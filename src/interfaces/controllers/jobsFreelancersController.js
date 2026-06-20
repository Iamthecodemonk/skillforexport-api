import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';
import { sendError } from '../errorResponse.js';
import logger from '../../utils/logger.js';

const log = logger.child('JOBS_FREELANCERS_CONTROLLER');

const actor = (req) => req.user || null;
const userId = (req) => req.user && req.user.id;
const success = (reply, data, message = 'success') => reply.send({ success: true, message, data });
const created = (reply, data, message = 'success') => reply.code(201).send({ success: true, message, data });
const publicJobStatuses = ['live', 'approved', 'active'];
const isOwnerOrAdmin = (currentActor, ownerId) => {
  if (!currentActor) return false;
  return currentActor.role === 'admin' || currentActor.id === ownerId || currentActor.userId === ownerId;
};

function queryParams(req, defaultPerPage = 20) {
  const { page, perPage, limit, offset } = parsePagination(req.query || {}, defaultPerPage);
  return { page, perPage, limit, offset, ...(req.query || {}) };
}

function adminQueryParams(req, defaultPerPage = 100) {
  const params = queryParams(req, defaultPerPage);
  if (req.query && (req.query.all === true || req.query.all === 'true')) {
    params.page = 1;
    params.perPage = 1000;
    params.limit = 1000;
    params.offset = 0;
  }
  return params;
}

function handleError(reply, err, notFoundCode = 'not_found') {
  if (err.message === 'unauthorized') return sendError(reply, 401, 'unauthorized', 'Unauthorized');
  if (err.message === 'forbidden') return sendError(reply, 403, 'forbidden', 'Forbidden');
  if (err.message === 'validation_error') return sendError(reply, 422, 'validation_error', 'Validation error');
  if (err.message === 'already_applied') return sendError(reply, 409, 'already_applied', 'Already applied');
  if (err.message === 'freelancer_profile_exists') return sendError(reply, 409, 'freelancer_profile_exists', 'Freelancer profile already exists');
  if (err.message && err.message.includes('not_found')) return sendError(reply, 404, err.message || notFoundCode, 'Not found');
  log.error('request failed', { message: err.message, stack: err.stack });
  return sendError(reply, 500, 'internal_error', 'Internal server error');
}

