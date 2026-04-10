import db from '../knexConfig.js';

export default class MysqlUserProfileRepository {
  async findByUserId(userId) {
    return db('user_profiles').where({ user_id: userId }).first();
  }

  async findByUsername(username) {
    if (!username) return null;
    return db('user_profiles').where({ username }).first();
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, created_at: now };
    try {
      await db('user_profiles').insert(payload);
      return db('user_profiles').where({ id: record.id }).first();
    } catch (err) {
      // Convert duplicate entry to a domain-friendly error so callers can handle it
      if (err && err.code === 'ER_DUP_ENTRY') {
        throw new Error('profile_already_exists');
      }
      throw err;
    }
  }

  async update(id, patch) {
    const now = new Date();
    await db('user_profiles').where({ id }).update({ ...patch, updated_at: now });
    return db('user_profiles').where({ id }).first();
  }
}
