import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import db from '../knexConfig.js';

const DEFAULT_PREFERENCES = {
  inApp: {
    comments: true,
    replies: true,
    answers: true,
    scores: true,
    follows: true,
    communities: true,
    jobs: true,
    pages: true,
    system: true
  },
  email: {
    comments: false,
    answers: true,
    jobs: true,
    system: true
  }
};

const TYPE_CATEGORY = {
  post_comment: 'comments',
  comment_reply: 'replies',
  question_answer: 'answers',
  post_score: 'scores',
  comment_score: 'scores',
  answer_score: 'scores',
  user_follow: 'follows',
  page_follow: 'pages',
  community_follow: 'communities',
  job_status: 'jobs',
  freelance_job_status: 'jobs',
  job_application: 'jobs',
  freelance_job_application: 'jobs',
  page_post: 'pages',
  community_post: 'communities',
  system: 'system'
};

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const parseJson = (value, fallback = null) => {
  if (value === null || typeof value === 'undefined') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
};

const displayName = (user) => user && (user.display_name || user.username || null);

export default class MysqlNotificationRepository {
  defaults() {
    return JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));
  }

  mergePreferences(value) {
    const parsed = parseJson(value, {});
    const defaults = this.defaults();
    return {
      inApp: { ...defaults.inApp, ...(parsed.inApp || {}) },
      email: { ...defaults.email, ...(parsed.email || {}) }
    };
  }

  async actor(actorUserId) {
    if (!actorUserId) return null;
    const row = await db('users as u')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .where('u.id', actorUserId)
      .select('u.id', 'up.username', 'up.display_name', 'up.avatar')
      .first();
    if (!row) return null;
    return {
      id: row.id,
      name: displayName(row) || 'Someone',
      avatar: row.avatar || null
    };
  }

  map(row) {
    if (!row) return null;
    const meta = parseJson(row.metadata, {});
    const actor = parseJson(row.actor, null) || meta.actor || null;
    const target = {
      type: row.target_type || (meta.target && meta.target.type) || null,
      id: row.target_id || (meta.target && meta.target.id) || null,
      title: row.target_title || (meta.target && meta.target.title) || null,
      url: row.target_url || (meta.target && meta.target.url) || null
    };
    return {
      id: row.id,
      type: row.type,
      title: row.title || meta.title || row.message || null,
      body: row.body || row.message || null,
      actor,
      target,
      readAt: row.read_at || (row.is_read ? row.updated_at || row.created_at : null),
      createdAt: row.created_at
    };
  }

  async getPreferences(userId) {
    const row = await db('user_settings').where({ user_id: userId }).first();
    return this.mergePreferences(row && row.notification_preferences);
  }

  async updatePreferences(userId, preferences = {}) {
    const existing = await db('user_settings').where({ user_id: userId }).first();
    const merged = this.mergePreferences(preferences);
    const now = new Date();
    const payload = {
      notification_preferences: JSON.stringify(merged),
      updated_at: now
    };
    if (existing) {
      await db('user_settings').where({ user_id: userId }).update(payload);
    } else {
      await db('user_settings').insert({ id: uuidv4(), user_id: userId, ...payload, created_at: now });
    }
    return merged;
  }

  async shouldCreate(userId, type) {
    const category = TYPE_CATEGORY[type] || 'system';
    const prefs = await this.getPreferences(userId);
    return prefs.inApp[category] !== false;
  }

  async create({ userId, actorUserId = null, type, title, body, target = {}, metadata = {} }) {
    if (!userId || !type) return null;
    if (actorUserId && actorUserId === userId) return null;
    if (!(await this.shouldCreate(userId, type))) return null;

    const id = uuidv4();
    const now = new Date();
    const actor = await this.actor(actorUserId);
    const targetPayload = {
      type: target.type || null,
      id: target.id || null,
      title: target.title || null,
      url: target.url || null
    };
    const meta = { ...metadata, actor, target: targetPayload };
    await db('notifications').insert({
      id,
      user_id: userId,
      type,
      title: title || null,
      body: body || title || null,
      message: body || title || null,
      actor_user_id: actorUserId || null,
      target_type: targetPayload.type,
      target_id: targetPayload.id,
      target_title: targetPayload.title,
      target_url: targetPayload.url,
      metadata: JSON.stringify(meta),
      is_read: 0,
      read_at: null,
      created_at: now,
      updated_at: now
    });
    const notification = this.map({
      id,
      type,
      title,
      body,
      actor: JSON.stringify(actor),
      target_type: targetPayload.type,
      target_id: targetPayload.id,
      target_title: targetPayload.title,
      target_url: targetPayload.url,
      metadata: JSON.stringify(meta),
      is_read: 0,
      read_at: null,
      created_at: now
    });
    const unreadCount = await this.unreadCount(userId);
    emitter.emit(userId, { notification, unreadCount });
    return notification;
  }

  async list(userId, { limit = 20, offset = 0 } = {}) {
    const rows = await db('notifications')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
    return rows.map(row => this.map(row));
  }

  async count(userId) {
    const row = await db('notifications').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async unreadCount(userId) {
    const row = await db('notifications').where({ user_id: userId, is_read: 0 }).count({ cnt: 'id' }).first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async markRead(userId, id) {
    await db('notifications').where({ user_id: userId, id }).update({ is_read: 1, read_at: new Date(), updated_at: new Date() });
    const row = await db('notifications').where({ user_id: userId, id }).first();
    return this.map(row);
  }

  async markManyRead(userId, ids = []) {
    if (!ids.length) return [];
    await db('notifications').where({ user_id: userId }).whereIn('id', ids).update({ is_read: 1, read_at: new Date(), updated_at: new Date() });
    return this.list(userId, { limit: ids.length, offset: 0 });
  }

  async markAllRead(userId) {
    await db('notifications').where({ user_id: userId, is_read: 0 }).update({ is_read: 1, read_at: new Date(), updated_at: new Date() });
    return { read: true };
  }

  async delete(userId, id) {
    await db('notifications').where({ user_id: userId, id }).del();
    return { id };
  }

  async clear(userId) {
    await db('notifications').where({ user_id: userId }).del();
    return { cleared: true };
  }

  subscribe(userId, listener) {
    emitter.on(userId, listener);
    return () => emitter.off(userId, listener);
  }
}
