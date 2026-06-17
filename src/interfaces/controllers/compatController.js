import { v4 as uuidv4 } from 'uuid';
import db from '../../infrastructure/knexConfig.js';
import { formatDateForSql } from '../../utils/date.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';
import logger from '../../utils/logger.js';
import MysqlPostRepository from '../../infrastructure/repositories/mysqlPostRepository.js';
import MysqlCommentRepository from '../../infrastructure/repositories/mysqlCommentRepository.js';
import MysqlQuestionRepository from '../../infrastructure/repositories/mysqlQuestionRepository.js';
import MysqlAnswerRepository from '../../infrastructure/repositories/mysqlAnswerRepository.js';

const compatLogger = logger.child('COMPAT_CONTROLLER');

const actorId = (req) => req.user && req.user.id;
const now = () => new Date();
const csv = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const tableColumnCache = new Map();
const queryText = (req) => {
  const query = (req && req.query) || {};
  const nestedFilters = query.filters && typeof query.filters === 'object' ? query.filters : {};
  const value = query.q || query.query || query.search || query['filters[search]'] || nestedFilters.search || '';
  return String(value || '').trim();
};
const likeText = (value) => `%${String(value || '').trim()}%`;
const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
};

const toBool = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
};

const settingValue = (source, keys, fallback = true) => {
  for (const key of keys) {
    if (typeof source[key] !== 'undefined') return toBool(source[key], fallback);
  }
  return fallback;
};

const normalizeSettings = (source = {}) => {
  const updatesSource = source.updates && typeof source.updates === 'object' ? source.updates : {};
  const notificationSource = source.notificationPreferences && typeof source.notificationPreferences === 'object' ? source.notificationPreferences : {};
  const combined = { ...source, ...notificationSource, ...updatesSource };
  const updates = {
    inbox: settingValue(combined, ['inbox', 'invox'], true),
    alerts: settingValue(combined, ['alerts'], true),
    emailNotifications: settingValue(combined, ['emailNotifications', 'email_notifications', 'mails'], false),
    comments: settingValue(combined, ['comments'], true),
    replies: settingValue(combined, ['replies'], true),
    answers: settingValue(combined, ['answers'], true),
    scoresAndReactions: settingValue(combined, ['scoresAndReactions', 'scores_and_reactions', 'scores', 'reactions'], true),
    follows: settingValue(combined, ['follows', 'followers'], true),
    research: settingValue(combined, ['research'], true),
    recommendedJobs: settingValue(combined, ['recommendedJobs', 'recommended_jobs', 'recommended'], true),
    pageActivity: settingValue(combined, ['pageActivity', 'page_activity', 'pages'], true),
    featuresAndAnnouncements: settingValue(combined, ['featuresAndAnnouncements', 'features_and_announcements', 'featureAndAnnouncement', 'feature_and_announcement'], true)
  };

  return {
    ...source,
    inbox: updates.inbox,
    alerts: updates.alerts,
    mails: updates.emailNotifications,
    emailNotifications: updates.emailNotifications,
    email_notifications: updates.emailNotifications,
    comments: updates.comments,
    replies: updates.replies,
    answers: updates.answers,
    scores: updates.scoresAndReactions,
    reactions: updates.scoresAndReactions,
    scoresAndReactions: updates.scoresAndReactions,
    scores_and_reactions: updates.scoresAndReactions,
    follows: updates.follows,
    research: updates.research,
    recommended: updates.recommendedJobs,
    recommendedJobs: updates.recommendedJobs,
    recommended_jobs: updates.recommendedJobs,
    pageActivity: updates.pageActivity,
    page_activity: updates.pageActivity,
    pages: updates.pageActivity,
    feature_and_announcement: updates.featuresAndAnnouncements,
    featureAndAnnouncement: updates.featuresAndAnnouncements,
    featuresAndAnnouncements: updates.featuresAndAnnouncements,
    features_and_announcements: updates.featuresAndAnnouncements,
    updates,
    notificationPreferences: updates
  };
};

const notificationPreferencesFromSettings = (settings = {}) => ({
  inApp: {
    comments: settings.comments !== false,
    replies: settings.replies !== false,
    answers: settings.answers !== false,
    scores: settings.scoresAndReactions !== false,
    follows: settings.follows !== false,
    communities: settings.alerts !== false,
    jobs: settings.recommendedJobs !== false,
    pages: settings.pageActivity !== false,
    system: settings.featuresAndAnnouncements !== false
  },
  email: {
    comments: settings.emailNotifications === true && settings.comments !== false,
    answers: settings.emailNotifications === true && settings.answers !== false,
    jobs: settings.emailNotifications === true && settings.recommendedJobs !== false,
    system: settings.emailNotifications === true && settings.featuresAndAnnouncements !== false
  }
});

const settingsFromNotificationPreferences = (preferences = {}) => {
  const inApp = preferences.inApp || {};
  const email = preferences.email || {};
  const emailNotifications = Object.values(email).some(value => value === true);
  return {
    comments: inApp.comments !== false,
    replies: inApp.replies !== false,
    answers: inApp.answers !== false,
    scoresAndReactions: inApp.scores !== false,
    follows: inApp.follows !== false,
    alerts: inApp.communities !== false,
    recommendedJobs: inApp.jobs !== false,
    pageActivity: inApp.pages !== false,
    featuresAndAnnouncements: inApp.system !== false,
    emailNotifications
  };
};

const invalidateUserProfileCache = async (req, userId) => {
  try {
    const redis = req.server && (req.server.redisManager || req.server.redisClient);
    if (redis && typeof redis.del === 'function') await redis.del(`user:profile:${userId}`);
  } catch (_) {
    // cache invalidation should not fail the settings request
  }
};

