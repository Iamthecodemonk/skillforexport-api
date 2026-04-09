import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPostReactionRepository {
  async findByUserAndPost(userId, postId) {
    return await db('post_reactions').where({ user_id: userId, post_id: postId }).first();
  }

  async toggle({ user_id, post_id, type = 'like' }) {
    // default to 'like' when type omitted
    type = type || 'like';
    const existing = await this.findByUserAndPost(user_id, post_id);
    if (existing) {
      if (existing.type === type) {
        // toggle off
        await db('post_reactions').where({ id: existing.id }).del();
        return { action: 'removed' };
      }
      // change type
      await db('post_reactions').where({ id: existing.id }).update({ type });
      return { action: 'updated', type };
    }
    const id = uuidv4();
    const now = new Date();
    await db('post_reactions').insert({ id, user_id, post_id, type, created_at: now });
    return { action: 'created', id, type };
  }

  async countByPost(postId) {
    const rows = await db('post_reactions').where({ post_id: postId }).count('id as cnt');
    return (rows && rows[0] && rows[0].cnt) ? Number(rows[0].cnt) : 0;
  }

  async listByPost(postId) {
    const rows = await db('post_reactions').where({ post_id: postId }).select('*');
    return rows || [];
  }
}
