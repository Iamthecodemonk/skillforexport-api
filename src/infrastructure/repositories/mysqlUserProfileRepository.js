import db from '../knexConfig.js';
import logger from '../../utils/logger.js';

const repoLog = logger.child('MYSQL_USER_PROFILE_REPO');

const normalizePatch = (patch = {}) => {
  const payload = { ...patch };
  if (typeof payload.displayName !== 'undefined') {
    payload.display_name = payload.displayName;
    delete payload.displayName;
  }
  if (typeof payload.currentJobTitle !== 'undefined') {
    payload.current_job_title = payload.currentJobTitle;
    delete payload.currentJobTitle;
  }
  if (typeof payload.currentWorkspace !== 'undefined') {
    payload.current_workspace = payload.currentWorkspace;
    delete payload.currentWorkspace;
  }
  delete payload.userId;
  delete payload.user_id;
  const allowed = new Set([
    'username',
    'display_name',
    'bio',
    'location',
    'avatar',
    'banner',
    'website',
    'linkedin',
    'github',
    'current_job_title',
    'current_workspace'
  ]);
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key)));
};

const normalizeCreate = (record = {}) => {
  const source = record && typeof record.toRecord === 'function' ? record.toRecord() : record;
  const payload = { ...normalizePatch(source) };
  payload.id = source.id;
  payload.user_id = source.user_id || source.userId;
  return payload;
};

export default class MysqlUserProfileRepository {
  async findByUserId(userId) {
    if (!userId) return null;
    return db('user_profiles').where({ user_id: userId }).first();
  }

  async findByUsername(username) {
    if (!username) return null;
    return db('user_profiles').where({ username }).first();
  }

  async create(record) {
    const now = new Date();
    const payload = { ...normalizeCreate(record), created_at: now };
    try {
      repoLog.debug('Inserting user_profile', { payload });
      await db('user_profiles').insert(payload);
      const row = await db('user_profiles').where({ id: record.id }).first();
      repoLog.debug('Inserted user_profile row', { row });
      return row;
    } catch (err) {
      // Convert duplicate entry to a domain-friendly error so callers can handle it
      if (err && err.code === 'ER_DUP_ENTRY') {
        throw new Error('profile_already_exists');
      }
      throw err;
    }
  }

  async update(id, patch) {
    const now = new Date();
    const payload = normalizePatch(patch);
    if (Object.keys(payload).length) {
      await db('user_profiles').where({ id }).update({ ...payload, updated_at: now });
    }
    return db('user_profiles').where({ id }).first();
  }
}
