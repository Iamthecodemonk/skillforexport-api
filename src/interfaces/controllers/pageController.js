import logger from '../../utils/logger.js';

const pageLogger = logger.child('PAGE_CONTROLLER');

export function makePageController({ useCase = null, followersRepository = null }) {
  if (!useCase) {
    pageLogger.error('makePageController requires a UseCase');
    throw new Error('useCase_required');
  }

  return {
    createPage: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const { categoryId, name, slug, description, metadata } = req.body || {};
        const created = await useCase.CreatePage({ ownerId: actorId, categoryId, name, slug, description, metadata });
        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        if ((err && err.message === 'name_required') || (err && err.message === 'slug_required'))
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        if (err && err.message === 'name_exists')
          return reply.code(409).send({ success: false, error: { code: 'name_exists', message: 'Page name already exists' } });
        if (err && err.message === 'owner_required')
             return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (err && err.message === 'max_pages_exceeded')
          return reply.code(409).send({ success: false, error: { code: 'max_pages_exceeded', message: 'Maximum pages reached for this category' } });
        pageLogger.error('createPage error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    createPageCategory: async (req, reply) => {
      try {
        const actor = req.user || null;
        if (!actor || actor.role !== 'admin')
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        const { name, slug, description, icon, is_active, rules, max_pages_per_user, requires_approval, validation_rules } = req.body || {};
        // Basic controller-level validation for JSON fields to provide clearer errors
        if (typeof rules !== 'undefined' && rules !== null && typeof rules !== 'object') {
          return reply.code(422).send({ success: false, error: { code: 'invalid_rules', message: 'rules must be an object' } });
        }
        if (typeof validation_rules !== 'undefined' && validation_rules !== null && typeof validation_rules !== 'object') {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules must be an object' } });
        }
        if (validation_rules && typeof validation_rules.slugPattern !== 'undefined' && typeof validation_rules.slugPattern !== 'string') {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules.slugPattern must be a string (regex pattern)' } });
        }
        if (validation_rules && typeof validation_rules.minNameLength !== 'undefined' && Number.isNaN(Number(validation_rules.minNameLength))) {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules.minNameLength must be a number' } });
        }
        if (validation_rules && typeof validation_rules.maxNameLength !== 'undefined' && Number.isNaN(Number(validation_rules.maxNameLength))) {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules.maxNameLength must be a number' } });
        }
        const created = await useCase.CreatePageCategory({ name, slug, description, icon, is_active, rules, max_pages_per_user, requires_approval, validation_rules });
        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        if (err && err.message === 'name_required')
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        if (err && err.message === 'slug_required')
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        if (err && err.message === 'name_exists')
          return reply.code(409).send({ success: false, error: { code: 'name_exists', message: 'Category name already exists' } });
        if (err && err.message === 'not_implemented')
          return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        pageLogger.error('createPageCategory error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    updatePageCategory: async (req, reply) => {
      try {
        const actor = req.user || null;
        if (!actor || actor.role !== 'admin')
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        const { id } = req.params;
        const updates = req.body || {};
        // Validate incoming JSON fields when provided
        if (typeof updates.rules !== 'undefined' && updates.rules !== null && typeof updates.rules !== 'object') {
          return reply.code(422).send({ success: false, error: { code: 'invalid_rules', message: 'rules must be an object' } });
        }
        if (typeof updates.validation_rules !== 'undefined' && updates.validation_rules !== null && typeof updates.validation_rules !== 'object') {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules must be an object' } });
        }
        if (updates.validation_rules && typeof updates.validation_rules.slugPattern !== 'undefined' && typeof updates.validation_rules.slugPattern !== 'string') {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules.slugPattern must be a string (regex pattern)' } });
        }
        if (updates.validation_rules && typeof updates.validation_rules.minNameLength !== 'undefined' && Number.isNaN(Number(updates.validation_rules.minNameLength))) {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules.minNameLength must be a number' } });
        }
        if (updates.validation_rules && typeof updates.validation_rules.maxNameLength !== 'undefined' && Number.isNaN(Number(updates.validation_rules.maxNameLength))) {
          return reply.code(422).send({ success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules.maxNameLength must be a number' } });
        }
        const updated = await useCase.UpdatePageCategory({ id, updates });
        return reply.code(200).send({ success: true, data: updated });
      } catch (err) {
        if (err && err.message === 'name_required')
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        if (err && err.message === 'slug_required')
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        if (err && err.message === 'name_exists')
          return reply.code(409).send({ success: false, error: { code: 'name_exists', message: 'Category name already exists' } });
        if (err && err.message === 'category_not_found')
          return reply.code(404).send({ success: false, error: { code: 'category_not_found' } });
        pageLogger.error('updatePageCategory error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    deletePageCategory: async (req, reply) => {
      try {
        const actor = req.user || null;
        if (!actor || actor.role !== 'admin')
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        const { id } = req.params;
        await useCase.DeletePageCategory({ id });
        return reply.code(200).send({ success: true, data: { id } });
      } catch (err) {
        if (err && err.message === 'category_not_found')
          return reply.code(404).send({ success: false, error: { code: 'category_not_found' } });
        pageLogger.error('deletePageCategory error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    followPage: async (req, reply) => {
      try {
        const { id } = req.params; // page id
        const actorId = req.user && req.user.id;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (!followersRepository) 
            return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        // Idempotent create: if already following, return existing record with 200
        try {
          const existing = await followersRepository.findByPageAndUser(id, actorId);
          if (existing) {
            return reply.code(200).send({ success: true, data: existing });
          }
        } catch (e) {
          // ignore and proceed to create
        }
        const created = await followersRepository.create({ pageId: id, userId: actorId });
        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        pageLogger.error('followPage error', { message: err.message, stack: err.stack });
        // Handle duplicate key gracefully in case of race condition
        if (err && (err.code === 'ER_DUP_ENTRY' || (err && String(err.message || '').toLowerCase().includes('duplicate entry')))) {
          try {
            const existing = await followersRepository.findByPageAndUser(req.params.id, req.user && req.user.id);
            if (existing) 
              return reply.code(200).send({ success: true, data: existing });
          } catch (e) {
            // fallthrough
          }
          return reply.code(200).send({ success: true, data: {} });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    unfollowPage: async (req, reply) => {
      try {
        const { id } = req.params; // page id
        const actorId = req.user && req.user.id;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (!followersRepository)
            return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        await followersRepository.deleteByPageAndUser(id, actorId);
        return reply.code(200).send({ success: true, data: { id } });
      } catch (err) {
        pageLogger.error('unfollowPage error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listPageFollowers: async (req, reply) => {
      try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit || '50', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        if (!followersRepository) 
            return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        const rows = await followersRepository.listByPage(id, { limit, offset });
        return reply.send({ success: true, data: rows });
      } catch (err) {
        pageLogger.error('listPageFollowers error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getPage: async (req, reply) => {
      try {
        const { id } = req.params;
        const page = await useCase.GetPage(id);
        // add followers count (if repository provided)
        let followersCount = null;
        try {
          if (followersRepository && typeof followersRepository.countByPage === 'function') {
            followersCount = await followersRepository.countByPage(id);
          }
        } catch (e) {
          pageLogger.warn('Failed to get followers count', { err: e && e.message });
        }

        // add category total pages
        let categoryPageCount = null;
        try {
          const categoryId = page && (page.category_id || page.categoryId);
          if (categoryId && useCase && useCase.pageRepository && typeof useCase.pageRepository.countByCategory === 'function') {
            categoryPageCount = await useCase.pageRepository.countByCategory(categoryId);
          }
        } catch (e) {
          pageLogger.warn('Failed to get category page count', { err: e && e.message });
        }

        const result = Object.assign({}, page, { followers_count: followersCount !== null ? followersCount : undefined, posts_count: page.post_count || 0, category_pages_count: categoryPageCount !== null ? categoryPageCount : undefined });
        return reply.send({ success: true, data: result });
      } catch (err) {
        if (err && err.message === 'page_not_found') 
            return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        pageLogger.error('getPage error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getPageCategory: async (req, reply) => {
      try {
        const { id } = req.params;
        if (!useCase.pageCategoryRepository || typeof useCase.pageCategoryRepository.findById !== 'function') {
          return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        }
        const cat = await useCase.pageCategoryRepository.findById(id);
        if (!cat) return reply.code(404).send({ success: false, error: { code: 'category_not_found' } });
        let total = null;
        try {
          if (useCase && useCase.pageRepository && typeof useCase.pageRepository.countByCategory === 'function') {
            total = await useCase.pageRepository.countByCategory(id);
          }
        } catch (e) {
          pageLogger.warn('Failed to count pages for category', { err: e && e.message });
        }

        const out = Object.assign({}, cat, { total_pages: total !== null ? total : undefined });
        return reply.send({ success: true, data: out });
      } catch (err) {
        pageLogger.error('getPageCategory error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // List pages for a category id
    listPagesByCategoryId: async (req, reply) => {
      try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit || '20', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        const rows = await useCase.pageRepository.listByCategory(id, { limit, offset });
        return reply.send({ success: true, data: rows });
      } catch (err) {
        pageLogger.error('listPagesByCategoryId error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // List pages for a category name
    listPagesByCategoryName: async (req, reply) => {
      try {
        const { name } = req.params;
        if (!useCase.pageCategoryRepository || typeof useCase.pageCategoryRepository.findByName !== 'function') {
          return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        }
        const cat = await useCase.pageCategoryRepository.findByName(name);
        if (!cat) 
          return reply.code(404).send({ success: false, error: { code: 'category_not_found' } });
        const limit = parseInt(req.query.limit || '20', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        const rows = await useCase.pageRepository.listByCategory(cat.id, { limit, offset });
        return reply.send({ success: true, data: rows });
      } catch (err) {
        pageLogger.error('listPagesByCategoryName error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // List posts belonging to a page
    listPostsByPage: async (req, reply) => {
      try {
        const { id } = req.params; // page id
        const limit = parseInt(req.query.limit || '20', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        // Try domain repo first, then adapter on server
        let rows = null;
        const postDomain = req.server && req.server.postRepository ? req.server.postRepository : null;
        const postAdapter = req.server && (req.server.postAdapter || req.server.postRepositoryAdapter) ? (req.server.postAdapter || req.server.postRepositoryAdapter) : null;
        if (postDomain && typeof postDomain.listByPage === 'function') {
          rows = await postDomain.listByPage(id, { limit, offset });
        } else if (postAdapter && typeof postAdapter.listByPage === 'function') {
          rows = await postAdapter.listByPage(id, { limit, offset });
        } else {
          return reply.code(501).send({ success: false, error: { code: 'not_implemented' } });
        }
        return reply.send({ success: true, data: rows });
      } catch (err) {
        pageLogger.error('listPostsByPage error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listPages: async (req, reply) => {
      try {
        const limit = parseInt(req.query.limit || '20', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        const rows = await useCase.ListPages({ limit, offset });
        return reply.send({ success: true, data: rows });
      } catch (err) {
        pageLogger.error('listPages error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    updatePage: async (req, reply) => {
      try {
        const { id } = req.params;
        const actorId = req.user && req.user.id;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const updates = req.body || {};
        const updated = await useCase.UpdatePage({ id, ownerId: actorId, updates });
        return reply.send({ success: true, data: updated });
      } catch (err) {
        if (err && err.message === 'page_not_found') 
            return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        if (err && err.message === 'not_authorized') 
            return reply.code(403).send({ success: false, error: { code: 'not_authorized' } });
        pageLogger.error('updatePage error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    deletePage: async (req, reply) => {
      try {
        const { id } = req.params;
        const actorId = req.user && req.user.id;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        await useCase.DeletePage({ id, ownerId: actorId });
        return reply.code(200).send({ success: true, data: { id } });
      } catch (err) {
        if (err && err.message === 'page_not_found') 
            return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        if (err && err.message === 'not_authorized') 
            return reply.code(403).send({ success: false, error: { code: 'not_authorized' } });
        pageLogger.error('deletePage error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    approvePage: async (req, reply) => {
      try {
        const { id } = req.params;
        const actorId = req.user && req.user.id;
        const actorRole = req.user && req.user.role;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const updated = await useCase.ApprovePage({ id, approverId: actorId, approverRole: actorRole });
        return reply.send({ success: true, data: updated });
      } catch (err) {
        if (err && err.message === 'not_authorized') 
            return reply.code(403).send({ success: false, error: { code: 'not_authorized' } });
        if (err && err.message === 'page_not_found') 
            return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        pageLogger.error('approvePage error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
