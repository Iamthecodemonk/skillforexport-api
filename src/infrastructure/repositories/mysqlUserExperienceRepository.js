import db from '../knexConfig.js';
import UserExperience from '../../domain/entities/UserExperience.js';

export default class MysqlUserExperienceRepository {
  constructor() {}

  async listByUserId(userId) {
    const rows = await db('user_experiences').where({ user_id: userId }).orderBy('start_date', 'desc');
    return rows.map(r => new UserExperience({ id: r.id, userId: r.user_id, company: r.company, title: r.title, employmentType: r.employment_type, startDate: r.start_date, endDate: r.end_date, isCurrent: r.is_current, description: r.description, createdAt: r.created_at }));
  }

  async create(exp) {
    const record = exp.toRecord ? exp.toRecord() : exp;
    await db('user_experiences').insert(record);
    return exp;
  }

  async delete(id) {
    await db('user_experiences').where({ id }).del();
    return true;
  }
}
