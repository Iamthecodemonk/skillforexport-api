import logger from '../../utils/logger.js';

const reactionLogger = logger.child('REACTION_CONTROLLER');

export function makeReactionController({ useCase = null }) {
  if (!useCase) throw new Error('useCase_required');

  return {
    togglePostReaction: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { type } = body;
        if (!actorId) 
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const res = await useCase.togglePostReaction({ postId, userId: actorId, type });
        return reply.send({ success: true, data: res });
      } catch (err) {
        reactionLogger.error('togglePostReaction error', { message: err.message });
        if (err.message === 'post_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    toggleCommentReaction: async (req, reply) => {
      try {
        const { id: commentId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { type } = body;
        if (!actorId) 
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const res = await useCase.toggleCommentReaction({ commentId, userId: actorId, type });
        return reply.send({ success: true, data: res });
      } catch (err) {
        reactionLogger.error('toggleCommentReaction error', { message: err.message });
        if (err.message === 'comment_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
