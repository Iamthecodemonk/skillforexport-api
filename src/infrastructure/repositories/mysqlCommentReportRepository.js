import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommentReportRepository {
  async create(report) {
    const id = report.id || uuidv4();
    const now = new Date();
    const payload = {
      id,
      comment_id: report.comment_id || report.commentId,
      user_id: report.user_id || report.userId,
      reason: report.reason || null,
      details: report.details || null,
      created_at: now
    };
    await db('comment_reports').insert(payload);
    return payload;
  }

  async findById(id) {
    const row = await db('comment_reports').where({ id }).first();
    return row || null;
  }
}
