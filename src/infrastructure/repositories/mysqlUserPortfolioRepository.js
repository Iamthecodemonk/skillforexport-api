import db from '../knexConfig.js';

export default class MysqlUserPortfolioRepository {
  async listByUserId(userId) {
    return db('user_portfolios').where({ user_id: userId }).orderBy('id', 'asc');
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, created_at: now };
    await db('user_portfolios').insert(payload);
    return db('user_portfolios').where({ id: record.id }).first();
  }

  async delete(id) {
    return db('user_portfolios').where({ id }).del();
  }
}
