import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';
import {
  communityMemberCountAggregate,
  questionAnswerCountAggregate,
  questionReactionCountAggregate,
  studentPageAggregate,
  userSkillsAggregate,
  viewerCommunityAggregate,
  viewerFollowingAggregate,
  viewerQuestionReactionAggregate,
  viewerQuestionSaveAggregate
} from './feedQueryAggregates.js';

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

const applyQuestionFilters = (q, { communityId = null, communitySlug = null, publicOnly = false, search = null, userId = null } = {}) => {
  if (userId) {
    q.where('q.user_id', userId);
  }

  if (communityId) {
    q.where('q.community_id', communityId);
  } else if (communitySlug) {
    q.where('c.slug', communitySlug);
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
    const { user_email, user_name, user_avatar, user_current_job_title, user_course_name, user_institution, user_display_title, user_skills, is_follow, is_liked, is_saved, community_name, community_description, community_icon, community_is_active, community_default_post_visibility, community_members_count, community_is_joined, _total_count, ...question } = row;
    const score = parseInt(question.score || 0, 10);
    const user = typeof user_email !== 'undefined' || typeof user_name !== 'undefined'
      ? {
          id: question.user_id,
          name: user_name || null,
          email: user_email || null,
          avatar: user_avatar || null,
          avatarUrl: user_avatar || null,
          current_job_title: user_current_job_title || null,
          currentJobTitle: user_current_job_title || null,
          course_name: user_course_name || null,
          courseName: user_course_name || null,
          institution: user_institution || null,
          institution_name: user_institution || null,
          institutionName: user_institution || null,
          display_title: user_display_title || user_current_job_title || null,
          displayTitle: user_display_title || user_current_job_title || null,
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
      score,
      is_liked: toBool(is_liked),
      isLiked: toBool(is_liked),
      is_saved: toBool(is_saved),
      isSaved: toBool(is_saved),
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
            is_active: typeof community_is_active === 'undefined' ? undefined : community_is_active,
            default_post_visibility: community_default_post_visibility || null,
            is_private: community_default_post_visibility === 'community' ? 1 : 0,
            isPrivate: community_default_post_visibility === 'community',
            members_count: parseInt(community_members_count || 0, 10),
            membersCount: parseInt(community_members_count || 0, 10),
            is_joined: toBool(community_is_joined),
            isJoined: toBool(community_is_joined),
            is_following: toBool(community_is_joined),
            isFollowing: toBool(community_is_joined)
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

  baseQuestionQuery(actorId = null) {
    const q = db('questions as q')
      .leftJoin('users as u', 'u.id', 'q.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .leftJoin('communities as c', 'c.id', 'q.community_id')
      .leftJoin(userSkillsAggregate().as('usa'), 'usa.user_id', 'q.user_id')
      .leftJoin(studentPageAggregate().as('spa'), 'spa.owner_id', 'q.user_id')
      .leftJoin(communityMemberCountAggregate().as('cmca'), 'cmca.community_id', 'q.community_id')
      .leftJoin(questionAnswerCountAggregate().as('qaca'), 'qaca.question_id', 'q.id')
      .leftJoin(questionReactionCountAggregate().as('qrca'), 'qrca.question_id', 'q.id')
      .select(
        'q.*',
        'u.email as user_email',
        db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as user_name'),
        'up.avatar as user_avatar',
        'up.current_job_title as user_current_job_title',
        'spa.course_name as user_course_name',
        'spa.institution as user_institution',
        db.raw(`COALESCE(
          NULLIF(CONCAT_WS(' at ', NULLIF(spa.course_name, ''), NULLIF(spa.institution, '')), ''),
          NULLIF(up.display_title, ''),
          NULLIF(CONCAT_WS(' at ', NULLIF(up.current_job_title, ''), NULLIF(up.current_workspace, '')), '')
        ) as user_display_title`),
        db.raw('IFNULL(usa.skills, JSON_ARRAY()) as user_skills'),
        'c.name as community_name',
        'c.description as community_description',
        'c.icon as community_icon',
        'c.is_active as community_is_active',
        'c.default_post_visibility as community_default_post_visibility',
        db.raw('COALESCE(cmca.members_count, 0) as community_members_count'),
        db.raw('COALESCE(qaca.total_answers, 0) as total_answers'),
        db.raw('COALESCE(qaca.total_answerers, 0) as total_answerers'),
        db.raw('COALESCE(qrca.score, 0) as score')
      );
    if (actorId) {
      q.leftJoin(viewerFollowingAggregate(actorId).as('vf'), 'vf.following_id', 'q.user_id')
        .leftJoin(viewerQuestionReactionAggregate(actorId).as('vqr'), 'vqr.question_id', 'q.id')
        .leftJoin(viewerQuestionSaveAggregate(actorId).as('vqs'), 'vqs.target_id', 'q.id')
        .leftJoin(viewerCommunityAggregate(actorId).as('vcm'), 'vcm.community_id', 'q.community_id');
      q.select(
        db.raw('vf.following_id IS NOT NULL as is_follow'),
        db.raw('vqr.question_id IS NOT NULL as is_liked'),
        db.raw('vqs.target_id IS NOT NULL as is_saved'),
        db.raw('vcm.community_id IS NOT NULL as community_is_joined')
      );
    } else {
      q.select(db.raw('false as is_follow'), db.raw('false as is_liked'), db.raw('false as is_saved'), db.raw('false as community_is_joined'));
    }
    return q;
  }

  async findById(id, { includeHidden = false, actorId = null } = {}) {
    const q = this.baseQuestionQuery(actorId).where('q.id', id);
    applyQuestionModerationFilter(q, includeHidden);
    const row = await q.first();

    return this.toQuestionWithRelations(row);
  }

  async list(options = {}) {
    const { limit = 20, offset = 0, actorId = null, includeTotal = false } = options;
    const q = this.baseQuestionQuery(actorId).limit(limit).offset(offset);
    if (includeTotal) q.select(db.raw('COUNT(*) OVER() as _total_count'));
    applyQuestionFilters(q, options);
    applyQuestionModerationFilter(q, options.includeHidden);
    applyQuestionOrdering(q, options);
    const rows = await q;
    const data = rows.map(row => this.toQuestionWithRelations(row));
    if (includeTotal) data.total = rows.length ? parseInt(rows[0]._total_count || 0, 10) : 0;
    return data;
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
