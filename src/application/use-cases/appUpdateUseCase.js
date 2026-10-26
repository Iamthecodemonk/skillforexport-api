const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function parseVersion(value) {
  if (typeof value !== 'string' || value.length > 32 || !versionPattern.test(value)) throw new Error('invalid_version');
  const parts = value.split('.').map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) throw new Error('invalid_version');
  return parts;
}

function validatePlatform(platform) {
  if (!['android', 'ios'].includes(platform)) throw new Error('invalid_platform');
}

function validateStoreUrl(platform, value) {
  let url;
  if (typeof value !== 'string' || value.length > 2048) throw new Error('invalid_store_url');
  try { url = new URL(value); } catch { throw new Error('invalid_store_url'); }
  const host = platform === 'android' ? 'play.google.com' : 'apps.apple.com';
  if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password) {
    throw new Error('invalid_store_url');
  }
  if (platform === 'android' && !url.pathname.startsWith('/store/apps/details')) throw new Error('invalid_store_url');
}

export class AppUpdateUseCase {
  constructor(repository) { this.repository = repository; }

  async check(platform, currentVersion) {
    validatePlatform(platform);
    parseVersion(currentVersion);
    const policy = await this.repository.find(platform);
    if (!policy || !policy.isPublished) throw new Error('update_policy_unavailable');
    const updateStatus = compareVersions(currentVersion, policy.minSupportedVersion) < 0 ? 'force'
      : compareVersions(currentVersion, policy.latestVersion) < 0 ? 'optional' : 'none';
    return { platform, current_version: currentVersion, latest_version: policy.latestVersion,
      min_supported_version: policy.minSupportedVersion, update_status: updateStatus,
      store_url: policy.storeUrl, release_notes: policy.releaseNotes,
      released_at: policy.releasedAt };
  }

  async list() {
    return this.repository.list();
  }

  async save(platform, input, actorId) {
    validatePlatform(platform);
    parseVersion(input.latestVersion);
    parseVersion(input.minSupportedVersion);
    if (compareVersions(input.minSupportedVersion, input.latestVersion) > 0) throw new Error('invalid_version_range');
    validateStoreUrl(platform, input.storeUrl);
    if (input.releaseNotes != null && (typeof input.releaseNotes !== 'string' || input.releaseNotes.length > 5000)) {
      throw new Error('invalid_release_notes');
    }
    if (input.isPublished && !input.releasedAt) throw new Error('release_date_required');
    const releasedAt = input.releasedAt ? new Date(input.releasedAt) : null;
    if (releasedAt && Number.isNaN(releasedAt.getTime())) throw new Error('invalid_release_date');
    return this.repository.save(platform, { ...input, releasedAt,
      releaseNotes: input.releaseNotes || null }, actorId);
  }
}
