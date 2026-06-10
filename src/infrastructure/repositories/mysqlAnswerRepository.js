import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlAnswerRepository {
  mapAnswer(row) {
    if (!row) return null;
    const score = parseInt(row.score || 0, 10);
    const isLiked = row.is_liked === true || row.is_liked === 1 || row.is_liked === '1';
    return {
      id: row.id,
      question_id: row.question_id,
      questionId: row.question_id,
      user_id: row.user_id,
      userId: row.user_id,
      parent_answer_id: row.parent_answer_id || null,
      parentAnswerId: row.parent_answer_id || null,
      content: row.content,
      moderation_status: row.moderation_status || 'approved',
      moderationStatus: row.moderation_status || 'approved',
      score,
      is_liked: isLiked,
      isLiked,
      created_at: row.created_at,
      createdAt: row.created_at,
      updated_at: row.updated_at,
      updatedAt: row.updated_at,
      user: {
        id: row.user_id,
        name: row.user_name || null,
        email: row.user_email || null,
        avatar: row.user_avatar || null,
        avatarUrl: row.user_avatar || null
      }
    };
  }

  baseAnswerQuery(userId = null) {
    const q = db('answers as a')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .select(
        'a.*',
        'u.email as user_email',
        db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as user_name'),
        'up.avatar as user_avatar',
        db.raw('(SELECT COUNT(*) FROM answer_reactions ar WHERE ar.answer_id = a.id) as score')
      );

    if (userId) {
      q.select(db.raw('EXISTS(SELECT 1 FROM answer_reactions ar2 WHERE ar2.user_id = ? AND ar2.answer_id = a.id) as is_liked', [userId]));
    } else {
      q.select(db.raw('false as is_liked'));
    }

    return q;
  }

  applyModerationFilter(q, includeHidden = false) {
    if (!includeHidden) q.whereNotIn('a.moderation_status', ['suspended', 'deleted']);
    return q;
  }

  async create(record) {
    const id = record.id || uuidv4();
    const now = new Date();
    const userId = record.user_id || record.userId;
    await db('answers').insert({
      id,
      question_id: record.question_id || record.questionId,
      user_id: userId,
      parent_answer_id: record.parent_answer_id || record.parentAnswerId || null,
      content: record.content,
      created_at: now,
      updated_at: now
    });
    return this.findById(id, { userId });
  }

  async findById(id, { userId = null, includeHidden = false } = {}) {
    const q = this.baseAnswerQuery(userId).where('a.id', id);
    this.applyModerationFilter(q, includeHidden);
    const row = await q.first();
    return this.mapAnswer(row);
  }

  async listByQuestion(questionId, { limit = 50, offset = 0, userId = null, includeHidden = false } = {}) {
    const q = this.baseAnswerQuery(userId)
      .where('a.question_id', questionId)
      .orderBy('a.created_at', 'asc')
      .limit(limit)
      .offset(offset);
    this.applyModerationFilter(q, includeHidden);
    const rows = await q;

    return (rows || []).map(row => this.mapAnswer(row));
  }

  async listByUser(userId, { limit = 50, offset = 0, actorId = null, includeHidden = false, search = null } = {}) {
    const q = this.baseAnswerQuery(actorId || userId)
      .where('a.user_id', userId)
      .orderBy('a.created_at', 'desc')
      .limit(limit)
      .offset(offset);
    if (search) q.andWhere('a.content', 'like', `%${search}%`);
    this.applyModerationFilter(q, includeHidden);
    const rows = await q;

    return (rows || []).map(row => this.mapAnswer(row));
  }

  async countByQuestion(questionId) {
    const row = await db('answers').where({ question_id: questionId }).whereNotIn('moderation_status', ['suspended', 'deleted']).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countDistinctAnswerersByQuestion(questionId) {
    const row = await db('answers').where({ question_id: questionId }).whereNotIn('moderation_status', ['suspended', 'deleted']).countDistinct({ cnt: 'user_id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countByUser(userId, { search = null } = {}) {
    const query = db('answers').where({ user_id: userId }).whereNotIn('moderation_status', ['suspended', 'deleted']);
    if (search) query.andWhere('content', 'like', `%${search}%`);
    const row = await query.count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async update(id, updates = {}) {
    const payload = {};
    if (typeof updates.content !== 'undefined') payload.content = updates.content;
    if (typeof updates.moderation_status !== 'undefined') payload.moderation_status = updates.moderation_status;
    if (typeof updates.moderationStatus !== 'undefined') payload.moderation_status = updates.moderationStatus;
    if (Object.keys(payload).length === 0) return this.findById(id, { includeHidden: true });
    payload.updated_at = new Date();
    await db('answers').where({ id }).update(payload);
    return this.findById(id, { includeHidden: true });
  }

  async delete(id) {
    await db('answers').where({ id }).del();
    return true;
  }
}
