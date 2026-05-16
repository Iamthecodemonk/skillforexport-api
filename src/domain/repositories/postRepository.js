// Repository interface for posts
export class PostRepository {
  constructor() {}
  async create(post) {
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

export class PostRepositoryImpl extends PostRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async create(post) {
    const created = await this.adapter.create(post);
    return created || null;
  }

  async findById(id, options = {}) {
    const row = await this.adapter.findById(id, options);
    return row || null;
  }

  async list(options = {}) {
    return this.adapter.list(options);
  }

  async countAll(options = {}) {
    return typeof this.adapter.countAll === 'function' ? this.adapter.countAll(options) : 0;
  }

  async update(id, updates) {
    return this.adapter.update(id, updates);
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
