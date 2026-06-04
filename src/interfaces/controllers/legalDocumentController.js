import logger from '../../utils/logger.js';

const legalLogger = logger.child('LEGAL_DOCUMENT_CONTROLLER');

const isAdmin = (req) => req.user && req.user.role === 'admin';

const sendValidationError = (reply, code) => reply.code(422).send({ success: false, error: { code } });

export function makeLegalDocumentController({ useCase }) {
  if (!useCase) throw new Error('useCase_required');

  return {
    listLegalDocuments: async (req, reply) => {
      try {
        const data = await useCase.ListPublicDocuments();
        return reply.send({ success: true, data });
      } catch (err) {
        legalLogger.error('listLegalDocuments error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getLegalDocument: async (req, reply) => {
      try {
        const data = await useCase.GetPublicDocument(req.params.slug);
        return reply.send({ success: true, data });
      } catch (err) {
        if (err.message === 'slug_required') return sendValidationError(reply, 'slug_required');
        if (err.message === 'document_not_found') return reply.code(404).send({ success: false, error: { code: 'document_not_found' } });
        legalLogger.error('getLegalDocument error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    adminListLegalDocuments: async (req, reply) => {
      try {
        if (!isAdmin(req)) return reply.code(req.user ? 403 : 401).send({ success: false, error: { code: req.user ? 'forbidden' : 'unauthorized' } });
        const data = await useCase.ListAllDocuments();
        return reply.send({ success: true, data });
      } catch (err) {
        legalLogger.error('adminListLegalDocuments error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    adminCreateLegalDocument: async (req, reply) => {
      try {
        if (!isAdmin(req)) return reply.code(req.user ? 403 : 401).send({ success: false, error: { code: req.user ? 'forbidden' : 'unauthorized' } });
        const data = await useCase.CreateDocument(req.body || {});
        return reply.code(201).send({ success: true, data });
      } catch (err) {
        if (['slug_required', 'title_required', 'content_required', 'invalid_content_type', 'invalid_status'].includes(err.message)) {
          return sendValidationError(reply, err.message);
        }
        legalLogger.error('adminCreateLegalDocument error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    adminUpdateLegalDocument: async (req, reply) => {
      try {
        if (!isAdmin(req)) return reply.code(req.user ? 403 : 401).send({ success: false, error: { code: req.user ? 'forbidden' : 'unauthorized' } });
        const data = await useCase.UpdateDocument(req.params.id, req.body || {});
        return reply.send({ success: true, data });
      } catch (err) {
        if (['id_required', 'slug_required', 'title_required', 'content_required', 'invalid_content_type', 'invalid_status'].includes(err.message)) {
          return sendValidationError(reply, err.message);
        }
        if (err.message === 'document_not_found') return reply.code(404).send({ success: false, error: { code: 'document_not_found' } });
        legalLogger.error('adminUpdateLegalDocument error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    adminDeleteLegalDocument: async (req, reply) => {
      try {
        if (!isAdmin(req)) return reply.code(req.user ? 403 : 401).send({ success: false, error: { code: req.user ? 'forbidden' : 'unauthorized' } });
        const data = await useCase.DeleteDocument(req.params.id);
        return reply.send({ success: true, data });
      } catch (err) {
        if (err.message === 'id_required') return sendValidationError(reply, 'id_required');
        if (err.message === 'document_not_found') return reply.code(404).send({ success: false, error: { code: 'document_not_found' } });
        legalLogger.error('adminDeleteLegalDocument error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
