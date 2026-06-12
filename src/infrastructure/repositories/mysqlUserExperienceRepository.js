import db from '../knexConfig.js';
import UserExperience from '../../domain/entities/UserExperience.js';
import { formatDateForSql } from '../../utils/date.js';

export default class MysqlUserExperienceRepository {
  constructor() {}

  async listByUserId(userId) {
    const rows = await db('user_experiences').where({ user_id: userId }).orderBy('start_date', 'desc');
    return rows.map(r => new UserExperience({ 
      id: r.id, 
      userId: r.user_id, 
      company: r.company, 
      title: r.title, 
      employmentType: r.employment_type, 
      startDate: r.start_date, 
      endDate: r.end_date, 
      isCurrent: r.is_current, 
      description: r.description, 
      createdAt: r.created_at 
    }));
  }

  async create(exp) {
    const source = exp.toRecord ? exp.toRecord() : exp;
    const record = { ...source };
    // Normalize date fields to YYYY-MM-DD
    if (typeof record.startDate !== 'undefined' || typeof record.start_date !== 'undefined') {
      record.start_date = formatDateForSql(record.startDate || record.start_date || null);
      delete record.startDate;
    }
    if (typeof record.endDate !== 'undefined' || typeof record.end_date !== 'undefined') {
      record.end_date = formatDateForSql(record.endDate || record.end_date || null);
      delete record.endDate;
    }
    await db('user_experiences').insert(record);
    return exp;
  }

  async delete(id) {
    await db('user_experiences').where({ id }).del();
    return true;
  }
}
