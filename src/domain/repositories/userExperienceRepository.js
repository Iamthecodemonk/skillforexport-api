import UserExperience from '../../domain/entities/UserExperience.js';

export class UserExperienceRepository {
  async listByUserId(userId) { throw new Error('listByUserId() not implemented'); }
  async create(exp) { throw new Error('create() not implemented'); }
  async delete(id) { throw new Error('delete() not implemented'); }
}

export class UserExperienceRepositoryImpl extends UserExperienceRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async listByUserId(userId) {
    const rows = await this.adapter.listByUserId(userId);
    return rows.map(r => new UserExperience(r));
  }

  async create(exp) {
    const record = exp && exp.toRecord ? exp.toRecord() : exp;
    const created = await this.adapter.create(record);
    return created ? new UserExperience(created) : null;
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
