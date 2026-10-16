import assert from 'node:assert/strict';
import test from 'node:test';
import UserUseCase from '../src/application/use-cases/userUseCase.js';
import { makeUserController } from '../src/interfaces/controllers/userController.js';
import { UserRepositoryImpl } from '../src/domain/repositories/userRepository.js';

function replyStub() {
  return {
    status: 200,
    code(status) { this.status = status; return this; },
    send(body) { this.body = body; return this; }
  };
}

test('public user creation refuses an admin role', async () => {
  let created = false;
  const controller = makeUserController({
    useCase: { createUser: async () => { created = true; } }
  });
  const reply = replyStub();
  await controller.createUser({ body: { email: 'admin@example.com', password: 'password1', role: 'admin' } }, reply);
  assert.equal(reply.status, 403);
  assert.equal(created, false);
});

test('only a granted superadmin can create an admin', async () => {
  let grant = false;
  const saved = [];
  const useCase = new UserUseCase({
    userRepository: {
      isSuperAdmin: async () => grant,
      findByEmail: async () => null,
      create: async (user) => { saved.push(user); return user; }
    }
  });
  const actor = { id: 'admin-1', role: 'admin' };
  await assert.rejects(useCase.createAdminUser(actor, { email: 'new@example.com', password: 'password1' }), /forbidden/);
  assert.equal(saved.length, 0);
  grant = true;
  const created = await useCase.createAdminUser(actor, { email: 'new@example.com', password: 'password1' });
  assert.equal(created.role, 'admin');
  assert.equal(saved.length, 1);
});

test('regular admins cannot grant superadmin access', async () => {
  let granted = false;
  const useCase = new UserUseCase({
    userRepository: {
      isSuperAdmin: async () => false,
      grantSuperAdmin: async () => { granted = true; return true; }
    }
  });
  const actor = { id: 'admin-1', role: 'admin' };
  assert.deepEqual(await useCase.getAdminAccess(actor), { isAdmin: true, isSuperAdmin: false });
  await assert.rejects(useCase.grantSuperAdmin(actor, 'admin-2'), /forbidden/);
  assert.equal(granted, false);
});

test('admin account methods reach the persistence adapter through the repository', async () => {
  const calls = [];
  const repository = new UserRepositoryImpl({ adapter: {
    isSuperAdmin: async (id) => { calls.push(['check', id]); return true; },
    listAdminUsers: async () => [{ id: 'admin-1' }],
    grantSuperAdmin: async (id, actorId) => { calls.push(['grant', id, actorId]); return true; }
  } });
  const useCase = new UserUseCase({ userRepository: repository });
  const actor = { id: 'admin-1', role: 'admin' };

  assert.deepEqual(await useCase.getAdminAccess(actor), { isAdmin: true, isSuperAdmin: true });
  assert.deepEqual(await useCase.listAdminUsers(actor), [{ id: 'admin-1', isSuperAdmin: false }]);
  assert.deepEqual(await useCase.grantSuperAdmin(actor, 'admin-2'), { id: 'admin-2', isSuperAdmin: true });
  assert.deepEqual(calls, [
    ['check', 'admin-1'], ['check', 'admin-1'], ['check', 'admin-1'], ['grant', 'admin-2', 'admin-1']
  ]);
});
