import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommentReactionRepository {
  async findByUserAndComment(userId, commentId) {
    return await db('comment_reactions').where({ user_id: userId, comment_id: commentId }).first();
  }

  async toggle({ user_id, comment_id, type = 'like' }) {
    type = type || 'like';
    const existing = await this.findByUserAndComment(user_id, comment_id);
    if (existing) {
      if (existing.type === type) {
        await db('comment_reactions').where({ id: existing.id }).del();
        return { action: 'removed' };
      }
      await db('comment_reactions').where({ id: existing.id }).update({ type });
      return { action: 'updated', type };
    }
    const id = uuidv4();
    const now = new Date();
    await db('comment_reactions').insert({ id, user_id, comment_id, type, created_at: now });
    return { action: 'created', id, type };
  }

  async countByComment(commentId) {
    const rows = await db('comment_reactions').where({ comment_id: commentId }).count('id as cnt');
    return (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
  }

  async listByComment(commentId) {
    const rows = await db('comment_reactions').where({ comment_id: commentId }).select('*');
    return rows || [];
  }
}
