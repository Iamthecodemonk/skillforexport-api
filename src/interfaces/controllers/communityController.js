import logger from '../../utils/logger.js';
const log = logger.child('COMMUNITY_CONTROLLER');

export function makeCommunityController({ useCase = null }) {
  if (!useCase) throw new Error('useCase required');
  return {
    createCategory: async (req, reply) => {
      try {
        const { name } = req.body || {};
        const created = await useCase.createCategory({ name });
        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        log.error('createCategory error', { message: err.message });
        if (err.message === 'category_exists') 
            return reply.code(409).send({ success: false, error: { code: 'category_exists' } });
        if (err.message === 'validation_failed') 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    updateCategory: async (req, reply) => {
      try {
        const { id } = req.params;
        const updates = req.body || {};
        const updated = await useCase.updateCategory({ id, updates });
        return reply.send({ success: true, data: updated });
      } catch (err) {
        log.error('updateCategory error', { message: err.message });
        if (err.message === 'category_not_found') 
            return reply.code(404).send({ success: false, error: { code: 'category_not_found' } });
        if (err.message === 'category_name_taken') 
            return reply.code(409).send({ success: false, error: { code: 'category_name_taken' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    deleteCategory: async (req, reply) => {
      try {
        const { id } = req.params;
        await useCase.deleteCategory({ id });
        return reply.send({ success: true, data: { id } });
      } catch (err) {
        log.error('deleteCategory error', { message: err.message });
        if (err.message === 'category_not_found') 
            return reply.code(404).send({ success: false, error: { code: 'category_not_found' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    createCommunity: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const { name, description, categoryId, defaultPostVisibility } = req.body || {};
        const created = await useCase.createCommunity({ name, description, categoryId, ownerId: actorId, defaultPostVisibility });
        return reply.code(201).send({ success: true, data: created });
      } catch (err) {
        log.error('createCommunity error', { message: err.message });
        if (err.message === 'validation_failed') 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    joinCommunity: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const { id } = req.params;
        const added = await useCase.joinCommunity({ communityId: id, userId: actorId });
        return reply.code(200).send({ success: true, data: added });
      } catch (err) {
        log.error('joinCommunity error', { message: err.message });
        if (err.message === 'validation_failed') 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    leaveCommunity: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        if (!actorId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const { id } = req.params;
        const removed = await useCase.leaveCommunity({ communityId: id, userId: actorId });
        return reply.code(200).send({ success: true, data: removed || {} });
      } catch (err) {
        log.error('leaveCommunity error', { message: err.message });
        if (err.message === 'validation_failed') 
            return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listMembers: async (req, reply) => {
      try {
        const { id } = req.params;
        const rows = await useCase.listMembers(id);
        return reply.send({ success: true, data: rows });
      } catch (err) {
        log.error('listMembers error', { message: err.message });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
    ,

    getCommunity: async (req, reply) => {
      try {
        const { id } = req.params;
        const row = await useCase.getCommunity(id);
        if (!row) 
            return reply.code(404).send({ success: false, error: { code: 'community_not_found' } });
        return reply.send({ success: true, data: row });
      } catch (err) {
        log.error('getCommunity error', { message: err.message });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    updateCommunity: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const { id } = req.params;
        const updates = req.body || {};
        // Only owner or admin role can update community settings
        const existing = await useCase.getCommunity(id);
        if (!existing) 
            return reply.code(404).send({ success: false, error: { code: 'community_not_found' } });
        const actorRole = req.user && req.user.role;
        if (existing.owner_id !== actorId && actorRole !== 'admin') {
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        }
        const updated = await useCase.updateCommunity({ id, updates });
        return reply.send({ success: true, data: updated });
      } catch (err) {
        log.error('updateCommunity error', { message: err.message });
        if (err.message === 'community_not_found') return reply.code(404).send({ success: false, error: { code: 'community_not_found' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    deleteCommunity: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        if (!actorId) 
            return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const { id } = req.params;
        const existing = await useCase.getCommunity(id);
        if (!existing) 
            return reply.code(404).send({ success: false, error: { code: 'community_not_found' } });
        const actorRole = req.user && req.user.role;
        if (existing.owner_id !== actorId && actorRole !== 'admin') {
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        }
        await useCase.deleteCommunity({ id });
        return reply.send({ success: true, data: { id } });
      } catch (err) {
        log.error('deleteCommunity error', { message: err.message });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
