import logger from '../../utils/logger.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';

const questionLogger = logger.child('QUESTION_CONTROLLER');

export function makeQuestionController({ useCase = null }) {
  if (!useCase) {
    questionLogger.error('makeQuestionController requires a useCase');
    throw new Error('useCase_required');
  }

  return {
    createQuestion: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        const { communityId, title, body, visibility } = req.body || {};
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (!title || !body) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.createQuestion({ userId: actorId, communityId, title, body, visibility });
        return reply.code(201).send({ success: true, message: 'Question created successfully', data: created && created.toPlainObject ? created.toPlainObject() : created });
      } catch (err) {
        questionLogger.error('createQuestion error', { message: err.message, stack: err.stack });
        if (err.message === 'user_required' || err.message === 'title_required' || err.message === 'body_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listQuestions: async (req, reply) => {
      try {
        const { page, perPage, limit, offset } = parsePagination(req.query, 20);
        const rows = await useCase.listQuestions({ limit, offset });
        const data = rows.map(r => (r && r.toPlainObject) ? r.toPlainObject() : r);
        const total = useCase.questionRepository && typeof useCase.questionRepository.countAll === 'function'
          ? await useCase.questionRepository.countAll()
          : data.length;
        return reply.send(buildPaginatedResponse(req, { data, page, perPage, total }));
      } catch (err) {
        questionLogger.error('listQuestions error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getQuestion: async (req, reply) => {
      try {
        const { id } = req.params;
        const includeAnswers = req.query.includeAnswers === '1' || req.query.includeAnswers === 'true';
        const q = await useCase.getQuestion({ id, includeAnswers });
        if (!q) return reply.code(404).send({ success: false, error: { code: 'question_not_found' } });
        return reply.send({ success: true, message: 'Success', data: q && q.toPlainObject ? q.toPlainObject() : q });
      } catch (err) {
        questionLogger.error('getQuestion error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    createAnswer: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        const { questionId } = req.params;
        const { parentAnswerId, content } = req.body || {};
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (!content) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.createAnswer({ questionId, userId: actorId, parentAnswerId, content });
        return reply.code(201).send({ success: true, message: 'Answer created successfully', data: created && created.toPlainObject ? created.toPlainObject() : created });
      } catch (err) {
        questionLogger.error('createAnswer error', { message: err.message, stack: err.stack });
        if (['content_required', 'question_required', 'user_required'].includes(err.message)) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        if (err.message === 'answers_not_implemented') return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listAnswers: async (req, reply) => {
      try {
        const { questionId } = req.params;
        const { page, perPage, limit, offset } = parsePagination(req.query, 50);
        const rows = await useCase.listAnswers({ questionId, limit, offset });
        const data = rows.map(r => (r && r.toPlainObject) ? r.toPlainObject() : r);
        const total = useCase.answerRepository && typeof useCase.answerRepository.countByQuestion === 'function'
          ? await useCase.answerRepository.countByQuestion(questionId)
          : data.length;
        return reply.send(buildPaginatedResponse(req, { data, page, perPage, total }));
      } catch (err) {
        questionLogger.error('listAnswers error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
