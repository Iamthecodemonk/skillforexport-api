import logger from '../../utils/logger.js';

const piLogger = logger.child('POST_INTERACTION_CONTROLLER');

export function makePostInteractionController({ useCase = null, notificationRepository = null, postRepository = null, commentRepository = null }) {
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
        return reply.send({ success: true, message: res.saved ? 'Post saved successfully' : 'Post unsaved successfully', data: res });
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
        if (notificationRepository && postRepository) {
          try {
            const post = await postRepository.findById(postId, { includeHidden: true });
            await notificationRepository.create({
              userId: post && (post.user_id || post.userId),
              actorUserId: null,
              type: 'content_flagged',
              title: 'Post flagged',
              body: 'Your post was flagged for review.',
              target: { type: 'post', id: postId, title: post && post.title, url: `/posts/${postId}` },
              metadata: { targetType: 'post', targetId: postId, anonymous: true }
            });
          } catch (notifyErr) {
            piLogger.warn('post report notification failed', { message: notifyErr.message });
          }
        }
        return reply.code(201).send({ success: true, message: 'Post reported successfully', data: rep });
      } catch (err) {
        piLogger.error('reportPost error', { message: err.message });
        if (err.message === 'post_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    reportComment: async (req, reply) => {
      try {
        const { id: commentId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { reason, details } = body;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const rep = await useCase.reportComment({ commentId, userId: actorId, reason, details });
        if (notificationRepository && commentRepository) {
          try {
            const comment = await commentRepository.findById(commentId, { includeHidden: true });
            await notificationRepository.create({
              userId: comment && (comment.user_id || comment.userId),
              actorUserId: null,
              type: 'content_flagged',
              title: 'Comment flagged',
              body: 'Your comment was flagged for review.',
              target: { type: 'comment', id: commentId, title: null, url: comment ? `/posts/${comment.post_id}` : null },
              metadata: { targetType: 'comment', targetId: commentId, anonymous: true }
            });
          } catch (notifyErr) {
            piLogger.warn('comment report notification failed', { message: notifyErr.message });
          }
        }
        return reply.code(201).send({ success: true, message: 'Comment reported successfully', data: rep });
      } catch (err) {
        piLogger.error('reportComment error', { message: err.message });
        if (err.message === 'comment_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
