import UserSkill from '../../domain/entities/UserSkill.js';

export class UserSkillRepository {
  async listByUserId(userId) {
    throw new Error('listByUserId() not implemented');
  }
  async create(skill) {
    throw new Error('create() not implemented');
  }
  async delete(id) {
    throw new Error('delete() not implemented');
  }
}

export class UserSkillRepositoryImpl extends UserSkillRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) 
        throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async listByUserId(userId) {
    const rows = await this.adapter.listByUserId(userId);
    return rows.map(r => new UserSkill(r));
  }

  async create(skill) {
    const record = skill && skill.toRecord ? skill.toRecord() : skill;
    const created = await this.adapter.create(record);
    return created ? new UserSkill(created) : null;
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
