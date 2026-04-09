import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommentRepository {
  async create(comment) {
    const id = comment.id || uuidv4();
    const now = new Date();
    await db('comments').insert({
      id,
      post_id: comment.post_id || comment.postId,
      user_id: comment.user_id || comment.userId,
      parent_comment_id: comment.parent_comment_id || comment.parentCommentId || null,
      content: comment.content,
      created_at: now,
      updated_at: now
    });
    return { id, post_id: comment.post_id || comment.postId, user_id: comment.user_id || comment.userId, parent_comment_id: comment.parent_comment_id || comment.parentCommentId || null, content: comment.content, created_at: now, updated_at: now };
  }

  async findById(id) {
    const row = await db('comments').where({ id }).first();
    return row || null;
  }

  async listByPost(postId, { limit = 50, offset = 0 } = {}) {
    const rows = await db('comments').where({ post_id: postId }).orderBy('created_at', 'asc').limit(limit).offset(offset);
    return rows || [];
  }

  async update(id, updates) {
    const now = new Date();
    const payload = {};
    if (typeof updates.content !== 'undefined') payload.content = updates.content;
    if (Object.keys(payload).length === 0) return null;
    payload.updated_at = now;
    await db('comments').where({ id }).update(payload);
    return this.findById(id);
  }

  async delete(id) {
    await db('comments').where({ id }).del();
    return true;
  }
}
