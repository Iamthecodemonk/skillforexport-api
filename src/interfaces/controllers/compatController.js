import { v4 as uuidv4 } from 'uuid';
import db from '../../infrastructure/knexConfig.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';
import logger from '../../utils/logger.js';

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

export function makeCompatController() {
  return {
    listEnums: async (req, reply) => reply.send({
      success: true,
      data: {
        jobTypes: ['full-time', 'part-time', 'contract', 'hybrid', 'remote'],
        workModes: ['remote', 'hybrid', 'onsite'],
        jobStatuses: ['draft', 'pending_review', 'approved', 'active', 'closed', 'archived'],
        freelancerStatuses: ['draft', 'pending_review', 'available', 'certified', 'suspended'],
        reportTargetTypes: ['post', 'question', 'answer', 'comment'],
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
      await db('user_settings')
        .insert({ id: uuidv4(), user_id: userId, settings: JSON.stringify(req.body || {}), created_at: now(), updated_at: now() })
        .onConflict('user_id')
        .merge({ settings: JSON.stringify(req.body || {}), updated_at: now() });
      return reply.send({ success: true, message: 'Settings updated successfully', data: { user_id: userId, ...(req.body || {}) } });
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

    listUserPosts: async (req, reply) => paginateTable(req, reply, 'posts', { user_id: actorId(req) }),
    listUserComments: async (req, reply) => paginateTable(req, reply, 'comments', { user_id: actorId(req) }),
    listUserQuestions: async (req, reply) => paginateTable(req, reply, 'questions', { user_id: actorId(req) }),
    listUserAnswers: async (req, reply) => paginateTable(req, reply, 'answers', { user_id: actorId(req) }),
    listSavedPosts: async (req, reply) => paginateTable(req, reply, 'post_saves', { user_id: actorId(req) }),
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
      return reply.send({ success: true, data: await createGenericReport({ userId, targetId: id, targetType, reason: reasonId || null, details: notes || null }) });
    },

    reportQuestion: async (req, reply) => reply.code(201).send({ success: true, data: await createGenericReport({ userId: actorId(req), targetId: req.params.id, targetType: 'question', reason: (req.body || {}).reason || (req.body || {}).report_reason_id || null, details: (req.body || {}).details || (req.body || {}).additional_notes || null }) }),
    reportAnswer: async (req, reply) => reply.code(201).send({ success: true, data: await createGenericReport({ userId: actorId(req), targetId: req.params.id, targetType: 'answer', reason: (req.body || {}).reason || (req.body || {}).report_reason_id || null, details: (req.body || {}).details || (req.body || {}).additional_notes || null }) }),
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
