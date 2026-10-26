import assert from 'node:assert/strict';
import test from 'node:test';
import { AppUpdateUseCase, compareVersions } from '../src/application/use-cases/appUpdateUseCase.js';
import { makeAppUpdateController } from '../src/interfaces/controllers/appUpdateController.js';

function replyStub() {
  return { status: 200, code(status) { this.status = status; return this; },
    send(body) { this.body = body; return this; } };
}

test('versions compare numerically, including double-digit components', () => {
  assert.equal(compareVersions('2.10.0', '2.9.0'), 1);
  assert.equal(compareVersions('2.4.0', '2.4.0'), 0);
  assert.throws(() => compareVersions('2.4', '2.4.0'), /invalid_version/);
});

test('published policies yield none, optional, and force', async () => {
  const useCase = new AppUpdateUseCase({ find: async () => ({ isPublished: true,
    latestVersion: '2.5.0', minSupportedVersion: '2.4.0', storeUrl: 'https://play.google.com/store/apps/details?id=example',
    releaseNotes: 'Updates', releasedAt: new Date('2026-10-15T09:00:00Z') }) });
  assert.equal((await useCase.check('android', '2.5.0')).update_status, 'none');
  assert.equal((await useCase.check('android', '2.4.0')).update_status, 'optional');
  assert.equal((await useCase.check('android', '2.3.1')).update_status, 'force');
});

test('unpublished policies are not exposed to the public', async () => {
  const useCase = new AppUpdateUseCase({ find: async () => ({ isPublished: false }) });
  await assert.rejects(useCase.check('ios', '1.0.0'), /update_policy_unavailable/);
});

test('admin save validates version ranges, stores, and publication', async () => {
  let saved;
  const useCase = new AppUpdateUseCase({ save: async (_, row) => { saved = row; return row; } });
  const input = { latestVersion: '2.5.0', minSupportedVersion: '2.4.0',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
    isPublished: true, releasedAt: '2026-10-15T09:00:00Z' };
  await useCase.save('android', input, 'admin-id');
  assert.ok(saved.releasedAt instanceof Date);
  await assert.rejects(useCase.save('android', { ...input, minSupportedVersion: '2.6.0' }, 'admin-id'), /invalid_version_range/);
  await assert.rejects(useCase.save('android', { ...input, storeUrl: 'https://evil.example/store/apps/details' }, 'admin-id'), /invalid_store_url/);
  await assert.rejects(useCase.save('android', { ...input, releasedAt: null }, 'admin-id'), /release_date_required/);
});

test('public checks require no authentication; policy editing requires superadmin', async () => {
  const repository = { find: async () => null, list: async () => [] };
  const controller = makeAppUpdateController({ repository, userRepository: { isSuperAdmin: async () => false } });
  const publicReply = replyStub();
  await controller.checkAppUpdate({ query: { platform: 'android', current_version: '1.0.0' } }, publicReply);
  assert.equal(publicReply.status, 404);
  const adminReply = replyStub();
  await controller.listAppUpdatePolicies({ user: { id: 'admin-id', role: 'admin' } }, adminReply);
  assert.equal(adminReply.status, 403);
});
