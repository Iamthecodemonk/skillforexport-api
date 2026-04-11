// Repository interface for pages
export class PageRepository {
  constructor() {}
  async create(page) {
    throw new Error('create() not implemented');
  }
  async findById(id) {
    throw new Error('findById() not implemented');
  }
  async list({ limit, offset } = {}) {
    throw new Error('list() not implemented');
  }
  async update(id, updates) {
    throw new Error('update() not implemented');
  }
  async delete(id) {
    throw new Error('delete() not implemented');
  }
}

export class PageRepositoryImpl extends PageRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async create(page) {
    return this.adapter.create(page);
  }

  async findById(id) {
    return this.adapter.findById(id);
  }

  async findByName(name) {
    if (typeof this.adapter.findByName !== 'function') throw new Error('findByName_not_implemented');
    return this.adapter.findByName(name);
  }

  async list({ limit = 20, offset = 0 } = {}) {
    return this.adapter.list({ limit, offset });
  }

  async update(id, updates) {
    return this.adapter.update(id, updates);
  }

  async delete(id) {
    return this.adapter.delete(id);
  }

  async countByOwnerAndCategory(ownerId, categoryId) {
    if (typeof this.adapter.countByOwnerAndCategory !== 'function') throw new Error('count_not_implemented');
    return this.adapter.countByOwnerAndCategory(ownerId, categoryId);
  }

  async incrementPostCount(pageId, delta = 1) {
    if (typeof this.adapter.incrementPostCount !== 'function') throw new Error('increment_post_count_not_implemented');
    return this.adapter.incrementPostCount(pageId, delta);
  }
}