export function makeJobsFreelancersController({ useCase }) {
  return {
    listJobs: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listJobs({ ...params, userId: userId(req), status: null, statuses: publicJobStatuses });
        const total = await useCase.countJobs({ ...params, status: null, statuses: publicJobStatuses });
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    listAllJobs: async (req, reply) => {
      try {
        const params = adminQueryParams(req, 100);
        const data = await useCase.listAllJobs(actor(req), params);
        const total = await useCase.countAllJobs(actor(req), params);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    getJob: async (req, reply) => {
      try {
        const job = await useCase.getJob(req.params.idOrSlug, userId(req));
        if (!publicJobStatuses.includes(job.status) && !isOwnerOrAdmin(actor(req), job.createdByUserId)) throw new Error('job_not_found');
        return success(reply, job);
      }
      catch (err) { return handleError(reply, err, 'job_not_found'); }
    },
    createJob: async (req, reply) => {
      try { return created(reply, await useCase.createJob(actor(req), req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateJob: async (req, reply) => {
      try { return success(reply, await useCase.updateJob(actor(req), req.params.id, req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateJobStatus: async (req, reply) => {
      try { return success(reply, await useCase.updateJobStatus(actor(req), req.params.id, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    updateJobStatusAsAdmin: async (req, reply) => {
      try { return success(reply, await useCase.updateJobStatusAsAdmin(actor(req), req.params.id, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    deleteJob: async (req, reply) => {
      try { return success(reply, await useCase.deleteJob(actor(req), req.params.id)); }
      catch (err) { return handleError(reply, err); }
    },
    deleteJobAsAdmin: async (req, reply) => {
      try { return success(reply, await useCase.deleteJobAsAdmin(actor(req), req.params.id)); }
      catch (err) { return handleError(reply, err); }
    },
    listMyPostedJobs: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listMyPostedJobs(actor(req), params);
        const total = await useCase.countMyPostedJobs(actor(req), params);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    applyToJob: async (req, reply) => {
      try { return created(reply, await useCase.applyToJob(actor(req), req.params.id, req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    shareJob: async (req, reply) => {
      try { return created(reply, await useCase.shareJob(actor(req), req.params.id, req.body || {}), 'Job shared successfully'); }
      catch (err) { return handleError(reply, err, 'job_not_found'); }
    },
    recordJobShareEvent: async (req, reply) => {
      try { return created(reply, await useCase.recordJobShareEvent(actor(req), req.params.id, req.body || {}), 'Job share event recorded'); }
      catch (err) { return handleError(reply, err, 'job_not_found'); }
    },
    referJob: async (req, reply) => {
      try { return success(reply, await useCase.referJob(actor(req), req.params.id, req.body || {}), 'Job referral sent successfully'); }
      catch (err) { return handleError(reply, err, 'job_not_found'); }
    },
    listMyJobApplications: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listMyJobApplications(actor(req), params);
        const total = await useCase.countMyJobApplications(actor(req));
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    listJobApplications: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listJobApplications(actor(req), req.params.id, params);
        const total = await useCase.countJobApplications(actor(req), req.params.id);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    updateJobApplication: async (req, reply) => {
      try { return success(reply, await useCase.updateJobApplication(actor(req), req.params.jobId, req.params.applicationId, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    withdrawJobApplication: async (req, reply) => {
      try { return success(reply, await useCase.withdrawJobApplication(actor(req), req.params.jobId, req.params.applicationId)); }
      catch (err) { return handleError(reply, err); }
    },
    getAlertPreferences: async (req, reply) => {
      try { return success(reply, await useCase.getAlertPreferences(actor(req)), 'Alert preferences retrieved successfully'); }
      catch (err) { return handleError(reply, err); }
    },
    updateAlertPreferences: async (req, reply) => {
      try { return success(reply, await useCase.updateAlertPreferences(actor(req), req.body || {}), 'Alert preferences updated successfully.'); }
      catch (err) { return handleError(reply, err); }
    },
    listFreelancers: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listFreelancers({ ...params, statuses: ['available', 'certified'], status: null });
        const total = await useCase.countFreelancers({ ...params, statuses: ['available', 'certified'], status: null });
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    getFreelancer: async (req, reply) => {
      try {
        const freelancer = await useCase.getFreelancer(req.params.idOrUserId);
        if (!['available', 'certified'].includes(freelancer.status) && !isOwnerOrAdmin(actor(req), freelancer.userId)) throw new Error('freelancer_not_found');
        return success(reply, freelancer);
      }
      catch (err) { return handleError(reply, err, 'freelancer_not_found'); }
    },
    createFreelancer: async (req, reply) => {
      try { return created(reply, await useCase.createFreelancer(actor(req), req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    getMyFreelancerProfile: async (req, reply) => {
      try { return success(reply, await useCase.getMyFreelancerProfile(actor(req))); }
      catch (err) { return handleError(reply, err); }
    },
    updateMyFreelancerProfile: async (req, reply) => {
      try { return success(reply, await useCase.updateMyFreelancerProfile(actor(req), req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateFreelancerStatus: async (req, reply) => {
      try { return success(reply, await useCase.updateFreelancerStatus(actor(req), req.params.idOrUserId, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    listFreelanceJobs: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listFreelanceJobs({ ...params, userId: userId(req), status: null, statuses: publicJobStatuses });
        const total = await useCase.countFreelanceJobs({ ...params, status: null, statuses: publicJobStatuses });
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    listAllFreelanceJobs: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listAllFreelanceJobs(actor(req), params);
        const total = await useCase.countAllFreelanceJobs(actor(req), params);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    getFreelanceJob: async (req, reply) => {
      try {
        const job = await useCase.getFreelanceJob(req.params.idOrSlug, userId(req));
        if (!publicJobStatuses.includes(job.status) && !isOwnerOrAdmin(actor(req), job.postedByUserId)) throw new Error('freelance_job_not_found');
        return success(reply, job);
      }
      catch (err) { return handleError(reply, err, 'freelance_job_not_found'); }
    },
    createFreelanceJob: async (req, reply) => {
      try { return created(reply, await useCase.createFreelanceJob(actor(req), req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateFreelanceJob: async (req, reply) => {
      try { return success(reply, await useCase.updateFreelanceJob(actor(req), req.params.id, req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    updateFreelanceJobStatus: async (req, reply) => {
      try { return success(reply, await useCase.updateFreelanceJobStatus(actor(req), req.params.id, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    updateFreelanceJobStatusAsAdmin: async (req, reply) => {
      try { return success(reply, await useCase.updateFreelanceJobStatusAsAdmin(actor(req), req.params.id, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    },
    deleteFreelanceJob: async (req, reply) => {
      try { return success(reply, await useCase.deleteFreelanceJob(actor(req), req.params.id)); }
      catch (err) { return handleError(reply, err); }
    },
    deleteFreelanceJobAsAdmin: async (req, reply) => {
      try { return success(reply, await useCase.deleteFreelanceJobAsAdmin(actor(req), req.params.id)); }
      catch (err) { return handleError(reply, err); }
    },
    applyToFreelanceJob: async (req, reply) => {
      try { return created(reply, await useCase.applyToFreelanceJob(actor(req), req.params.id, req.body || {})); }
      catch (err) { return handleError(reply, err); }
    },
    listMyFreelanceJobs: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listMyFreelanceJobs(actor(req), params);
        const total = await useCase.countMyFreelanceJobs(actor(req), params);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    listMyFreelanceApplications: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listMyFreelanceApplications(actor(req), params);
        const total = await useCase.countMyFreelanceApplications(actor(req));
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total }));
      } catch (err) { return handleError(reply, err); }
    },
    listFreelanceJobApplications: async (req, reply) => {
      try {
        const params = queryParams(req);
        const data = await useCase.listFreelanceJobApplications(actor(req), req.params.id, params);
        return reply.send(buildPaginatedResponse(req, { data, page: params.page, perPage: params.perPage, total: data.length }));
      } catch (err) { return handleError(reply, err); }
    },
    updateFreelanceApplication: async (req, reply) => {
      try { return success(reply, await useCase.updateFreelanceApplication(actor(req), req.params.jobId, req.params.applicationId, (req.body || {}).status)); }
      catch (err) { return handleError(reply, err); }
    }
  };
}
