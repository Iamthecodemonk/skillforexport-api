import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPostReportRepository {
  async create(report) {
    const id = report.id || uuidv4();
    const now = new Date();
    await db('post_reports').insert({
      id,
      post_id: report.post_id || report.postId,
      user_id: report.user_id || report.userId,
      reason: report.reason || null,
      details: report.details || null,
      created_at: now
    });
    return { id, post_id: report.post_id || report.postId, user_id: report.user_id || report.userId, reason: report.reason || null, details: report.details || null, created_at: now };
  }

  async findById(id) {
    const row = await db('post_reports').where({ id }).first();
    return row || null;
  }
}
