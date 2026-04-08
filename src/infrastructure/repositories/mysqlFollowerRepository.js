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
}
