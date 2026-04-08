import UserLoginHistory from '../../domain/entities/UserLoginHistory.js';

export class UserLoginHistoryRepository {
  async listByUserId(userId) {
    throw new Error('listByUserId() not implemented');
  }
  async create(entry) {
    throw new Error('create() not implemented');
  }
}

export class UserLoginHistoryRepositoryImpl extends UserLoginHistoryRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async listByUserId(userId) {
    const rows = await this.adapter.listByUserId(userId);
    return rows.map(r => new UserLoginHistory(r));
  }

  async create(entry) {
    const record = entry && entry.toRecord ? entry.toRecord() : entry;
    const created = await this.adapter.create(record);
    return created ? new UserLoginHistory(created) : null;
  }
}
