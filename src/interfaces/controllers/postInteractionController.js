import logger from '../../utils/logger.js';

const piLogger = logger.child('POST_INTERACTION_CONTROLLER');

export function makePostInteractionController({ useCase = null }) {
  if (!useCase) throw new Error('useCase_required');

  return {
    toggleSave: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        if (!actorId) 
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const res = await useCase.toggleSave({ postId, userId: actorId });
        return reply.send({ success: true, data: res });
      } catch (err) {
        piLogger.error('toggleSave error', { message: err.message });
        if (err.message === 'post_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    reportPost: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { reason, details } = body;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const rep = await useCase.reportPost({ postId, userId: actorId, reason, details });
        return reply.code(201).send({ success: true, data: rep });
      } catch (err) {
        piLogger.error('reportPost error', { message: err.message });
        if (err.message === 'post_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
