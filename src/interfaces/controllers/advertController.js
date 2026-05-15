import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';
import { sendError } from '../errorResponse.js';
import logger from '../../utils/logger.js';

const log = logger.child('ADVERT_CONTROLLER');
const actor = (req) => req.user || null;
const success = (reply, data, message = 'success') => reply.send({ success: true, message, data });
const created = (reply, data, message = 'success') => reply.code(201).send({ success: true, message, data });

function queryParams(req, defaultPerPage = 20) {
  const { page, perPage, limit, offset } = parsePagination(req.query || {}, defaultPerPage);
  return { page, perPage, limit, offset, ...(req.query || {}) };
}

function handleError(reply, err, notFoundCode = 'not_found') {
  if (err.message === 'unauthorized') return sendError(reply, 401, 'unauthorized', 'Unauthorized');
  if (err.message === 'forbidden') return sendError(reply, 403, 'forbidden', 'Forbidden');
  if (err.message === 'validation_error') return sendError(reply, 422, 'validation_error', 'Validation error');
  if (err.message === 'media_validation_unavailable') return sendError(reply, 503, 'media_validation_unavailable', 'Media validation is unavailable');
  if (err.message === 'media_not_ready') return sendError(reply, 422, 'media_not_ready', 'Uploaded advert image is not ready yet');
  if (err.message === 'invalid_media_type') return sendError(reply, 422, 'invalid_media_type', 'Advert image must be an image asset');
  if (err.message && err.message.includes('not_found')) return sendError(reply, 404, err.message || notFoundCode, 'Not found');
  log.error('request failed', { message: err.message, stack: err.stack });
  return sendError(reply, 500, 'internal_error', 'Internal server error');
}

export function makeAdvertController({ useCase }) {
  return {
    listAdverts: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listPublicAdverts(params);
        const total = await useCase.countPublicAdverts(params);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    listAllAdverts: async (req, reply) => {
      try {
        if (!actor(req) || actor(req).role !== 'admin') throw new Error(actor(req) ? 'forbidden' : 'unauthorized');
        const params = queryParams(req);
        const data = await useCase.listAdverts(params);
        const total = await useCase.countAdverts(params);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    getAdvert: async (req, reply) => {
      try { return success(reply, await useCase.getAdvert(req.params.id, true)); }
      catch (err) { return handleError(reply, err, 'advert_not_found'); }
    },
    createAdvert: async (req, reply) => {
      try { return created(reply, await useCase.createAdvert(actor(req), req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateAdvert: async (req, reply) => {
      try { return success(reply, await useCase.updateAdvert(actor(req), req.params.id, req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateAdvertStatus: async (req, reply) => {
      try { return success(reply, await useCase.updateAdvertStatus(actor(req), req.params.id, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    listAdvertLocations: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listLocations({ ...params, status: params.status || 'active' });
        const total = await useCase.countLocations({ ...params, status: params.status || 'active' });
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    createAdvertLocation: async (req, reply) => {
      try { return created(reply, await useCase.createLocation(actor(req), req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateAdvertLocation: async (req, reply) => {
      try { return success(reply, await useCase.updateLocation(actor(req), req.params.id, req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateAdvertLocationStatus: async (req, reply) => {
      try { return success(reply, await useCase.updateLocationStatus(actor(req), req.params.id, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    listAdvertSites: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listSites({ ...params, status: params.status || 'active' });
        const total = await useCase.countSites({ ...params, status: params.status || 'active' });
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    createAdvertSite: async (req, reply) => {
      try { return created(reply, await useCase.createSite(actor(req), req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateAdvertSite: async (req, reply) => {
      try { return success(reply, await useCase.updateSite(actor(req), req.params.id, req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateAdvertSiteStatus: async (req, reply) => {
      try { return success(reply, await useCase.updateSiteStatus(actor(req), req.params.id, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    }
  };
}
