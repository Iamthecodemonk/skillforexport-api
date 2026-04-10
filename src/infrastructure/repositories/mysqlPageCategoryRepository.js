import db from '../knexConfig.js';

export default class MysqlPageCategoryRepository {
  async findById(id) {
    const row = await db('page_categories').where({ id }).first();
    return row || null;
  }
}
