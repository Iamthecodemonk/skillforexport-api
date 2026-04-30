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
    const qb = db('communities').select('*');
    if (categoryId) qb.where('category_id', categoryId);
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(function () {
        this.where('name', 'like', like).orWhere('description', 'like', like);
      });
    }
    qb.orderBy('name', 'asc').offset(offset).limit(limit);
    return qb;
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
