import logger from '../../utils/logger.js';
import { getCompactPostItem } from './feedController.js';

const reactionLogger = logger.child('REACTION_CONTROLLER');

const invalidateCompactFeedCache = async (req) => {
  try {
    const redis = req.server && (req.server.redisManager || req.server.redisClient);
    if (!redis || typeof redis.keys !== 'function') return;
    const keys = await redis.keys('feed:compact:*');
    if (!keys || keys.length === 0) return;
    if (redis.client && typeof redis.client === 'function') {
      const client = redis.client();
      if (client && typeof client.del === 'function') await client.del(...keys);
      return;
    }
    if (typeof redis.del === 'function') await redis.del(...keys);
  } catch (err) {
    reactionLogger.warn('compact feed cache invalidation failed', { message: err && err.message });
  }
};

const invalidateUserProfileCaches = async (req, userIds = []) => {
  try {
    const redis = req.server && (req.server.redisManager || req.server.redisClient);
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!redis || ids.length === 0) return;
    const keys = ids.map((id) => `user:profile:${id}`);
    if (redis.client && typeof redis.client === 'function') {
      const client = redis.client();
      if (client && typeof client.del === 'function') await client.del(...keys);
      return;
    }
    if (typeof redis.del === 'function') await redis.del(...keys);
  } catch (err) {
    reactionLogger.warn('profile cache invalidation failed', { message: err && err.message });
  }
};

export function makeReactionController({ useCase = null, notificationRepository = null, postRepository = null, commentRepository = null, questionRepository = null }) {
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
        if (postRepository && typeof postRepository.findById === 'function') {
          const post = await postRepository.findById(postId, { userId: actorId });
          if (!post) return reply.code(404).send({ success: false, error: { code: 'post_not_found', message: 'Post not found' } });
          if ((post.user_id || post.userId) === actorId) {
            return reply.code(403).send({ success: false, error: { code: 'self_reaction_not_allowed', message: 'You cannot like your own post' } });
          }
        }
        const res = await useCase.togglePostReaction({ postId, userId: actorId, type });
        await invalidateCompactFeedCache(req);
        const item = await getCompactPostItem({ postId, actorId });
        const postOwnerId = item && item.author && item.author.id;
        await invalidateUserProfileCaches(req, [actorId, postOwnerId]);
        const isLiked = !!(item && item.viewerState && item.viewerState.isScored);
        const payload = {
          ...res,
          score: res.count,
          is_liked: isLiked,
          isLiked,
          item,
          post: item
        };
        if (notificationRepository && postRepository && res && res.result && res.result.action !== 'removed') {
          try {
            const post = await postRepository.findById(postId, { userId: actorId });
            if (post && post.user_id && post.user_id !== actorId) {
              await notificationRepository.create({
                userId: post.user_id,
                actorUserId: actorId,
                type: 'post_score',
                title: 'New reaction on your post',
                body: 'Someone reacted to your post.',
                target: { type: 'post', id: postId, title: post && post.title, url: `/posts/${postId}` },
                metadata: { reactionType: type || 'like' }
              });
            }
          } catch (notifyErr) {
            reactionLogger.warn('post reaction notification failed', { message: notifyErr.message });
          }
        }
        return reply.send({ success: true, message: 'Post reaction updated successfully', data: payload });
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
        return reply.send({ success: true, message: 'Comment reaction updated successfully', data: res });
      } catch (err) {
        reactionLogger.error('toggleCommentReaction error', { message: err.message });
        if (err.message === 'comment_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    toggleQuestionReaction: async (req, reply) => {
      try {
        const { id: questionId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { type } = body;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });

        const question = questionRepository && typeof questionRepository.findById === 'function'
          ? await questionRepository.findById(questionId, { actorId })
          : null;
        if (!question) return reply.code(404).send({ success: false, error: { code: 'question_not_found', message: 'Question not found' } });
        if ((question.user_id || question.userId) === actorId) {
          return reply.code(403).send({ success: false, error: { code: 'self_reaction_not_allowed', message: 'You cannot like your own question' } });
        }

        const res = await useCase.toggleQuestionReaction({ questionId, userId: actorId, type });
        await invalidateCompactFeedCache(req);
        const item = questionRepository && typeof questionRepository.findById === 'function'
          ? await questionRepository.findById(questionId, { actorId })
          : null;
        await invalidateUserProfileCaches(req, [actorId, question.user_id || question.userId]);
        const isLiked = !!(item && (item.is_liked || item.isLiked));
        const payload = {
          ...res,
          score: res.count,
          is_liked: isLiked,
          isLiked,
          item,
          question: item
        };
        if (notificationRepository && res && res.result && res.result.action !== 'removed') {
          try {
            await notificationRepository.create({
              userId: question.user_id || question.userId,
              actorUserId: actorId,
              type: 'question_score',
              title: 'New reaction on your question',
              body: 'Someone reacted to your question.',
              target: { type: 'question', id: questionId, title: question.title, url: `/questions/${questionId}` },
              metadata: { reactionType: type || 'like' }
            });
          } catch (notifyErr) {
            reactionLogger.warn('question reaction notification failed', { message: notifyErr.message });
          }
        }
        return reply.send({ success: true, message: 'Question reaction updated successfully', data: payload });
      } catch (err) {
        reactionLogger.error('toggleQuestionReaction error', { message: err.message });
        if (err.message === 'question_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
