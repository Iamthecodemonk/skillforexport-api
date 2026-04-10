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
        if (err && err.message === 'owner_required')
             return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (err && err.message === 'max_pages_exceeded')
          return reply.code(409).send({ success: false, error: { code: 'max_pages_exceeded', message: 'Maximum pages reached for this category' } });
        pageLogger.error('createPage error', { message: err.message, stack: err.stack });
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
        const created = await followersRepository.create({ pageId: id, userId: actorId });
        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        pageLogger.error('followPage error', { message: err.message, stack: err.stack });
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
        return reply.code(204).send();
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
        return reply.send({ success: true, data: page });
      } catch (err) {
        if (err && err.message === 'page_not_found') 
            return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        pageLogger.error('getPage error', { message: err.message, stack: err.stack });
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
        return reply.code(204).send();
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
