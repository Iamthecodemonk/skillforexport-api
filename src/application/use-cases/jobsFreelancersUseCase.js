const JOB_STATUSES = ['draft', 'pending_review', 'live', 'approved', 'active', 'closed', 'archived', 'deleted', 'suspended'];
const APPLICATION_STATUSES = ['submitted', 'reviewing', 'shortlisted', 'interview', 'rejected', 'accepted', 'withdrawn'];
const FREELANCER_STATUSES = ['draft', 'pending_review', 'available', 'certified', 'suspended'];
const FREELANCER_AVAILABILITY = ['available_now', 'open', 'busy', 'unavailable'];
const FREELANCE_JOB_STATUSES = ['pending_review', 'live', 'approved', 'active', 'closed', 'archived', 'deleted', 'suspended'];
const PUBLIC_JOB_STATUSES = ['live', 'approved', 'active'];

export default class JobsFreelancersUseCase {
  constructor({ repository, notificationRepository = null }) {
    this.repository = repository;
    this.notificationRepository = notificationRepository;
  }

  assertOwnerOrAdmin(recordUserId, actor) {
    if (!actor || (!actor.id && !actor.userId)) throw new Error('unauthorized');
    const actorId = actor.id || actor.userId;
    if (recordUserId !== actorId && actor.role !== 'admin') throw new Error('forbidden');
  }

  assertAdmin(actor) {
    if (!actor || (!actor.id && !actor.userId)) throw new Error('unauthorized');
    if (actor.role !== 'admin') throw new Error('forbidden');
  }

  async notify(payload) {
    if (!this.notificationRepository) return null;
    try {
      return await this.notificationRepository.create(payload);
    } catch (e) {
      return null;
    }
  }

  async listJobs(params) {
    return this.repository.listJobs(params);
  }

  async countJobs(params) {
    return this.repository.countJobs(params);
  }

  async listAllJobs(actor, params = {}) {
    this.assertAdmin(actor);
    const status = !params.status || params.status === 'all' || params.status === 'any'
      ? null
      : (params.status === 'pending' ? 'pending_review' : params.status);
    return this.repository.listJobs({ ...params, status, statuses: params.statuses || null });
  }

  async countAllJobs(actor, params = {}) {
    this.assertAdmin(actor);
    const status = !params.status || params.status === 'all' || params.status === 'any'
      ? null
      : (params.status === 'pending' ? 'pending_review' : params.status);
    return this.repository.countJobs({ ...params, status, statuses: params.statuses || null });
  }

  async getJob(idOrSlug, userId = null) {
    const job = await this.repository.findJob(idOrSlug, userId);
    if (!job) throw new Error('job_not_found');
    return job;
  }

  async createJob(actor, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    if (!body.title || !(body.companyName || body.company) || !body.description) throw new Error('validation_error');
    return this.repository.createJob({ ...body, createdByUserId: actor.id, status: body.status || 'pending_review' });
  }

