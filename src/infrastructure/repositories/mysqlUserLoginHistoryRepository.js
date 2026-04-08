import db from '../knexConfig.js';

export default class MysqlUserLoginHistoryRepository {
  async listByUserId(userId) {
    return db('user_login_history').where({ user_id: userId }).orderBy('login_at', 'desc');
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, login_at: record.login_at || now };
    await db('user_login_history').insert(payload);
    return db('user_login_history').where({ id: record.id }).first();
  }
}
