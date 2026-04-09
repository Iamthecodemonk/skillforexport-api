import logger from '../../utils/logger.js';

const commentLogger = logger.child('COMMENT_CONTROLLER');

export function makeCommentController({ useCase = null }) {
  if (!useCase) throw new Error('useCase_required');

  return {
    createComment: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const { userId, content, parentCommentId } = req.body || {};
        if (!userId || !content) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.createComment({ postId, userId, parentCommentId, content });
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
        const limit = parseInt(req.query.limit || '50', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        const rows = await useCase.listCommentsByPost(postId, { limit, offset });
        return reply.send({ success: true, data: rows });
      } catch (err) {
        commentLogger.error('listComments error', { message: err.message });
        if (err.message === 'post_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
