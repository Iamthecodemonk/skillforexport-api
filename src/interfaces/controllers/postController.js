import logger from '../../utils/logger.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';

const postLogger = logger.child('POST_CONTROLLER');

const firstDefined = (...values) => values.find(value => typeof value !== 'undefined' && value !== null && value !== '');

const nestedQueryValue = (query, group, key) => {
  if (!query) return undefined;
  if (query[group] && typeof query[group] === 'object') return query[group][key];
  return query[`${group}[${key}]`];
};

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
        const communityId = firstDefined(body.communityId, body.community_id);
        const pageId = firstDefined(body.pageId, body.page_id);
        const mediaAssetIds = firstDefined(body.mediaAssetIds, body.media_asset_ids, body.assetIds, body.asset_ids) || [];
        const { title, content, visibility } = body;
        if (!actorId) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        }
        if (!title || !content) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        const created = await useCase.CreatePost({ userId: actorId, communityId, pageId, title, content, visibility, mediaAssetIds, actorRole: req.user && req.user.role });

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

        return reply.code(201).send({ success: true, message: 'Post created successfully', data: created });
      } catch (err) {
        const expectedErrors = new Set([
          'user_required',
          'title_required',
          'content_required',
          'community_not_found',
          'community_inactive',
          'not_a_member',
          'admin_only_community',
          'media_validation_unavailable',
          'media_not_ready'
        ]);
        if (!expectedErrors.has(err.message)) {
          postLogger.error('createPost error', { message: err.message, stack: err.stack });
        }
        if (err.message === 'user_required' || err.message === 'content_required') {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        if (err.message === 'title_required') {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        if (err.message === 'community_not_found') {
          return reply.code(404).send({ success: false, error: { code: 'community_not_found', message: 'Community not found' } });
        }
        if (err.message === 'community_inactive') {
          return reply.code(403).send({ success: false, error: { code: 'community_inactive', message: 'Community is inactive' } });
        }
        if (err.message === 'not_a_member') {
          return reply.code(403).send({ success: false, error: { code: 'not_a_member', message: 'Join the community before posting' } });
        }
        if (err.message === 'admin_only_community') {
          return reply.code(403).send({ success: false, error: { code: 'admin_only_community', message: 'Only admins can post in this community' } });
        }
        if (err.message === 'media_validation_unavailable') {
          return reply.code(503).send({ success: false, error: { code: 'media_validation_unavailable', message: 'Media validation is unavailable' } });
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
        const actorId = req.user && req.user.id;
        const post = await useCase.GetPost(id, { userId: actorId || null });
        return reply.send({ success: true, message: 'Success', data: post });
      } catch (err) {
        postLogger.error('getPost error', { message: err.message, stack: err.stack });
        if (err.message === 'post_not_found') return reply.code(404).send({ success: false, error: { code: 'post_not_found' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listPosts: async (req, reply) => {
      try {
        const { page, perPage, limit, offset } = parsePagination(req.query, 20);
        const query = req.query || {};
        const lastCreatedAt = query.lastCreatedAt || query.last_created_at || null;
        const lastId = query.lastId || query.last_id || null;
        const actorId = req.user && req.user.id;
        const communityId = firstDefined(
          query.communityId,
          query.community_id,
          nestedQueryValue(query, 'filters', 'community_id'),
          nestedQueryValue(query, 'filters', 'communityId')
        ) || null;
        const search = firstDefined(query.q, query.search, nestedQueryValue(query, 'filters', 'search')) || null;
        const sortField = firstDefined(query.sortField, query.sort_field, nestedQueryValue(query, 'sort', 'field')) || null;
        const sortDirection = firstDefined(query.sortDirection, query.sort_direction, nestedQueryValue(query, 'sort', 'direction')) || null;
        const publicOnly = !communityId;
        const rows = await useCase.ListPosts({ limit, offset, lastCreatedAt, lastId, userId: actorId || null, communityId, publicOnly, search, sortField, sortDirection });
        const total = useCase.postRepository && typeof useCase.postRepository.countAll === 'function'
          ? await useCase.postRepository.countAll({ communityId, publicOnly, search })
          : rows.length;
        return reply.send(buildPaginatedResponse(req, { data: rows, page, perPage, total }));
      } catch (err) {
        postLogger.error('listPosts error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    adminListPosts: async (req, reply) => {
      try {
        const actor = req.user || null;
        if (!actor) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (actor.role !== 'admin') return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        const { page, perPage, limit, offset } = parsePagination(req.query, 20);
        const query = req.query || {};
        const communityId = firstDefined(
          query.communityId,
          query.community_id,
          nestedQueryValue(query, 'filters', 'community_id'),
          nestedQueryValue(query, 'filters', 'communityId')
        ) || null;
        const search = firstDefined(query.q, query.search, nestedQueryValue(query, 'filters', 'search')) || null;
        const sortField = firstDefined(query.sortField, query.sort_field, nestedQueryValue(query, 'sort', 'field')) || null;
        const sortDirection = firstDefined(query.sortDirection, query.sort_direction, nestedQueryValue(query, 'sort', 'direction')) || null;
        const status = firstDefined(query.status, query.moderation_status, nestedQueryValue(query, 'filters', 'status'), nestedQueryValue(query, 'filters', 'moderation_status')) || null;
        const rows = await useCase.ListPosts({
          limit,
          offset,
          userId: actor.id,
          communityId,
          publicOnly: false,
          search,
          sortField,
          sortDirection,
          includeHidden: true,
          status
        });
        const total = useCase.postRepository && typeof useCase.postRepository.countAll === 'function'
          ? await useCase.postRepository.countAll({ communityId, publicOnly: false, search, includeHidden: true, status })
          : rows.length;
        return reply.send(buildPaginatedResponse(req, { data: rows, page, perPage, total }));
      } catch (err) {
        postLogger.error('adminListPosts error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    sharePost: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const actorId = req.user && req.user.id;
        const body = req.body || {};
        const communityId = firstDefined(body.communityId, body.community_id);
        const { comment } = body;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const shared = await useCase.SharePost({ postId, userId: actorId, communityId, comment, actorRole: req.user && req.user.role });
        return reply.code(201).send({ success: true, data: shared });
      } catch (err) {
        const expectedErrors = new Set(['post_required', 'user_required', 'community_required', 'post_not_found', 'community_not_found', 'community_inactive', 'not_a_member', 'admin_only_community', 'admin_only_community_share_disabled']);
        if (!expectedErrors.has(err.message)) {
          postLogger.error('sharePost error', { message: err.message, stack: err.stack });
        }
        if (err.message === 'post_not_found') return reply.code(404).send({ success: false, error: { code: 'post_not_found' } });
        if (err.message === 'community_not_found') return reply.code(404).send({ success: false, error: { code: 'community_not_found' } });
        if (err.message === 'community_inactive') return reply.code(403).send({ success: false, error: { code: 'community_inactive' } });
        if (err.message === 'not_a_member') return reply.code(403).send({ success: false, error: { code: 'not_a_member' } });
        if (err.message === 'admin_only_community') return reply.code(403).send({ success: false, error: { code: 'admin_only_community', message: 'Only admins can post in this community' } });
        if (err.message === 'admin_only_community_share_disabled') return reply.code(403).send({ success: false, error: { code: 'admin_only_community_share_disabled', message: 'Posts from this community cannot be shared to another community' } });
        if (err.message === 'post_required' || err.message === 'user_required' || err.message === 'community_required') {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    recordShareEvent: async (req, reply) => {
      try {
        const { id: postId } = req.params;
        const actorId = req.user && req.user.id;
        const { type = 'copy_link' } = req.body || {};
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const event = await useCase.RecordShareEvent({ postId, userId: actorId, type });
        return reply.code(201).send({ success: true, data: event });
      } catch (err) {
        if (err.message === 'post_not_found') return reply.code(404).send({ success: false, error: { code: 'post_not_found' } });
        if (err.message === 'post_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        postLogger.error('recordShareEvent error', { message: err.message, stack: err.stack });
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
        return reply.send({ success: true, message: 'Post updated successfully', data: updated });
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
        const actorRole = req.user && req.user.role;
        if (!actorId) 
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        await useCase.DeletePost({ id, userId: actorId, actorRole });
        try {
          const redis = req.server && req.server.redisClient;
          if (redis) await redis.del('feed:global', `feed:user:${actorId}`);
        } catch (cacheErr) {
          postLogger.warn('feed cache invalidation failed after delete', { message: cacheErr && cacheErr.message });
        }
        return reply.code(200).send({ success: true, message: 'Deleted success', data: [] });
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
