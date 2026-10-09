import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import AuthUseCase from '../src/application/use-cases/authUseCase.js';

function setup() {
  const user = { id: 'user-1', email: 'user@example.com', tokenVersion: 0 };
  const sessions = new Map();
  const sessionRepository = {
    async create(session) {
      sessions.set(session.id, { ...session });
    },
    async rotate({ oldHash, newHash, now, expiresAt }) {
      const session = [...sessions.values()].find((item) => item.token_hash === oldHash || item.previous_token_hash === oldHash);
      if (!session || session.revoked_at) return null;
      if (session.previous_token_hash === oldHash) {
        session.revoked_at = now;
        return null;
      }
      if (session.expires_at <= now) return null;
      session.previous_token_hash = oldHash;
      session.token_hash = newHash;
      session.expires_at = expiresAt;
      return { ...session };
    },
    async revoke(tokenHash) {
      const session = [...sessions.values()].find((item) => item.token_hash === tokenHash);
      if (!session || session.revoked_at) return 0;
      session.revoked_at = new Date();
      return 1;
    }
  };
  const useCase = new AuthUseCase({
    userRepository: { findById: async () => user },
    authSessionRepository: sessionRepository,
    jwtSecret: 'remember-me-test-secret'
  });
  return { user, useCase, sessionRepository, sessions };
}

test('remembered session rotates and rejects reuse', async () => {
  const { user, useCase, sessions } = setup();
  const first = await useCase.createRememberedSession(user);
  assert.equal(jwt.verify(first.token, useCase.jwtSecret).sub, user.id);
  assert.equal([...sessions.values()][0].token_hash, useCase.sessionTokenHash(first.refreshToken));
  assert.notEqual([...sessions.values()][0].token_hash, first.refreshToken);
  const second = await useCase.refreshRememberedSession(first.refreshToken);
  assert.notEqual(second.refreshToken, first.refreshToken);
  await assert.rejects(useCase.refreshRememberedSession(first.refreshToken), /invalid_refresh_token/);
  await assert.rejects(useCase.refreshRememberedSession(second.refreshToken), /invalid_refresh_token/);
});

test('remembered session stops working after password token version changes', async () => {
  const { user, useCase } = setup();
  const first = await useCase.createRememberedSession(user);
  user.tokenVersion += 1;
  await assert.rejects(useCase.refreshRememberedSession(first.refreshToken), /invalid_refresh_token/);
});
