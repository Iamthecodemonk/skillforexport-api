import logger from '../../utils/logger.js';

const postLogger = logger.child('POST_CONTROLLER');

export function makePostController({ useCase = null }) {
  if (!useCase) {
    postLogger.error('makePostController requires a useCase');
    throw new Error('useCase_required');
  }

  return {
    createPost: async (req, reply) => {
      try {
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        const { communityId, pageId, title, content, visibility, mediaAssetIds } = body;
        if (!actorId) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        }
        if (!title || !content) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        const created = await useCase.CreatePost({ userId: actorId, communityId, pageId, title, content, visibility, mediaAssetIds });

        // Invalidate simple feed caches when a new post is created
        try {
          const redis = req.server && req.server.redisClient;
          if (redis) {
            const keys = [`feed:user:${actorId}`, 'feed:global'];
            if (created.page_id) keys.push(`feed:page:${created.page_id}`);
            await redis.del(...keys);
          }
        } catch (cacheErr) {
          postLogger.warn('feed cache invalidation failed', { message: cacheErr && cacheErr.message });
        }

        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        postLogger.error('createPost error', { message: err.message, stack: err.stack });
        if (err.message === 'user_required' || err.message === 'content_required') {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        if (err.message === 'media_not_ready') {
          return reply.code(422).send({ success: false, error: { code: 'media_not_ready', message: 'One or more media assets are not yet processed' } });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getPost: async (req, reply) => {
      try {
        const { id } = req.params;
        const post = await useCase.GetPost(id);
        return reply.send({ success: true, data: post });
      } catch (err) {
        postLogger.error('getPost error', { message: err.message, stack: err.stack });
        if (err.message === 'post_not_found') return reply.code(404).send({ success: false, error: { code: 'post_not_found' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listPosts: async (req, reply) => {
      try {
        const limit = parseInt(req.query.limit || '20', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        const lastCreatedAt = req.query && req.query.lastCreatedAt ? req.query.lastCreatedAt : null;
        const lastId = req.query && req.query.lastId ? req.query.lastId : null;
        const rows = await useCase.ListPosts({ limit, offset, lastCreatedAt, lastId });
        return reply.send({ success: true, data: rows });
      } catch (err) {
        postLogger.error('listPosts error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    updatePost: async (req, reply) => {
      try {
        const { id } = req.params;
      const body = req.body || {};
      const actorId = req.user && req.user.id;
      const { title, content } = body;
      if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      if (typeof title === 'undefined' && typeof content === 'undefined') 
        return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
      const updated = await useCase.UpdatePost({ id, userId: actorId, title, content });
        return reply.send({ success: true, data: updated });
      } catch (err) {
        postLogger.error('updatePost error', { message: err.message, stack: err.stack });
        if (err.message === 'post_not_found')
             return reply.code(404).send({ success: false, error: { code: 'post_not_found' } });
        if (err.message === 'not_authorized') 
            return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    deletePost: async (req, reply) => {
      try {
        const { id } = req.params;
        const body = req.body || {};
        const actorId = req.user && req.user.id;
        if (!actorId) 
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        await useCase.DeletePost({ id, userId: actorId });
        return reply.code(200).send({ success: true, data: { id } });
      } catch (err) {
        postLogger.error('deletePost error', { message: err.message, stack: err.stack });
        if (err.message === 'post_not_found') return reply.code(404).send({ success: false, error: { code: 'post_not_found' } });
        if (err.message === 'not_authorized') return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}

// Media attach endpoints for posts
export function makePostMediaController({ useCase = null }) {
  const mediaLogger = postLogger.child('MEDIA');
  if (!useCase) {
    mediaLogger.error('makePostMediaController requires a useCase');
    throw new Error('useCase_required');
  }
  return {
    attachMediaByUrl: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const { url, mediaType = 'image', displayOrder = 0 } = req.body || {};
        if (!url) 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const res = await useCase.AttachMediaByUrl({ postId, url, mediaType, displayOrder });
        return reply.code(202).send({ success: true, data: res });
      } catch (err) {
        mediaLogger.error('attachMediaByUrl error', { message: err.message, stack: err.stack });
        if (err.message === 'queue_unavailable') 
            return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        if (err.message === 'post_required' || err.message === 'url_required') 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listPostMedia: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const rows = await useCase.ListMediaByPost(postId);
        return reply.send({ success: true, data: rows });
      } catch (err) {
        mediaLogger.error('listPostMedia error', { message: err.message, stack: err.stack });
        if (err.message === 'post_required') 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    deletePostMedia: async (req, reply) => {
      try {
        const { id: mediaId } = req.params;
        await useCase.DeleteMediaById(mediaId);
        return reply.code(200).send({ success: true, data: { id: mediaId } });
      } catch (err) {
        mediaLogger.error('deletePostMedia error', { message: err.message, stack: err.stack });
        if (err.message === 'media_id_required') 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