const getTableColumns = async (tableName) => {
  if (tableColumnCache.has(tableName)) return tableColumnCache.get(tableName);
  const rows = await db('INFORMATION_SCHEMA.COLUMNS')
    .select('COLUMN_NAME as name', 'DATA_TYPE as dataType', 'EXTRA as extra')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    .where('TABLE_NAME', tableName);
  const columns = {};
  for (const row of rows || []) {
    columns[row.name] = {
      dataType: String(row.dataType || '').toLowerCase(),
      extra: String(row.extra || '').toLowerCase()
    };
  }
  tableColumnCache.set(tableName, columns);
  return columns;
};

const filterExistingColumns = (payload, columns) => {
  const filtered = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (Object.prototype.hasOwnProperty.call(columns, key)) filtered[key] = value;
  }
  return filtered;
};

const nextNumericId = async (tableName) => {
  const row = await db(tableName).max({ max_id: 'id' }).first();
  return Number(row && row.max_id ? row.max_id : 0) + 1;
};

const saveUserSettings = async (userId, patch = {}) => {
  const columns = await getTableColumns('user_settings');
  const timestamp = now();
  const updatePayload = filterExistingColumns({ ...patch, updated_at: timestamp }, columns);
  const existing = await db('user_settings').where({ user_id: userId }).first();

  if (existing) {
    if (Object.keys(updatePayload).length > 0) {
      await db('user_settings').where({ user_id: userId }).update(updatePayload);
    }
    return db('user_settings').where({ user_id: userId }).first();
  }

  const insertPayload = filterExistingColumns({
    user_id: userId,
    ...patch,
    created_at: timestamp,
    updated_at: timestamp
  }, columns);

  if (columns.id && !Object.prototype.hasOwnProperty.call(insertPayload, 'id')) {
    if (['char', 'varchar', 'text'].includes(columns.id.dataType)) {
      insertPayload.id = uuidv4();
    } else if (!columns.id.extra.includes('auto_increment')) {
      insertPayload.id = await nextNumericId('user_settings');
    }
  }

  try {
    await db('user_settings').insert(insertPayload);
  } catch (err) {
    if (String(err && err.message || '').toLowerCase().includes('duplicate')) {
      await db('user_settings').where({ user_id: userId }).update(updatePayload);
    } else {
      throw err;
    }
  }
  return db('user_settings').where({ user_id: userId }).first();
};

async function paginateTable(req, reply, table, where = {}, orderColumn = 'created_at') {
  const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
  const query = db(table).where(where).orderBy(orderColumn, 'desc').limit(limit).offset(offset);
  const countQuery = db(table).where(where).count({ cnt: 'id' }).first();
  const [rows, countRow] = await Promise.all([query, countQuery]);
  const total = parseInt((countRow && (countRow.cnt || Object.values(countRow)[0])) || 0, 10);
  return reply.send(buildPaginatedResponse(req, { data: rows || [], page, perPage, total }));
}

async function sendPaginated(req, reply, { data, page, perPage, total }) {
  return reply.send(buildPaginatedResponse(req, { data, page, perPage, total }));
}

async function toggleSavedItem({ userId, targetId, targetType }) {
  const existing = await db('saved_items').where({ user_id: userId, target_id: targetId, target_type: targetType }).first();
  if (existing) {
    await db('saved_items').where({ id: existing.id }).del();
    return { id: targetId, saved: false };
  }
  const id = uuidv4();
  await db('saved_items').insert({ id, user_id: userId, target_id: targetId, target_type: targetType, created_at: now() });
  return { id: targetId, saved: true };
}

async function createGenericReport({ userId, targetId, targetType, reason = null, details = null }) {
  const id = uuidv4();
  const payload = { id, user_id: userId, target_id: targetId, target_type: targetType, reason, details, created_at: now() };
  await db('generic_reports').insert(payload);
  return payload;
}

function requireAdmin(req, reply) {
  const actor = req.user || null;
  if (!actor) {
    reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
    return false;
  }
  if (actor.role !== 'admin') {
    reply.code(403).send({ success: false, error: { code: 'forbidden' } });
    return false;
  }
  return true;
}

function normalizeReportType(value) {
  return ({
    posts: 'post',
    comments: 'comment',
    questions: 'question',
    answers: 'answer',
    pages: 'page',
    jobs: 'job'
  })[value] || value;
}

function applyGenericReportTypeWhere(query, targetType) {
  return query.whereRaw(
    'CAST(target_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci',
    [targetType]
  );
}

function applyGenericReportTargetWhere(query, targetId, targetType) {
  return query
    .whereRaw(
      'CAST(r.target_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci',
      [targetId]
    )
    .whereRaw(
      'CAST(r.target_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci',
      [targetType]
    );
}

async function reportCountRows(targetType) {
  const rows = [];
  const generic = await applyGenericReportTypeWhere(db('generic_reports'), targetType).select('target_id').count({ reports_count: 'id' }).groupBy('target_id');
  rows.push(...generic);

  const totals = new Map();
  for (const row of rows) {
    const id = row.target_id;
    const count = parseInt(row.reports_count || 0, 10);
    if (!id) continue;
    totals.set(id, (totals.get(id) || 0) + count);
  }
  return [...totals.entries()]
    .map(([targetId, reportsCount]) => ({ targetId, reportsCount }))
    .sort((a, b) => b.reportsCount - a.reportsCount);
}

