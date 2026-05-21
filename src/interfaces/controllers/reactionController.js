import logger from '../../utils/logger.js';

const reactionLogger = logger.child('REACTION_CONTROLLER');

export function makeReactionController({ useCase = null, notificationRepository = null, postRepository = null, commentRepository = null }) {
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
        if (notificationRepository && postRepository && res && res.result && res.result.action !== 'removed') {
          try {
            const post = await postRepository.findById(postId, { userId: actorId });
            await notificationRepository.create({
              userId: post && post.user_id,
              actorUserId: actorId,
              type: 'post_score',
              title: 'New reaction on your post',
              body: 'Someone reacted to your post.',
              target: { type: 'post', id: postId, title: post && post.title, url: `/posts/${postId}` },
              metadata: { reactionType: type || 'like' }
            });
          } catch (notifyErr) {
            reactionLogger.warn('post reaction notification failed', { message: notifyErr.message });
          }
        }
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
        if (notificationRepository && commentRepository && res && res.result && res.result.action !== 'removed') {
          try {
            const comment = await commentRepository.findById(commentId);
            await notificationRepository.create({
              userId: comment && comment.user_id,
              actorUserId: actorId,
              type: 'comment_score',
              title: 'New reaction on your comment',
              body: 'Someone reacted to your comment.',
              target: { type: 'comment', id: commentId, title: null, url: comment ? `/posts/${comment.post_id}` : null },
              metadata: { reactionType: type || 'like' }
            });
          } catch (notifyErr) {
            reactionLogger.warn('comment reaction notification failed', { message: notifyErr.message });
          }
        }
        return reply.send({ success: true, data: res });
      } catch (err) {
        reactionLogger.error('toggleCommentReaction error', { message: err.message });
        if (err.message === 'comment_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
