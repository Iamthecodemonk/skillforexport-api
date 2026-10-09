import db from '../knexConfig.js';

export default class MysqlAuthSessionRepository {
  async create(session) {
    await db('auth_sessions').insert(session);
  }

  async rotate({ oldHash, newHash, now, expiresAt }) {
    return db.transaction(async (trx) => {
      const session = await trx('auth_sessions')
        .where((query) => query.where({ token_hash: oldHash }).orWhere({ previous_token_hash: oldHash }))
        .forUpdate()
        .first();
      if (session && session.previous_token_hash === oldHash && !session.revoked_at) {
        await trx('auth_sessions').where({ id: session.id }).update({ revoked_at: now, updated_at: now });
        return null;
      }
      if (!session || session.revoked_at || new Date(session.expires_at) <= now) {
        return null;
      }
      await trx('auth_sessions').where({ id: session.id }).update({
        token_hash: newHash,
        previous_token_hash: oldHash,
        expires_at: expiresAt,
        updated_at: now
      });
      return session;
    });
  }

  async revoke(tokenHash, userId = null) {
    const query = db('auth_sessions').where({ token_hash: tokenHash });
    if (userId) query.andWhere({ user_id: userId });
    return query.whereNull('revoked_at').update({ revoked_at: new Date(), updated_at: new Date() });
  }

  async revokeAll(userId) {
    return db('auth_sessions').where({ user_id: userId }).whereNull('revoked_at')
      .update({ revoked_at: new Date(), updated_at: new Date() });
  }
}
