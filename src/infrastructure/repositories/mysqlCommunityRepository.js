import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommunityRepository {
  async findById(id) {
    return db('communities').where({ id }).first();
  }

  async create(record) {
    const id = record.id || uuidv4();
    const payload = {
      id,
      category_id: record.category_id || record.categoryId || null,
      name: record.name || null,
      description: record.description || null,
      default_post_visibility: typeof record.default_post_visibility !== 'undefined' ? record.default_post_visibility : null,
      is_active: typeof record.is_active !== 'undefined' ? record.is_active : 1,
      created_at: new Date()
    };
    await db('communities').insert(payload);
    return db('communities').where({ id }).first();
  }

  async update(id, updates) {
    await db('communities').where({ id }).update(updates);
    return db('communities').where({ id }).first();
  }

  async delete(id) {
    await db('communities').where({ id }).del();
    return { id };
  }

  async listByCategory(categoryId) {
    return db('communities').where({ category_id: categoryId }).orderBy('name', 'asc');
  }

  async listAll() {
    return db('communities').orderBy('name', 'asc');
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
