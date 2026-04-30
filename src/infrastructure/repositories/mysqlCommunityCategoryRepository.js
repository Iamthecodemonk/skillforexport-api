import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommunityCategoryRepository {
  async findById(id) {
    return db('community_categories').where({ id }).first();
  }

  async findByName(name) {
    return db('community_categories').where({ name }).first();
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
    return db('community_categories').orderBy('name', 'asc');
  }
}
