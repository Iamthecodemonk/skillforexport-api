import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const qLogger = logger.child('QUESTION_USECASE');

export default class QuestionUseCase {
  constructor({ questionRepository, answerRepository = null }) {
    this.questionRepository = questionRepository;
    this.answerRepository = answerRepository;
  }
  async createQuestion({ userId, communityId = null, title, body, visibility = 'public' }) {
    if (!userId) throw new Error('user_required');
    if (!title || String(title).trim() === '') throw new Error('title_required');
    if (!body || String(body).trim() === '') throw new Error('body_required');
    const q = {
      id: uuidv4(),
      user_id: userId,
      community_id: communityId,
      title: String(title),
      body: String(body),
      visibility
    };
    return this.questionRepository.create(q);
  }

  async getQuestion({ id, includeAnswers = false }) {
    if (!id) throw new Error('id_required');
    const q = await this.questionRepository.findById(id);
    if (!q) throw new Error('question_not_found');
    if (includeAnswers && this.answerRepository && typeof this.answerRepository.listByQuestion === 'function') {
      try {
        const answers = await this.answerRepository.listByQuestion(id, { limit: 100, offset: 0 });
        return Object.assign({}, q, { answers: answers.map(a => (a && a.toPlainObject) ? a.toPlainObject() : a) });
      } catch (e) {
        qLogger.warn('Failed to load answers for question', { err: e && e.message });
      }
    }
    return q;
  }

  async listQuestions({ limit = 20, offset = 0 } = {}) {
    return this.questionRepository.list({ limit, offset });
  }

  async updateQuestion({ id, userId, updates }) {
    if (!id) throw new Error('id_required');
    const existing = await this.questionRepository.findById(id);
    if (!existing) throw new Error('question_not_found');
    if ((existing.user_id || existing.userId) !== userId) throw new Error('not_authorized');
    return this.questionRepository.update(id, updates);
  }

  async deleteQuestion({ id, userId }) {
    if (!id) throw new Error('id_required');
    const existing = await this.questionRepository.findById(id);
    if (!existing) throw new Error('question_not_found');
    if ((existing.user_id || existing.userId) !== userId) throw new Error('not_authorized');
    return this.questionRepository.delete(id);
  }

  async createAnswer({ questionId, userId, parentAnswerId = null, content }) {
    if (!this.answerRepository) throw new Error('answers_not_implemented');
    if (!questionId) throw new Error('question_required');
    if (!userId) throw new Error('user_required');
    if (!content || String(content).trim() === '') throw new Error('content_required');
    const a = { id: uuidv4(), question_id: questionId, user_id: userId, parent_answer_id: parentAnswerId, content: String(content) };
    return this.answerRepository.create(a);
  }

  async listAnswers({ questionId, limit = 50, offset = 0 }) {
    if (!this.answerRepository) throw new Error('answers_not_implemented');
    if (!questionId) throw new Error('question_required');
    return this.answerRepository.listByQuestion(questionId, { limit, offset });
  }
}
