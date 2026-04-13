// Repository interface for page followers
export class PageFollowerRepository {
  constructor() {}
  async create(record) {
    throw new Error('create() not implemented');
  }
  async deleteByPageAndUser(pageId, userId) {
    throw new Error('deleteByPageAndUser() not implemented');
  }
  async listByPage(pageId, { limit, offset } = {}) {
    throw new Error('listByPage() not implemented');
  }
  async findByPageAndUser(pageId, userId) {
    throw new Error('findByPageAndUser() not implemented');
  }
}

export class PageFollowerRepositoryImpl extends PageFollowerRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async create(record) {
    return this.adapter.create(record);
  }

  async deleteByPageAndUser(pageId, userId) {
    return this.adapter.deleteByPageAndUser(pageId, userId);
  }

  async listByPage(pageId, { limit = 50, offset = 0 } = {}) {
    return this.adapter.listByPage(pageId, { limit, offset });
  }
  async findByPageAndUser(pageId, userId) {
    if (typeof this.adapter.findByPageAndUser === 'function') {
      return this.adapter.findByPageAndUser(pageId, userId);
    }
    return null;
  }
}
