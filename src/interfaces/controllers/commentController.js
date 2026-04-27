import logger from '../../utils/logger.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';

const commentLogger = logger.child('COMMENT_CONTROLLER');

export function makeCommentController({ useCase = null }) {
  if (!useCase) throw new Error('useCase_required');

  return {
    createComment: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { content, parentCommentId } = body;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (!content) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.createComment({ postId, userId: actorId, parentCommentId, content });
        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        commentLogger.error('createComment error', { message: err.message });
        if (err.message === 'post_required' || err.message === 'user_required' || err.message === 'content_required') {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listComments: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const { page, perPage, limit, offset } = parsePagination(req.query, 50);
        const rows = await useCase.listCommentsByPost(postId, { limit, offset });
        const total = useCase.commentRepository && typeof useCase.commentRepository.countByPost === 'function'
          ? await useCase.commentRepository.countByPost(postId)
          : rows.length;
        return reply.send(buildPaginatedResponse(req, { data: rows, page, perPage, total }));
      } catch (err) {
        commentLogger.error('listComments error', { message: err.message });
        if (err.message === 'post_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
