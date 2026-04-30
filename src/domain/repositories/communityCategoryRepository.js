export class CommunityCategoryRepository {
  async findById(id) { throw new Error('findById() not implemented'); }
  async findByName(name) { throw new Error('findByName() not implemented'); }
  async create(record) { throw new Error('create() not implemented'); }
  async update(id, updates) { throw new Error('update() not implemented'); }
  async delete(id) { throw new Error('delete() not implemented'); }
  async listAll() { throw new Error('listAll() not implemented'); }
}

export class CommunityCategoryRepositoryImpl extends CommunityCategoryRepository {
  constructor({ adapter }) { 
    super(); 
    if (!adapter) 
        throw new Error('adapter is required'); 
    this.adapter = adapter; }
  async findById(id) { 
    return this.adapter.findById(id); 
  }
  async findByName(name) { 
    return this.adapter.findByName(name); 
  }
  async create(record) { 
    return this.adapter.create(record); 
  }
  async update(id, updates) { 
    return this.adapter.update(id, updates); 
  }
  async delete(id) { 
    return this.adapter.delete(id); 
  }
  async listAll() {
    if (typeof this.adapter.listAll === 'function') {
      return this.adapter.listAll();
    }
    return [];
  }
}