  async updateJob(actor, id, body = {}) {
    const existing = await this.getJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.createdByUserId, actor);
    return this.repository.updateJob(existing.id, body);
  }

  async updateJobStatus(actor, id, status) {
    if (!JOB_STATUSES.includes(status)) throw new Error('validation_error');
    const job = await this.updateJob(actor, id, { status });
    if (this.notificationRepository && ['approved', 'active', 'live', 'suspended', 'deleted', 'closed', 'archived'].includes(status)) {
      await this.notify({
        userId: job.createdByUserId,
        actorUserId: actor && (actor.id || actor.userId),
        type: 'job_status',
        title: status === 'suspended' ? 'Job suspended' : status === 'deleted' ? 'Job deleted' : 'Job status updated',
        body: `Your job "${job.title}" is now ${status}.`,
        target: { type: 'job', id: job.id, title: job.title, url: `/jobs/${job.id}` },
        metadata: { status }
      });
    }
    return job;
  }

  async updateJobStatusAsAdmin(actor, id, status) {
    this.assertAdmin(actor);
    return this.updateJobStatus(actor, id, status);
  }

  async deleteJob(actor, id) {
    const existing = await this.getJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.createdByUserId, actor);
    await this.repository.deleteJob(existing.id);
    return { id: existing.id };
  }

  async deleteJobAsAdmin(actor, id) {
    this.assertAdmin(actor);
    return this.deleteJob(actor, id);
  }

  async applyToJob(actor, id, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    const job = await this.getJob(id, actor.id);
    if (!PUBLIC_JOB_STATUSES.includes(job.status)) throw new Error('job_not_found');
    const application = await this.repository.createJobApplication({ jobId: job.id, userId: actor.id, coverLetter: body.coverLetter || null, resumeMediaId: body.resumeMediaId || null, answers: body.answers || [] });
    if (this.notificationRepository) {
      await this.notify({
        userId: job.createdByUserId,
        actorUserId: actor.id,
        type: 'job_application',
        title: 'New job application',
        body: `Someone applied to "${job.title}".`,
        target: { type: 'job', id: job.id, title: job.title, url: `/jobs/${job.id}` },
        metadata: { applicationId: application.id }
      });
    }
    return application;
  }

  async shareJob(actor, id, body = {}) {
    const job = await this.getJob(id, actor && actor.id);
    if (!PUBLIC_JOB_STATUSES.includes(job.status) && (!actor || (actor.role !== 'admin' && actor.id !== job.createdByUserId))) {
      throw new Error('job_not_found');
    }
    return {
      jobId: job.id,
      userId: actor && actor.id ? actor.id : null,
      type: body.type || 'share',
      url: body.url || `/jobs/${job.slug || job.id}`,
      title: job.title,
      recorded: true,
      createdAt: new Date().toISOString()
    };
  }

  async recordJobShareEvent(actor, id, body = {}) {
    const job = await this.getJob(id, actor && actor.id);
    if (!PUBLIC_JOB_STATUSES.includes(job.status) && (!actor || (actor.role !== 'admin' && actor.id !== job.createdByUserId))) {
      throw new Error('job_not_found');
    }
    return {
      jobId: job.id,
      userId: actor && actor.id ? actor.id : null,
      type: body.type || 'copy_link',
      recorded: true,
      createdAt: new Date().toISOString()
    };
  }

  async listMyPostedJobs(actor, params) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.listJobs({ ...params, userId: actor.id, status: params.status || null, createdByUserId: actor.id });
  }

  async countMyPostedJobs(actor, params) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.countJobs({ ...params, status: params.status || null, createdByUserId: actor.id });
  }

  async listMyJobApplications(actor, params) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.listMyJobApplications(actor.id, params);
  }

  async countMyJobApplications(actor) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.countMyJobApplications(actor.id);
  }

  async listJobApplications(actor, id, params) {
    const job = await this.getJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(job.createdByUserId, actor);
    return this.repository.listJobApplications(job.id, params);
  }

  async countJobApplications(actor, id) {
    const job = await this.getJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(job.createdByUserId, actor);
    return this.repository.countJobApplications(job.id);
  }

  async updateJobApplication(actor, jobId, applicationId, status) {
    if (!APPLICATION_STATUSES.includes(status)) throw new Error('validation_error');
    const job = await this.getJob(jobId, actor && actor.id);
    this.assertOwnerOrAdmin(job.createdByUserId, actor);
    return this.repository.updateJobApplication(job.id, applicationId, status);
  }

  async withdrawJobApplication(actor, jobId, applicationId) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    const application = await this.repository.findJobApplication(jobId, applicationId);
    if (!application) throw new Error('application_not_found');
    if (application.userId !== actor.id) throw new Error('forbidden');
    return this.repository.updateJobApplication(jobId, applicationId, 'withdrawn');
  }

  async getAlertPreferences(actor) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.getAlertPreferences(actor.id) || this.repository.upsertAlertPreferences(actor.id, {});
  }

  async updateAlertPreferences(actor, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    const tags = body.jobSearchTags || [];
    if (!Array.isArray(tags) || tags.length > 10) throw new Error('validation_error');
    const seen = new Set();
    const unique = [];
    for (const tag of tags) {
      const clean = String(tag || '').trim();
      const key = clean.toLowerCase();
      if (clean && !seen.has(key)) {
        seen.add(key);
        unique.push(clean);
      }
    }
    const scholarshipTypes = Array.isArray(body.scholarshipTypes)
      ? body.scholarshipTypes
      : Array.isArray(body.scholarship_types)
        ? body.scholarship_types
        : (body.scholarshipType || body.scholarship_type ? [body.scholarshipType || body.scholarship_type] : []);
    const employmentTypes = Array.isArray(body.employmentTypes)
      ? body.employmentTypes
      : Array.isArray(body.employment_types)
        ? body.employment_types
        : (body.employmentType || body.employment_type ? [body.employmentType || body.employment_type] : []);
    const experienceLevels = Array.isArray(body.experienceLevels)
      ? body.experienceLevels
      : Array.isArray(body.experience_levels)
        ? body.experience_levels
        : (body.experienceLevel || body.experience_level ? [body.experienceLevel || body.experience_level] : []);
    const jobTypes = Array.isArray(body.jobTypes)
      ? body.jobTypes
      : Array.isArray(body.job_types)
        ? body.job_types
        : (body.jobType || body.job_type ? [body.jobType || body.job_type] : []);
    if (body.sponsorshipAlert && !scholarshipTypes.length) throw new Error('validation_error');
    return this.repository.upsertAlertPreferences(actor.id, {
      ...body,
      jobSearchTags: unique,
      scholarshipTypes,
      employmentTypes,
      experienceLevels,
      jobTypes
    });
  }

  async listFreelancers(params) {
    return this.repository.listFreelancers(params);
  }

  async countFreelancers(params) {
    return this.repository.countFreelancers(params);
  }

  async getFreelancer(idOrUserId) {
    const profile = await this.repository.findFreelancer(idOrUserId);
    if (!profile) throw new Error('freelancer_not_found');
    return profile;
  }

  async getMyFreelancerProfile(actor) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.findFreelancer(actor.id);
  }

  async createFreelancer(actor, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    if (!body.agreedToTerms || !body.name || !body.title || !body.bio) throw new Error('validation_error');
    if (body.status && !FREELANCER_STATUSES.includes(body.status)) throw new Error('validation_error');
    if (body.availability && !FREELANCER_AVAILABILITY.includes(body.availability)) throw new Error('validation_error');
    return this.repository.createFreelancer({ ...body, userId: actor.id, status: body.status || 'available' });
  }

  async updateMyFreelancerProfile(actor, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.updateFreelancer(actor.id, body);
  }

  async updateFreelancerStatus(actor, idOrUserId, status) {
    if (!FREELANCER_STATUSES.includes(status)) throw new Error('validation_error');
    const existing = await this.getFreelancer(idOrUserId);
    this.assertOwnerOrAdmin(existing.userId, actor);
    return this.repository.updateFreelancerStatus(idOrUserId, status);
  }

  async listFreelanceJobs(params) {
    return this.repository.listFreelanceJobs(params);
  }

  async countFreelanceJobs(params) {
    return this.repository.countFreelanceJobs(params);
  }

  async listAllFreelanceJobs(actor, params = {}) {
    this.assertAdmin(actor);
    return this.repository.listFreelanceJobs({ ...params, status: params.status || null, statuses: params.statuses || null });
  }

  async countAllFreelanceJobs(actor, params = {}) {
    this.assertAdmin(actor);
    return this.repository.countFreelanceJobs({ ...params, status: params.status || null, statuses: params.statuses || null });
  }

  async getFreelanceJob(idOrSlug, userId = null) {
    const job = await this.repository.findFreelanceJob(idOrSlug, userId);
    if (!job) throw new Error('freelance_job_not_found');
    return job;
  }

  async createFreelanceJob(actor, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    if (!body.agreedToTerms || !body.title || !body.description || !(body.companyName || body.company)) throw new Error('validation_error');
    return this.repository.createFreelanceJob({ ...body, postedByUserId: actor.id, status: body.status || 'pending_review' });
  }

  async updateFreelanceJob(actor, id, body = {}) {
    const existing = await this.getFreelanceJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.postedByUserId, actor);
    return this.repository.updateFreelanceJob(existing.id, body);
  }

  async updateFreelanceJobStatus(actor, id, status) {
    if (!FREELANCE_JOB_STATUSES.includes(status)) throw new Error('validation_error');
    const job = await this.updateFreelanceJob(actor, id, { status });
    if (this.notificationRepository && ['approved', 'active', 'live', 'suspended', 'deleted', 'closed', 'archived'].includes(status)) {
      await this.notify({
        userId: job.postedByUserId,
        actorUserId: actor && (actor.id || actor.userId),
        type: 'freelance_job_status',
        title: status === 'suspended' ? 'Freelance job suspended' : status === 'deleted' ? 'Freelance job deleted' : 'Freelance job status updated',
        body: `Your freelance job "${job.title}" is now ${status}.`,
        target: { type: 'freelance_job', id: job.id, title: job.title, url: `/freelance-jobs/${job.id}` },
        metadata: { status }
      });
    }
    return job;
  }

  async updateFreelanceJobStatusAsAdmin(actor, id, status) {
    this.assertAdmin(actor);
    return this.updateFreelanceJobStatus(actor, id, status);
  }

  async deleteFreelanceJob(actor, id) {
    const existing = await this.getFreelanceJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.postedByUserId, actor);
    await this.repository.deleteFreelanceJob(existing.id);
    return { id: existing.id };
  }

  async deleteFreelanceJobAsAdmin(actor, id) {
    this.assertAdmin(actor);
    return this.deleteFreelanceJob(actor, id);
  }

  async applyToFreelanceJob(actor, id, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    const job = await this.getFreelanceJob(id, actor.id);
    if (!PUBLIC_JOB_STATUSES.includes(job.status)) throw new Error('freelance_job_not_found');
    const application = await this.repository.createFreelanceJobApplication({ freelanceJobId: job.id, userId: actor.id, proposal: body.proposal || null, bidAmount: body.bidAmount || null, currency: body.currency || 'NGN', attachmentMediaIds: body.attachmentMediaIds || [] });
    if (this.notificationRepository) {
      await this.notify({
        userId: job.postedByUserId,
        actorUserId: actor.id,
        type: 'freelance_job_application',
        title: 'New freelance job application',
        body: `Someone applied to "${job.title}".`,
        target: { type: 'freelance_job', id: job.id, title: job.title, url: `/freelance-jobs/${job.id}` },
        metadata: { applicationId: application.id }
      });
    }
    return application;
  }

  async listMyFreelanceJobs(actor, params) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.listFreelanceJobs({ ...params, userId: actor.id, status: params.status || null, postedByUserId: actor.id });
  }

  async countMyFreelanceJobs(actor, params) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.countFreelanceJobs({ ...params, status: params.status || null, postedByUserId: actor.id });
  }

  async listMyFreelanceApplications(actor, params) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.listMyFreelanceApplications(actor.id, params);
  }

  async countMyFreelanceApplications(actor) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    return this.repository.countMyFreelanceApplications(actor.id);
  }

  async listFreelanceJobApplications(actor, id, params) {
    const job = await this.getFreelanceJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(job.postedByUserId, actor);
    return this.repository.listFreelanceJobApplications(job.id, params);
  }

  async updateFreelanceApplication(actor, jobId, applicationId, status) {
    if (!APPLICATION_STATUSES.includes(status)) throw new Error('validation_error');
    const job = await this.getFreelanceJob(jobId, actor && actor.id);
    this.assertOwnerOrAdmin(job.postedByUserId, actor);
    return this.repository.updateFreelanceApplication(job.id, applicationId, status);
  }
}
