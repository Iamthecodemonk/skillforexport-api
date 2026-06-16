import db from '../knexConfig.js';

export default class MysqlPageCategoryRepository {
  withPageCounts() {
    return db('pages')
      .select('category_id')
      .count({ total_pages: 'id' })
      .whereNotNull('category_id')
      .groupBy('category_id')
      .as('pc');
  }

  withOwnerPageCounts(ownerId) {
    return db('pages')
      .select('category_id')
      .count({ total_pages: 'id' })
      .where('owner_id', ownerId)
      .whereNotNull('category_id')
      .groupBy('category_id')
      .as('opc');
  }

  normalize(row) {
    if (!row) return null;
    return {
      ...row,
      total_pages: parseInt(row.total_pages || 0, 10)
    };
  }

  async findById(id) {
    const row = await db('page_categories as pcg')
      .leftJoin(this.withPageCounts(), 'pc.category_id', 'pcg.id')
      .where('pcg.id', id)
      .select('pcg.*', db.raw('COALESCE(pc.total_pages, 0) as total_pages'))
      .first();
    return this.normalize(row);
  }

  async findByName(name) {
    if (!name) return null;
    const row = await db('page_categories as pcg')
      .leftJoin(this.withPageCounts(), 'pc.category_id', 'pcg.id')
      .where('pcg.name', name)
      .select('pcg.*', db.raw('COALESCE(pc.total_pages, 0) as total_pages'))
      .first();
    return this.normalize(row);
  }

  async list({ limit = 50, offset = 0 } = {}) {
    const rows = await db('page_categories as pcg')
      .leftJoin(this.withPageCounts(), 'pc.category_id', 'pcg.id')
      .select('pcg.*', db.raw('COALESCE(pc.total_pages, 0) as total_pages'))
      .orderBy('pcg.name', 'asc')
      .limit(limit)
      .offset(offset);
    return rows.map(row => this.normalize(row));
  }

  async listForOwner(ownerId, { limit = 50, offset = 0 } = {}) {
    const rows = await db('page_categories as pcg')
      .leftJoin(this.withOwnerPageCounts(ownerId), 'opc.category_id', 'pcg.id')
      .select('pcg.*', db.raw('COALESCE(opc.total_pages, 0) as total_pages'))
      .orderBy('pcg.name', 'asc')
      .limit(limit)
      .offset(offset);
    return rows.map(row => this.normalize(row));
  }

  async countAll() {
    const row = await db('page_categories').count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
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
    return this.findById(record.id);
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
    return this.findById(id);
  }

  async delete(id) {
    await db('page_categories').where({ id }).del();
    return true;
  }
}
