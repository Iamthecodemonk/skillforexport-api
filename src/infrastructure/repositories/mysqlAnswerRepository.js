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
    const rows = await db('answers as a')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .where('a.question_id', questionId)
      .orderBy('a.created_at', 'asc')
      .limit(limit)
      .offset(offset)
      .select('a.*', 'u.email as answerer_email', 'up.username as answerer_name');

    return rows.map(({ answerer_email, answerer_name, ...answer }) => ({
      ...answer,
      user: {
        id: answer.user_id,
        name: answerer_name || null,
        email: answerer_email || null
      }
    }));
  }

  async countByQuestion(questionId) {
    const row = await db('answers').where({ question_id: questionId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countDistinctAnswerersByQuestion(questionId) {
    const row = await db('answers').where({ question_id: questionId }).countDistinct({ cnt: 'user_id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async delete(id) {
    await db('answers').where({ id }).del();
    return true;
  }
}
