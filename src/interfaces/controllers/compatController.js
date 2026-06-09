import { v4 as uuidv4 } from 'uuid';
import db from '../../infrastructure/knexConfig.js';
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

export function makeCompatController() {
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

    updatePrivacy: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      await db('user_settings')
        .insert({ id: uuidv4(), user_id: userId, privacy: JSON.stringify(req.body || {}), created_at: now(), updated_at: now() })
        .onConflict('user_id')
        .merge({ privacy: JSON.stringify(req.body || {}), updated_at: now() });
      return reply.send({ success: true, message: 'Privacy settings updated successfully', data: [] });
    },

    updateSettings: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const body = req.body || {};
      const normalized = {
        ...body,
        feature_and_announcement: typeof body.feature_and_announcement !== 'undefined' ? body.feature_and_announcement : body.featureAndAnnouncement,
        featureAndAnnouncement: typeof body.featureAndAnnouncement !== 'undefined' ? body.featureAndAnnouncement : body.feature_and_announcement,
        inbox: typeof body.inbox !== 'undefined' ? body.inbox : body.invox,
        research: body.research,
        recommended: body.recommended,
        alerts: body.alerts,
        profile: body.profile
      };
      for (const key of Object.keys(normalized)) {
        if (typeof normalized[key] === 'undefined') delete normalized[key];
      }
      await db('user_settings')
        .insert({ id: uuidv4(), user_id: userId, settings: JSON.stringify(normalized), created_at: now(), updated_at: now() })
        .onConflict('user_id')
        .merge({ settings: JSON.stringify(normalized), updated_at: now() });
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
      await db('user_settings')
        .insert({ id: uuidv4(), user_id: userId, notification_email: notificationEmail, notification_email_otp: otp, created_at: now(), updated_at: now() })
        .onConflict('user_id')
        .merge({ notification_email: notificationEmail, notification_email_otp: otp, updated_at: now() });
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
      const [data, total] = await Promise.all([
        postRepository.listByUser(userId, { limit, offset, actorId: userId }),
        postRepository.countByUser(userId)
      ]);
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listUserComments: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const rows = await commentRepository.listByUser(userId, { limit, offset, actorId: userId });
      const data = await Promise.all(rows.map(async (comment) => ({
        ...comment,
        commentable: await postRepository.findById(comment.post_id, { userId })
      })));
      const total = await commentRepository.countByUser(userId);
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listUserQuestions: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const [data, total] = await Promise.all([
        questionRepository.listByUser(userId, { limit, offset }),
        questionRepository.countByUser(userId)
      ]);
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listUserAnswers: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const rows = await answerRepository.listByUser(userId, { limit, offset, actorId: userId });
      const data = await Promise.all(rows.map(async (answer) => ({
        ...answer,
        question: await questionRepository.findById(answer.question_id)
      })));
      const total = await answerRepository.countByUser(userId);
      return sendPaginated(req, reply, { data, page, perPage, total });
    },
    listSavedPosts: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
      const saves = await db('post_saves').where({ user_id: userId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
      const data = await Promise.all((saves || []).map(async (save) => {
        const feed = await postRepository.findById(save.post_id, { userId });
        return feed ? { ...feed, saved_at: save.created_at, save_id: save.id } : null;
      }));
      const countRow = await db('post_saves').where({ user_id: userId }).count({ cnt: 'id' }).first();
      const total = parseInt((countRow && (countRow.cnt || Object.values(countRow)[0])) || 0, 10);
      return sendPaginated(req, reply, { data: data.filter(Boolean), page, perPage, total });
    },
    listSavedQuestions: async (req, reply) => paginateTable(req, reply, 'saved_items', { user_id: actorId(req), target_type: 'question' }),
    listPostScores: async (req, reply) => paginateTable(req, reply, 'post_reactions', { user_id: actorId(req) }),
    listCommentScores: async (req, reply) => paginateTable(req, reply, 'comment_reactions', { user_id: actorId(req) }),
    listAnswerScores: async (req, reply) => paginateTable(req, reply, 'answer_reactions', { user_id: actorId(req) }),

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
      const row = { id: uuidv4(), user_id: userId, school: body.school || body.name || null, degree: body.degree || body.course || null, field: body.field || null, start_date: body.startDate || body.start_date || null, end_date: body.endDate || body.end_date || null, created_at: now(), updated_at: now() };
      await db('user_education').insert(row);
      return reply.code(201).send({ success: true, data: row });
    },
    updateEducationRoot: async (req, reply) => {
      await db('user_education').where({ id: req.params.id, user_id: actorId(req) }).update({ ...req.body, updated_at: now() });
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
      const row = { id: uuidv4(), user_id: userId, company: body.company || null, title: body.title || body.role || null, employment_type: body.employmentType || body.employment_type || null, start_date: body.startDate || body.start_date || null, end_date: body.endDate || body.end_date || null, is_current: body.isCurrent || body.is_current || 0, description: body.description || null, created_at: now(), updated_at: now() };
      await db('user_experiences').insert(row);
      return reply.code(201).send({ success: true, data: row });
    },
    updateExperienceRoot: async (req, reply) => {
      await db('user_experiences').where({ id: req.params.id, user_id: actorId(req) }).update({ ...req.body, updated_at: now() });
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
      const row = { id: uuidv4(), user_id: userId, name: body.name || body.title || null, issuer: body.issuer || null, issue_date: body.issueDate || body.issue_date || body.date || null, created_at: now(), updated_at: now() };
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
      const body = req.body || {};
      const row = { id: uuidv4(), user_id: userId, title: body.title || null, description: body.description || null, link: body.link || body.url || null, pictures: JSON.stringify(body.pictures || []), created_at: now(), updated_at: now() };
      await db('user_portfolios').insert(row);
      return reply.code(201).send({ success: true, data: row });
    },
    updateProjectRoot: async (req, reply) => {
      const patch = { ...req.body, updated_at: now() };
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
