import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const parseJsonArray = (value) => {
  if (value === null || typeof value === 'undefined') return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const toBool = (value) => value === true || value === 1 || value === '1';

const applyPostFilters = (q, { communityId = null, publicOnly = false, search = null } = {}) => {
  if (communityId) {
    q.where('p.community_id', communityId);
  } else if (publicOnly) {
    q.where('p.visibility', 'public');
  }

  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    q.andWhere(function () {
      this.where('p.title', 'like', `%${term}%`)
        .orWhere('p.content', 'like', `%${term}%`)
        .orWhere('up.username', 'like', `%${term}%`)
        .orWhere('u.email', 'like', `%${term}%`)
        .orWhere('c.name', 'like', `%${term}%`);
    });
  }
};

const applyPostOrdering = (q, { sortField = null, sortDirection = null } = {}) => {
  const sortableColumns = {
    created_at: 'p.created_at',
    updated_at: 'p.updated_at',
    title: 'p.title',
    score: 'score',
    comment_count: 'comment_count'
  };
  const field = sortableColumns[sortField] || 'p.created_at';
  const direction = String(sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

  q.orderBy(field, direction);
  if (field !== 'p.id') q.orderBy('p.id', direction);
};

export default class MysqlPostRepository {
  async create(post) {
    const id = post.id || uuidv4();
    const now = new Date();
    await db('posts').insert({
      id,
      user_id: post.user_id || post.userId,
      community_id: post.community_id || post.communityId || null,
      page_id: post.page_id || post.pageId || null,
      parent_post_id: post.parent_post_id || post.parentPostId || post.originalPostId || null,
      visibility: post.visibility || post.visibility || 'public',
      title: post.title || post.title || null,
      content: post.content,
      created_at: now,
      updated_at: now
    });
    return this.findById(id, { userId: post.user_id || post.userId });
  }

  mapPost(row) {
    if (!row) return null;
    const mediaPath = parseJsonArray(row.media_path);
    const commentCount = parseInt(row.comment_count || 0, 10);
    const score = parseInt(row.score || 0, 10);
    const user = {
      id: row.user_id,
      name: row.user_name || null,
      email: row.user_email || null,
      avatar: row.user_avatar || null
    };
    const community = row.community_id
      ? {
          id: row.community_id,
          name: row.community_name || null,
          description: row.community_description || null,
          is_active: typeof row.community_is_active === 'undefined' ? undefined : row.community_is_active,
          default_post_visibility: row.community_default_post_visibility || null
        }
      : null;

    return {
      id: row.id,
      user_id: row.user_id,
      community_id: row.community_id,
      page_id: row.page_id,
      parent_post_id: row.parent_post_id,
      originalPostId: row.parent_post_id || null,
      visibility: row.visibility,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      file_path: mediaPath,
      media_path: mediaPath,
      images_count: mediaPath.length,
      comment_count: commentCount,
      score,
      is_follow: toBool(row.is_follow),
      is_liked: toBool(row.is_liked),
      is_saved: toBool(row.is_saved),
      is_report: toBool(row.is_report),
      type: 'POST',
      user,
      community,
      page: null
    };
  }

  basePostQuery(userId = null) {
    const q = db('posts as p')
      .leftJoin('users as u', 'u.id', 'p.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .leftJoin('communities as c', 'c.id', 'p.community_id')
      .select(
        'p.*',
        'u.email as user_email',
        db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as user_name'),
        'up.avatar as user_avatar',
        'c.name as community_name',
        'c.description as community_description',
        'c.is_active as community_is_active',
        'c.default_post_visibility as community_default_post_visibility',
        db.raw('(SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) as comment_count'),
        db.raw('(SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) as score'),
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pm.id, 'url', pm.url, 'media_type', pm.media_type, 'thumbnail_url', pm.thumbnail_url, 'display_order', pm.display_order, 'created_at', pm.created_at))
          FROM post_media pm
          WHERE pm.post_id = p.id
          ORDER BY pm.display_order ASC, pm.created_at ASC
        ), JSON_ARRAY()) as media_path`)
      );

    if (userId) {
      q.select(
        db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = p.user_id) as is_follow', [userId]),
        db.raw('EXISTS(SELECT 1 FROM post_reactions pr2 WHERE pr2.user_id = ? AND pr2.post_id = p.id) as is_liked', [userId]),
        db.raw('EXISTS(SELECT 1 FROM post_saves ps WHERE ps.user_id = ? AND ps.post_id = p.id) as is_saved', [userId]),
        db.raw('EXISTS(SELECT 1 FROM generic_reports r WHERE r.user_id = ? AND r.target_id = p.id AND r.target_type = ?) as is_report', [userId, 'post'])
      );
    } else {
      q.select(
        db.raw('false as is_follow'),
        db.raw('false as is_liked'),
        db.raw('false as is_saved'),
        db.raw('false as is_report')
      );
    }

    return q;
  }

  async findById(id, { userId = null } = {}) {
    const row = await this.basePostQuery(userId)
      .where('p.id', id)
      .first();
    return this.mapPost(row);
  }

  async list({ limit = 20, offset = 0, lastCreatedAt = null, lastId = null, userId = null, communityId = null, publicOnly = false, search = null, sortField = null, sortDirection = null } = {}) {
    const q = this.basePostQuery(userId).limit(limit);
    applyPostFilters(q, { communityId, publicOnly, search });
    applyPostOrdering(q, { sortField, sortDirection });
    if (lastCreatedAt) {
      // keyset pagination: created_at < lastCreatedAt OR (created_at = lastCreatedAt AND id < lastId)
      q.where(function () {
        this.where('p.created_at', '<', lastCreatedAt);
        if (lastId) this.orWhere(function () { this.where('p.created_at', '=', lastCreatedAt).andWhere('p.id', '<', lastId); });
      });
    } else if (offset) {
      q.offset(offset);
    }
    const rows = await q;
    return (rows || []).map(row => this.mapPost(row));
  }

  async listByPage(pageId, { limit = 20, offset = 0, lastCreatedAt = null, lastId = null, userId = null } = {}) {
    const q = this.basePostQuery(userId).where('p.page_id', pageId).orderBy('p.created_at', 'desc').orderBy('p.id', 'desc').limit(limit);
    if (lastCreatedAt) {
      q.andWhere(function () {
        this.where('p.created_at', '<', lastCreatedAt);
        if (lastId) this.orWhere(function () { this.where('p.created_at', '=', lastCreatedAt).andWhere('p.id', '<', lastId); });
      });
    } else if (offset) {
      q.offset(offset);
    }
    const rows = await q;
    return (rows || []).map(row => this.mapPost(row));
  }

  async listByUser(ownerUserId, { limit = 20, offset = 0, actorId = null } = {}) {
    const q = this.basePostQuery(actorId || ownerUserId)
      .where('p.user_id', ownerUserId)
      .orderBy('p.created_at', 'desc')
      .orderBy('p.id', 'desc')
      .limit(limit)
      .offset(offset);
    const rows = await q;
    return (rows || []).map(row => this.mapPost(row));
  }

  async countAll({ communityId = null, publicOnly = false, search = null } = {}) {
    const q = db('posts as p')
      .leftJoin('users as u', 'u.id', 'p.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .leftJoin('communities as c', 'c.id', 'p.community_id')
      .count({ cnt: 'p.id' });
    applyPostFilters(q, { communityId, publicOnly, search });
    const row = await q.first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countByUser(userId) {
    const row = await db('posts').where({ user_id: userId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countByPage(pageId) {
    const row = await db('posts').where({ page_id: pageId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
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
    await db.transaction(async (trx) => {
      const postIds = [id];
      let frontier = [id];
      while (frontier.length > 0) {
        const children = await trx('posts').whereIn('parent_post_id', frontier).pluck('id');
        const freshChildren = children.filter(childId => !postIds.includes(childId));
        if (freshChildren.length === 0) break;
        postIds.push(...freshChildren);
        frontier = freshChildren;
      }

      const commentIds = await trx('comments').whereIn('post_id', postIds).pluck('id');
      if (commentIds.length > 0) {
        await trx('comment_reactions').whereIn('comment_id', commentIds).del();
        await trx('comment_reports').whereIn('comment_id', commentIds).del();
        await trx('generic_reports').whereIn('target_id', commentIds).where('target_type', 'comment').del();
      }
      await trx('comments').whereIn('post_id', postIds).del();
      await trx('post_media').whereIn('post_id', postIds).del();
      await trx('post_reactions').whereIn('post_id', postIds).del();
      await trx('post_saves').whereIn('post_id', postIds).del();
      await trx('post_reports').whereIn('post_id', postIds).del();
      await trx('generic_reports').whereIn('target_id', postIds).where('target_type', 'post').del();
      await trx('posts').whereIn('id', postIds).del();
    });
    return true;
  }
}
