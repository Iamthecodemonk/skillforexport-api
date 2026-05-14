import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';
const repoLog = logger.child('mysqlCommunityCategoryRepository');

export default class MysqlCommunityCategoryRepository {
  async findById(id) {
    return db('community_categories').where({ id }).first();
  }

  async findByName(name) {
    return db('community_categories')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
  }

  async create(record) {
    const id = record.id || uuidv4();
    const payload = { id, name: record.name || null };
    await db('community_categories').insert(payload);
    return db('community_categories').where({ id }).first();
  }

  async update(id, updates) {
    await db('community_categories').where({ id }).update(updates);
    return db('community_categories').where({ id }).first();
  }

  async delete(id) {
    await db('community_categories').where({ id }).del();
    return { id };
  }

  async listAll() {
    const rows = await db('community_categories as cc')
      .leftJoin('communities as c', 'c.category_id', 'cc.id')
      .select('cc.*')
      .count({ total_communities: 'c.id' })
      .groupBy('cc.id')
      .orderBy('cc.name', 'asc');
    const normalizedRows = rows.map((row) => ({
      ...row,
      total_communities: parseInt(row.total_communities || 0, 10)
    }));
    try {
      repoLog.info('listAll fetched rows', { count: Array.isArray(normalizedRows) ? normalizedRows.length : 0 });
    } catch (e) {
      // ignore logging errors
    }
    return normalizedRows;
  }
}
