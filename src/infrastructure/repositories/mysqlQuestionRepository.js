import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const applyQuestionFilters = (q, { communityId = null, publicOnly = false, search = null } = {}) => {
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
    const { asker_email, asker_name, asker_avatar, community_name, community_description, ...question } = row;
    const asker = typeof asker_email !== 'undefined' || typeof asker_name !== 'undefined'
      ? {
          id: question.user_id,
          name: asker_name || null,
          email: asker_email || null,
          avatar: asker_avatar || null,
          avatarUrl: asker_avatar || null
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
      type: 'QUESTION',
      asker,
      user: asker,
      community: question.community_id
        ? {
            id: question.community_id,
            name: community_name || null,
            description: community_description || null
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
      is_closed: typeof record.is_closed !== 'undefined' ? record.is_closed : 0,
      accepted_answer_id: record.accepted_answer_id || record.acceptedAnswerId || null,
      created_at: now,
      updated_at: now
    });
    return db('questions').where({ id }).first();
  }

  async findById(id) {
    const answerCounts = db('answers')
      .select('question_id')
      .count({ total_answers: 'id' })
      .countDistinct({ total_answerers: 'user_id' })
      .groupBy('question_id')
      .as('ac');

    const row = await db('questions as q')
      .leftJoin('users as u', 'u.id', 'q.user_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .leftJoin('communities as c', 'c.id', 'q.community_id')
      .leftJoin(answerCounts, 'ac.question_id', 'q.id')
      .where('q.id', id)
      .select(
        'q.*',
        'u.email as asker_email',
        'up.username as asker_name',
        'c.name as community_name',
        'c.description as community_description',
        db.raw('COALESCE(ac.total_answers, 0) as total_answers'),
        db.raw('COALESCE(ac.total_answerers, 0) as total_answerers')
      )
      .first();

    return this.toQuestionWithRelations(row);
  }

  async list(options = {}) {
    const { limit = 20, offset = 0 } = options;
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
        'u.email as asker_email',
        db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as asker_name'),
        'up.avatar as asker_avatar',
        'c.name as community_name',
        'c.description as community_description',
        db.raw('COALESCE(ac.total_answers, 0) as total_answers'),
        db.raw('COALESCE(ac.total_answerers, 0) as total_answerers')
      );
    applyQuestionFilters(q, options);
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
    const row = await q.first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async update(id, patch) {
    const now = new Date();
    await db('questions').where({ id }).update({ ...patch, updated_at: now });
    return db('questions').where({ id }).first();
  }

  async delete(id) {
    await db('questions').where({ id }).del();
    return true;
  }
}