async function reportDetails(targetType, targetId) {
  const query = db('generic_reports as r')
    .leftJoin('users as u', 'u.id', 'r.user_id')
    .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
    .select('r.*', 'u.email as reporter_email', db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as reporter_name'), 'up.avatar as reporter_avatar');
  const rows = await applyGenericReportTargetWhere(query, targetId, targetType);
  return rows.map(mapReportRow);
}

function mapReportRow(row) {
  return {
    id: row.id,
    reason: row.reason || null,
    details: row.details || null,
    created_at: row.created_at,
    reporter: {
      id: row.user_id,
      name: row.reporter_name || null,
      email: row.reporter_email || null,
      avatar: row.reporter_avatar || null,
      avatarUrl: row.reporter_avatar || null
    }
  };
}

async function targetPayload({ targetType, targetId, repositories }) {
  if (targetType === 'post') return repositories.postRepository.findById(targetId, { includeHidden: true });
  if (targetType === 'comment') {
    const comment = await repositories.commentRepository.findById(targetId, { includeHidden: true });
    if (!comment) return null;
    return { ...comment, commentable: await repositories.postRepository.findById(comment.post_id, { includeHidden: true }) };
  }
  if (targetType === 'question') return repositories.questionRepository.findById(targetId, { includeHidden: true });
  if (targetType === 'answer') {
    const answer = await repositories.answerRepository.findById(targetId, { includeHidden: true });
    if (!answer) return null;
    return { ...answer, question: await repositories.questionRepository.findById(answer.question_id, { includeHidden: true }) };
  }
  if (targetType === 'page') return db('pages').where({ id: targetId }).first();
  if (targetType === 'job') return db('jobs').where({ id: targetId }).first();
  return null;
}

function moderationStatusForAction(action) {
  const normalized = String(action || '').toLowerCase();
  if (normalized === 'approve') return 'approved';
  if (normalized === 'suspend') return 'suspended';
  if (normalized === 'unsuspend') return 'approved';
  if (normalized === 'delete') return 'deleted';
  return null;
}

function moderationMessage(targetType, action) {
  return ({
    approve: `${targetType} approved successfully`,
    suspend: `${targetType} suspended successfully`,
    unsuspend: `${targetType} unsuspended successfully`,
    delete: `${targetType} deleted successfully`
  })[String(action || '').toLowerCase()] || `${targetType} moderated successfully`;
}

async function updateModerationTarget({ targetType, targetId, action, actorId }) {
  const status = moderationStatusForAction(action);
  if (!status) throw new Error('invalid_moderation_action');
  const updatedAt = now();

  if (targetType === 'post') {
    await db('posts').where({ id: targetId }).update({ moderation_status: status, updated_at: updatedAt });
    return db('posts').where({ id: targetId }).first();
  }
  if (targetType === 'comment') {
    await db('comments').where({ id: targetId }).update({ moderation_status: status, updated_at: updatedAt });
    return db('comments').where({ id: targetId }).first();
  }
  if (targetType === 'question') {
    await db('questions').where({ id: targetId }).update({ moderation_status: status, updated_at: updatedAt });
    return db('questions').where({ id: targetId }).first();
  }
  if (targetType === 'answer') {
    await db('answers').where({ id: targetId }).update({ moderation_status: status, updated_at: updatedAt });
    return db('answers').where({ id: targetId }).first();
  }
  if (targetType === 'page') {
    const patch = { moderation_status: status, updated_at: updatedAt };
    if (status === 'approved') {
      patch.is_approved = 1;
      patch.is_active = 1;
      patch.approved_at = updatedAt;
      patch.approved_by = actorId;
    }
    if (status === 'suspended' || status === 'deleted') patch.is_active = 0;
    await db('pages').where({ id: targetId }).update(patch);
    return db('pages').where({ id: targetId }).first();
  }
  if (targetType === 'job') {
    await db('jobs').where({ id: targetId }).update({ status, updated_at: updatedAt });
    return db('jobs').where({ id: targetId }).first();
  }
  throw new Error('invalid_report_type');
}

export function makeCompatController({ cloudinary = null } = {}) {
  const postRepository = new MysqlPostRepository();
  const commentRepository = new MysqlCommentRepository();
  const questionRepository = new MysqlQuestionRepository();
  const answerRepository = new MysqlAnswerRepository();
  const states = [
    'Abia',
    'Adamawa',
    'Akwa Ibom',
    'Anambra',
    'Bauchi',
    'Bayelsa',
    'Benue',
    'Borno',
    'Cross River',
    'Delta',
    'Ebonyi',
    'Edo',
    'Ekiti',
    'Enugu',
    'FCT',
    'Gombe',
    'Imo',
    'Jigawa',
    'Kaduna',
    'Kano',
    'Katsina',
    'Kebbi',
    'Kogi',
    'Kwara',
    'Lagos',
    'Nasarawa',
    'Niger',
    'Ogun',
    'Ondo',
    'Osun',
    'Oyo',
    'Plateau',
    'Rivers',
    'Sokoto',
    'Taraba',
    'Yobe',
    'Zamfara'
  ];
  const experience = ['entry-level', 'junior', 'mid-level', 'senior', 'lead', '0-1 years', '1-2 years', '2-3 years', '3-5 years', '5+ years'];
  const jobTypes = ['full-time', 'part-time', 'contract', 'hybrid', 'remote'];

  const parsePictureValue = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    if (typeof value === 'object') {
      const url = value.url || value.path || value.secure_url || value.uri;
      return url ? [url] : [];
    }
    const raw = String(value).trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return parsePictureValue(parsed);
    } catch (_) {
      return raw.split(',').map((item) => item.trim()).filter(Boolean);
    }
  };

  const drainFile = async (file) => {
    if (!file) return;
    for await (const _chunk of file) {
      // consume stream so multipart parsing can finish
    }
  };

  const uploadProjectFile = async (part) => {
    if (!cloudinary || typeof cloudinary.uploadFromStream !== 'function') {
      await drainFile(part.file);
      return part.filename || null;
    }
    const isVideo = (part.mimetype || '').startsWith('video/');
    const isDocument = !isVideo && !(part.mimetype || '').startsWith('image/');
    const result = await cloudinary.uploadFromStream(part.file, {
      folder: isVideo
        ? (process.env.CLOUDINARY_FOLDER_VIDEOS || process.env.CLOUDINARY_FOLDER_POSTS || 'posts')
        : isDocument
          ? (process.env.CLOUDINARY_FOLDER_DOCS || 'documents')
          : (process.env.CLOUDINARY_FOLDER_POSTS || 'posts'),
      resource_type: isVideo ? 'video' : (isDocument ? 'raw' : 'image')
    });
    return result.secure_url || result.url || null;
  };

  const parseProjectBody = async (req) => {
    if (!req.isMultipart || !req.isMultipart()) {
      const body = { ...(req.body || {}) };
      return { ...body, pictures: parsePictureValue(body.pictures || body.image || body.file) };
    }

    const body = {};
    const pictures = [];
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const uploaded = await uploadProjectFile(part);
        if (uploaded) pictures.push(uploaded);
        continue;
      }
      const key = part.fieldname;
      const value = part.value;
      if (key === 'pictures' || key === 'pictures[]' || key === 'image' || key === 'file') {
        pictures.push(...parsePictureValue(value));
      } else if (typeof body[key] === 'undefined') {
        body[key] = value;
      } else {
        body[key] = Array.isArray(body[key]) ? [...body[key], value] : [body[key], value];
      }
    }
    body.pictures = pictures;
    return body;
  };

  return {
    listEnums: async (req, reply) => reply.send({
      success: true,
      data: {
        experience,
        states,
        jobTypes,
        job_types: jobTypes,
        workModes: ['remote', 'hybrid', 'onsite'],
        work_modes: ['remote', 'hybrid', 'onsite'],
        jobStatuses: ['draft', 'pending_review', 'approved', 'active', 'closed', 'archived'],
        job_statuses: ['draft', 'pending_review', 'approved', 'active', 'closed', 'archived'],
        freelancerStatuses: ['draft', 'pending_review', 'available', 'certified', 'suspended'],
        freelancer_statuses: ['draft', 'pending_review', 'available', 'certified', 'suspended'],
        reportTargetTypes: ['post', 'question', 'answer', 'comment', 'page', 'job'],
        report_target_types: ['post', 'question', 'answer', 'comment', 'page', 'job'],
        privacyLevels: { public: 1, followers: 2, private: 3 }
      }
    }),

    sendContact: async (req, reply) => {
      const { name, email, subject, message } = req.body || {};
      if (!name || !email || !message) {
        return reply.code(422).send({ success: false, message: 'Validation failed', data: null });
      }
      return reply.code(201).send({ success: true, message: 'Your message has been sent successfully!', data: [] });
    },

    sendReferrals: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const emails = csv((req.body || {}).emails);
        if (emails.length === 0) return reply.code(422).send({ success: false, message: 'emails is required', data: null });
        const rows = emails.map((email) => ({ id: uuidv4(), sender_user_id: userId, email, status: 'queued', created_at: now(), updated_at: now() }));
        await db('user_referrals').insert(rows);
        return reply.send({ success: true, message: 'Referral emails are being sent.', data: emails });
      } catch (err) {
        compatLogger.error('sendReferrals failed', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getPrivacy: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const row = await db('user_settings').where({ user_id: userId }).first();
      return reply.send({
        success: true,
        message: 'Privacy settings fetched successfully',
        data: {
          user_id: userId,
          privacy: parseJsonObject(row && row.privacy),
          ...(parseJsonObject(row && row.privacy))
        }
      });
    },

    updatePrivacy: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const existing = await db('user_settings').where({ user_id: userId }).first();
      const nextPrivacy = { ...parseJsonObject(existing && existing.privacy), ...(req.body || {}) };
      await saveUserSettings(userId, { privacy: JSON.stringify(nextPrivacy) });
      await invalidateUserProfileCache(req, userId);
      return reply.send({ success: true, message: 'Privacy settings updated successfully', data: [] });
    },

    getSettings: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const row = await db('user_settings').where({ user_id: userId }).first();
      const settings = normalizeSettings({
        ...settingsFromNotificationPreferences(parseJsonObject(row && row.notification_preferences)),
        ...parseJsonObject(row && row.settings)
      });
      return reply.send({
        success: true,
        message: 'Settings fetched successfully',
        data: {
          user_id: userId,
          settings,
          ...settings
        }
      });
    },

    updateSettings: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const body = req.body || {};
      const existing = await db('user_settings').where({ user_id: userId }).first();
      const currentSettings = parseJsonObject(existing && existing.settings);
      const normalized = normalizeSettings({ ...currentSettings, ...body });
      const notificationPreferences = notificationPreferencesFromSettings(normalized);
      for (const key of Object.keys(normalized)) {
        if (typeof normalized[key] === 'undefined') delete normalized[key];
      }
      await saveUserSettings(userId, {
        settings: JSON.stringify(normalized),
        notification_preferences: JSON.stringify(notificationPreferences)
      });
      await invalidateUserProfileCache(req, userId);
      return reply.send({ success: true, message: 'Settings updated successfully', data: { user_id: userId, ...normalized } });
    },

    disableAccount: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      await db('users').where({ id: userId }).update({ disabled_at: now(), updated_at: now() });
      return reply.send({ success: true, message: 'Your account has been disabled successfully.', data: [] });
    },

    sendNotificationEmailOtp: async (req, reply) => {
      const userId = actorId(req);
      const { notification_email: notificationEmail } = req.body || {};
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      if (!notificationEmail) return reply.code(422).send({ success: false, message: 'notification_email is required', data: null });
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await saveUserSettings(userId, { notification_email: notificationEmail, notification_email_otp: otp });
      return reply.send({ success: true, message: `OTP sent to ${notificationEmail}`, data: process.env.NODE_ENV === 'production' ? {} : { otp } });
    },

    verifyNotificationEmail: async (req, reply) => {
      const userId = actorId(req);
      const { otp } = req.body || {};
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const row = await db('user_settings').where({ user_id: userId }).first();
      if (!row || row.notification_email_otp !== String(otp || '')) {
        return reply.code(422).send({ success: false, message: 'Invalid OTP', data: null });
      }
      await db('user_settings').where({ user_id: userId }).update({ notification_email_verified_at: now(), notification_email_otp: null, updated_at: now() });
      return reply.send({ success: true, message: 'Email verified successfully', data: { notification_email: row.notification_email } });
    },

    listNotifications: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      return paginateTable(req, reply, 'notifications', { user_id: userId });
    },

    unreadNotificationCount: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const row = await db('notifications').where({ user_id: userId, is_read: 0 }).count({ cnt: 'id' }).first();
      return reply.send({ success: true, data: { count: parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10) } });
    },

    markNotificationsRead: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const ids = Array.isArray((req.body || {}).ids) ? req.body.ids : [];
      if (ids.length) await db('notifications').where({ user_id: userId }).whereIn('id', ids).update({ is_read: 1 });
      return reply.send({ success: true, data: { ids } });
    },

    markAllNotificationsRead: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      await db('notifications').where({ user_id: userId }).update({ is_read: 1 });
      return reply.send({ success: true, data: [] });
    },

    markNotificationRead: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      await db('notifications').where({ user_id: userId, id: req.params.id }).update({ is_read: 1 });
      return reply.send({ success: true, data: { id: req.params.id } });
    },

    listUserPosts: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const search = queryText(req);
      const [data, total] = await Promise.all([
        postRepository.listByUser(userId, { limit, offset, actorId: userId, search }),
        postRepository.countByUser(userId, { search })
      ]);
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listUserComments: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const search = queryText(req);
      const rows = await commentRepository.listByUser(userId, { limit, offset, actorId: userId, search });
      const data = await Promise.all(rows.map(async (comment) => ({
        ...comment,
        commentable: await postRepository.findById(comment.post_id, { userId })
      })));
      const total = await commentRepository.countByUser(userId, { search });
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listUserQuestions: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const search = queryText(req);
      const [data, total] = await Promise.all([
        questionRepository.listByUser(userId, { limit, offset, search }),
        questionRepository.countByUser(userId, { search })
      ]);
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listUserAnswers: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const search = queryText(req);
      const rows = await answerRepository.listByUser(userId, { limit, offset, actorId: userId, search });
      const data = await Promise.all(rows.map(async (answer) => ({
        ...answer,
        question: await questionRepository.findById(answer.question_id)
      })));
      const total = await answerRepository.countByUser(userId, { search });
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listSavedPosts: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const search = queryText(req);
      const savesQuery = db('post_saves as ps').where('ps.user_id', userId).orderBy('ps.created_at', 'desc').limit(limit).offset(offset).select('ps.*');
      const countQuery = db('post_saves as ps').where('ps.user_id', userId).count({ cnt: 'ps.id' }).first();
      if (search) {
        savesQuery.leftJoin('posts as p', 'p.id', 'ps.post_id').andWhere((builder) => {
          builder.where('p.title', 'like', likeText(search)).orWhere('p.content', 'like', likeText(search));
        });
        countQuery.leftJoin('posts as p', 'p.id', 'ps.post_id').andWhere((builder) => {
          builder.where('p.title', 'like', likeText(search)).orWhere('p.content', 'like', likeText(search));
        });
      }
      const saves = await savesQuery;
      const data = await Promise.all((saves || []).map(async (save) => {
        const feed = await postRepository.findById(save.post_id, { userId });
        return feed ? { ...feed, saved_at: save.created_at, save_id: save.id } : null;
      }));
      const countRow = await countQuery;
      const total = parseInt((countRow && (countRow.cnt || Object.values(countRow)[0])) || 0, 10);
      return sendPaginated(req, reply, { data: data.filter(Boolean), page, perPage, total });
    },
    listSavedQuestions: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const search = queryText(req);
      const savesQuery = db('saved_items as si').where({ 'si.user_id': userId, 'si.target_type': 'question' }).orderBy('si.created_at', 'desc').limit(limit).offset(offset).select('si.*');
      const countQuery = db('saved_items as si').where({ 'si.user_id': userId, 'si.target_type': 'question' }).count({ cnt: 'si.id' }).first();
      if (search) {
        savesQuery.leftJoin('questions as q', 'q.id', 'si.target_id').andWhere((builder) => {
          builder.where('q.title', 'like', likeText(search)).orWhere('q.content', 'like', likeText(search));
        });
        countQuery.leftJoin('questions as q', 'q.id', 'si.target_id').andWhere((builder) => {
          builder.where('q.title', 'like', likeText(search)).orWhere('q.content', 'like', likeText(search));
        });
      }
      const saves = await savesQuery;
      const data = await Promise.all((saves || []).map(async (save) => {
        const question = await questionRepository.findById(save.target_id);
        return question ? { ...question, saved_at: save.created_at, save_id: save.id } : null;
      }));
      const countRow = await countQuery;
      const total = parseInt((countRow && (countRow.cnt || Object.values(countRow)[0])) || 0, 10);
      return sendPaginated(req, reply, { data: data.filter(Boolean), page, perPage, total });
    },
    listPostScores: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const search = queryText(req);
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const query = db('post_reactions as r')
        .leftJoin('posts as p', 'p.id', 'r.post_id')
        .where('r.user_id', userId)
        .whereNotIn('p.moderation_status', ['suspended', 'deleted']);
      const countQuery = db('post_reactions as r')
        .leftJoin('posts as p', 'p.id', 'r.post_id')
        .where('r.user_id', userId)
        .whereNotIn('p.moderation_status', ['suspended', 'deleted'])
        .count({ cnt: 'r.id' })
        .first();
      if (search) {
        query.andWhere((builder) => {
          builder.where('p.title', 'like', likeText(search)).orWhere('p.content', 'like', likeText(search));
        });
        countQuery.andWhere((builder) => {
          builder.where('p.title', 'like', likeText(search)).orWhere('p.content', 'like', likeText(search));
        });
      }
      const [rows, countRow] = await Promise.all([
        query.select('r.*').orderBy('r.created_at', 'desc').limit(limit).offset(offset),
        countQuery
      ]);
      const data = (await Promise.all((rows || []).map(async (reaction) => {
        const post = await postRepository.findById(reaction.post_id, { userId });
        return post ? { ...post, scored_at: reaction.created_at, score_id: reaction.id, reaction_type: reaction.type || 'like' } : null;
      }))).filter(Boolean);
      return sendPaginated(req, reply, { data, page, perPage, total: parseInt((countRow && (countRow.cnt || Object.values(countRow)[0])) || 0, 10) });
    },
    listCommentScores: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const search = queryText(req);
      if (!search) return paginateTable(req, reply, 'comment_reactions', { user_id: userId });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const query = db('comment_reactions as r').leftJoin('comments as c', 'c.id', 'r.comment_id').where('r.user_id', userId).where('c.content', 'like', likeText(search)).select('r.*').orderBy('r.created_at', 'desc').limit(limit).offset(offset);
      const countQuery = db('comment_reactions as r').leftJoin('comments as c', 'c.id', 'r.comment_id').where('r.user_id', userId).where('c.content', 'like', likeText(search)).count({ cnt: 'r.id' }).first();
      const [data, countRow] = await Promise.all([query, countQuery]);
      return sendPaginated(req, reply, { data, page, perPage, total: parseInt((countRow && (countRow.cnt || Object.values(countRow)[0])) || 0, 10) });
    },
    listAnswerScores: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const search = queryText(req);
      if (!search) return paginateTable(req, reply, 'answer_reactions', { user_id: userId });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const query = db('answer_reactions as r').leftJoin('answers as a', 'a.id', 'r.answer_id').where('r.user_id', userId).where('a.content', 'like', likeText(search)).select('r.*').orderBy('r.created_at', 'desc').limit(limit).offset(offset);
      const countQuery = db('answer_reactions as r').leftJoin('answers as a', 'a.id', 'r.answer_id').where('r.user_id', userId).where('a.content', 'like', likeText(search)).count({ cnt: 'r.id' }).first();
      const [data, countRow] = await Promise.all([query, countQuery]);
      return sendPaginated(req, reply, { data, page, perPage, total: parseInt((countRow && (countRow.cnt || Object.values(countRow)[0])) || 0, 10) });
    },

    addLegacySkills: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const skills = csv((req.body || {}).skills || (req.body || {}).skill);
      if (!skills.length) return reply.code(422).send({ success: false, message: 'skills is required', data: null });
      const rows = skills.map((skill) => ({ id: uuidv4(), user_id: userId, skill, level: null, created_at: now() }));
      await db('user_skills').insert(rows);
      return reply.code(201).send({ success: true, message: 'Skill added', data: rows });
    },

    toggleGenericSave: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { id, q } = req.body || {};
      const targetType = ({ p: 'post', q: 'question', a: 'answer', c: 'comment' })[q] || q;
      if (!id || !targetType) return reply.code(422).send({ success: false, message: 'id and q are required', data: null });
      if (targetType === 'post') {
        const existing = await db('post_saves').where({ user_id: userId, post_id: id }).first();
        if (existing) {
          await db('post_saves').where({ id: existing.id }).del();
          return reply.send({ success: true, data: { id, saved: false } });
        }
        await db('post_saves').insert({ id: uuidv4(), user_id: userId, post_id: id, created_at: now() });
        return reply.send({ success: true, data: { id, saved: true } });
      }
      return reply.send({ success: true, data: await toggleSavedItem({ userId, targetId: id, targetType }) });
    },

    saveQuestion: async (req, reply) => reply.send({ success: true, data: await toggleSavedItem({ userId: actorId(req), targetId: req.params.id, targetType: 'question' }) }),
    saveAnswer: async (req, reply) => reply.send({ success: true, data: await toggleSavedItem({ userId: actorId(req), targetId: req.params.id, targetType: 'answer' }) }),
    saveComment: async (req, reply) => reply.send({ success: true, data: await toggleSavedItem({ userId: actorId(req), targetId: req.params.id, targetType: 'comment' }) }),

    genericReport: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { id, q, report_reason_id: reasonId, additional_notes: notes } = req.body || {};
      const targetType = ({ p: 'post', q: 'question', a: 'answer', c: 'comment' })[q] || q;
      if (!id || !targetType) return reply.code(422).send({ success: false, message: 'id and q are required', data: null });
      return reply.send({ success: true, message: 'Report submitted successfully', data: await createGenericReport({ userId, targetId: id, targetType, reason: reasonId || null, details: notes || null }) });
    },

    reportQuestion: async (req, reply) => reply.code(201).send({ success: true, message: 'Question reported successfully', data: await createGenericReport({ userId: actorId(req), targetId: req.params.id, targetType: 'question', reason: (req.body || {}).reason || (req.body || {}).report_reason_id || null, details: (req.body || {}).details || (req.body || {}).additional_notes || null }) }),
    reportAnswer: async (req, reply) => reply.code(201).send({ success: true, message: 'Answer reported successfully', data: await createGenericReport({ userId: actorId(req), targetId: req.params.id, targetType: 'answer', reason: (req.body || {}).reason || (req.body || {}).report_reason_id || null, details: (req.body || {}).details || (req.body || {}).additional_notes || null }) }),
    reportPage: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const body = req.body || {};
      const data = await createGenericReport({ userId, targetId: req.params.id, targetType: 'page', reason: body.reason || body.report_reason_id || null, details: body.details || body.additional_notes || null });
      return reply.code(201).send({ success: true, message: 'Page reported successfully', data });
    },
    reportJob: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const body = req.body || {};
      const data = await createGenericReport({ userId, targetId: req.params.id, targetType: 'job', reason: body.reason || body.report_reason_id || null, details: body.details || body.additional_notes || null });
      return reply.code(201).send({ success: true, message: 'Job reported successfully', data });
    },
    listReportedTargets: async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const targetType = normalizeReportType((req.params && req.params.type) || (req.query && req.query.type));
      const allowed = new Set(['post', 'comment', 'question', 'answer', 'page', 'job']);
      if (!allowed.has(targetType)) return reply.code(422).send({ success: false, error: { code: 'invalid_report_type' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const allRows = await reportCountRows(targetType);
      const pageRows = allRows.slice(offset, offset + limit);
      const repositories = { postRepository, commentRepository, questionRepository, answerRepository };
      const data = (await Promise.all(pageRows.map(async (row) => {
        const target = await targetPayload({ targetType, targetId: row.targetId, repositories });
        if (!target) return null;
        return {
          targetType,
          targetId: row.targetId,
          reports_count: row.reportsCount,
          reportsCount: row.reportsCount,
          data: target,
          target,
          reports: await reportDetails(targetType, row.targetId)
        };
      }))).filter(Boolean);
      return sendPaginated(req, reply, { data, page, perPage, total: allRows.length });
    },
    listAllReportedTargets: async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const types = ['post', 'comment', 'question', 'answer', 'page', 'job'];
      const repositories = { postRepository, commentRepository, questionRepository, answerRepository };
      const data = {};
      for (const targetType of types) {
        const rows = await reportCountRows(targetType);
        data[targetType === 'post' ? 'posts' : `${targetType}s`] = (await Promise.all(rows.map(async (row) => {
          const target = await targetPayload({ targetType, targetId: row.targetId, repositories });
          if (!target) return null;
          return {
            targetType,
            targetId: row.targetId,
            reports_count: row.reportsCount,
            reportsCount: row.reportsCount,
            data: target,
            target,
            reports: await reportDetails(targetType, row.targetId)
          };
        }))).filter(Boolean);
      }
      return reply.send({ success: true, message: 'Reported items fetched successfully', data });
    },
    moderateReportedTarget: async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const targetType = normalizeReportType((req.params && req.params.type) || (req.body && req.body.targetType));
      const targetId = (req.params && req.params.id) || (req.body && (req.body.targetId || req.body.id));
      const action = (req.params && req.params.action) || (req.body && req.body.action);
      const allowed = new Set(['post', 'comment', 'question', 'answer', 'page', 'job']);
      if (!allowed.has(targetType) || !targetId) {
        return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
      }
      try {
        const updated = await updateModerationTarget({ targetType, targetId, action, actorId: actorId(req) });
        if (!updated) return reply.code(404).send({ success: false, error: { code: 'target_not_found' } });
        const repositories = { postRepository, commentRepository, questionRepository, answerRepository };
        const target = await targetPayload({ targetType, targetId, repositories });
        return reply.send({
          success: true,
          message: moderationMessage(targetType, action),
          data: {
            targetType,
            targetId,
            action,
            status: moderationStatusForAction(action),
            target: target || updated
          }
        });
      } catch (err) {
        if (err.message === 'invalid_moderation_action') {
          return reply.code(422).send({ success: false, error: { code: 'invalid_moderation_action' } });
        }
        throw err;
      }
    },
    reportReasons: async (req, reply) => reply.send({ success: true, data: [
      { id: 'spam', name: 'Spam' },
      { id: 'abuse', name: 'Abuse or harassment' },
      { id: 'misleading', name: 'Misleading information' },
      { id: 'other', name: 'Other' }
    ] }),

    emptyPaginated: async (req, reply) => {
      const { page, perPage } = parsePagination(req.query || {}, 20);
      return reply.send(buildPaginatedResponse(req, { data: [], page, perPage, total: 0 }));
    },

    listEducationRoot: async (req, reply) => paginateTable(req, reply, 'user_education', { user_id: actorId(req) }),
    createEducationRoot: async (req, reply) => {
      const userId = actorId(req);
      const body = req.body || {};
      const row = {
        id: uuidv4(),
        user_id: userId,
        school: body.school || body.name || null,
        degree: body.degree || body.course || null,
        field: body.field || null,
        start_date: formatDateForSql(body.startDate || body.start_date || null),
        end_date: formatDateForSql(body.endDate || body.end_date || null),
        created_at: now(),
        updated_at: now()
      };
      await db('user_education').insert(row);
      return reply.code(201).send({ success: true, data: row });
    },
    updateEducationRoot: async (req, reply) => {
      const body = req.body || {};
      const updates = { ...body };
      if (typeof body.startDate !== 'undefined' || typeof body.start_date !== 'undefined') updates.start_date = formatDateForSql(body.startDate || body.start_date || null);
      if (typeof body.endDate !== 'undefined' || typeof body.end_date !== 'undefined') updates.end_date = formatDateForSql(body.endDate || body.end_date || null);
      updates.updated_at = now();
      await db('user_education').where({ id: req.params.id, user_id: actorId(req) }).update(updates);
      const row = await db('user_education').where({ id: req.params.id, user_id: actorId(req) }).first();
      return reply.send({ success: true, data: row });
    },
    deleteEducationRoot: async (req, reply) => {
      await db('user_education').where({ id: req.params.id, user_id: actorId(req) }).del();
      return reply.send({ success: true, data: { id: req.params.id } });
    },

    listExperienceRoot: async (req, reply) => paginateTable(req, reply, 'user_experiences', { user_id: actorId(req) }),
    createExperienceRoot: async (req, reply) => {
      const userId = actorId(req);
      const body = req.body || {};
      const row = {
        id: uuidv4(),
        user_id: userId,
        company: body.company || null,
        title: body.title || body.role || null,
        employment_type: body.employmentType || body.employment_type || null,
        start_date: formatDateForSql(body.startDate || body.start_date || null),
        end_date: formatDateForSql(body.endDate || body.end_date || null),
        is_current: body.isCurrent || body.is_current || 0,
        description: body.description || null,
        created_at: now(),
        updated_at: now()
      };
      await db('user_experiences').insert(row);
      return reply.code(201).send({ success: true, data: row });
    },
    updateExperienceRoot: async (req, reply) => {
      const body = req.body || {};
      const updates = { ...body };
      if (typeof body.startDate !== 'undefined' || typeof body.start_date !== 'undefined') updates.start_date = formatDateForSql(body.startDate || body.start_date || null);
      if (typeof body.endDate !== 'undefined' || typeof body.end_date !== 'undefined') updates.end_date = formatDateForSql(body.endDate || body.end_date || null);
      updates.updated_at = now();
      await db('user_experiences').where({ id: req.params.id, user_id: actorId(req) }).update(updates);
      const row = await db('user_experiences').where({ id: req.params.id, user_id: actorId(req) }).first();
      return reply.send({ success: true, data: row });
    },
    deleteExperienceRoot: async (req, reply) => {
      await db('user_experiences').where({ id: req.params.id, user_id: actorId(req) }).del();
      return reply.send({ success: true, data: { id: req.params.id } });
    },

    listCertificationRoot: async (req, reply) => paginateTable(req, reply, 'user_certifications', { user_id: actorId(req) }),
    createCertificationRoot: async (req, reply) => {
      const userId = actorId(req);
      const body = req.body || {};
      const row = {
        id: uuidv4(),
        user_id: userId,
        name: body.name || body.title || null,
        issuer: body.issuer || null,
        issue_date: formatDateForSql(body.issueDate || body.issue_date || body.date || null),
        created_at: now(),
        updated_at: now()
      };
      await db('user_certifications').insert(row);
      return reply.code(201).send({ success: true, data: row });
    },
    updateCertificationRoot: async (req, reply) => {
      await db('user_certifications').where({ id: req.params.id, user_id: actorId(req) }).update({ ...req.body, updated_at: now() });
      const row = await db('user_certifications').where({ id: req.params.id, user_id: actorId(req) }).first();
      return reply.send({ success: true, data: row });
    },
    deleteCertificationRoot: async (req, reply) => {
      await db('user_certifications').where({ id: req.params.id, user_id: actorId(req) }).del();
      return reply.send({ success: true, data: { id: req.params.id } });
    },

    listProjectRoot: async (req, reply) => paginateTable(req, reply, 'user_portfolios', { user_id: actorId(req) }),
    createProjectRoot: async (req, reply) => {
      const userId = actorId(req);
      const body = await parseProjectBody(req);
      const row = { id: uuidv4(), user_id: userId, title: body.title || null, description: body.description || null, link: body.link || body.url || null, pictures: JSON.stringify(body.pictures || []), created_at: now(), updated_at: now() };
      await db('user_portfolios').insert(row);
      return reply.code(201).send({ success: true, data: row });
    },
    updateProjectRoot: async (req, reply) => {
      const body = await parseProjectBody(req);
      const patch = { ...body, updated_at: now() };
      if (Array.isArray(patch.pictures)) patch.pictures = JSON.stringify(patch.pictures);
      await db('user_portfolios').where({ id: req.params.id, user_id: actorId(req) }).update(patch);
      const row = await db('user_portfolios').where({ id: req.params.id, user_id: actorId(req) }).first();
      return reply.send({ success: true, data: row });
    },
    deleteProjectRoot: async (req, reply) => {
      await db('user_portfolios').where({ id: req.params.id, user_id: actorId(req) }).del();
      return reply.send({ success: true, data: { id: req.params.id } });
    }
  };
}
