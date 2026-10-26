import db from '../knexConfig.js';

const columns = {
  latestVersion: 'latest_version', minSupportedVersion: 'min_supported_version',
  storeUrl: 'store_url', releaseNotes: 'release_notes', releasedAt: 'released_at',
  isPublished: 'is_published', updatedBy: 'updated_by', updatedAt: 'updated_at'
};

function mapPolicy(row) {
  if (!row) return null;
  return { platform: row.platform, latestVersion: row.latest_version,
    minSupportedVersion: row.min_supported_version, storeUrl: row.store_url,
    releaseNotes: row.release_notes, releasedAt: row.released_at,
    isPublished: Boolean(row.is_published), updatedBy: row.updated_by,
    updatedAt: row.updated_at };
}

export default class MysqlAppUpdateRepository {
  async find(platform) {
    return mapPolicy(await db('app_update_policies').where({ platform }).first());
  }

  async list() {
    return (await db('app_update_policies').orderBy('platform')).map(mapPolicy);
  }

  async save(platform, input, actorId) {
    const row = { platform, updated_by: actorId, updated_at: new Date() };
    for (const [key, column] of Object.entries(columns)) {
      if (Object.hasOwn(input, key)) row[column] = input[key];
    }
    await db('app_update_policies').insert(row).onConflict('platform').merge(row);
    return this.find(platform);
  }
}
