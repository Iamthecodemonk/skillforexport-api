import db from '../knexConfig.js';

export default class MysqlFollowerRepository {
  async listFollowers(userId) {
    return db('followers').where({ following_id: userId }).orderBy('created_at', 'desc');
  }

  async listFollowing(userId) {
    return db('followers').where({ follower_id: userId }).orderBy('created_at', 'desc');
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, created_at: now };
    await db('followers').insert(payload);
    return db('followers').where({ id: record.id }).first();
  }

  async findByFollowerAndFollowing(followerId, followingId) {
    return db('followers').where({ follower_id: followerId, following_id: followingId }).first();
  }

  async deleteByFollowerAndFollowing(followerId, followingId) {
    // Attempt to find existing record first
    const existing = await db('followers').where({ follower_id: followerId, following_id: followingId }).first();
    if (!existing) return null;
    await db('followers').where({ id: existing.id }).del();
    return existing;
  }
}
