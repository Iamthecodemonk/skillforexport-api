import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlQuestionReactionRepository {
  async findByUserAndQuestion(userId, questionId) {
    return db('question_reactions').where({ user_id: userId, question_id: questionId }).first();
  }

  async toggle({ user_id, question_id, type = 'like' }) {
    type = type || 'like';
    const existing = await this.findByUserAndQuestion(user_id, question_id);
    if (existing) {
      if (existing.type === type) {
        await db('question_reactions').where({ id: existing.id }).del();
        return { action: 'removed' };
      }
      await db('question_reactions').where({ id: existing.id }).update({ type });
      return { action: 'updated', type };
    }
    const id = uuidv4();
    await db('question_reactions').insert({ id, user_id, question_id, type, created_at: new Date() });
    return { action: 'created', id, type };
  }

  async countByQuestion(questionId) {
    const rows = await db('question_reactions').where({ question_id: questionId }).count('id as cnt');
    return rows && rows[0] && rows[0].cnt ? Number(rows[0].cnt) : 0;
  }
}
