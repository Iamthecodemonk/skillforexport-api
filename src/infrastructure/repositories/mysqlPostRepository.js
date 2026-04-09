import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPostRepository {
  async create(post) {
    const id = post.id || uuidv4();
    const now = new Date();
    await db('posts').insert({
      id,
      user_id: post.user_id || post.userId,
      community_id: post.community_id || post.communityId || null,
      content: post.content,
      created_at: now,
      updated_at: now
    });
    return { id, user_id: post.user_id || post.userId, community_id: post.community_id || post.communityId || null, content: post.content, created_at: now, updated_at: now };
  }

  async findById(id) {
    const row = await db('posts').where({ id }).first();
    return row || null;
  }

  async list({ limit = 20, offset = 0 } = {}) {
    const rows = await db('posts').orderBy('created_at', 'desc').limit(limit).offset(offset);
    return rows || [];
  }

  async update(id, updates) {
    const now = new Date();
    const payload = {};
    if (typeof updates.content !== 'undefined') 
        payload.content = updates.content;
    if (typeof updates.community_id !== 'undefined') 
        payload.community_id = updates.community_id;
    if (Object.keys(payload).length === 0) return null;
    payload.updated_at = now;
    await db('posts').where({ id }).update(payload);
    return this.findById(id);
  }

  async delete(id) {
    await db('posts').where({ id }).del();
    return true;
  }
}
