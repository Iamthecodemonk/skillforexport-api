import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommentRepository {
  mapComment(row) {
    if (!row) return null;
    const score = parseInt(row.score || 0, 10);
    const isLiked = row.is_liked === true || row.is_liked === 1 || row.is_liked === '1';
    const isReported = row.is_report === true || row.is_report === 1 || row.is_report === '1';
    return {
      id: row.id,
      post_id: row.post_id,
      postId: row.post_id,
      user_id: row.user_id,
      userId: row.user_id,
      parent_comment_id: row.parent_comment_id || null,
      parentCommentId: row.parent_comment_id || null,
      content: row.content,
      moderation_status: row.moderation_status || 'approved',
      moderationStatus: row.moderation_status || 'approved',
      score,
      is_liked: isLiked,
      isLiked,
      is_report: isReported,
      isReport: isReported,
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

  baseCommentQuery(userId = null) {
    const q = db('comments as c')
      .leftJoin('users as u', 'u.id', 'c.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .select(
        'c.*',
        'u.email as user_email',
        db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as user_name'),
        'up.avatar as user_avatar',
        db.raw('(SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.id) as score')
      );

    if (userId) {
      q.select(
        db.raw('EXISTS(SELECT 1 FROM comment_reactions cr2 WHERE cr2.user_id = ? AND cr2.comment_id = c.id) as is_liked', [userId]),
        db.raw('EXISTS(SELECT 1 FROM generic_reports r WHERE r.user_id = ? AND r.target_id = c.id AND r.target_type = ?) as is_report', [userId, 'comment'])
      );
    } else {
      q.select(
        db.raw('false as is_liked'),
        db.raw('false as is_report')
      );
    }

    return q;
  }

  applyModerationFilter(q, includeHidden = false) {
    if (!includeHidden) q.whereNotIn('c.moderation_status', ['suspended', 'deleted']);
    return q;
  }

  async create(comment) {
    const id = comment.id || uuidv4();
    const now = new Date();
    const postId = comment.post_id || comment.postId;
    const userId = comment.user_id || comment.userId;
    const parentCommentId = comment.parent_comment_id || comment.parentCommentId || null;
    await db('comments').insert({
      id,
      post_id: postId,
      user_id: userId,
      parent_comment_id: parentCommentId,
      content: comment.content,
      created_at: now,
      updated_at: now
    });
    return this.findById(id, { userId });
  }

  async findById(id, { userId = null, includeHidden = false } = {}) {
    const q = this.baseCommentQuery(userId).where('c.id', id);
    this.applyModerationFilter(q, includeHidden);
    const row = await q.first();
    return this.mapComment(row);
  }

  async listByPost(postId, { limit = 50, offset = 0, userId = null, includeHidden = false } = {}) {
    const q = this.baseCommentQuery(userId)
      .where('c.post_id', postId)
      .orderBy('c.created_at', 'asc')
      .limit(limit)
      .offset(offset);
    this.applyModerationFilter(q, includeHidden);
    const rows = await q;
    return (rows || []).map(row => this.mapComment(row));
  }

  async listByUser(userId, { limit = 50, offset = 0, actorId = null, includeHidden = false, search = null } = {}) {
    const q = this.baseCommentQuery(actorId || userId)
      .where('c.user_id', userId)
      .orderBy('c.created_at', 'desc')
      .limit(limit)
      .offset(offset);
    if (search) q.andWhere('c.content', 'like', `%${search}%`);
    this.applyModerationFilter(q, includeHidden);
    const rows = await q;
    return (rows || []).map(row => this.mapComment(row));
  }

  async countByUser(userId, { search = null } = {}) {
    const query = db('comments').where({ user_id: userId }).whereNotIn('moderation_status', ['suspended', 'deleted']);
    if (search) query.andWhere('content', 'like', `%${search}%`);
    const row = await query.count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countByPost(postId) {
    const row = await db('comments').where({ post_id: postId }).whereNotIn('moderation_status', ['suspended', 'deleted']).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async update(id, updates) {
    const now = new Date();
    const payload = {};
    if (typeof updates.content !== 'undefined') payload.content = updates.content;
    if (typeof updates.moderation_status !== 'undefined') payload.moderation_status = updates.moderation_status;
    if (typeof updates.moderationStatus !== 'undefined') payload.moderation_status = updates.moderationStatus;
    if (Object.keys(payload).length === 0) return null;
    payload.updated_at = now;
    await db('comments').where({ id }).update(payload);
    return this.findById(id, { userId: updates.user_id || updates.userId || null });
  }

  async delete(id) {
    await db('comments').where({ id }).del();
    return true;
  }
}
