import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const parseJsonArray = (value) => {
  if (value === null || typeof value === 'undefined') return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const toBool = (value) => value === true || value === 1 || value === '1';

const applyQuestionFilters = (q, { communityId = null, publicOnly = false, search = null, userId = null } = {}) => {
  if (userId) {
    q.where('q.user_id', userId);
  }

  if (communityId) {
    q.where('q.community_id', communityId);
  } else if (publicOnly) {
    q.whereIn('q.visibility', ['public', 'community_public']);
  }

  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    q.andWhere(function () {
      this.where('q.title', 'like', `%${term}%`)
        .orWhere('q.body', 'like', `%${term}%`)
        .orWhere('up.username', 'like', `%${term}%`)
        .orWhere('up.display_name', 'like', `%${term}%`)
        .orWhere('u.email', 'like', `%${term}%`)
        .orWhere('c.name', 'like', `%${term}%`);
    });
  }
};

const applyQuestionModerationFilter = (q, includeHidden = false) => {
  if (!includeHidden) q.whereNotIn('q.moderation_status', ['suspended', 'deleted']);
};

const applyQuestionOrdering = (q, { sortField = null, sortDirection = null } = {}) => {
  const sortableColumns = {
    created_at: 'q.created_at',
    updated_at: 'q.updated_at',
    title: 'q.title'
  };
  const field = sortableColumns[sortField] || 'q.created_at';
  const direction = String(sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  q.orderBy(field, direction);
  q.orderBy('q.id', direction);
};

export default class MysqlQuestionRepository {
  toQuestionWithRelations(row) {
    if (!row) return null;
    const { user_email, user_name, user_avatar, user_skills, is_follow, community_name, community_description, community_icon, community_is_active, ...question } = row;
    const user = typeof user_email !== 'undefined' || typeof user_name !== 'undefined'
      ? {
          id: question.user_id,
          name: user_name || null,
          email: user_email || null,
          avatar: user_avatar || null,
          avatarUrl: user_avatar || null,
          skills: parseJsonArray(user_skills),
          is_follow: toBool(is_follow),
          isFollow: toBool(is_follow)
        }
      : null;
    return {
      ...question,
      userId: question.user_id,
      communityId: question.community_id,
      isClosed: Boolean(question.is_closed),
      acceptedAnswerId: question.accepted_answer_id || null,
      createdAt: question.created_at,
      updatedAt: question.updated_at,
      totalAnswers: parseInt(question.total_answers || 0, 10),
      totalAnswerers: parseInt(question.total_answerers || 0, 10),
      is_follow: toBool(is_follow),
      isFollow: toBool(is_follow),
      type: 'QUESTION',
      user,
      community: question.community_id
        ? {
            id: question.community_id,
            name: community_name || null,
            description: community_description || null,
            icon: community_icon || null,
            is_active: typeof community_is_active === 'undefined' ? undefined : community_is_active
          }
        : null
    };
  }

  async create(record) {
    const id = record.id || uuidv4();
    const now = new Date();
    await db('questions').insert({
      id,
      user_id: record.user_id || record.userId,
      community_id: record.community_id || record.communityId,
      title: record.title,
      body: record.body,
      visibility: record.visibility || 'public',
      moderation_status: record.moderation_status || record.moderationStatus || 'approved',
      is_closed: typeof record.is_closed !== 'undefined' ? record.is_closed : 0,
      accepted_answer_id: record.accepted_answer_id || record.acceptedAnswerId || null,
      created_at: now,
      updated_at: now
    });
    return this.findById(id);
  }

  async findById(id, { includeHidden = false, actorId = null } = {}) {
    const answerCounts = db('answers')
      .select('question_id')
      .count({ total_answers: 'id' })
      .countDistinct({ total_answerers: 'user_id' })
      .groupBy('question_id')
      .as('ac');

    const q = db('questions as q')
      .leftJoin('users as u', 'u.id', 'q.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .leftJoin('communities as c', 'c.id', 'q.community_id')
      .leftJoin(answerCounts, 'ac.question_id', 'q.id')
      .where('q.id', id)
      .select(
        'q.*',
        'u.email as user_email',
        db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as user_name'),
        'up.avatar as user_avatar',
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', us.id, 'skill', us.skill, 'level', us.level))
          FROM user_skills us
          WHERE us.user_id = q.user_id
        ), JSON_ARRAY()) as user_skills`),
        'c.name as community_name',
        'c.description as community_description',
        'c.icon as community_icon',
        'c.is_active as community_is_active',
        db.raw('COALESCE(ac.total_answers, 0) as total_answers'),
        db.raw('COALESCE(ac.total_answerers, 0) as total_answerers')
      );
    if (actorId) {
      q.select(db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = q.user_id) as is_follow', [actorId]));
    } else {
      q.select(db.raw('false as is_follow'));
    }
    applyQuestionModerationFilter(q, includeHidden);
    const row = await q.first();

    return this.toQuestionWithRelations(row);
  }

  async list(options = {}) {
    const { limit = 20, offset = 0, actorId = null } = options;
    const q = db('questions as q')
      .leftJoin('communities as c', 'c.id', 'q.community_id')
      .leftJoin('users as u', 'u.id', 'q.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .leftJoin(
        db('answers')
          .select('question_id')
          .count({ total_answers: 'id' })
          .countDistinct({ total_answerers: 'user_id' })
          .groupBy('question_id')
          .as('ac'),
        'ac.question_id',
        'q.id'
      )
      .limit(limit)
      .offset(offset)
      .select(
        'q.*',
        'u.email as user_email',
        db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as user_name'),
        'up.avatar as user_avatar',
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', us.id, 'skill', us.skill, 'level', us.level))
          FROM user_skills us
          WHERE us.user_id = q.user_id
        ), JSON_ARRAY()) as user_skills`),
        'c.name as community_name',
        'c.description as community_description',
        'c.icon as community_icon',
        'c.is_active as community_is_active',
        db.raw('COALESCE(ac.total_answers, 0) as total_answers'),
        db.raw('COALESCE(ac.total_answerers, 0) as total_answerers')
      );
    if (actorId) {
      q.select(db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = q.user_id) as is_follow', [actorId]));
    } else {
      q.select(db.raw('false as is_follow'));
    }
    applyQuestionFilters(q, options);
    applyQuestionModerationFilter(q, options.includeHidden);
    applyQuestionOrdering(q, options);
    const rows = await q;
    return rows.map(row => this.toQuestionWithRelations(row));
  }

  async countAll(filters = {}) {
    const q = db('questions as q')
      .leftJoin('communities as c', 'c.id', 'q.community_id')
      .leftJoin('users as u', 'u.id', 'q.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .countDistinct({ cnt: 'q.id' });
    applyQuestionFilters(q, filters);
    applyQuestionModerationFilter(q, filters.includeHidden);
    const row = await q.first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async listByUser(userId, { limit = 20, offset = 0, sortField = null, sortDirection = null, search = null } = {}) {
    return this.list({ limit, offset, userId, sortField, sortDirection, search });
  }

  async countByUser(userId, { search = null } = {}) {
    return this.countAll({ userId, search });
  }

  async update(id, patch) {
    const now = new Date();
    await db('questions').where({ id }).update({ ...patch, updated_at: now });
    return this.findById(id, { includeHidden: true });
  }

  async delete(id) {
    await db('questions').where({ id }).del();
    return true;
  }
}
