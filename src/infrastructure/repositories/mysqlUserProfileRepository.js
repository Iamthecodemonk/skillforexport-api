import db from '../knexConfig.js';

export default class MysqlUserProfileRepository {
  async findByUserId(userId) {
    return db('user_profiles').where({ user_id: userId }).first();
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, created_at: now };
    await db('user_profiles').insert(payload);
    return db('user_profiles').where({ id: record.id }).first();
  }

  async update(id, patch) {
    const now = new Date();
    await db('user_profiles').where({ id }).update({ ...patch, updated_at: now });
    return db('user_profiles').where({ id }).first();
  }
}
