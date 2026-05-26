import schemas from '../docs/schemas.js';
import logger from '../../utils/logger.js';
import { sendError } from '../errorResponse.js';
import 'dotenv/config';

const routesLogger = logger.child('ROUTES');

export default async function registerRoutes(fastify, deps) {
  routesLogger.info('Registering routes', { controllers: Object.keys(deps.controllers) });

  // Default fallback handler for missing controllers
  const fallback = async (req, reply) => {
    return sendError(reply, 501, 'handler_not_implemented', 'Handler not implemented');
  };

  // Helper to get handler or fallback
  const handler = (name) => deps.controllers[name] || fallback;
  const idParam = (name = 'id') => ({
    type: 'object',
    required: [name],
    properties: { [name]: { type: 'string' } }
  });
  const twoIdParams = (first, second) => ({
    type: 'object',
    required: [first, second],
    properties: { [first]: { type: 'string' }, [second]: { type: 'string' } }
  });
  const dataResponse = (dataSchema) => ({
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: dataSchema
    }
  });
  const anyObject = { type: 'object', additionalProperties: true };
  const anyArray = { type: 'array', items: anyObject };
  const genericSuccess = dataResponse(anyObject);
  const genericArraySuccess = dataResponse(anyArray);
  const genericPaginatedResponse = {
    type: 'object',
    properties: {
      current_page: { type: 'number' },
      data: anyArray,
      first_page_url: { type: ['string', 'null'] },
      from: { type: ['number', 'null'] },
      last_page: { type: 'number' },
      last_page_url: { type: ['string', 'null'] },
      next_page_url: { type: ['string', 'null'] },
      path: { type: ['string', 'null'] },
      per_page: { type: 'number' },
      prev_page_url: { type: ['string', 'null'] },
      to: { type: ['number', 'null'] },
      total: { type: 'number' }
    }
  };
  const legacyBody = {
    type: 'object',
    additionalProperties: true
  };
  const notificationReadBody = {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' } },
      notificationIds: { type: 'array', items: { type: 'string' } }
    }
  };
  const genericSaveBody = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      itemId: { type: 'string' },
      type: { type: 'string' },
      model: { type: 'string' }
    },
    additionalProperties: true
  };
  const genericReportBody = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      itemId: { type: 'string' },
      type: { type: 'string' },
      reason: { type: 'string' },
      details: { type: 'string' }
    },
    additionalProperties: true
  };
  const listQueryBase = {
    page: { type: 'integer', minimum: 1 },
    per_page: { type: 'integer', minimum: 1, maximum: 100 },
    perPage: { type: 'integer', minimum: 1, maximum: 100 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    offset: { type: 'integer', minimum: 0 },
    q: { type: 'string' },
    status: { type: 'string' },
    sort: { type: 'string' }
  };
  const jobsQuery = {
    type: 'object',
    properties: {
      ...listQueryBase,
      location: { type: 'string' },
      type: { type: 'string' },
      skill: { type: 'string' },
      experience: { type: 'string' },
      workMode: { type: 'string' }
    }
  };
  const freelancersQuery = {
    type: 'object',
    properties: {
      ...listQueryBase,
      skill: { type: 'string' },
      location: { type: 'string' },
      availability: { type: 'string' },
      remoteOnly: { type: 'boolean' }
    }
  };
  const freelanceJobsQuery = {
    type: 'object',
    properties: {
      ...listQueryBase,
      skill: { type: 'string' },
      location: { type: 'string' },
      type: { type: 'string' }
    }
  };
  const advertsQuery = {
    type: 'object',
    properties: {
      ...listQueryBase,
      locationId: { type: 'string' },
      siteId: { type: 'string' }
    }
  };

  // ========== Root ==========
  fastify.get('/', {
    schema: {
      operationId: 'getRoot',
      description: 'API root endpoint'
    }
  }, async (req, reply) => {
    return reply.send({ message: 'Fastify Clean Architecture API' });
  });

  // ========== Health ==========
  fastify.get('/health', {
    schema: {
      operationId: 'getHealth',
      tags: ['Health'],
      description: 'Check API health status',
      response: {
        200: {
          type: 'object',
          properties: { status: { type: 'string' } }
        }
      }
    }
  }, handler('health'));

  // ========== Jobs, Alerts, Freelancers ==========
  fastify.get('/jobs', {
    schema: { operationId: 'listJobs', tags: ['Jobs'], description: 'List approved/active jobs only. Public feed returns `approved`, `active`, and legacy `live` jobs.', querystring: jobsQuery, response: { 200: schemas.JobPaginatedResponse } }
  }, handler('listJobs'));
  fastify.post('/jobs', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'createJob', tags: ['Jobs'], description: 'Create a job posting. New jobs start as `pending_review` until approved.', body: schemas.JobCreateBody, response: { 201: dataResponse(schemas.JobResponse), 422: schemas.GenericErrorResponse } }
  }, handler('createJob'));
  fastify.get('/jobs/:idOrSlug', {
    schema: { operationId: 'getJob', tags: ['Jobs'], description: 'Get approved job detail by id or slug. Non-approved jobs are hidden from public users; owners/admins may view them.', params: idParam('idOrSlug'), response: { 200: dataResponse(schemas.JobResponse), 404: schemas.GenericErrorResponse } }
  }, handler('getJob'));
  fastify.patch('/jobs/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'updateJob', tags: ['Jobs'], description: 'Update a job posting. Creator/admin only.', params: idParam(), body: { ...schemas.JobCreateBody, required: [] }, response: { 200: dataResponse(schemas.JobResponse) } }
  }, handler('updateJob'));
  fastify.patch('/jobs/:id/status', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'updateJobStatus', tags: ['Jobs'], description: 'Update a job status. Set status to `approved` or `active` to show it publicly; `live` is still supported for existing data.', params: idParam(), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.JobResponse) } }
  }, handler('updateJobStatus'));
  fastify.delete('/jobs/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'deleteJob', tags: ['Jobs'], description: 'Delete a job posting. Creator/admin only.', params: idParam(), response: { 200: schemas.IdSuccessResponse } }
  }, handler('deleteJob'));
  fastify.get('/job/:idOrSlug', { schema: { operationId: 'legacyGetJob', tags: ['Jobs'], description: 'Legacy alias for GET /jobs/:idOrSlug', params: idParam('idOrSlug'), response: { 200: dataResponse(schemas.JobResponse), 404: schemas.GenericErrorResponse } } }, handler('getJob'));
  fastify.post('/job', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateJob', tags: ['Jobs'], description: 'Legacy alias for POST /jobs', body: schemas.JobCreateBody, response: { 201: dataResponse(schemas.JobResponse), 422: schemas.GenericErrorResponse } } }, handler('createJob'));
  fastify.put('/job/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateJob', tags: ['Jobs'], description: 'Legacy alias for PATCH /jobs/:id', params: idParam(), body: { ...schemas.JobCreateBody, required: [] }, response: { 200: dataResponse(schemas.JobResponse), 404: schemas.GenericErrorResponse } } }, handler('updateJob'));
  fastify.delete('/job/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDeleteJob', tags: ['Jobs'], description: 'Legacy alias for DELETE /jobs/:id', params: idParam(), response: { 200: schemas.IdSuccessResponse, 404: schemas.GenericErrorResponse } } }, handler('deleteJob'));
  fastify.get('/me/jobs/posted', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'listMyPostedJobs', tags: ['Jobs'], description: 'List jobs posted by the authenticated user.', querystring: jobsQuery, response: { 200: schemas.JobPaginatedResponse } }
  }, handler('listMyPostedJobs'));
  fastify.get('/user/jobs/posted', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { tags: ['Jobs'], description: 'Legacy alias for GET /me/jobs/posted', querystring: jobsQuery, response: { 200: schemas.JobPaginatedResponse } }
  }, handler('listMyPostedJobs'));
  fastify.post('/jobs/:id/applications', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'applyToJob', tags: ['Jobs'], description: 'Apply to a job.', params: idParam(), body: schemas.JobApplicationBody, response: { 201: dataResponse(schemas.JobApplicationResponse), 409: schemas.GenericErrorResponse } }
  }, handler('applyToJob'));
  fastify.post('/job/:id/apply', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyApplyToJob', tags: ['Jobs'], description: 'Legacy alias for applying to a job. Use resumeMediaId after uploading resume through media endpoints.', params: idParam(), body: schemas.JobApplicationBody, response: { 201: dataResponse(schemas.JobApplicationResponse), 409: schemas.GenericErrorResponse, 422: schemas.GenericErrorResponse } } }, handler('applyToJob'));
  fastify.get('/me/jobs/applications', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'listMyJobApplications', tags: ['Jobs'], description: 'List jobs the authenticated user applied for.', querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.JobApplicationPaginatedResponse } }
  }, handler('listMyJobApplications'));
  fastify.get('/user/jobs/applied', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { tags: ['Jobs'], description: 'Legacy alias for GET /me/jobs/applications', querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.JobApplicationPaginatedResponse } }
  }, handler('listMyJobApplications'));
  fastify.get('/jobs/:id/applications', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'listJobApplications', tags: ['Jobs'], description: 'List applications for a posted job. Creator/admin only.', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.JobApplicationPaginatedResponse } }
  }, handler('listJobApplications'));
  fastify.get('/job/:id/applicants', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListJobApplicants', tags: ['Jobs'], description: 'Legacy alias for GET /jobs/:id/applications', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.JobApplicationPaginatedResponse } } }, handler('listJobApplications'));
  fastify.patch('/jobs/:jobId/applications/:applicationId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'updateJobApplication', tags: ['Jobs'], description: 'Update job application status. Creator/admin only.', params: twoIdParams('jobId', 'applicationId'), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.JobApplicationResponse) } }
  }, handler('updateJobApplication'));
  fastify.delete('/jobs/:jobId/applications/:applicationId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'withdrawJobApplication', tags: ['Jobs'], description: 'Withdraw a job application.', params: twoIdParams('jobId', 'applicationId'), response: { 200: dataResponse(schemas.JobApplicationResponse) } }
  }, handler('withdrawJobApplication'));
  fastify.get('/me/alert-preferences', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'getAlertPreferences', tags: ['Jobs'], description: 'Get my alert preferences.', response: { 200: dataResponse(schemas.AlertPreferencesResponse) } }
  }, handler('getAlertPreferences'));
  fastify.put('/me/alert-preferences', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'updateAlertPreferences', tags: ['Jobs'], description: 'Update my alert preferences.', body: schemas.AlertPreferencesBody, response: { 200: dataResponse(schemas.AlertPreferencesResponse) } }
  }, handler('updateAlertPreferences'));

  fastify.get('/freelancers', { schema: { operationId: 'listFreelancers', tags: ['Freelancers'], description: 'List approved freelancer profiles only. Public feed returns profiles with status `available` or `certified`.', querystring: freelancersQuery, response: { 200: schemas.FreelancerPaginatedResponse } } }, handler('listFreelancers'));
  fastify.post('/freelancers', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'createFreelancer', tags: ['Freelancers'], description: 'Register as a freelancer.', body: schemas.FreelancerCreateBody, response: { 201: dataResponse(schemas.FreelancerProfileResponse) } } }, handler('createFreelancer'));
  fastify.get('/freelancers/:idOrUserId', { schema: { operationId: 'getFreelancer', tags: ['Freelancers'], description: 'Get approved freelancer profile by profile id or user id. Draft, pending, or suspended profiles are hidden from public users; owners/admins may view them.', params: idParam('idOrUserId'), response: { 200: dataResponse(schemas.FreelancerProfileResponse), 404: schemas.GenericErrorResponse } } }, handler('getFreelancer'));
  fastify.get('/me/freelancer-profile', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'getMyFreelancerProfile', tags: ['Freelancers'], description: 'Get my freelancer profile.', response: { 200: dataResponse(schemas.FreelancerProfileResponse) } } }, handler('getMyFreelancerProfile'));
  fastify.patch('/me/freelancer-profile', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateMyFreelancerProfile', tags: ['Freelancers'], description: 'Update my freelancer profile.', body: { ...schemas.FreelancerCreateBody, required: [] }, response: { 200: dataResponse(schemas.FreelancerProfileResponse) } } }, handler('updateMyFreelancerProfile'));
  fastify.patch('/freelancers/:idOrUserId/status', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateFreelancerStatus', tags: ['Freelancers'], description: 'Update a freelancer profile status. Set status to `available` or `certified` to approve/show it publicly.', params: idParam('idOrUserId'), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.FreelancerProfileResponse) } } }, handler('updateFreelancerStatus'));
  fastify.post('/freelancer/register', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateFreelancer', tags: ['Freelancers'], description: 'Legacy alias for POST /freelancers', body: schemas.FreelancerCreateBody, response: { 201: dataResponse(schemas.FreelancerProfileResponse), 422: schemas.GenericErrorResponse } } }, handler('createFreelancer'));
  fastify.get('/freelancer/profile', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyGetMyFreelancerProfile', tags: ['Freelancers'], description: 'Legacy alias for GET /me/freelancer-profile', response: { 200: dataResponse(schemas.FreelancerProfileResponse), 401: schemas.AuthErrorResponse } } }, handler('getMyFreelancerProfile'));
  fastify.put('/freelancer/profile', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateMyFreelancerProfile', tags: ['Freelancers'], description: 'Legacy alias for PATCH /me/freelancer-profile', body: { ...schemas.FreelancerCreateBody, required: [] }, response: { 200: dataResponse(schemas.FreelancerProfileResponse), 422: schemas.GenericErrorResponse } } }, handler('updateMyFreelancerProfile'));

  fastify.get('/freelance-jobs', { schema: { operationId: 'listFreelanceJobs', tags: ['Freelance Jobs'], description: 'List approved/active freelance jobs only. Public feed returns `approved`, `active`, and legacy `live` jobs.', querystring: freelanceJobsQuery, response: { 200: schemas.FreelanceJobPaginatedResponse } } }, handler('listFreelanceJobs'));
  fastify.post('/freelance-jobs', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'createFreelanceJob', tags: ['Freelance Jobs'], description: 'Create freelance job. New freelance jobs start as `pending_review` until approved.', body: schemas.FreelanceJobCreateBody, response: { 201: dataResponse(schemas.FreelanceJobResponse) } } }, handler('createFreelanceJob'));
  fastify.get('/freelance-jobs/:idOrSlug', { schema: { operationId: 'getFreelanceJob', tags: ['Freelance Jobs'], description: 'Get approved freelance job detail. Non-approved freelance jobs are hidden from public users; owners/admins may view them.', params: idParam('idOrSlug'), response: { 200: dataResponse(schemas.FreelanceJobResponse), 404: schemas.GenericErrorResponse } } }, handler('getFreelanceJob'));
  fastify.patch('/freelance-jobs/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateFreelanceJob', tags: ['Freelance Jobs'], description: 'Update freelance job.', params: idParam(), body: { ...schemas.FreelanceJobCreateBody, required: [] }, response: { 200: dataResponse(schemas.FreelanceJobResponse) } } }, handler('updateFreelanceJob'));
  fastify.patch('/freelance-jobs/:id/status', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateFreelanceJobStatus', tags: ['Freelance Jobs'], description: 'Update freelance job status. Set status to `approved` or `active` to show it publicly; `live` is still supported for existing data.', params: idParam(), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.FreelanceJobResponse) } } }, handler('updateFreelanceJobStatus'));
  fastify.delete('/freelance-jobs/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'deleteFreelanceJob', tags: ['Freelance Jobs'], description: 'Delete freelance job.', params: idParam(), response: { 200: schemas.IdSuccessResponse } } }, handler('deleteFreelanceJob'));
  fastify.post('/freelance-jobs/:id/applications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'applyToFreelanceJob', tags: ['Freelance Jobs'], description: 'Apply to freelance job.', params: idParam(), body: schemas.FreelanceApplicationBody, response: { 201: dataResponse(schemas.FreelanceApplicationResponse) } } }, handler('applyToFreelanceJob'));
  fastify.get('/me/freelance-jobs/posted', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'listMyFreelanceJobs', tags: ['Freelance Jobs'], description: 'List my posted freelance jobs.', querystring: freelanceJobsQuery, response: { 200: schemas.FreelanceJobPaginatedResponse } } }, handler('listMyFreelanceJobs'));
  fastify.get('/me/freelance-jobs/applications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'listMyFreelanceApplications', tags: ['Freelance Jobs'], description: 'List my freelance job applications.', querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.FreelanceApplicationPaginatedResponse } } }, handler('listMyFreelanceApplications'));
  fastify.get('/freelance-jobs/:id/applications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'listFreelanceJobApplications', tags: ['Freelance Jobs'], description: 'List applications for freelance job.', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.FreelanceApplicationPaginatedResponse } } }, handler('listFreelanceJobApplications'));
  fastify.patch('/freelance-jobs/:jobId/applications/:applicationId', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateFreelanceApplication', tags: ['Freelance Jobs'], description: 'Update freelance application status.', params: twoIdParams('jobId', 'applicationId'), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.FreelanceApplicationResponse) } } }, handler('updateFreelanceApplication'));
  fastify.post('/freelancer/job', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateFreelanceJob', tags: ['Freelance Jobs'], description: 'Legacy alias for POST /freelance-jobs', body: schemas.FreelanceJobCreateBody, response: { 201: dataResponse(schemas.FreelanceJobResponse), 422: schemas.GenericErrorResponse } } }, handler('createFreelanceJob'));
  fastify.get('/freelancer/jobs', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListMyFreelanceJobs', tags: ['Freelance Jobs'], description: 'Legacy alias for GET /me/freelance-jobs/posted', querystring: freelanceJobsQuery, response: { 200: schemas.FreelanceJobPaginatedResponse } } }, handler('listMyFreelanceJobs'));
  fastify.post('/freelancer/email', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyEmailFreelancer', tags: ['Freelancers'], description: 'Legacy freelancer email compatibility endpoint', body: { type: 'object', properties: { freelancerId: { type: 'string' }, email: { type: 'string', format: 'email' }, message: { type: 'string' } }, additionalProperties: true }, response: { 200: genericArraySuccess } } }, async (req, reply) => reply.send({ success: true, message: 'Email queued', data: [] }));

  // ========== Adverts ==========
  fastify.get('/ads', { schema: { operationId: 'listAds', tags: ['Adverts'], description: 'List active approved adverts for public placement.', querystring: advertsQuery, response: { 200: schemas.AdvertPaginatedResponse } } }, handler('listAdverts'));
  fastify.get('/adverts', { schema: { operationId: 'listAdverts', tags: ['Adverts'], description: 'List active approved adverts for public placement.', querystring: advertsQuery, response: { 200: schemas.AdvertPaginatedResponse } } }, handler('listAdverts'));
  fastify.get('/adverts/all', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'listAllAdverts', tags: ['Adverts'], description: 'Admin list of all adverts, including pending, suspended, deleted, and expired adverts.', querystring: advertsQuery, response: { 200: schemas.AdvertPaginatedResponse } } }, handler('listAllAdverts'));
  fastify.get('/adverts/:id', { schema: { operationId: 'getAdvert', tags: ['Adverts'], description: 'Get an active approved advert by id.', params: idParam(), response: { 200: dataResponse(schemas.AdvertResponse), 404: schemas.GenericErrorResponse } } }, handler('getAdvert'));
  fastify.post('/adverts', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'createAdvert', tags: ['Adverts'], description: 'Create an advert for admin approval/management.', body: schemas.AdvertCreateBody, response: { 201: dataResponse(schemas.AdvertResponse), 422: schemas.GenericErrorResponse } } }, handler('createAdvert'));
  fastify.patch('/adverts/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateAdvert', tags: ['Adverts'], description: 'Update advert content, placement, owner details, duration, or media.', params: idParam(), body: { ...schemas.AdvertCreateBody, required: [] }, response: { 200: dataResponse(schemas.AdvertResponse) } } }, handler('updateAdvert'));
  fastify.patch('/adverts/:id/status', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateAdvertStatus', tags: ['Adverts'], description: 'Approve, activate, expire, suspend, delete, or unsuspend an advert.', params: idParam(), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.AdvertResponse) } } }, handler('updateAdvertStatus'));
  fastify.delete('/adverts/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'deleteAdvert', tags: ['Adverts'], description: 'Soft-delete an advert by setting status to `deleted`.', params: idParam(), response: { 200: dataResponse(schemas.AdvertResponse) } } }, async (req, reply) => {
    req.body = { status: 'deleted' };
    return handler('updateAdvertStatus')(req, reply);
  });
  fastify.get('/advert-locations', { schema: { operationId: 'listAdvertLocations', tags: ['Adverts'], description: 'List active advert locations.', querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.AdvertLocationPaginatedResponse } } }, handler('listAdvertLocations'));
  fastify.post('/advert-locations', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'createAdvertLocation', tags: ['Adverts'], description: 'Create an advert location option.', body: schemas.AdvertOptionCreateBody, response: { 201: dataResponse(schemas.AdvertLocationResponse) } } }, handler('createAdvertLocation'));
  fastify.patch('/advert-locations/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateAdvertLocation', tags: ['Adverts'], description: 'Update an advert location option.', params: idParam(), body: { ...schemas.AdvertOptionCreateBody, required: [] }, response: { 200: dataResponse(schemas.AdvertLocationResponse) } } }, handler('updateAdvertLocation'));
  fastify.patch('/advert-locations/:id/status', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateAdvertLocationStatus', tags: ['Adverts'], description: 'Suspend, delete, or unsuspend an advert location option.', params: idParam(), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.AdvertLocationResponse) } } }, handler('updateAdvertLocationStatus'));
  fastify.delete('/advert-locations/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'deleteAdvertLocation', tags: ['Adverts'], description: 'Soft-delete an advert location option by setting status to `deleted`.', params: idParam(), response: { 200: dataResponse(schemas.AdvertLocationResponse) } } }, async (req, reply) => {
    req.body = { status: 'deleted' };
    return handler('updateAdvertLocationStatus')(req, reply);
  });
  fastify.get('/advert-sites', { schema: { operationId: 'listAdvertSites', tags: ['Adverts'], description: 'List active advert site options.', querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.AdvertSitePaginatedResponse } } }, handler('listAdvertSites'));
  fastify.post('/advert-sites', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'createAdvertSite', tags: ['Adverts'], description: 'Create an advert site option.', body: schemas.AdvertOptionCreateBody, response: { 201: dataResponse(schemas.AdvertSiteResponse) } } }, handler('createAdvertSite'));
  fastify.patch('/advert-sites/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateAdvertSite', tags: ['Adverts'], description: 'Update an advert site option.', params: idParam(), body: { ...schemas.AdvertOptionCreateBody, required: [] }, response: { 200: dataResponse(schemas.AdvertSiteResponse) } } }, handler('updateAdvertSite'));
  fastify.patch('/advert-sites/:id/status', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateAdvertSiteStatus', tags: ['Adverts'], description: 'Suspend, delete, or unsuspend an advert site option.', params: idParam(), body: schemas.StatusUpdateBody, response: { 200: dataResponse(schemas.AdvertSiteResponse) } } }, handler('updateAdvertSiteStatus'));
  fastify.delete('/advert-sites/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'deleteAdvertSite', tags: ['Adverts'], description: 'Soft-delete an advert site option by setting status to `deleted`.', params: idParam(), response: { 200: dataResponse(schemas.AdvertSiteResponse) } } }, async (req, reply) => {
    req.body = { status: 'deleted' };
    return handler('updateAdvertSiteStatus')(req, reply);
  });

  fastify.get('/feeds', { schema: { operationId: 'legacyListFeeds', tags: ['Feeds'], description: 'Legacy feed alias for /posts', querystring: { type: 'object', properties: { ...listQueryBase, communityId: { type: 'string' }, lastCreatedAt: { type: 'string' }, lastId: { type: 'string' } } }, response: { 200: schemas.PostPaginatedResponse } } }, handler('listPosts'));
  fastify.get('/enums', { schema: { operationId: 'legacyListEnums', tags: ['Meta'], description: 'Legacy enum bootstrap endpoint', response: { 200: genericSuccess } } }, handler('listEnums'));
  fastify.post('/contact', { schema: { operationId: 'legacySendContact', tags: ['Contact'], description: 'Legacy public contact endpoint', body: { type: 'object', required: ['name', 'email', 'message'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, subject: { type: 'string' }, message: { type: 'string' } }, additionalProperties: true }, response: { 201: genericArraySuccess, 422: schemas.GenericErrorResponse } } }, handler('sendContact'));

  // Items feature removed

  // Legacy `/auth/*` routes removed — unified API endpoints live under the single API surface
  // Examples: /register/send-otp, /register/verify-otp, /register/complete, /login, /forgot-password, /reset-password

  // ========== Google OAuth ==========
  fastify.get('/auth/google', {
    schema: {
      operationId: 'googleRedirect',
      tags: ['Auth'],
      description: 'Redirect to Google OAuth consent screen'
    }
  }, handler('GoogleRedirect'));

  fastify.get('/auth/google/callback', {
    schema: {
      operationId: 'googleCallback',
      tags: ['Auth'],
      description: 'Google OAuth callback handler'
    }
  }, handler('GoogleCallback'));

  fastify.post(
    '/auth/google/token',
    {
      schema: {
        operationId: 'googleTokenSignIn',
        tags: ['Auth'],
        description: 'Exchange a Google ID token for an application auth token.',
        body: schemas.TokenSignInBody,
        response: {
          200: schemas.AuthSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.GenericErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, {
        idToken: req.body && (req.body.id_token || req.body.idToken)
      });

      return handler('TokenSignIn')(req, reply);
    }
  );

  // ======= Unified API auth endpoints (single flow used by web and mobile)
  // Register the common API endpoints under `/api/*` and call existing controllers directly.
  const authPre = deps && deps.authRequired ? deps.authRequired : undefined;

  fastify.post(
    '/register/send-otp',
    {
      schema: {
        operationId: 'sendRegistrationOtp',
        tags: ['Auth'],
        description: 'Start registration by sending an OTP to the supplied email address.',
        body: schemas.RequestOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('RequestRegistrationOtp')
  );

  fastify.post(
    '/register/verify-otp',
    {
      schema: {
        operationId: 'verifyRegistrationOtp',
        tags: ['Auth'],
        description: 'Verify the OTP code sent during registration before completing account creation.',
        body: schemas.VerifyOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, {
        otpCode: req.body && (req.body.otp || req.body.otpCode)
      });

      return handler('VerifyOtp')(req, reply);
    }
  );

  fastify.post(
    '/register/resend-otp',
    {
      schema: {
        operationId: 'resendRegistrationOtp',
        tags: ['Auth'],
        description: 'Resend the registration OTP to the provided email address.',
        body: schemas.RequestOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('ResendRegistrationOtp')
  );

  fastify.post(
    '/register/set-password',
    {
      schema: {
        operationId: 'setRegistrationPassword',
        tags: ['Auth'],
        description: 'Set the password during the registration flow after email ownership has been verified.',
        body: schemas.RegisterSetPasswordBody,
        response: {
          200: schemas.EmptyObjectSuccessResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('SetRegistrationPassword')
  );

  fastify.post(
    '/register/complete',
    {
      schema: {
        operationId: 'completeRegistration',
        tags: ['Auth'],
        description: 'Complete the registration flow and return the created user with an API token.',
        body: schemas.RegisterCompleteBody,
        response: {
          201: schemas.AuthSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('CompleteRegistration')
  );

  fastify.post(
    '/login',
    {
      schema: {
        operationId: 'loginWithEmailPassword',
        tags: ['Auth'],
        description: 'Authenticate with email and password and return the authenticated user plus API token.',
        body: schemas.LoginBody,
        response: {
          200: schemas.AuthSuccessResponse,
          401: schemas.MessageOnlyErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('LoginUserWithEmailPassword')
  );

  fastify.post(
    '/forgot-password',
    {
      schema: {
        operationId: 'requestPasswordReset',
        tags: ['Auth'],
        description: 'Request a password reset token or OTP for the supplied email address.',
        body: schemas.RequestOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, { purpose: 'password_reset' });

      return handler('RequestOtp')(req, reply);
    }
  );

  fastify.post(
    '/reset-password',
    {
      schema: {
        operationId: 'resetPassword',
        tags: ['Auth'],
        description: 'Reset a user password with a reset token or OTP previously issued by the platform.',
        body: schemas.ResetPasswordBody,
        response: {
          200: schemas.SimpleSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, {
        otpCode: req.body && (req.body.otp || req.body.token || req.body.otpCode),
        newPassword: req.body && (req.body.password || req.body.newPassword)
      });

      return handler('ResetPassword')(req, reply);
    }
  );

  fastify.post(
    '/logout',
    {
      preHandler: authPre,
      schema: {
        operationId: 'logoutUser',
        tags: ['Auth'],
        description: 'Invalidate the current authenticated session or token.',
        response: {
          200: schemas.SimpleSuccessResponse,
          401: schemas.AuthErrorResponse
        }
      }
    },
    handler('Logout')
  );

  fastify.post(
    '/refresh-token',
    {
      preHandler: authPre,
      schema: {
        operationId: 'refreshAuthToken',
        tags: ['Auth'],
        description: 'Refresh the current authentication token and return a new token payload.',
        response: {
          200: schemas.AuthSuccessResponse,
          401: schemas.AuthErrorResponse
        }
      }
    },
    async (req, reply) => {
      if (!deps.controllers || !deps.controllers.RefreshToken) {
        return sendError(reply, 501, 'not_implemented', 'Refresh token endpoint is not implemented on server');
      }

      return handler('RefreshToken')(req, reply);
    }
  );

  // Auth-required endpoints for changing password/email
  fastify.put(
    '/user/change-password',
    {
      preHandler: authPre,
      schema: {
        operationId: 'changeUserPassword',
        tags: ['Auth'],
        description: 'Change the password for the currently authenticated user.',
        body: schemas.ChangePasswordBody,
        response: {
          200: schemas.EmptyArraySuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      if (!deps.controllers || !deps.controllers.ChangePassword) {
        return sendError(reply, 501, 'not_implemented', 'Change password not implemented');
      }

      req.body = Object.assign({}, req.body, {
        oldPassword: req.body && (req.body.current_password || req.body.oldPassword),
        newPassword: req.body && (req.body.password || req.body.newPassword)
      });

      return handler('ChangePassword')(req, reply);
    }
  );

  fastify.put(
    '/user/change-email',
    {
      preHandler: authPre,
      schema: {
        operationId: 'changeUserEmail',
        tags: ['Auth'],
        description: 'Change the email address for the currently authenticated user.',
        body: schemas.ChangeEmailBody,
        response: {
          200: schemas.EmailObjectSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      if (!deps.controllers || !deps.controllers.ChangeEmail) {
        return sendError(reply, 501, 'not_implemented', 'Change email not implemented');
      }

      req.body = Object.assign({}, req.body, {
        newEmail: req.body && (req.body.new_email || req.body.newEmail)
      });

      return handler('ChangeEmail')(req, reply);
    }
  );

  // ========== Users ==========
  fastify.get('/users', {
    schema: {
      operationId: 'listUsers',
      tags: ['Users'],
      description: 'List users with aggregate activity counts and latest related records.',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          per_page: { type: 'integer', minimum: 1, maximum: 100 },
          perPage: { type: 'integer', minimum: 1, maximum: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 }
        }
      },
      response: {
        200: schemas.UserActivityPaginatedResponse
      }
    }
  }, handler('listUsers'));

  fastify.get('/users/:id', {
    schema: {
      operationId: 'getUser',
      tags: ['Users'],
      description: 'Get a user by id with aggregate activity counts, profile collections, and latest related records.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: schemas.UserActivityResponse
          },
          example: { success: true, message: 'Success', data: schemas.UserActivityResponse.example }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('getUser'));

  fastify.patch('/users/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updateUser',
      tags: ['Users'],
      description: 'Update basic user-facing fields. Currently supports display/full name via `name` or `displayName` and returns both user and profile.',
      params: idParam(),
      body: schemas.UserUpdateBody,
      response: { 200: dataResponse(schemas.UserUpdateResponse), 401: schemas.AuthErrorResponse, 403: schemas.GenericErrorResponse, 422: schemas.GenericErrorResponse }
    }
  }, handler('updateUser'));

  fastify.get('/users/:id/public-profile', {
    schema: {
      operationId: 'getPublicProfile',
      tags: ['Users'],
      description: 'Get public-safe profile data for a public profile page. Private fields such as email and phone are not returned.',
      params: idParam(),
      response: { 200: dataResponse(schemas.PublicProfileResponse), 404: schemas.GenericErrorResponse }
    }
  }, handler('getPublicProfile'));

  fastify.post('/users', {
    schema: {
      operationId: 'createUser',
      tags: ['Users'],
      description: 'Create a user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] }
        },
        example: { email: 'user@example.com', password: 'P@ssw0rd', role: 'user' }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' } } }
          }
        },
        422: schemas.ValidationErrorResponse,
        409: schemas.GenericErrorResponse
      }
    }
  }, handler('createUser'));

  fastify.get('/users/:id/profile', {
    schema: {
      operationId: 'getUserProfile',
      tags: ['Users'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: schemas.FullProfileResponse
          }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('getUserProfile'));
  // Authenticated endpoint to return the full assembled profile for the current user
  fastify.get('/user/profile/me', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'getMyProfile',
      tags: ['Users'],
      description: 'Get complete profile for the authenticated user (profile, skills, portfolios, certs, education, experiences, followers, oauth accounts)',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: schemas.FullProfileResponse
          }
        },
        401: schemas.AuthErrorResponse
      }
    }
  }, handler('getMyProfile'));

  fastify.get('/user/stats/me', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'getMyStats',
      tags: ['Users'],
      description: 'Get simple counts for the authenticated user: pages, communities, posts, comments',
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { pages: { type: 'number' }, communities: { type: 'number' }, posts: { type: 'number' }, comments: { type: 'number' } } } } },
        401: { type: 'object' }
      }
    }
  }, handler('getMyStats'));
  fastify.get('/user/profile', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { tags: ['Users'], description: 'Legacy alias for GET /user/profile/me', response: { 200: dataResponse(schemas.FullProfileResponse) } }
  }, handler('getMyProfile'));
  fastify.post('/user/update', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'legacyUpdateUserProfile', tags: ['Users'], description: 'Legacy profile update alias. Updates display name and profile fields.', body: { ...schemas.UserProfileBody, properties: { ...schemas.UserProfileBody.properties, name: { type: 'string' }, displayName: { type: 'string' } } }, response: { 200: genericSuccess, 401: schemas.AuthErrorResponse, 422: schemas.GenericErrorResponse } }
  }, async (req, reply) => {
    const id = req.user && req.user.id;
    if (!id) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
    if ((req.body || {}).name || (req.body || {}).displayName) {
      req.params = { id };
      return handler('updateUser')(req, reply);
    }
    req.params = { id };
    return handler('updateUserProfile')(req, reply);
  });
  fastify.get('/user/:id', { schema: { operationId: 'legacyGetUser', tags: ['Users'], description: 'Legacy public profile alias for GET /users/:id', params: idParam(), response: { 200: dataResponse(schemas.UserActivityResponse), 404: schemas.GenericErrorResponse } } }, handler('getUser'));
  fastify.put('/user/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'legacyToggleFollowUser', tags: ['Users'], description: 'Legacy toggle follow. Follows when not following, unfollows when already following.', params: idParam(), response: { 200: genericSuccess, 401: schemas.AuthErrorResponse } }
  }, async (req, reply) => {
    const followerId = req.user && req.user.id;
    if (!followerId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
    try {
      const existing = deps.controllers && deps.controllers.__noop;
      return handler('followUser')(req, reply);
    } catch (e) {
      return handler('followUser')(req, reply);
    }
  });
  fastify.post('/user/referrals', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacySendReferrals', tags: ['Users'], description: 'Send referral emails. Accepts a comma-separated `emails` string.', body: { type: 'object', required: ['emails'], properties: { emails: { type: 'string', example: 'friend@example.com, teammate@example.com' } } }, response: { 200: dataResponse({ type: 'array', items: { type: 'string' } }), 401: schemas.AuthErrorResponse, 422: schemas.GenericErrorResponse } } }, handler('sendReferrals'));
  fastify.post('/user/skills', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyAddSkills', tags: ['Users'], description: 'Legacy add skills route. Accepts comma-separated `skills` or `skill`.', body: { type: 'object', properties: { skills: { type: 'string' }, skill: { type: 'string' } } }, response: { 201: genericArraySuccess, 401: schemas.AuthErrorResponse, 422: schemas.GenericErrorResponse } } }, handler('addLegacySkills'));
  fastify.put('/user/privacy', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdatePrivacy', tags: ['Users'], description: 'Update legacy privacy settings', body: legacyBody, response: { 200: genericArraySuccess, 401: schemas.AuthErrorResponse } } }, handler('updatePrivacy'));
  fastify.put('/user/settings', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateSettings', tags: ['Users'], description: 'Update legacy settings', body: legacyBody, response: { 200: genericSuccess, 401: schemas.AuthErrorResponse } } }, handler('updateSettings'));
  fastify.put('/user/disable-account', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDisableAccount', tags: ['Users'], description: 'Disable authenticated account', body: legacyBody, response: { 200: genericArraySuccess, 401: schemas.AuthErrorResponse } } }, handler('disableAccount'));
  fastify.post('/user/notification-email/send-otp', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacySendNotificationEmailOtp', tags: ['Users'], description: 'Send notification email OTP', body: { type: 'object', required: ['notification_email'], properties: { notification_email: { type: 'string', format: 'email' } } }, response: { 200: genericSuccess, 401: schemas.AuthErrorResponse, 422: schemas.GenericErrorResponse } } }, handler('sendNotificationEmailOtp'));
  fastify.post('/user/notification-email/verify', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyVerifyNotificationEmail', tags: ['Users'], description: 'Verify notification email OTP', body: { type: 'object', required: ['otp'], properties: { otp: { type: 'string' } } }, response: { 200: genericSuccess, 401: schemas.AuthErrorResponse, 422: schemas.GenericErrorResponse } } }, handler('verifyNotificationEmail'));
  fastify.get('/user/notifications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListUserNotifications', tags: ['Users', 'Notifications'], description: 'Legacy notification list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse, 401: schemas.AuthErrorResponse } } }, handler('listNotifications'));
  fastify.get('/user/posts', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListUserPosts', tags: ['Users'], description: 'Legacy own posts list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listUserPosts'));
  fastify.get('/user/comments', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListUserComments', tags: ['Users'], description: 'Legacy own comments list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listUserComments'));
  fastify.get('/user/questions', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListUserQuestions', tags: ['Users'], description: 'Legacy own questions list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listUserQuestions'));
  fastify.get('/user/answers', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListUserAnswers', tags: ['Users'], description: 'Legacy own answers list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listUserAnswers'));
  fastify.get('/user/scores/posts', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListPostScores', tags: ['Users'], description: 'Legacy post scores list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listPostScores'));
  fastify.get('/user/scores/answers', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListAnswerScores', tags: ['Users'], description: 'Legacy answer scores list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listAnswerScores'));
  fastify.get('/user/scores/comments', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListCommentScores', tags: ['Users'], description: 'Legacy comment scores list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listCommentScores'));
  fastify.get('/user/saved-posts', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListSavedPosts', tags: ['Users'], description: 'Legacy saved posts list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listSavedPosts'));
  fastify.get('/user/saved-question', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListSavedQuestions', tags: ['Users'], description: 'Legacy saved questions list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listSavedQuestions'));
  fastify.get('/user/alerts', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyGetAlerts', tags: ['Users'], description: 'Legacy alias for alert preferences', response: { 200: dataResponse(schemas.AlertPreferencesResponse) } } }, handler('getAlertPreferences'));
  fastify.post('/user/alerts', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateAlerts', tags: ['Users'], description: 'Legacy alias for updating alert preferences', body: schemas.AlertPreferencesBody, response: { 200: dataResponse(schemas.AlertPreferencesResponse) } } }, handler('updateAlertPreferences'));
  fastify.get('/notifications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'listNotifications', tags: ['Notifications'], description: 'List authenticated user notifications.', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listNotifications'));
  fastify.get('/notifications/unread-count', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'unreadNotificationCount', tags: ['Notifications'], description: 'Unread notification count', response: { 200: { type: 'object', properties: { count: { type: 'number' } } } } } }, handler('unreadNotificationCount'));
  fastify.get('/notifications/stream', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'streamNotifications', tags: ['Notifications'], description: 'Server-sent events stream for authenticated user notifications.', response: { 200: { type: 'string', description: 'text/event-stream' } } } }, handler('streamNotifications'));
  fastify.put('/notifications/mark-read', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyMarkNotificationsRead', tags: ['Notifications'], description: 'Mark notifications read', body: notificationReadBody, response: { 200: genericSuccess } } }, handler('markNotificationsRead'));
  fastify.patch('/notifications/mark-read', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'markNotificationsRead', tags: ['Notifications'], description: 'Mark selected notifications read', body: notificationReadBody, response: { 200: genericSuccess } } }, handler('markNotificationsRead'));
  fastify.put('/notifications/read-all', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyMarkAllNotificationsRead', tags: ['Notifications'], description: 'Mark all notifications read', response: { 200: genericSuccess } } }, handler('markAllNotificationsRead'));
  fastify.patch('/notifications/read-all', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'markAllNotificationsRead', tags: ['Notifications'], description: 'Mark all notifications read', response: { 200: genericSuccess } } }, handler('markAllNotificationsRead'));
  fastify.put('/notifications/:id/read', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyMarkNotificationRead', tags: ['Notifications'], description: 'Mark notification read', params: idParam(), response: { 200: genericSuccess } } }, handler('markNotificationRead'));
  fastify.patch('/notifications/:id/read', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'markNotificationRead', tags: ['Notifications'], description: 'Mark notification read', params: idParam(), response: { 200: genericSuccess } } }, handler('markNotificationRead'));
  fastify.delete('/notifications/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'deleteNotification', tags: ['Notifications'], description: 'Delete a notification', params: idParam(), response: { 200: genericSuccess } } }, handler('deleteNotification'));
  fastify.delete('/notifications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'clearNotifications', tags: ['Notifications'], description: 'Clear all notifications for authenticated user', response: { 200: genericSuccess } } }, handler('clearNotifications'));
  fastify.get('/users/me/notification-preferences', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'getNotificationPreferences', tags: ['Notifications', 'Users'], description: 'Get authenticated user notification preferences', response: { 200: genericSuccess } } }, handler('getNotificationPreferences'));
  fastify.put('/users/me/notification-preferences', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'updateNotificationPreferences', tags: ['Notifications', 'Users'], description: 'Update authenticated user notification preferences', body: legacyBody, response: { 200: genericSuccess } } }, handler('updateNotificationPreferences'));
  fastify.put('/save-data', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyToggleGenericSave', tags: ['Saved Items'], description: 'Legacy generic save endpoint. Use `id` and `q` (`p`, `q`, `a`, or `c`) to save/unsave an item.', body: { ...genericSaveBody, properties: { ...genericSaveBody.properties, q: { type: 'string', enum: ['p', 'q', 'a', 'c', 'post', 'question', 'answer', 'comment'] } } }, response: { 200: genericSuccess, 422: schemas.GenericErrorResponse } } }, handler('toggleGenericSave'));
  fastify.put('/question/:id/save', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacySaveQuestion', tags: ['Saved Items'], description: 'Legacy question save endpoint', params: idParam(), response: { 200: genericSuccess } } }, handler('saveQuestion'));
  fastify.put('/answer/:id/save', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacySaveAnswer', tags: ['Saved Items'], description: 'Legacy answer save endpoint', params: idParam(), response: { 200: genericSuccess } } }, handler('saveAnswer'));
  fastify.put('/comment/:id/save', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacySaveComment', tags: ['Saved Items'], description: 'Legacy comment save endpoint', params: idParam(), response: { 200: genericSuccess } } }, handler('saveComment'));
  fastify.put('/report', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyGenericReport', tags: ['Reports'], description: 'Legacy generic report endpoint. Use `id` and `q` (`p`, `q`, `a`, or `c`) to report an item.', body: { ...genericReportBody, required: ['id', 'q'], properties: { ...genericReportBody.properties, q: { type: 'string', enum: ['p', 'q', 'a', 'c', 'post', 'question', 'answer', 'comment'] }, report_reason_id: { type: 'string' }, additional_notes: { type: 'string' } } }, response: { 200: genericSuccess, 422: schemas.GenericErrorResponse } } }, handler('genericReport'));
  fastify.get('/report-reasons', { schema: { operationId: 'legacyListReportReasons', tags: ['Reports'], description: 'Legacy report reasons endpoint', response: { 200: dataResponse({ type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } }) } } }, handler('reportReasons'));
  fastify.get('/education', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListEducation', tags: ['Education'], description: 'Legacy education resource list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listEducationRoot'));
  fastify.post('/education', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateEducation', tags: ['Education'], description: 'Legacy education create', body: { ...schemas.Education, required: [] }, response: { 201: dataResponse(schemas.Education), 422: schemas.GenericErrorResponse } } }, handler('createEducationRoot'));
  fastify.put('/education/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateEducation', tags: ['Education'], description: 'Legacy education update', params: idParam(), body: { ...schemas.Education, required: [] }, response: { 200: dataResponse(schemas.Education), 404: schemas.GenericErrorResponse } } }, handler('updateEducationRoot'));
  fastify.delete('/education/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDeleteEducation', tags: ['Education'], description: 'Legacy education delete', params: idParam(), response: { 200: schemas.IdSuccessResponse } } }, handler('deleteEducationRoot'));
  fastify.get('/experience', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListExperience', tags: ['Experience'], description: 'Legacy experience resource list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listExperienceRoot'));
  fastify.post('/experience', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateExperience', tags: ['Experience'], description: 'Legacy experience create', body: { ...schemas.Experience, required: [] }, response: { 201: dataResponse(schemas.Experience), 422: schemas.GenericErrorResponse } } }, handler('createExperienceRoot'));
  fastify.put('/experience/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateExperience', tags: ['Experience'], description: 'Legacy experience update', params: idParam(), body: { ...schemas.Experience, required: [] }, response: { 200: dataResponse(schemas.Experience), 404: schemas.GenericErrorResponse } } }, handler('updateExperienceRoot'));
  fastify.delete('/experience/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDeleteExperience', tags: ['Experience'], description: 'Legacy experience delete', params: idParam(), response: { 200: schemas.IdSuccessResponse } } }, handler('deleteExperienceRoot'));
  fastify.get('/certifications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListCertifications', tags: ['Certifications'], description: 'Legacy certification resource list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listCertificationRoot'));
  fastify.post('/certifications', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateCertification', tags: ['Certifications'], description: 'Legacy certification create', body: { ...schemas.Certification, required: [] }, response: { 201: dataResponse(schemas.Certification), 422: schemas.GenericErrorResponse } } }, handler('createCertificationRoot'));
  fastify.put('/certifications/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateCertification', tags: ['Certifications'], description: 'Legacy certification update', params: idParam(), body: { ...schemas.Certification, required: [] }, response: { 200: dataResponse(schemas.Certification), 404: schemas.GenericErrorResponse } } }, handler('updateCertificationRoot'));
  fastify.delete('/certifications/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDeleteCertification', tags: ['Certifications'], description: 'Legacy certification delete', params: idParam(), response: { 200: schemas.IdSuccessResponse } } }, handler('deleteCertificationRoot'));
  fastify.get('/projects', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListProjects', tags: ['Projects'], description: 'Legacy project resource list', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('listProjectRoot'));
  fastify.post('/projects', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateProject', tags: ['Projects'], description: 'Legacy project create', body: { ...schemas.Portfolio, required: [] }, response: { 201: dataResponse(schemas.Portfolio), 422: schemas.GenericErrorResponse } } }, handler('createProjectRoot'));
  fastify.put('/projects/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateProject', tags: ['Projects'], description: 'Legacy project update', params: idParam(), body: { ...schemas.Portfolio, required: [] }, response: { 200: dataResponse(schemas.Portfolio), 404: schemas.GenericErrorResponse } } }, handler('updateProjectRoot'));
  fastify.post('/projects/:id/update', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdateProjectFallback', tags: ['Projects'], description: 'Legacy project update fallback', params: idParam(), body: { ...schemas.Portfolio, required: [] }, response: { 200: dataResponse(schemas.Portfolio), 404: schemas.GenericErrorResponse } } }, handler('updateProjectRoot'));
  fastify.delete('/projects/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDeleteProject', tags: ['Projects'], description: 'Legacy project delete', params: idParam(), response: { 200: schemas.IdSuccessResponse } } }, handler('deleteProjectRoot'));

  fastify.post('/users/:id/profile', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createUserProfile',
      tags: ['Users'],
      // Embed example into the route body so Swagger UI shows the sample submission payload
      body: Object.assign({}, schemas.UserProfileBody, { example: schemas.UserProfileBody.example }),
      response: {
        201: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            }, data: schemas.UserProfileResponse
          }
        },
        409: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            error: {
              type: 'object',
              properties:
              {
                code: {
                  type: 'string'
                },
                message: {
                  type: 'string'
                }
              }
            }
          }
        },
        422: { type: 'object' }
      }
    }
  }, handler('createProfile'));
  fastify.post('/users/:id/profile/avatar', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadUserAvatar',
      tags: ['Users'],
      description: 'Upload a profile avatar by URL, Cloudinary publicId, or multipart file; validation and profile update happen in background. If avatar already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { avatar: null }.',
      parameters: [
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing avatar' }
      ],
      // Support application/json { imageUrl } or { publicId }, and multipart/form-data { file }
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' }
              },
              required: ['file']
            }
          },
          'application/json': { schema: schemas.AvatarUploadBody }
        }
      },
      response: {
        202: schemas.JobAcceptedResponse,
        422: { type: 'object' },
        409: schemas.GenericErrorResponse,
        503: { type: 'object' }
      }
    }
  }, handler('uploadAvatar'));
  fastify.post('/users/:id/profile/banner', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadUserBanner',
      tags: ['Users'],
      description: 'Upload a profile banner by URL, Cloudinary publicId, or multipart file; validation and profile update happen in background. If banner already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { banner: null }.',
      parameters: [
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing banner' }
      ],
      // Support application/json { imageUrl } or { publicId }, and multipart/form-data { file }
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' }
              },
              required: ['file']
            }
          },
          'application/json': { schema: schemas.AvatarUploadBody }
        }
      },
      response: {
        202: schemas.JobAcceptedResponse,
        422: { type: 'object' },
        409: schemas.GenericErrorResponse,
        503: { type: 'object' }
      }
    }
  }, handler('uploadBanner'));

  // Direct signed upload support
  fastify.get('/media/signature', {
    schema: {
      operationId: 'getCloudinarySignature',
      tags: ['Media'],
      description: 'Get Cloudinary upload signature and credentials for direct client upload',
      response: { 200: schemas.CloudinarySignatureResponse }
    }
  }, handler('getCloudinarySignature'));

  fastify.post('/media/register', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'registerMedia',
      tags: ['Media'],
      description: 'Register a direct client upload (Cloudinary public id) so the server can validate, create an asset record and enqueue processing. Recommended flow: upload media first (or perform direct client upload), then call this endpoint with the provider public id. Server-side validation performed: allowed MIME types (image/jpeg,image/png,image/webp), max file size (enforced by the media worker, see MAX_POST_IMAGE_BYTES env), and optional checks per `kind` (e.g., avatar/banner uniqueness). Use `kind=advert_image` for advert images. The endpoint returns a job id — poll `GET /media/jobs/:id` for processing status and detailed per-asset errors (e.g., file_too_large, unsupported_media_type). If you intend to attach media to a post or advert, wait until job status is `completed` and asset record has a `url` before creating the record.',
      body: schemas.MediaRegisterBody,
      response: {
        202: schemas.JobAcceptedResponse,
        409: { type: 'object' },
        422: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object', properties: { assetId: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } } } }
              }
            }
          }
        }
      }
    }
  }, handler('registerMedia'));

  fastify.get('/media/jobs/:id', {
    schema: {
      operationId: 'getMediaJobStatus',
      tags: ['Media'],
      description: 'Get status for a media processing job',
      response: {
        200: schemas.MediaJobStatusResponse,
        404: { type: 'object' },
        503: { type: 'object' }
      }
    }
  }, handler('getJobStatus'));

  // Multipart upload endpoint
  fastify.post('/users/:id/profile/avatar-file', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadUserAvatarFile',
      tags: ['Media', 'Users'],
      description: 'Upload avatar file (multipart) - server accepts file and enqueues background validation and Cloudinary upload. Use kind=banner to upload a banner. If image already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { avatar: null } or { banner: null }.',
      parameters: [
        { name: 'kind', in: 'query', schema: { type: 'string' }, description: 'Optional kind (avatar, banner, post_image, advert_image, document) to control validation and folder' },
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing avatar' }
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
              required: ['file']
            }
          }
        }
      },
      response: {
        202: schemas.JobAcceptedResponse,
        422: { type: 'object' },
        409: schemas.GenericErrorResponse,
        503: { type: 'object' }
      }
    }
  }, handler('uploadAvatarFile'));

  fastify.get('/users/:id/skills', {
    schema: {
      operationId: 'listUserSkills',
      tags: ['Users'],
      description: 'List the skills attached to a user profile.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Skill } },
          example: { success: true, data: [schemas.Skill.example] }
        }
      }
    }
  }, handler('listUserSkills'));

  fastify.post('/users/:id/skills', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addUserSkill',
      tags: ['Users'],
      description: 'Add a skill entry to the user profile.',
      body: {
        type: 'object',
        required: ['skill'],
        properties: { skill: { type: 'string' }, level: { type: 'string' } },
        example: { skill: 'JavaScript', level: 'advanced' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Skill },
          example: { success: true, data: schemas.Skill.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addUserSkill'));

  fastify.delete('/users/:id/skills/:skillId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: {
        operationId:
          'deleteUserSkill',
        tags: ['Users'],
        description: 'Delete a specific skill from the user profile.',
        response: { 200: schemas.IdSuccessResponse }
      }
    }, handler('deleteSkill'));

  fastify.get('/users/:id/portfolios', {
    schema: {
      operationId: 'listUserPortfolios',
      tags: ['Users'],
      description: 'List portfolio links or projects attached to a user profile.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: schemas.Portfolio }
          },
          example: { success: true, data: [schemas.Portfolio.example] }
        }
      }
    }
  }, handler('listUserPortfolios'));
  fastify.post('/users/:id/portfolios', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addUserPortfolio',
      tags: ['Users'],
      description: 'Create a portfolio entry for the user profile.',
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          link: { type: 'string' },
          pictures: { type: 'array', items: { type: 'string' } }
        },
        example: {
          title: 'Personal Website',
          description: 'Portfolio site',
          link: 'https://janedoe.dev',
          pictures: ['https://cdn.example.com/portfolio/homepage.png']
        }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Portfolio },
          example: { success: true, data: schemas.Portfolio.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addUserPortfolio'));
  fastify.delete(
    '/users/:id/portfolios/:portfolioId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
      schema: {
        operationId: 'deleteUserPortfolio',
        tags: ['Users'],
        description: 'Delete a portfolio entry from the user profile.',
        response: { 200: schemas.IdSuccessResponse }
      }
    },
    handler('deletePortfolio')
  );

  fastify.post('/users/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'followUser',
      tags: ['Users'],
      description: 'Follow another user. The authenticated user becomes the follower.',
      body: {
        type: 'object',
        properties: { followerId: { type: 'string' } },
        example: { followerId: 'uuid-or-id' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Follower },
          example: { success: true, data: schemas.Follower.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('followUser'));

  fastify.delete('/users/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'unfollowUser',
      tags: ['Users'],
      description: 'Unfollow a user. The response may indicate when the user was not being followed.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: ['string', 'null'] },
                followerId: { type: ['string', 'null'] },
                followingId: { type: ['string', 'null'] },
                createdAt: { type: ['string', 'null'] },
                message: { type: ['string', 'null'] }
              }
            }
          },
          example: { success: true, data: { id: 'follow-uuid', followerId: 'user-uuid-2', followingId: 'user-uuid', createdAt: '2026-04-20T09:00:00Z', message: 'unfollowed' } }
        }
      }
    }
  }, handler('unfollowUser'));

  fastify.get('/users/:id/followers', {
    schema: {
      operationId: 'listFollowers',
      tags: ['Users'],
      description: 'List followers for a user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Follower } },
          example: { success: true, data: [schemas.Follower.example] }
        }
      }
    }
  }, handler('listFollowers'));

  fastify.get('/users/:id/login-history', {
    schema: {
      operationId: 'listLoginHistory',
      tags: ['Users'],
      description: 'List recent login history entries for a user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.UserLoginHistory } },
          example: { success: true, data: [schemas.UserLoginHistory.example] }
        }
      }
    }
  }, handler('listLoginHistory'));

  // Community categories
  fastify.post('/community-categories', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createCommunityCategory',
      tags: ['Communities'],
      description: 'Create a community category used to organize communities.',
      body: schemas.CommunityCategoryCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityCategoryResponse },
          example: { success: true, data: schemas.CommunityCategoryResponse.example }
        },
        409: schemas.GenericErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createCategory'));

  // Public: list all community categories
  fastify.get('/community-categories', {
    schema: {
      operationId: 'listCommunityCategories',
      tags: ['Communities'],
      description: 'List all community categories with the total number of communities under each category.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.CommunityCategoryResponse } },
          example: { success: true, data: [schemas.CommunityCategoryResponse.example] }
        }
      }
    }
  }, handler('listCategories'));

  fastify.put('/community-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updateCommunityCategory',
      tags: ['Communities'],
      description: 'Update a community category by id.',
      body: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, example: { name: 'Sports', description: 'Groups for sports fans' } },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityCategoryResponse },
          example: { success: true, data: schemas.CommunityCategoryResponse.example }
        },
        404: schemas.GenericErrorResponse,
        409: schemas.GenericErrorResponse
      }
    }
  }, handler('updateCategory'));

  fastify.delete('/community-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deleteCommunityCategory',
      tags: ['Communities'],
      description: 'Delete a community category.',
      response: { 200: schemas.IdSuccessResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deleteCategory'));

  // Communities
  fastify.post('/communities', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createCommunity',
      tags: ['Communities'],
      description: 'Create a community. The authenticated user becomes the owner.',
      body: schemas.CommunityCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityResponse },
          example: { success: true, data: schemas.CommunityResponse.example }
        },
        401: schemas.AuthErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createCommunity'));

  // Public: list communities (supports pagination and filtering)
  fastify.get('/communities', {
    schema: {
      operationId: 'listCommunities',
      tags: ['Communities'],
      description: 'List communities with their category details and aggregate post, post reaction, post like, and post comment counts. Supports query params: page, per_page, q (search), categoryId, limit, offset.',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'number' } },
        { name: 'per_page', in: 'query', schema: { type: 'number' } },
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search term for name or description' },
        { name: 'categoryId', in: 'query', schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'number' } },
        { name: 'offset', in: 'query', schema: { type: 'number' } }
      ],
      response: {
        200: schemas.CommunityPaginatedResponse
      }
    }
  }, handler('listCommunities'));

  fastify.get('/communities/:id', {
    schema: {
      operationId: 'getCommunity',
      tags: ['Communities'],
      description: 'Get a community by id.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityResponse },
          example: { success: true, data: schemas.CommunityResponse.example }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('getCommunity'));

  fastify.put('/communities/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updateCommunity',
      tags: ['Communities'],
      description: 'Update community settings. Only the owner or an admin may perform this action.',
      body: schemas.CommunityUpdateBody,
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityResponse },
          example: { success: true, data: schemas.CommunityResponse.example }
        },
        401: schemas.AuthErrorResponse,
        403: schemas.GenericErrorResponse,
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('updateCommunity'));

  fastify.delete('/communities/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deleteCommunity',
      tags: ['Communities'],
      description: 'Delete a community. Only the owner or an admin may perform this action.',
      response: { 200: schemas.IdSuccessResponse, 401: schemas.AuthErrorResponse, 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deleteCommunity'));

  fastify.post('/communities/:id/join', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'joinCommunity',
      tags: ['Communities'],
      description: 'Join a community as the authenticated user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityMemberResponse },
          example: { success: true, data: schemas.CommunityMemberResponse.example }
        },
        401: schemas.AuthErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('joinCommunity'));

  fastify.post('/toggle-community/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'legacyToggleCommunityJoin', tags: ['Communities'], description: 'Legacy community join toggle alias', params: idParam(), response: { 200: dataResponse(schemas.CommunityMemberResponse), 401: schemas.AuthErrorResponse, 422: schemas.GenericErrorResponse } }
  }, handler('joinCommunity'));

  fastify.delete('/communities/:id/join', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'leaveCommunity',
      tags: ['Communities'],
      description: 'Leave a community as the authenticated user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { removed: { type: 'boolean' } } } },
          example: { success: true, data: { removed: true } }
        },
        401: schemas.AuthErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('leaveCommunity'));

  fastify.get('/communities/:id/members', {
    schema: {
      operationId: 'listCommunityMembers',
      tags: ['Communities'],
      description: 'List members in a community.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.CommunityMemberResponse } },
          example: { success: true, data: [schemas.CommunityMemberResponse.example] }
        }
      }
    }
  }, handler('listMembers'));

  fastify.post('/users/:id/oauth-accounts', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createOauthAccount',
      tags: ['Users'],
      description: 'Link an OAuth account to a user.',
      body: {
        type: 'object',
        required: ['provider', 'providerId'],
        properties: { provider: { type: 'string' }, providerId: { type: 'string' }, accessToken: { type: 'string' } },
        example: { provider: 'google', providerId: 'google-12345', accessToken: 'ya29.a0Af...' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.OAuthAccount },
          example: { success: true, data: schemas.OAuthAccount.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createOauthAccount'));

  // ========== User Certifications ==========
  fastify.get('/users/:id/certifications', {
    schema: {
      operationId: 'listCertifications',
      tags: ['Users'],
      description: 'List certification entries for a user profile.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: schemas.Certification }
          },
          example: { success: true, data: [schemas.Certification.example] }
        }
      }
    }
  }, handler('listCertifications'));

  fastify.post('/users/:id/certifications', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addCertification',
      tags: ['Users'],
      description: 'Add a certification to a user profile.',
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' }, issuer: { type: 'string' }, issueDate: { type: 'string' } },
        example: { name: 'Certified Kubernetes Administrator', issuer: 'CNCF', issueDate: '2021-08-01' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Certification },
          example: { success: true, data: schemas.Certification.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addCertification'));

  fastify.delete('/users/:id/certifications/:certId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deleteCertification',
      tags: ['Users'],
      description: 'Delete a certification from a user profile.',
      response: { 200: schemas.IdSuccessResponse }
    }
  }, handler('deleteCertification'));

  // ========== User Education ==========
  fastify.get('/users/:id/education', {
    schema: {
      operationId: 'listEducation',
      tags: ['Users'],
      description: 'List education entries for a user profile.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Education } },
          example: { success: true, data: [schemas.Education.example] }
        }
      }
    }
  }, handler('listEducation'));

  fastify.post('/users/:id/education', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addEducation',
      tags: ['Users'],
      description: 'Add an education entry to a user profile.',
      body: {
        type: 'object',
        required: ['school'],
        properties: { school: { type: 'string' }, degree: { type: 'string' }, field: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } },
        example: { school: 'University', degree: 'BSc Computer Science', field: 'Computer Science', startDate: '2015-09-01', endDate: '2019-06-01' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Education },
          example: { success: true, data: schemas.Education.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addEducation'));

  fastify.delete('/users/:id/education/:eduId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'deleteEducation', tags: ['Users'], description: 'Delete an education entry from a user profile.', response: { 200: schemas.IdSuccessResponse } }
  }, handler('deleteEducation'));

  // ========== User Experiences ==========
  fastify.get('/users/:id/experiences', {
    schema: {
      operationId: 'listExperiences',
      tags: ['Users'],
      description: 'List work experience entries for a user profile.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Experience } },
          example: { success: true, data: [schemas.Experience.example] }
        }
      }
    }
  }, handler('listExperiences'));

  fastify.post('/users/:id/experiences', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addExperience',
      tags: ['Users'],
      description: 'Add a work experience entry to a user profile.',
      body: {
        type: 'object',
        required: ['company', 'title'],
        properties: { company: { type: 'string' }, title: { type: 'string' }, employmentType: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, isCurrent: { type: 'boolean' }, description: { type: 'string' } },
        example: { company: 'Acme Corp', title: 'Senior Engineer', employmentType: 'full-time', startDate: '2020-01-01', endDate: '2022-12-31', isCurrent: false, description: 'Worked on X' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Experience },
          example: { success: true, data: schemas.Experience.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addExperience'));

  fastify.delete(
    '/users/:id/experiences/:expId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
      schema: {
        operationId: 'deleteExperience',
        tags: ['Users'],
        description: 'Delete a work experience entry from a user profile.',
        response: { 200: schemas.IdSuccessResponse }
      }
    },
    handler('deleteExperience')
  );

  // ========== Posts ==========
  fastify.post('/post', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: { operationId: 'legacyCreatePost', tags: ['Posts'], description: 'Legacy alias for POST /posts', body: schemas.PostCreateBody, response: { 201: dataResponse(schemas.PostResponse), 422: schemas.GenericErrorResponse } }
  }, async (req, reply) => {
    req.body = Object.assign({}, req.body || {}, {
      communityId: (req.body || {}).communityId || (req.body || {}).community_id,
      pageId: (req.body || {}).pageId || (req.body || {}).page_id
    });
    return handler('createPost')(req, reply);
  });
  fastify.get('/post', { schema: { operationId: 'legacyListPosts', tags: ['Posts'], description: 'Legacy alias for GET /posts', querystring: { type: 'object', properties: { ...listQueryBase, communityId: { type: 'string' }, lastCreatedAt: { type: 'string' }, lastId: { type: 'string' } } }, response: { 200: schemas.PostPaginatedResponse } } }, handler('listPosts'));
  fastify.get('/post/:id', { schema: { operationId: 'legacyGetPost', tags: ['Posts'], description: 'Legacy alias for GET /posts/:id', params: idParam(), response: { 200: dataResponse(schemas.PostResponse), 404: schemas.GenericErrorResponse } } }, handler('getPost'));
  fastify.put('/post/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdatePost', tags: ['Posts'], description: 'Legacy alias for PUT /posts/:id', params: idParam(), body: { type: 'object', properties: { userId: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, additionalProperties: true }, response: { 200: dataResponse(schemas.PostResponse), 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse } } }, handler('updatePost'));
  fastify.delete('/post/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDeletePost', tags: ['Posts'], description: 'Legacy alias for DELETE /posts/:id', params: idParam(), body: { type: 'object', properties: { userId: { type: 'string' } } }, response: { 200: schemas.EmptyArraySuccessResponse, 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse } } }, handler('deletePost'));
  fastify.post('/post/:id/comment', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreatePostComment', tags: ['Posts', 'Comments'], description: 'Legacy alias for POST /posts/:id/comments', params: idParam(), body: schemas.CommentCreateBody, response: { 201: dataResponse(schemas.CommentResponse), 422: schemas.GenericErrorResponse } } }, handler('createComment'));
  fastify.get('/post/:id/comment', { schema: { operationId: 'legacyListPostComments', tags: ['Posts', 'Comments'], description: 'Legacy alias for GET /posts/:id/comments', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.CommentPaginatedResponse } } }, handler('listComments'));
  fastify.put('/post/:postId/comment/:id/like', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyToggleCommentLike', tags: ['Comments'], description: 'Legacy comment like alias', params: twoIdParams('postId', 'id'), body: schemas.ReactionBody, response: { 200: dataResponse(schemas.ReactionToggleResponse), 422: schemas.GenericErrorResponse } } }, handler('toggleCommentReaction'));
  fastify.put('/post/:postId/comment/:id/follow', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyFollowComment', tags: ['Comments'], description: 'Legacy comment follow compatibility no-op', params: twoIdParams('postId', 'id'), response: { 200: dataResponse({ type: 'object', properties: { following: { type: 'boolean' } } }) } } }, async (req, reply) => reply.send({ success: true, message: 'Followed successfully.', data: { following: true } }));
  fastify.post('/post/:id/repost', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'legacyRepostPost', tags: ['Posts'], description: 'Legacy alias for POST /posts/:id/shares', params: idParam(), body: schemas.PostShareBody, response: { 201: dataResponse(schemas.PostShareResponse), 422: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse } }
  }, async (req, reply) => {
    req.body = Object.assign({}, req.body || {}, {
      communityId: (req.body || {}).communityId || (req.body || {}).community_id,
      comment: (req.body || {}).comment || (req.body || {}).content
    });
    return handler('sharePost')(req, reply);
  });
  fastify.put('/post/:id/like', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyTogglePostLike', tags: ['Posts'], description: 'Legacy alias for POST /posts/:id/reactions', params: idParam(), body: schemas.ReactionBody, response: { 200: dataResponse(schemas.ReactionToggleResponse), 422: schemas.GenericErrorResponse } } }, handler('togglePostReaction'));
  fastify.put('/post/:id/save', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyTogglePostSave', tags: ['Posts'], description: 'Legacy alias for POST /posts/:id/save', params: idParam(), body: schemas.PostSaveBody, response: { 200: dataResponse({ type: 'object', properties: { postId: { type: 'string' }, userId: { type: 'string' }, saved: { type: 'boolean' } } }) } } }, handler('toggleSave'));
  fastify.post('/post/:id/report', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyReportPost', tags: ['Posts'], description: 'Legacy alias for POST /posts/:id/report', params: idParam(), body: schemas.PostReportBody, response: { 201: dataResponse(schemas.PostReportResponse), 422: schemas.GenericErrorResponse } } }, handler('reportPost'));

  fastify.post('/posts', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createPost',
      tags: ['Posts'],
      description: 'Create a new post. Provide `title` and `content` in body. Optional `communityId`. Upload media first (use /media/register or media endpoints), wait until media job(s) are processed, then include their `mediaAssetIds` here — the server will validate that each asset is processed and has a URL before creating the post.',
      body: schemas.PostCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PostResponse }
        },
        422: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object', properties: { assetId: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } } } }
              }
            }
          }
        }
      }
    }
  }, handler('createPost'));

  fastify.get('/posts', {
    schema: {
      operationId: 'listPosts',
      tags: ['Posts'],
      description: 'List posts (feed). Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }, { name: 'communityId', in: 'query', schema: { type: 'string' } }, { name: 'lastCreatedAt', in: 'query', schema: { type: 'string', description: 'Use for keyset pagination: ISO timestamp of last item from previous page' } }, { name: 'lastId', in: 'query', schema: { type: 'string', description: 'Use with `lastCreatedAt` for keyset pagination: last item id from previous page' } }],
      response: { 200: schemas.PostPaginatedResponse }
    }
  }, handler('listPosts'));

  fastify.get('/posts/:id', {
    schema: {
      operationId: 'getPost',
      tags: ['Posts'],
      description: 'Get a single post by id',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostResponse } }, 404: { type: 'object' } }
    }
  }, handler('getPost'));

  fastify.post('/posts/:id/shares', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'sharePostToCommunity',
      tags: ['Posts', 'Sharing'],
      description: 'Share an existing post into a community. The created post keeps parent_post_id/originalPostId as the original post reference.',
      params: idParam(),
      body: schemas.PostShareBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostShareResponse } }, 422: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('sharePost'));

  fastify.post('/posts/:id/share-events', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'recordPostShareEvent',
      tags: ['Posts', 'Sharing'],
      description: 'Record/acknowledge a share event such as copy_link. This currently returns an acknowledgement for frontend analytics wiring.',
      params: idParam(),
      body: schemas.PostShareEventBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostShareEventResponse } }, 422: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('recordShareEvent'));

  fastify.put('/posts/:id', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'updatePost',
      tags: ['Posts'],
      description: 'Update a post. Provide `userId` and `content` in body.',
      body: { type: 'object', properties: { userId: { type: 'string' }, content: { type: 'string' } }, example: { userId: 'user-uuid', content: 'Updated post content' } },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PostResponse },
          example: { success: true, data: schemas.PostResponse.example }
        },
        403: schemas.GenericErrorResponse,
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('updatePost'));

  fastify.delete('/posts/:id', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'deletePost',
      tags: ['Posts'],
      description: 'Delete a post. Provide `userId` in body to verify ownership.',
      body: { type: 'object', properties: { userId: { type: 'string' } } },
      response: { 200: schemas.EmptyArraySuccessResponse, 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deletePost'));

  // Post media endpoints
  fastify.post('/posts/:id/media', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.mediaFile, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'attachPostMedia',
      tags: ['Posts', 'Media'],
      description: 'Attach media to a post by URL (server enqueues background validation/upload).',
      body: schemas.PostMediaAttachBody,
      response: { 202: schemas.JobAcceptedResponse, 422: { type: 'object' }, 503: { type: 'object' } }
    }
  }, handler('attachMediaByUrl'));

  // ========== Comments ==========
  fastify.post('/posts/:id/comments', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.comments, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createComment',
      tags: ['Posts', 'Comments'],
      description: 'Create a comment on a post',
      body: schemas.CommentCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommentResponse },
          example: { success: true, data: schemas.CommentResponse.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createComment'));

  fastify.get('/posts/:id/comments', {
    schema: {
      operationId: 'listComments',
      tags: ['Posts', 'Comments'],
      description: 'List comments for a post. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.CommentPaginatedResponse }
    }
  }, handler('listComments'));

  // ========== Reactions ==========
  fastify.post('/posts/:id/reactions', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.reactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'togglePostReaction',
      tags: ['Posts', 'Reactions'],
      description: 'Toggle reaction on a post (one reaction per user). Omitting `type` defaults to `like`.',
      body: schemas.ReactionBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.ReactionToggleResponse } }, 422: { type: 'object' } }
    }
  }, handler('togglePostReaction'));

  // Save and report endpoints for posts
  fastify.post('/posts/:id/save', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'toggleSave',
      tags: ['Posts', 'Interactions'],
      description: 'Toggle save for a post (save/unsave).',
      body: schemas.PostSaveBody,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                postId: { type: 'string' },
                userId: { type: 'string' },
                saved: { type: 'boolean' }
              }
            }
          },
          example: { success: true, data: { postId: 'post-uuid', userId: 'user-uuid', saved: true } }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('toggleSave'));

  fastify.post('/posts/:id/report', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'reportPost',
      tags: ['Posts', 'Moderation'],
      description: 'Report a post for moderation.',
      body: schemas.PostReportBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostReportResponse } }, 422: { type: 'object' } }
    }
  }, handler('reportPost'));

  fastify.post('/comments/:id/reactions', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.reactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'toggleCommentReaction',
      tags: ['Comments', 'Reactions'],
      description: 'Toggle reaction on a comment (one reaction per user). Omitting `type` defaults to `like`.',
      body: schemas.ReactionBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.ReactionToggleResponse } }, 422: { type: 'object' } }
    }
  }, handler('toggleCommentReaction'));

  fastify.post('/comments/:id/report', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'reportComment',
      tags: ['Comments', 'Moderation'],
      description: 'Report a comment for moderation. Authenticated user is used; body userId is optional/ignored.',
      params: idParam(),
      body: schemas.PostReportBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.CommentReportResponse } }, 422: { type: 'object' } }
    }
  }, handler('reportComment'));

  fastify.get('/posts/:id/media', {
    schema: {
      operationId: 'listPostMedia',
      tags: ['Posts', 'Media'],
      description: 'List media attached to a post',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.PostMediaResponse } } } }
    }
  }, handler('listPostMedia'));

  fastify.delete('/posts/media/:id', {
    schema: {
      operationId: 'deletePostMedia',
      tags: ['Posts', 'Media'],
      description: 'Delete a post media item by id',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } } }
    }
  }, handler('deletePostMedia'));

  // ========== Questions & Answers ==========
  fastify.post('/question', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'legacyCreateQuestion', tags: ['Questions'], description: 'Legacy alias for POST /questions', body: schemas.QuestionCreateBody, response: { 201: dataResponse(schemas.QuestionResponse), 422: schemas.GenericErrorResponse } }
  }, async (req, reply) => {
    req.body = Object.assign({}, req.body || {}, {
      communityId: (req.body || {}).communityId || (req.body || {}).community_id,
      body: (req.body || {}).body || (req.body || {}).guide
    });
    return handler('createQuestion')(req, reply);
  });
  fastify.get('/question', { schema: { operationId: 'legacyListQuestions', tags: ['Questions'], description: 'Legacy alias for GET /questions', querystring: { type: 'object', properties: { ...listQueryBase, communityId: { type: 'string' } } }, response: { 200: schemas.QuestionPaginatedResponse } } }, handler('listQuestions'));
  fastify.get('/question/:id', { schema: { operationId: 'legacyGetQuestion', tags: ['Questions'], description: 'Legacy alias for GET /questions/:id', params: idParam(), querystring: { type: 'object', properties: { includeAnswers: { type: 'boolean' } } }, response: { 200: dataResponse(schemas.QuestionResponse), 404: schemas.GenericErrorResponse } } }, handler('getQuestion'));
  fastify.post('/question/:questionId/answer', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreateAnswer', tags: ['Questions', 'Answers'], description: 'Legacy alias for POST /questions/:questionId/answers', params: idParam('questionId'), body: schemas.AnswerCreateBody, response: { 201: dataResponse(schemas.AnswerResponse), 422: schemas.GenericErrorResponse } } }, handler('createAnswer'));
  fastify.get('/question/:questionId/answer', { schema: { operationId: 'legacyListAnswers', tags: ['Questions', 'Answers'], description: 'Legacy alias for GET /questions/:questionId/answers', params: idParam('questionId'), querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.AnswerPaginatedResponse } } }, handler('listAnswers'));
  fastify.post('/question/:id/report', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyReportQuestion', tags: ['Questions'], description: 'Legacy report question route', params: idParam(), body: genericReportBody, response: { 201: genericSuccess, 422: schemas.GenericErrorResponse } } }, handler('reportQuestion'));
  fastify.post('/answer/:id/report', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyReportAnswer', tags: ['Answers'], description: 'Legacy report answer route', params: idParam(), body: genericReportBody, response: { 201: genericSuccess, 422: schemas.GenericErrorResponse } } }, handler('reportAnswer'));
  fastify.post('/comment/:id/report', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyReportComment', tags: ['Comments'], description: 'Legacy alias for POST /comments/:id/report', params: idParam(), body: schemas.PostReportBody, response: { 201: dataResponse(schemas.CommentReportResponse), 422: schemas.GenericErrorResponse } } }, handler('reportComment'));
  fastify.get('/contests', { schema: { operationId: 'legacyListContests', tags: ['Contests'], description: 'Legacy contests placeholder', querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('emptyPaginated'));
  fastify.get('/contest/:id', { schema: { operationId: 'legacyGetContest', tags: ['Contests'], description: 'Legacy contest placeholder', params: idParam(), response: { 200: dataResponse(schemas.QuestionResponse), 404: schemas.GenericErrorResponse } } }, handler('getQuestion'));

  fastify.post('/questions', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createQuestion',
      tags: ['Questions'],
      description: 'Create a new question. Authenticated user becomes the author. Optionally attach the question to a community. Returns the created question.',
      body: schemas.QuestionCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.QuestionResponse },
          example: { success: true, data: schemas.QuestionResponse.example }
        },
        401: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('createQuestion'));

  fastify.get('/questions', {
    schema: {
      operationId: 'listQuestions',
      tags: ['Questions'],
      description: 'List questions. Returns a paginator payload at the root and includes community details when a question belongs to a community.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'perPage', in: 'query', schema: { type: 'number' } }, { name: 'communityId', in: 'query', schema: { type: 'string' } }],
      response: { 200: schemas.QuestionPaginatedResponse }
    }
  }, handler('listQuestions'));

  fastify.get('/questions/:id', {
    schema: {
      operationId: 'getQuestion',
      tags: ['Questions'],
      description: 'Get a single question by id with asker details, community details when available, answer aggregates, and answers by default. Set `includeAnswers=false` to omit answers.',
      parameters: [{ name: 'includeAnswers', in: 'query', schema: { type: 'boolean' } }],
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.QuestionResponse },
          example: { success: true, data: schemas.QuestionResponse.example }
        },
        404: { type: 'object' }
      }
    }
  }, handler('getQuestion'));

  fastify.post('/questions/:questionId/answers', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.comments, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createAnswer',
      tags: ['Questions', 'Answers'],
      description: 'Create an answer for a question. Authenticated user becomes the author.',
      body: schemas.AnswerCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.AnswerResponse },
          example: { success: true, data: schemas.AnswerResponse.example }
        },
        401: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('createAnswer'));

  fastify.get('/questions/:questionId/answers', {
    schema: {
      operationId: 'listAnswers',
      tags: ['Questions', 'Answers'],
      description: 'List answers for a question. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.AnswerPaginatedResponse }
    }
  }, handler('listAnswers'));

  // ========== Pages ==========
  fastify.post('/page', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyCreatePage', tags: ['Pages'], description: 'Legacy alias for POST /pages', body: schemas.PageCreateBody, response: { 201: dataResponse(schemas.PageResponse), 422: schemas.GenericErrorResponse } } }, handler('createPage'));
  fastify.get('/page/user', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListMyPages', tags: ['Pages'], description: 'Legacy alias for GET /me/pages', querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.PagePaginatedResponse } } }, handler('listMyPages'));
  fastify.get('/page/prefill', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyGetPagePrefill', tags: ['Pages'], description: 'Legacy alias for GET /pages/prefill. Returns form defaults for a business or student page.', querystring: { type: 'object', properties: { type: { type: 'string', enum: ['business', 'student'] }, pageType: { type: 'string', enum: ['business', 'student'] } } }, response: { 200: dataResponse(schemas.PagePrefillResponse), 401: schemas.AuthErrorResponse, 422: schemas.GenericErrorResponse } } }, handler('getPagePrefill'));
  fastify.get('/page/:id', { schema: { operationId: 'legacyGetPage', tags: ['Pages'], description: 'Legacy alias for GET /pages/:id', params: idParam(), response: { 200: dataResponse(schemas.PageResponse), 404: schemas.GenericErrorResponse } } }, handler('getPage'));
  fastify.put('/page/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdatePage', tags: ['Pages'], description: 'Legacy alias for PUT /pages/:id', params: idParam(), body: { ...schemas.PageCreateBody, required: [] }, response: { 200: dataResponse(schemas.PageResponse), 404: schemas.GenericErrorResponse } } }, handler('updatePage'));
  fastify.post('/page/:id/update', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyUpdatePageFallback', tags: ['Pages'], description: 'Legacy update fallback alias for PUT /pages/:id', params: idParam(), body: { ...schemas.PageCreateBody, required: [] }, response: { 200: dataResponse(schemas.PageResponse), 404: schemas.GenericErrorResponse } } }, handler('updatePage'));
  fastify.delete('/page/:id', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyDeletePage', tags: ['Pages'], description: 'Legacy alias for DELETE /pages/:id', params: idParam(), response: { 200: schemas.IdSuccessResponse, 404: schemas.GenericErrorResponse } } }, handler('deletePage'));
  fastify.put('/page/:id/follow', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyFollowPage', tags: ['Pages'], description: 'Legacy page follow alias', params: idParam(), response: { 200: dataResponse(schemas.PageFollower), 404: schemas.GenericErrorResponse } } }, handler('followPage'));
  fastify.get('/page/:id/post', { schema: { operationId: 'legacyListPagePosts', tags: ['Pages', 'Posts'], description: 'Legacy page posts route', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: schemas.PostPaginatedResponse } } }, handler('listPostsByPage'));
  fastify.post('/page/:id/post', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'legacyCreatePagePost', tags: ['Pages', 'Posts'], description: 'Legacy create page post route', params: idParam(), body: schemas.PostCreateBody, response: { 201: dataResponse(schemas.PostResponse), 422: schemas.GenericErrorResponse } }
  }, async (req, reply) => {
    req.body = Object.assign({}, req.body || {}, {
      pageId: req.params.id,
      communityId: (req.body || {}).communityId || (req.body || {}).community_id
    });
    return handler('createPost')(req, reply);
  });
  fastify.get('/page/:id/jobs', { schema: { operationId: 'legacyListPageJobs', tags: ['Pages', 'Jobs'], description: 'Legacy page jobs placeholder', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('emptyPaginated'));
  fastify.get('/page/:id/photos', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListPagePhotos', tags: ['Pages'], description: 'Legacy page photos placeholder', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('emptyPaginated'));
  fastify.get('/page/:id/uploads', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListPageUploads', tags: ['Pages'], description: 'Legacy page uploads placeholder', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('emptyPaginated'));
  fastify.get('/page/:id/recommended-jobs', { preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: { operationId: 'legacyListPageRecommendedJobs', tags: ['Pages', 'Jobs'], description: 'Legacy recommended jobs placeholder', params: idParam(), querystring: { type: 'object', properties: listQueryBase }, response: { 200: genericPaginatedResponse } } }, handler('emptyPaginated'));

  fastify.post('/pages', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createPage',
      tags: ['Pages'],
      description: 'Create a new page. Authenticated user becomes the owner.',
      body: schemas.PageCreateBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageResponse } }, 422: { type: 'object' } }
    }
  }, handler('createPage'));

  fastify.get('/pages', {
    schema: {
      operationId: 'listPages',
      tags: ['Pages'],
      description: 'List pages. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PagePaginatedResponse }
    }
  }, handler('listPages'));

  fastify.get('/me/pages', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'listMyPages',
      tags: ['Pages'],
      description: 'List pages owned by the authenticated user. Each page includes ownerId.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PagePaginatedResponse, 401: schemas.AuthErrorResponse }
    }
  }, handler('listMyPages'));

  fastify.get('/pages/prefill', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'getPagePrefill',
      tags: ['Pages'],
      description: 'Return prefilled values for creating a business or student page.',
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['business', 'student'] },
          pageType: { type: 'string', enum: ['business', 'student'] }
        }
      },
      response: {
        200: dataResponse(schemas.PagePrefillResponse),
        401: schemas.AuthErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('getPagePrefill'));

  fastify.get('/pages/:id', {
    schema: {
      operationId: 'getPage',
      tags: ['Pages'],
      description: 'Get a page by id',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageResponse } }, 404: { type: 'object' } }
    }
  }, handler('getPage'));

  fastify.get('/page-categories', {
    schema: {
      operationId: 'listPageCategories',
      tags: ['Pages', 'Categories'],
      description: 'List all page categories with the total number of pages under each category.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'perPage', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PageCategoryPaginatedResponse }
    }
  }, handler('listPageCategories'));

  // pages by category id
  fastify.get('/page-categories/:id/pages', {
    schema: {
      operationId: 'listPagesByCategoryId',
      tags: ['Pages', 'Categories'],
      description: 'List pages under a category id. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PagePaginatedResponse }
    }
  }, handler('listPagesByCategoryId'));

  // pages by category name
  fastify.get('/page-categories/name/:name/pages', {
    schema: {
      operationId: 'listPagesByCategoryName',
      tags: ['Pages', 'Categories'],
      description: 'List pages under a category name. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PagePaginatedResponse, 404: { type: 'object' } }
    }
  }, handler('listPagesByCategoryName'));

  // get category details (include total pages)
  fastify.get('/page-categories/:id', {
    schema: {
      operationId: 'getPageCategory',
      tags: ['Pages', 'Categories'],
      description: 'Get page category details (includes total pages count)',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PageCategoryResponse },
          example: { success: true, data: schemas.PageCategoryResponse.example }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, async (req, reply) => {
    try {
      return handler('getPageCategory')(req, reply);
    } catch (e) {
      return sendError(reply, 500, 'internal_error', 'Internal server error');
    }
  });

  // Admin-only: create a page category
  fastify.post('/page-categories', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createPageCategory',
      tags: ['Categories'],
      description: 'Create a new page category (admin only).',
      // Embed example so Swagger UI shows a ready-to-use sample payload for admins
      body: Object.assign({}, schemas.PageCategoryCreateBody, { example: schemas.PageCategoryCreateBody.example }),
      response: {
        201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageCategoryResponse } },
        401: { type: 'object' },
        403: { type: 'object' },
        409: schemas.GenericErrorResponse,
        422: {
          type: 'object',
          examples: [
            { summary: 'Invalid slug format', value: { success: false, error: { code: 'invalid_slug_format', message: 'Slug must match ^[a-z0-9-]+$' } } },
            { summary: 'Name too short', value: { success: false, error: { code: 'name_too_short', message: 'Name must be at least the minimum length' } } },
            { summary: 'Invalid validation rules', value: { success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules must be an object with valid fields' } } }
          ]
        }
      }
    }
  }, handler('createPageCategory'));

  fastify.put('/page-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updatePageCategory',
      tags: ['Categories'],
      description: 'Update an existing page category (admin only).',
      body: Object.assign({}, schemas.PageCategoryCreateBody, { example: schemas.PageCategoryCreateBody.example }),
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageCategoryResponse } },
        401: { type: 'object' },
        403: { type: 'object' },
        404: { type: 'object' },
        409: schemas.GenericErrorResponse,
        422: {
          type: 'object',
          examples: [
            { summary: 'Invalid slug format', value: { success: false, error: { code: 'invalid_slug_format', message: 'Slug must match ^[a-z0-9-]+$' } } },
            { summary: 'Name too short', value: { success: false, error: { code: 'name_too_short', message: 'Name must be at least the minimum length' } } },
            { summary: 'Invalid validation rules', value: { success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules must be an object with valid fields' } } }
          ]
        }
      }
    }
  }, handler('updatePageCategory'));

  fastify.delete('/page-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deletePageCategory',
      tags: ['Categories'],
      description: 'Delete a page category (admin only). Pages that reference this category will be unassigned (category set to null) before deletion to avoid FK errors.',
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } },
        401: { type: 'object' },
        403: { type: 'object' },
        404: { type: 'object' }
      }
    }
  }, handler('deletePageCategory'));

  fastify.put('/pages/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updatePage',
      tags: ['Pages'],
      description: 'Update a page. Only the page owner may update.',
      body: { ...schemas.PageCreateBody, required: [], example: { type: 'business', name: 'Ben Confectioneries', slug: 'ben-confectioneries', description: '<p>Updated business description</p>', metadata: { slogan: 'Cooking Up Love', contactEmail: 'business@email.com', website: 'https://example.com', staffSize: '1-10', businessCategory: 'Information Technology' } } },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PageResponse },
          example: { success: true, data: schemas.PageResponse.example }
        },
        403: schemas.GenericErrorResponse,
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('updatePage'));

  // Page avatar (multipart) upload
  fastify.post('/pages/:id/avatar-file', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadPageAvatarFile',
      tags: ['Media', 'Pages'],
      description: 'Upload a page avatar file (multipart). Enqueues background job and returns jobId.',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
              required: ['file']
            }
          }
        }
      },
      response: {
        202:
        {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            data: {
              type: 'object',
              properties: {
                jobId: {
                  type: 'string'
                }
              }
            }
          },
          examples: [
            {
              summary: 'Job queued',
              value: {
                success: true,
                data: {
                  jobId: 'job_abc123'
                }
              }
            }
          ]
        },
        422: {
          type: 'object'
        },
        503: {
          type: 'object'
        }
      }
    }
  }, handler('uploadPageAvatarFile'));

  // Page cover/banner (multipart) upload
  fastify.post('/pages/:id/cover-file', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadPageCoverFile',
      tags: ['Media', 'Pages'],
      description: 'Upload a page cover/banner file (multipart). Enqueues background job and returns jobId.',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
              required: ['file']
            }
          }
        }
      },
      response: { 202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } }, examples: [{ summary: 'Job queued', value: { success: true, data: { jobId: 'job_def456' } } }] }, 422: { type: 'object' }, 503: { type: 'object' } }
    }
  }, handler('uploadPageCoverFile'));

  fastify.delete('/pages/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deletePage',
      tags: ['Pages'],
      description: 'Delete a page. Only the page owner may delete.',
      response: { 200: schemas.IdSuccessResponse, 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deletePage'));

  fastify.post('/pages/:id/approve', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'approvePage',
      tags: ['Pages', 'Moderation'],
      description: 'Approve a page (admin only).',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageResponse } }, 403: { type: 'object' }, 404: { type: 'object' } }
    }
  }, handler('approvePage'));

  fastify.post('/pages/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'followPage',
      tags: ['Pages'],
      description: 'Follow a page',
      body: {
        type: 'object',
        description: 'Empty body accepted; request requires Authorization header. Server ignores body and uses the authenticated user from the Authorization token.',
        properties: {},
        example: { "note": "No body required. Include Authorization: Bearer <token>" }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', properties: { following: { type: 'boolean' } } }
          },
          example: { success: true, message: 'Followed successfully.', data: { following: true } }
        },
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', properties: { following: { type: 'boolean' } } }
          },
          example: { success: true, message: 'Followed successfully.', data: { following: true } }
        },
        401: schemas.AuthErrorResponse
      }
    }
  }, handler('followPage'));

  fastify.delete('/pages/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'unfollowPage',
      tags: ['Pages'],
      description: 'Unfollow a page',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', properties: { following: { type: 'boolean' } } }
          },
          example: { success: true, message: 'Unfollowed successfully.', data: { following: false } }
        },
        401: schemas.AuthErrorResponse
      }
    }
  }, handler('unfollowPage'));

  fastify.get('/pages/:id/followers', {
    schema: {
      operationId: 'listPageFollowers',
      tags: ['Pages'],
      description: 'List followers for a page. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PageFollowerPaginatedResponse }
    }
  }, handler('listPageFollowers'));

  routesLogger.info('Routes registered');
}
