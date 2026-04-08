import UserOauthAccount from '../../domain/entities/UserOauthAccount.js';

export class UserOauthRepository {
  async findByProvider(provider, providerId) {
    throw new Error('findByProvider() not implemented');
  }
  async create(account) {
    throw new Error('create() not implemented');
  }
}

export class UserOauthRepositoryImpl extends UserOauthRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async findByProvider(provider, providerId) {
    const row = await this.adapter.findByProvider(provider, providerId);
    return row ? new UserOauthAccount(row) : null;
  }

  async create(account) {
    const record = account && account.toRecord ? account.toRecord() : account;
    const created = await this.adapter.create(record);
    return created ? new UserOauthAccount(created) : null;
  }
}
