import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
};

export default class MysqlUserSettingsRepository {
  async get(userId) {
    if (!userId) return null;
    const row = await db('user_settings').where({ user_id: userId }).first();
    if (!row) return null;
    return {
      ...row,
      settings: parseJsonObject(row.settings),
      privacy: parseJsonObject(row.privacy),
      notification_preferences: parseJsonObject(row.notification_preferences)
    };
  }

  async mergeSettings(userId, patch = {}) {
    if (!userId) throw new Error('user_required');
    const now = new Date();
    const existing = await this.get(userId);
    const baseSettings = existing && existing.settings ? existing.settings : {};
    const nextSettings = { ...baseSettings };
    for (const [key, value] of Object.entries(patch || {})) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        nextSettings[key] &&
        typeof nextSettings[key] === 'object' &&
        !Array.isArray(nextSettings[key])
      ) {
        nextSettings[key] = { ...nextSettings[key], ...value };
      } else {
        nextSettings[key] = value;
      }
    }
    const payload = {
      settings: JSON.stringify(nextSettings),
      updated_at: now
    };

    if (existing) {
      await db('user_settings').where({ user_id: userId }).update(payload);
    } else {
      await db('user_settings').insert({
        id: uuidv4(),
        user_id: userId,
        ...payload,
        created_at: now
      });
    }

    return this.get(userId);
  }
}
