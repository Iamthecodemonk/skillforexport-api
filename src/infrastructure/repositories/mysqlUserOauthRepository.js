import db from '../knexConfig.js';

export default class MysqlUserOauthRepository {
  async findByProvider(provider, providerId) {
    return db('user_oauth_accounts').where({ provider, provider_id: providerId }).first();
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, created_at: now, updated_at: now };
    await db('user_oauth_accounts').insert(payload);
    return db('user_oauth_accounts').where({ id: record.id }).first();
  }
}
