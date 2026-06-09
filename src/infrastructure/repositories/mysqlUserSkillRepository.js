import db from '../knexConfig.js';

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const skillRowsFromArray = (userId, skills = [], source = 'profile') => skills
  .map((item, index) => {
    if (!item) return null;
    if (typeof item === 'object') {
      const skill = item.skill || item.name || item.title || item.value;
      if (!skill) return null;
      return { id: item.id || `${source}-skill-${index}`, user_id: userId, skill, level: item.level || null };
    }
    return { id: `${source}-skill-${index}`, user_id: userId, skill: String(item), level: null };
  })
  .filter(Boolean);

export default class MysqlUserSkillRepository {
  async listByUserId(userId) {
    const direct = await db('user_skills').where({ user_id: userId }).orderBy('id', 'asc');
    if (direct && direct.length > 0) return direct;

    const fallbackRows = [];
    const freelancer = await db('freelancer_profiles').where({ user_id: userId }).first().catch(() => null);
    fallbackRows.push(...skillRowsFromArray(userId, parseJsonArray(freelancer && freelancer.skills), 'freelancer'));

    const pages = await db('pages').where({ owner_id: userId }).select('id', 'metadata').catch(() => []);
    for (const page of pages || []) {
      const metadata = page.metadata && typeof page.metadata === 'object' ? page.metadata : (() => {
        try { return JSON.parse(page.metadata || '{}'); } catch (e) { return {}; }
      })();
      fallbackRows.push(...skillRowsFromArray(userId, parseJsonArray(metadata.skills), `page-${page.id}`));
    }

    return fallbackRows;
  }

  async create(record) {
    const now = new Date();
    const payload = { ...record, created_at: now };
    await db('user_skills').insert(payload);
    return db('user_skills').where({ id: record.id }).first();
  }

  async delete(id) {
    return db('user_skills').where({ id }).del();
  }
}
