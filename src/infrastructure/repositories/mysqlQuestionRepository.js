import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlQuestionRepository {
  toQuestionWithRelations(row) {
    if (!row) return null;
    const { asker_email, asker_name, community_name, community_description, ...question } = row;
    return {
      ...question,
      asker: typeof asker_email !== 'undefined' || typeof asker_name !== 'undefined'
        ? {
            id: question.user_id,
            name: asker_name || null,
            email: asker_email || null
          }
        : null,
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

  async list({ limit = 20, offset = 0 } = {}) {
    const rows = await db('questions as q')
      .leftJoin('communities as c', 'c.id', 'q.community_id')
      .orderBy('q.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('q.*', 'c.name as community_name', 'c.description as community_description');
    return rows.map(row => this.toQuestionWithRelations(row));
  }

  async countAll() {
    const row = await db('questions').count({ cnt: 'id' }).first();
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
