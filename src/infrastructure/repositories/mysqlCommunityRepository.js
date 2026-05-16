import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommunityRepository {
  mapCommunity(row) {
    if (!row) return null;
    return {
      ...row,
      membersOnlyPosting: !(row.members_only_posting === 0 || row.members_only_posting === false || row.members_only_posting === '0')
    };
  }

  toPersistence(record = {}, { includeOwner = false } = {}) {
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(record, 'category_id') || Object.prototype.hasOwnProperty.call(record, 'categoryId')) {
      payload.category_id = record.category_id || record.categoryId || null;
    }
    if (includeOwner && (Object.prototype.hasOwnProperty.call(record, 'owner_id') || Object.prototype.hasOwnProperty.call(record, 'ownerId'))) {
      payload.owner_id = record.owner_id || record.ownerId || null;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'name')) {
      payload.name = record.name || null;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'icon')) {
      payload.icon = record.icon || null;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'description')) {
      payload.description = record.description || null;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'default_post_visibility') || Object.prototype.hasOwnProperty.call(record, 'defaultPostVisibility')) {
      payload.default_post_visibility = typeof record.default_post_visibility !== 'undefined'
        ? record.default_post_visibility
        : record.defaultPostVisibility;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'members_only_posting') || Object.prototype.hasOwnProperty.call(record, 'membersOnlyPosting')) {
      const value = typeof record.members_only_posting !== 'undefined'
        ? record.members_only_posting
        : record.membersOnlyPosting;
      payload.members_only_posting = value === false || value === 0 || value === '0' ? 0 : 1;
    }
    if (Object.prototype.hasOwnProperty.call(record, 'is_active') || Object.prototype.hasOwnProperty.call(record, 'isActive')) {
      payload.is_active = typeof record.is_active !== 'undefined' ? record.is_active : record.isActive;
    }

    return payload;
  }

  async findById(id) {
    return this.mapCommunity(await db('communities').where({ id }).first());
  }

  async create(record) {
    const id = record.id || uuidv4();
    const payload = {
      id,
      ...this.toPersistence(record),
      is_active: typeof record.is_active !== 'undefined'
        ? record.is_active
        : (typeof record.isActive !== 'undefined' ? record.isActive : 1),
      members_only_posting: typeof record.members_only_posting !== 'undefined'
        ? record.members_only_posting
        : (typeof record.membersOnlyPosting !== 'undefined' ? (record.membersOnlyPosting ? 1 : 0) : 0),
      created_at: new Date()
    };
    await db('communities').insert(payload);
    return this.findById(id);
  }

  async update(id, updates) {
    const payload = this.toPersistence(updates);
    if (Object.keys(payload).length > 0) {
      await db('communities').where({ id }).update(payload);
    }
    return this.findById(id);
  }

  async delete(id) {
    await db('communities').where({ id }).del();
    return { id };
  }

  async listByCategory(categoryId) {
    const rows = await db('communities').where({ category_id: categoryId }).orderBy('name', 'asc');
    return rows.map(row => this.mapCommunity(row));
  }

  async listAll() {
    const rows = await db('communities').orderBy('name', 'asc');
    return rows.map(row => this.mapCommunity(row));
  }

  async list({ offset = 0, limit = 20, q = null, categoryId = null } = {}) {
    const postCounts = db('posts')
      .select('community_id')
      .count({ posts_count: 'id' })
      .whereNotNull('community_id')
      .groupBy('community_id')
      .as('pc');
    const postReactionCounts = db('posts as p')
      .leftJoin('post_reactions as pr', 'pr.post_id', 'p.id')
      .select('p.community_id')
      .count({ post_reactions_count: 'pr.id' })
      .sum({ post_likes_count: db.raw("CASE WHEN pr.type = 'like' THEN 1 ELSE 0 END") })
      .whereNotNull('p.community_id')
      .groupBy('p.community_id')
      .as('prc');
    const commentCounts = db('posts as p')
      .leftJoin('comments as cm', 'cm.post_id', 'p.id')
      .select('p.community_id')
      .count({ comments_count: 'cm.id' })
      .whereNotNull('p.community_id')
      .groupBy('p.community_id')
      .as('cmc');
    const qb = db('communities as c')
      .leftJoin('community_categories as cc', 'cc.id', 'c.category_id')
      .leftJoin(postCounts, 'pc.community_id', 'c.id')
      .leftJoin(postReactionCounts, 'prc.community_id', 'c.id')
      .leftJoin(commentCounts, 'cmc.community_id', 'c.id')
      .select(
        'c.*',
        'cc.id as community_category_id',
        'cc.name as community_category_name',
        'pc.posts_count',
        'prc.post_likes_count',
        'prc.post_reactions_count',
        'cmc.comments_count'
      );
    if (categoryId) qb.where('c.category_id', categoryId);
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(function () {
        this.where('c.name', 'like', like).orWhere('c.description', 'like', like);
      });
    }
    qb.orderBy('c.name', 'asc').offset(offset).limit(limit);
    const rows = await qb;
    return rows.map(({
      community_category_id: categoryId,
      community_category_name: categoryName,
      posts_count,
      post_likes_count,
      post_reactions_count,
      comments_count,
      ...community
    }) => ({
      ...community,
      membersOnlyPosting: !(community.members_only_posting === 0 || community.members_only_posting === false || community.members_only_posting === '0'),
      category: categoryId ? { id: categoryId, name: categoryName } : null,
      posts_count: parseInt(posts_count || 0, 10),
      post_likes_count: parseInt(post_likes_count || 0, 10),
      post_reactions_count: parseInt(post_reactions_count || 0, 10),
      comments_count: parseInt(comments_count || 0, 10)
    }));
  }

  async count({ q = null, categoryId = null } = {}) {
    const qb = db('communities').count({ cnt: 'id' });
    if (categoryId) qb.where('category_id', categoryId);
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(function () {
        this.where('name', 'like', like).orWhere('description', 'like', like);
      });
    }
    const row = await qb.first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }
}
