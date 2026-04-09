import db from '../knexConfig.js';

export default class MysqlPasswordResetRepository {
  async create({ id, userId, tokenHash, expiresAt, ipAddress = null, userAgent = null }) {
    const now = new Date();
    await db('password_resets').insert({
      id,
      user_id: userId,
      token_hash: tokenHash,
      is_used: false,
      expires_at: expiresAt,
      created_at: now,
      ip_address: ipAddress,
      user_agent: userAgent
    });
    return { id, user_id: userId };
  }

  async findValidByHash(tokenHash) {
    const now = new Date();
    const row = await db('password_resets')
      .where({ token_hash: tokenHash, is_used: false })
      .where('expires_at', '>', now)
      .orderBy('created_at', 'desc')
      .first();
    return row || null;
  }

  async markUsed(id) {
    const now = new Date();
    await db('password_resets').where({ id }).update({ is_used: true, used_at: now });
    return { id, is_used: true, used_at: now };
  }

  async deleteExpired(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
    const deleted = await db('password_resets').where('created_at', '<', cutoff).andWhere('is_used', true).del();
    return deleted;
  }
}
