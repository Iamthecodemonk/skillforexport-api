import logger from '../../utils/logger.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';

const commentLogger = logger.child('COMMENT_CONTROLLER');

export function makeCommentController({ useCase = null, notificationRepository = null, postRepository = null }) {
  if (!useCase) throw new Error('useCase_required');

  return {
    createComment: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { content } = body;
        const parentCommentId = body.parentCommentId || body.parent_comment_id || null;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (!content) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.createComment({ postId, userId: actorId, parentCommentId, content });
        if (notificationRepository && postRepository) {
          try {
            const post = await postRepository.findById(postId, { userId: actorId });
            if (parentCommentId && useCase.commentRepository && typeof useCase.commentRepository.findById === 'function') {
              const parent = await useCase.commentRepository.findById(parentCommentId);
              await notificationRepository.create({
                userId: parent && parent.user_id,
                actorUserId: actorId,
                type: 'comment_reply',
                title: 'New reply to your comment',
                body: 'Someone replied to your comment.',
                target: { type: 'post', id: postId, title: post && post.title, url: `/posts/${postId}` },
                metadata: { commentId: created.id, parentCommentId }
              });
            } else {
              await notificationRepository.create({
                userId: post && post.user_id,
                actorUserId: actorId,
                type: 'post_comment',
                title: 'New comment on your post',
                body: 'Someone commented on your post.',
                target: { type: 'post', id: postId, title: post && post.title, url: `/posts/${postId}` },
                metadata: { commentId: created.id }
              });
            }
          } catch (notifyErr) {
            commentLogger.warn('comment notification failed', { message: notifyErr.message });
          }
        }
        return reply.code(201).send({ success: true, message: 'Comment created successfully', data: created });
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
        const actorId = req.user && req.user.id;
        const rows = await useCase.listCommentsByPost(postId, { limit, offset, userId: actorId || null });
        const total = useCase.commentRepository && typeof useCase.commentRepository.countByPost === 'function'
          ? await useCase.commentRepository.countByPost(postId)
          : rows.length;
        return reply.send(buildPaginatedResponse(req, { data: rows, page, perPage, total }));
      } catch (err) {
        commentLogger.error('listComments error', { message: err.message });
        if (err.message === 'post_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    deleteComment: async (req, reply) => {
      try {
        const { id } = req.params;
        const actorId = req.user && req.user.id;
        const actorRole = req.user && req.user.role;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        await useCase.deleteComment({ id, userId: actorId, actorRole });
        return reply.code(200).send({ success: true, message: 'Comment deleted successfully', data: { id } });
      } catch (err) {
        commentLogger.error('deleteComment error', { message: err.message });
        if (err.message === 'comment_not_found') return reply.code(404).send({ success: false, error: { code: 'comment_not_found' } });
        if (err.message === 'not_authorized') return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        if (err.message === 'comment_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
