import db from '../knexConfig.js';
import UserEducation from '../../domain/entities/UserEducation.js';

export default class MysqlUserEducationRepository {
  constructor() {}

  async listByUserId(userId) {
    const rows = await db('user_education').where({ user_id: userId }).orderBy('start_date', 'desc');
    return rows.map(r => new UserEducation({ id: r.id, userId: r.user_id, school: r.school, degree: r.degree, field: r.field, startDate: r.start_date, endDate: r.end_date, createdAt: r.created_at }));
  }

  async create(edu) {
    const record = edu.toRecord ? edu.toRecord() : edu;
    await db('user_education').insert(record);
    return edu;
  }

  async delete(id) {
    await db('user_education').where({ id }).del();
    return true;
  }
}
