const JOB_STATUSES = ['draft', 'pending_review', 'live', 'closed', 'archived'];
const APPLICATION_STATUSES = ['submitted', 'reviewing', 'shortlisted', 'interview', 'rejected', 'accepted', 'withdrawn'];
const FREELANCER_STATUSES = ['draft', 'pending_review', 'available', 'certified', 'suspended'];
const FREELANCER_AVAILABILITY = ['available_now', 'open', 'busy', 'unavailable'];
const FREELANCE_JOB_STATUSES = ['pending_review', 'live', 'closed', 'archived'];

export default class JobsFreelancersUseCase {
  constructor({ repository }) {
    this.repository = repository;
  }

  assertOwnerOrAdmin(recordUserId, actor) {
    if (!actor || (!actor.id && !actor.userId)) throw new Error('unauthorized');
    const actorId = actor.id || actor.userId;
    if (recordUserId !== actorId && actor.role !== 'admin') throw new Error('forbidden');
  }

  async listJobs(params) {
    return this.repository.listJobs(params);
  }

  async countJobs(params) {
    return this.repository.countJobs(params);
  }

  async getJob(idOrSlug, userId = null) {
    const job = await this.repository.findJob(idOrSlug, userId);
    if (!job) throw new Error('job_not_found');
    return job;
  }

  async createJob(actor, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    if (!body.title || !(body.companyName || body.company) || !body.description) throw new Error('validation_error');
    return this.repository.createJob({ ...body, createdByUserId: actor.id, status: body.status || 'live' });
  }

  async updateJob(actor, id, body = {}) {
    const existing = await this.getJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.createdByUserId, actor);
    return this.repository.updateJob(existing.id, body);
  }

  async updateJobStatus(actor, id, status) {
    if (!JOB_STATUSES.includes(status)) throw new Error('validation_error');
    return this.updateJob(actor, id, { status });
  }

  async deleteJob(actor, id) {
    const existing = await this.getJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.createdByUserId, actor);
    await this.repository.deleteJob(existing.id);
    return { id: existing.id };
  }

  async applyToJob(actor, id, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    const job = await this.getJob(id, actor.id);
    return this.repository.createJobApplication({ jobId: job.id, userId: actor.id, coverLetter: body.coverLetter || null, resumeMediaId: body.resumeMediaId || null, answers: body.answers || [] });
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
    if (body.sponsorshipAlert && !body.scholarshipType) throw new Error('validation_error');
    return this.repository.upsertAlertPreferences(actor.id, { ...body, jobSearchTags: unique });
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

  async listFreelanceJobs(params) {
    return this.repository.listFreelanceJobs(params);
  }

  async countFreelanceJobs(params) {
    return this.repository.countFreelanceJobs(params);
  }

  async getFreelanceJob(idOrSlug, userId = null) {
    const job = await this.repository.findFreelanceJob(idOrSlug, userId);
    if (!job) throw new Error('freelance_job_not_found');
    return job;
  }

  async createFreelanceJob(actor, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    if (!body.agreedToTerms || !body.title || !body.description || !(body.companyName || body.company)) throw new Error('validation_error');
    return this.repository.createFreelanceJob({ ...body, postedByUserId: actor.id, status: body.status || 'live' });
  }

  async updateFreelanceJob(actor, id, body = {}) {
    const existing = await this.getFreelanceJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.postedByUserId, actor);
    return this.repository.updateFreelanceJob(existing.id, body);
  }

  async updateFreelanceJobStatus(actor, id, status) {
    if (!FREELANCE_JOB_STATUSES.includes(status)) throw new Error('validation_error');
    return this.updateFreelanceJob(actor, id, { status });
  }

  async deleteFreelanceJob(actor, id) {
    const existing = await this.getFreelanceJob(id, actor && actor.id);
    this.assertOwnerOrAdmin(existing.postedByUserId, actor);
    await this.repository.deleteFreelanceJob(existing.id);
    return { id: existing.id };
  }

  async applyToFreelanceJob(actor, id, body = {}) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    const job = await this.getFreelanceJob(id, actor.id);
    return this.repository.createFreelanceJobApplication({ freelanceJobId: job.id, userId: actor.id, proposal: body.proposal || null, bidAmount: body.bidAmount || null, currency: body.currency || 'NGN', attachmentMediaIds: body.attachmentMediaIds || [] });
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
