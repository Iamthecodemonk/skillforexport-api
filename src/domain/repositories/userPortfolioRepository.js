import UserPortfolio from '../../domain/entities/UserPortfolio.js';

export class UserPortfolioRepository {
  async listByUserId(userId) {
    throw new Error('listByUserId() not implemented');
  }
  async create(portfolio) {
    throw new Error('create() not implemented');
  }
  async delete(id) {
    throw new Error('delete() not implemented');
  }
}

export class UserPortfolioRepositoryImpl extends UserPortfolioRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async listByUserId(userId) {
    const rows = await this.adapter.listByUserId(userId);
    return rows.map(r => new UserPortfolio(r));
  }

  async create(portfolio) {
    const record = portfolio && portfolio.toRecord ? portfolio.toRecord() : portfolio;
    const created = await this.adapter.create(record);
    return created ? new UserPortfolio(created) : null;
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
