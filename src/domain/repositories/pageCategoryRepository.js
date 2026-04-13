// Repository interface for page categories
export class PageCategoryRepository {
  constructor() {}
  async findById(id) {
    throw new Error('findById() not implemented');
  }
  async create(record) {
    throw new Error('create() not implemented');
  }
  async findByName(name) {
    throw new Error('findByName() not implemented');
  }
}

export class PageCategoryRepositoryImpl extends PageCategoryRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async findById(id) {
    return this.adapter.findById(id);
  }
  async create(record) {
    return this.adapter.create(record);
  }
  async findByName(name) {
    if (typeof this.adapter.findByName === 'function') return this.adapter.findByName(name);
    return null;
  }
  async update(id, updates) {
    if (typeof this.adapter.update === 'function') return this.adapter.update(id, updates);
    throw new Error('not_implemented');
  }
  async delete(id) {
    if (typeof this.adapter.delete === 'function') return this.adapter.delete(id);
    throw new Error('not_implemented');
  }
}
