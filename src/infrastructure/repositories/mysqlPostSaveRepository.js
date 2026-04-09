import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPostSaveRepository {
  async findByUserAndPost(userId, postId) {
    return await db('post_saves').where({ user_id: userId, post_id: postId }).first();
  }

  async toggle({ user_id, post_id }) {
    const existing = await this.findByUserAndPost(user_id, post_id);
    if (existing) {
      await db('post_saves').where({ id: existing.id }).del();
      return { action: 'removed' };
    }
    const id = uuidv4();
    const now = new Date();
    await db('post_saves').insert({ id, user_id, post_id, created_at: now });
    return { action: 'created', id };
  }

  async listByUser(userId, { limit = 50, offset = 0 } = {}) {
    const rows = await db('post_saves').where({ user_id: userId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
    return rows || [];
  }
}
