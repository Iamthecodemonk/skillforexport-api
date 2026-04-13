import db from '../knexConfig.js';

export default class MysqlPageCategoryRepository {
  async findById(id) {
    const row = await db('page_categories').where({ id }).first();
    return row || null;
  }

  async findByName(name) {
    if (!name) return null;
    const row = await db('page_categories').where({ name }).first();
    return row || null;
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, created_at: now, updated_at: now };
    // Ensure JSON columns are stored as valid JSON strings when JS objects are provided
    if (payload && typeof payload.rules === 'object') 
      payload.rules = JSON.stringify(payload.rules);
    if (payload && typeof payload.validation_rules === 'object') 
      payload.validation_rules = JSON.stringify(payload.validation_rules);
    await db('page_categories').insert(payload);
    const row = await db('page_categories').where({ id: record.id }).first();
    return row || null;
  }

  async update(id, updates) {
    const now = new Date();
    const payload = Object.assign({}, updates, { updated_at: now });
    // Stringify JSON fields to avoid MySQL invalid JSON errors
    if (payload && typeof payload.rules === 'object') 
      payload.rules = JSON.stringify(payload.rules);
    if (payload && typeof payload.validation_rules === 'object') 
      payload.validation_rules = JSON.stringify(payload.validation_rules);
    await db('page_categories').where({ id }).update(payload);
    const row = await db('page_categories').where({ id }).first();
    return row || null;
  }

  async delete(id) {
    await db('page_categories').where({ id }).del();
    return true;
  }
}
