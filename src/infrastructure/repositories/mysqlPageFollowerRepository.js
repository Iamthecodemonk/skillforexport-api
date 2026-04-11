import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPageFollowerRepository {
  async create(record) {
    const id = record.id || uuidv4();
    const now = new Date();
    await db('page_followers').insert({
      id,
      page_id: record.page_id || record.pageId,
      user_id: record.user_id || record.userId,
      role: record.role || 'follower',
      is_notified: typeof record.is_notified !== 'undefined' ? record.is_notified : 1,
      is_muted: typeof record.is_muted !== 'undefined' ? record.is_muted : 0,
      created_at: now,
      updated_at: now
    });
    return { id, page_id: record.page_id || record.pageId, user_id: record.user_id || record.userId, role: record.role || 'follower', is_notified: record.is_notified || 1, is_muted: record.is_muted || 0, created_at: now, updated_at: now };
  }

  async deleteByPageAndUser(pageId, userId) {
    await db('page_followers').where({ page_id: pageId, user_id: userId }).del();
    return true;
  }

  async listByPage(pageId, { limit = 50, offset = 0 } = {}) {
    const rows = await db('page_followers').where({ page_id: pageId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
    return rows || [];
  }

  async countByPage(pageId) {
    const row = await db('page_followers').where({ page_id: pageId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }
}
