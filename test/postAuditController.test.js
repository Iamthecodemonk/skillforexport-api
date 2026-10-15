import assert from 'node:assert/strict';
import test from 'node:test';
import { makePostAuditController } from '../src/interfaces/controllers/postAuditController.js';

function replyStub() {
  return {
    status: 200,
    code(status) { this.status = status; return this; },
    send(body) { this.body = body; return this; }
  };
}

test('only superadmins can configure audit units', async () => {
  let created = false;
  const controller = makePostAuditController({
    userRepository: { isSuperAdmin: async () => false },
    repository: { createUnit: async () => { created = true; } }
  });
  const reply = replyStub();
  await controller.createAuditUnit({ user: { id: 'admin-1', role: 'admin' }, body: { name: 'Unit A' } }, reply);
  assert.equal(reply.status, 403);
  assert.equal(created, false);
});

test('an admin can checkpoint only the selected unit through its assignment', async () => {
  const calls = [];
  const controller = makePostAuditController({
    userRepository: { isSuperAdmin: async () => false },
    repository: {
      findUnit: async (id) => id === 'unit-a' ? { id } : null,
      checkpoint: async (...args) => { calls.push(args); return { checkedCount: 2 }; }
    }
  });
  const reply = replyStub();
  await controller.checkpointAuditUnit({
    user: { id: 'admin-1', role: 'admin' }, params: { id: 'unit-a' },
    body: { throughAssignmentId: 'assignment-1' }
  }, reply);
  assert.deepEqual(calls, [['unit-a', 'admin-1', 'assignment-1']]);
  assert.equal(reply.body.data.checkedCount, 2);
});

test('a superadmin can replace an item assignment with multiple units', async () => {
  const calls = [];
  const controller = makePostAuditController({
    userRepository: { isSuperAdmin: async () => true },
    repository: {
      assignItem: async (...args) => { calls.push(args); return [{ id: 'assignment-1' }]; }
    }
  });
  const reply = replyStub();
  await controller.assignAuditItem({
    user: { id: 'super-1', role: 'admin' }, params: { type: 'post', id: 'post-1' },
    body: { unitIds: ['unit-a', 'unit-b'], replace: true }
  }, reply);
  assert.deepEqual(calls, [['post', 'post-1', ['unit-a', 'unit-b'], true]]);
  assert.equal(reply.body.data.assignments.length, 1);
});
