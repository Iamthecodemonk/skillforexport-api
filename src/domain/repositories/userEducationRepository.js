import UserEducation from '../../domain/entities/UserEducation.js';

export class UserEducationRepository {
  async listByUserId(userId) { throw new Error('listByUserId() not implemented'); }
  async create(edu) { throw new Error('create() not implemented'); }
  async delete(id) { throw new Error('delete() not implemented'); }
}

export class UserEducationRepositoryImpl extends UserEducationRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async listByUserId(userId) {
    const rows = await this.adapter.listByUserId(userId);
    return rows.map(r => new UserEducation(r));
  }

  async create(edu) {
    const record = edu && edu.toRecord ? edu.toRecord() : edu;
    const created = await this.adapter.create(record);
    return created ? new UserEducation(created) : null;
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
