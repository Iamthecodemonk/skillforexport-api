import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlQuestionRepository {
  async create(record) {
    const id = record.id || uuidv4();
    const now = new Date();
    await db('questions').insert({
      id,
      user_id: record.user_id || record.userId,
      community_id: record.community_id || record.communityId,
      title: record.title,
      body: record.body,
      visibility: record.visibility || 'public',
      is_closed: typeof record.is_closed !== 'undefined' ? record.is_closed : 0,
      accepted_answer_id: record.accepted_answer_id || record.acceptedAnswerId || null,
      created_at: now,
      updated_at: now
    });
    return db('questions').where({ id }).first();
  }

  async findById(id) {
    return db('questions').where({ id }).first();
  }

  async list({ limit = 20, offset = 0 } = {}) {
    return db('questions').orderBy('created_at', 'desc').limit(limit).offset(offset);
  }

  async countAll() {
    const row = await db('questions').count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async update(id, patch) {
    const now = new Date();
    await db('questions').where({ id }).update({ ...patch, updated_at: now });
    return db('questions').where({ id }).first();
  }

  async delete(id) {
    await db('questions').where({ id }).del();
    return true;
  }
}
