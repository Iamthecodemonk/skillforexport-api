export class CommunityRepository {
  async findById(id) { throw new Error('findById() not implemented'); }
  async create(record) { throw new Error('create() not implemented'); }
  async update(id, updates) { throw new Error('update() not implemented'); }
  async delete(id) { throw new Error('delete() not implemented'); }
  async listByCategory(categoryId) { throw new Error('listByCategory() not implemented'); }
}

export class CommunityRepositoryImpl extends CommunityRepository {
  constructor({ adapter }) { 
    super(); 
    if (!adapter) 
        throw new Error('adapter is required'); this.adapter = adapter; }
  async findById(id) { 
    return this.adapter.findById(id); 
 }
  async create(record) { 
    return this.adapter.create(record); }
  async update(id, updates) { 
    return this.adapter.update(id, updates); }
  async delete(id) { 
    return this.adapter.delete(id); }
  async listByCategory(categoryId) { 
    return this.adapter.listByCategory(categoryId); }
}
