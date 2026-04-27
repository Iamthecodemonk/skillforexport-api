import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlAnswerRepository {
  async create(record) {
    const id = record.id || uuidv4();
    const now = new Date();
    await db('answers').insert({
      id,
      question_id: record.question_id || record.questionId,
      user_id: record.user_id || record.userId,
      parent_answer_id: record.parent_answer_id || record.parentAnswerId || null,
      content: record.content,
      created_at: now,
      updated_at: now
    });
    return db('answers').where({ id }).first();
  }

  async findById(id) {
    return db('answers').where({ id }).first();
  }

  async listByQuestion(questionId, { limit = 50, offset = 0 } = {}) {
    return db('answers').where({ question_id: questionId }).orderBy('created_at', 'asc').limit(limit).offset(offset);
  }

  async countByQuestion(questionId) {
    const row = await db('answers').where({ question_id: questionId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async delete(id) {
    await db('answers').where({ id }).del();
    return true;
  }
}
