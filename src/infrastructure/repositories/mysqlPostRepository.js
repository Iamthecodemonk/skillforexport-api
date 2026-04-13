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
      page_id: post.page_id || post.pageId || null,
      visibility: post.visibility || post.visibility || 'public',
      title: post.title || post.title || null,
      content: post.content,
      created_at: now,
      updated_at: now
    });
    return { id, user_id: post.user_id || post.userId, community_id: post.community_id || post.communityId || null, page_id: post.page_id || post.pageId || null, visibility: post.visibility || 'public', title: post.title || null, content: post.content, created_at: now, updated_at: now };
  }

  async findById(id) {
    const row = await db('posts').where({ id }).first();
    return row || null;
  }

  async list({ limit = 20, offset = 0, lastCreatedAt = null, lastId = null } = {}) {
    const q = db('posts').orderBy('created_at', 'desc').orderBy('id', 'desc').limit(limit);
    if (lastCreatedAt) {
      // keyset pagination: created_at < lastCreatedAt OR (created_at = lastCreatedAt AND id < lastId)
      q.where(function () {
        this.where('created_at', '<', lastCreatedAt);
        if (lastId) this.orWhere(function () { this.where('created_at', '=', lastCreatedAt).andWhere('id', '<', lastId); });
      });
    } else if (offset) {
      q.offset(offset);
    }
    const rows = await q;
    return rows || [];
  }

  async listByPage(pageId, { limit = 20, offset = 0, lastCreatedAt = null, lastId = null } = {}) {
    const q = db('posts').where({ page_id: pageId }).orderBy('created_at', 'desc').orderBy('id', 'desc').limit(limit);
    if (lastCreatedAt) {
      q.andWhere(function () {
        this.where('created_at', '<', lastCreatedAt);
        if (lastId) this.orWhere(function () { this.where('created_at', '=', lastCreatedAt).andWhere('id', '<', lastId); });
      });
    } else if (offset) {
      q.offset(offset);
    }
    const rows = await q;
    return rows || [];
  }

  async update(id, updates) {
    const now = new Date();
    const payload = {};
    if (typeof updates.title !== 'undefined')
      payload.title = updates.title;
    if (typeof updates.content !== 'undefined') 
      payload.content = updates.content;
    if (typeof updates.community_id !== 'undefined') 
        payload.community_id = updates.community_id;
    if (typeof updates.page_id !== 'undefined')
        payload.page_id = updates.page_id;
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
