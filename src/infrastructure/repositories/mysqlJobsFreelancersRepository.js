import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const json = (value, fallback = []) => {
  if (typeof value === 'undefined' || value === null) return JSON.stringify(fallback);
  return JSON.stringify(Array.isArray(value) ? value : fallback);
};

const parseJson = (value, fallback = []) => {
  if (value === null || typeof value === 'undefined') return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

const slugify = (text) => String(text || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 90);

const toBool = (value) => value === true || value === 1 || value === '1';
const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
  return [];
};

export default class MysqlJobsFreelancersRepository {
  now() {
    return new Date();
  }

  async uniqueSlug(table, title, existingId = null) {
    const base = slugify(title) || uuidv4();
    let slug = base;
    let i = 2;
    while (true) {
      const q = db(table).where({ slug });
      if (existingId) q.whereNot({ id: existingId });
      const existing = await q.first();
      if (!existing) return slug;
      slug = `${base}-${i++}`;
    }
  }

  jobSelect(userId = null) {
    const appCounts = db('job_applications')
      .select('job_id')
      .count({ applicant_count: 'id' })
      .whereNot({ status: 'withdrawn' })
      .groupBy('job_id')
      .as('ja');

    const q = db('jobs as j')
      .leftJoin(appCounts, 'ja.job_id', 'j.id')
      .select('j.*', db.raw('COALESCE(ja.applicant_count, 0) as applicant_count'));

    if (userId) {
      q.select(db.raw('EXISTS(SELECT 1 FROM job_applications a WHERE a.job_id = j.id AND a.user_id = ?) as has_applied', [userId]));
    }
    return q;
  }

  mapJob(row) {
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      companyName: row.company_name,
      companyId: row.company_id,
      location: row.location,
      workMode: row.work_mode,
      type: row.type,
      salaryMin: row.salary_min === null ? null : Number(row.salary_min),
      salaryMax: row.salary_max === null ? null : Number(row.salary_max),
      salaryCurrency: row.salary_currency,
      salaryLabel: row.salary_label,
      experience: row.experience,
      skills: parseJson(row.skills),
      description: row.description,
      summary: row.summary,
      responsibilities: parseJson(row.responsibilities),
      requirements: parseJson(row.requirements),
      perks: parseJson(row.perks),
      applicationEmail: row.application_email,
      applicationUrl: row.application_url,
      applicationEndDate: row.application_end_date,
      status: row.status,
      applicantCount: parseInt(row.applicant_count || 0, 10),
      hasApplied: typeof row.has_applied === 'undefined' ? undefined : Boolean(row.has_applied),
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  applyJobFilters(q, filters = {}) {
    if (filters.status) q.where('j.status', filters.status);
    if (filters.q) {
      const like = `%${filters.q}%`;
      q.andWhere((b) => b.where('j.title', 'like', like).orWhere('j.company_name', 'like', like).orWhere('j.description', 'like', like));
    }
    if (filters.location) q.where('j.location', 'like', `%${filters.location}%`);
    if (filters.type) q.where('j.type', filters.type);
    if (filters.workMode) q.where('j.work_mode', filters.workMode);
    if (filters.experience) q.where('j.experience', filters.experience);
    if (filters.skill) q.where('j.skills', 'like', `%${filters.skill}%`);
    if (filters.createdByUserId) q.where('j.created_by_user_id', filters.createdByUserId);
  }

  sortJobs(q, sort = 'latest') {
    if (sort === 'oldest') q.orderBy('j.created_at', 'asc');
    else if (sort === 'most_applied') q.orderBy('applicant_count', 'desc');
    else if (sort === 'closing_soon') q.orderBy('j.application_end_date', 'asc');
    else q.orderBy('j.created_at', 'desc');
  }

  async listJobs({ limit = 20, offset = 0, userId = null, status = 'live', sort = 'latest', ...filters } = {}) {
    const q = this.jobSelect(userId);
    this.applyJobFilters(q, { ...filters, status });
    this.sortJobs(q, sort);
    const rows = await q.limit(limit).offset(offset);
    return rows.map(row => this.mapJob(row));
  }

  async countJobs({ status = 'live', ...filters } = {}) {
    const q = db('jobs as j').count({ cnt: 'j.id' });
    this.applyJobFilters(q, { ...filters, status });
    const row = await q.first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async findJob(idOrSlug, userId = null) {
    const row = await this.jobSelect(userId)
      .where((q) => q.where('j.id', idOrSlug).orWhere('j.slug', idOrSlug))
      .first();
    return this.mapJob(row);
  }

  async createJob(input) {
    const now = this.now();
    const id = input.id || uuidv4();
    const title = input.title;
    const payload = {
      id,
      slug: await this.uniqueSlug('jobs', title),
      title,
      company_name: input.companyName || input.company,
      company_id: input.companyId || null,
      location: input.location || null,
      work_mode: input.workMode || null,
      type: input.type || 'full-time',
      salary_min: input.salaryMin ?? input.minSalary ?? input.min_salary ?? null,
      salary_max: input.salaryMax ?? input.maxSalary ?? input.max_salary ?? null,
      salary_currency: input.salaryCurrency || 'NGN',
      salary_label: input.salaryLabel || null,
      experience: input.experience || input.workExperience || null,
      skills: json(toArray(input.skills)),
      description: input.description,
      summary: input.summary || null,
      responsibilities: json(input.responsibilities || (input.tasks ? [input.tasks] : [])),
      requirements: json(input.requirements || (input.qualifications ? [input.qualifications] : [])),
      perks: json(input.perks),
      application_email: input.applicationEmail || input.senderEmail || input.sender_email || null,
      application_url: input.applicationUrl || null,
      application_end_date: input.applicationEndDate || input.closing_date || null,
      status: input.status || 'live',
      created_by_user_id: input.createdByUserId,
      created_at: now,
      updated_at: now
    };
    await db('jobs').insert(payload);
    return this.findJob(id, input.createdByUserId);
  }

  async updateJob(id, updates) {
    const payload = {};
    const map = {
      companyName: 'company_name', companyId: 'company_id', workMode: 'work_mode',
      salaryMin: 'salary_min', minSalary: 'salary_min', salaryMax: 'salary_max', maxSalary: 'salary_max',
      salaryCurrency: 'salary_currency', salaryLabel: 'salary_label', applicationEmail: 'application_email',
      senderEmail: 'application_email', sender_email: 'application_email', applicationUrl: 'application_url',
      applicationEndDate: 'application_end_date', closing_date: 'application_end_date',
      createdByUserId: 'created_by_user_id', workExperience: 'experience',
      company: 'company_name', min_salary: 'salary_min', max_salary: 'salary_max'
    };
    for (const [key, value] of Object.entries(updates || {})) {
      if (key === 'skills') payload[key] = json(toArray(value));
      else if (['responsibilities', 'requirements', 'perks'].includes(key)) payload[key] = json(value);
      else if (key === 'tasks') payload.responsibilities = json([value]);
      else if (key === 'qualifications') payload.requirements = json([value]);
      else if (map[key]) payload[map[key]] = value;
      else if (['title','location','type','experience','description','summary','status'].includes(key)) payload[key] = value;
    }
    if (payload.title) payload.slug = await this.uniqueSlug('jobs', payload.title, id);
    payload.updated_at = this.now();
    await db('jobs').where({ id }).update(payload);
    return this.findJob(id);
  }

  async deleteJob(id) {
    await db('jobs').where({ id }).del();
    return true;
  }

  async createJobApplication({ jobId, userId, coverLetter = null, resumeMediaId = null, answers = [] }) {
    const existing = await db('job_applications').where({ job_id: jobId, user_id: userId }).first();
    if (existing && existing.status !== 'withdrawn') throw new Error('already_applied');
    const now = this.now();
    const id = existing ? existing.id : uuidv4();
    const payload = {
      id,
      job_id: jobId,
      user_id: userId,
      cover_letter: coverLetter,
      resume_media_id: resumeMediaId,
      answers: JSON.stringify(answers || []),
      status: 'submitted',
      created_at: existing ? existing.created_at : now,
      updated_at: now
    };
    if (existing) await db('job_applications').where({ id }).update(payload);
    else await db('job_applications').insert(payload);
    return this.mapJobApplication(await db('job_applications').where({ id }).first());
  }

  mapJobApplication(row, job = null) {
    if (!row) return null;
    return {
      id: row.id,
      jobId: row.job_id,
      userId: row.user_id,
      job,
      coverLetter: row.cover_letter,
      resumeMediaId: row.resume_media_id,
      answers: parseJson(row.answers),
      status: row.status,
      createdAt: row.created_at,
      appliedAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listMyJobApplications(userId, { limit = 20, offset = 0 } = {}) {
    const rows = await db('job_applications as a').where('a.user_id', userId).orderBy('a.created_at', 'desc').limit(limit).offset(offset);
    return Promise.all(rows.map(async row => ({ ...this.mapJobApplication(row), job: await this.findJob(row.job_id, userId) })));
  }

  async countMyJobApplications(userId) {
    const row = await db('job_applications').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async listJobApplications(jobId, { limit = 20, offset = 0 } = {}) {
    const rows = await db('job_applications').where({ job_id: jobId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
    return rows.map(row => this.mapJobApplication(row));
  }

  async countJobApplications(jobId) {
    const row = await db('job_applications').where({ job_id: jobId }).count({ cnt: 'id' }).first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async updateJobApplication(jobId, applicationId, status) {
    await db('job_applications').where({ id: applicationId, job_id: jobId }).update({ status, updated_at: this.now() });
    return this.mapJobApplication(await db('job_applications').where({ id: applicationId, job_id: jobId }).first());
  }

  async findJobApplication(jobId, applicationId) {
    return this.mapJobApplication(await db('job_applications').where({ id: applicationId, job_id: jobId }).first());
  }

  async upsertAlertPreferences(userId, input = {}) {
    const now = this.now();
    const existing = await db('alert_preferences').where({ user_id: userId }).first();
    const payload = {
      id: existing ? existing.id : uuidv4(),
      user_id: userId,
      contest_alert: toBool(input.contestAlert),
      sponsorship_alert: toBool(input.sponsorshipAlert),
      scholarship_type: input.scholarshipType || null,
      job_alert: toBool(input.jobAlert),
      job_search_tags: json(input.jobSearchTags),
      created_at: existing ? existing.created_at : now,
      updated_at: now
    };
    if (existing) await db('alert_preferences').where({ id: existing.id }).update(payload);
    else await db('alert_preferences').insert(payload);
    return this.getAlertPreferences(userId);
  }

  async getAlertPreferences(userId) {
    const row = await db('alert_preferences').where({ user_id: userId }).first();
    if (!row) return null;
    return {
      contestAlert: Boolean(row.contest_alert),
      sponsorshipAlert: Boolean(row.sponsorship_alert),
      scholarshipType: row.scholarship_type,
      jobAlert: Boolean(row.job_alert),
      jobSearchTags: parseJson(row.job_search_tags),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  mapFreelancer(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      title: row.title,
      skills: parseJson(row.skills),
      location: row.location,
      bio: row.bio,
      avatar: row.avatar,
      passportMediaId: row.passport_media_id,
      status: row.status,
      availability: row.availability,
      remoteOnly: Boolean(row.remote_only),
      hourlyRateMin: row.hourly_rate_min === null ? null : Number(row.hourly_rate_min),
      hourlyRateMax: row.hourly_rate_max === null ? null : Number(row.hourly_rate_max),
      currency: row.currency,
      rating: row.rating === null ? null : Number(row.rating),
      completedJobsCount: parseInt(row.completed_jobs_count || 0, 10),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listFreelancers({ limit = 20, offset = 0, q, skill, location, availability, status = 'available', statuses = null, remoteOnly, sort = 'latest' } = {}) {
    const query = db('freelancer_profiles');
    if (Array.isArray(statuses) && statuses.length > 0) query.whereIn('status', statuses);
    else if (status) query.where({ status });
    if (availability) query.where({ availability });
    if (typeof remoteOnly !== 'undefined') query.where({ remote_only: toBool(remoteOnly) ? 1 : 0 });
    if (skill) query.where('skills', 'like', `%${skill}%`);
    if (location) query.where('location', 'like', `%${location}%`);
    if (q) {
      const like = `%${q}%`;
      query.andWhere(b => b.where('name', 'like', like).orWhere('title', 'like', like).orWhere('bio', 'like', like));
    }
    if (sort === 'oldest') query.orderBy('created_at', 'asc');
    else if (sort === 'rating') query.orderBy('rating', 'desc');
    else query.orderBy('created_at', 'desc');
    const rows = await query.limit(limit).offset(offset);
    return rows.map(row => this.mapFreelancer(row));
  }

  async countFreelancers(filters = {}) {
    const rows = await this.listFreelancers({ ...filters, limit: 100000, offset: 0 });
    return rows.length;
  }

  async findFreelancer(idOrUserId) {
    const row = await db('freelancer_profiles').where(q => q.where({ id: idOrUserId }).orWhere({ user_id: idOrUserId })).first();
    return this.mapFreelancer(row);
  }

  async createFreelancer(input) {
    const existing = await db('freelancer_profiles').where({ user_id: input.userId }).first();
    if (existing) throw new Error('freelancer_profile_exists');
    const now = this.now();
    const id = uuidv4();
    await db('freelancer_profiles').insert({
      id,
      user_id: input.userId,
      name: input.name,
      title: input.title,
      skills: json(toArray(input.skills)),
      location: input.location,
      bio: input.bio,
      avatar: input.avatar || null,
      passport_media_id: input.passportMediaId || null,
      status: input.status || 'available',
      availability: input.availability || 'open',
      remote_only: toBool(input.remoteOnly) ? 1 : 0,
      hourly_rate_min: input.hourlyRateMin || null,
      hourly_rate_max: input.hourlyRateMax || null,
      currency: input.currency || 'NGN',
      rating: null,
      completed_jobs_count: 0,
      created_at: now,
      updated_at: now
    });
    return this.findFreelancer(id);
  }

  async updateFreelancer(userId, updates) {
    const payload = {};
    for (const [key, value] of Object.entries(updates || {})) {
      if (key === 'skills') payload.skills = json(value);
      else if (key === 'passportMediaId') payload.passport_media_id = value;
      else if (key === 'remoteOnly') payload.remote_only = toBool(value) ? 1 : 0;
      else if (key === 'hourlyRateMin') payload.hourly_rate_min = value;
      else if (key === 'hourlyRateMax') payload.hourly_rate_max = value;
      else if (['name','title','location','bio','avatar','status','availability','currency'].includes(key)) payload[key] = value;
    }
    payload.updated_at = this.now();
    await db('freelancer_profiles').where({ user_id: userId }).update(payload);
    return this.findFreelancer(userId);
  }

  async updateFreelancerStatus(idOrUserId, status) {
    await db('freelancer_profiles')
      .where(q => q.where({ id: idOrUserId }).orWhere({ user_id: idOrUserId }))
      .update({ status, updated_at: this.now() });
    return this.findFreelancer(idOrUserId);
  }

  freelanceJobSelect(userId = null) {
    const appCounts = db('freelance_job_applications')
      .select('freelance_job_id')
      .count({ applicant_count: 'id' })
      .whereNot({ status: 'withdrawn' })
      .groupBy('freelance_job_id')
      .as('fa');
    const q = db('freelance_jobs as f')
      .leftJoin(appCounts, 'fa.freelance_job_id', 'f.id')
      .select('f.*', db.raw('COALESCE(fa.applicant_count, 0) as applicant_count'));
    if (userId) q.select(db.raw('EXISTS(SELECT 1 FROM freelance_job_applications a WHERE a.freelance_job_id = f.id AND a.user_id = ?) as has_applied', [userId]));
    return q;
  }

  mapFreelanceJob(row) {
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      companyName: row.company_name,
      postedByUserId: row.posted_by_user_id,
      location: row.location,
      type: row.type,
      skills: parseJson(row.skills),
      description: row.description,
      qualifications: row.qualifications,
      minFee: row.min_fee === null ? null : Number(row.min_fee),
      maxFee: row.max_fee === null ? null : Number(row.max_fee),
      currency: row.currency,
      feeLabel: row.fee_label,
      applicationEndDate: row.application_end_date,
      status: row.status,
      applicantCount: parseInt(row.applicant_count || 0, 10),
      verified: Boolean(row.verified),
      hasApplied: typeof row.has_applied === 'undefined' ? undefined : Boolean(row.has_applied),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listFreelanceJobs({ limit = 20, offset = 0, userId = null, status = 'live', q, skill, location, type, sort = 'latest', postedByUserId = null } = {}) {
    const query = this.freelanceJobSelect(userId);
    if (status) query.where('f.status', status);
    if (q) {
      const like = `%${q}%`;
      query.andWhere(b => b.where('f.title', 'like', like).orWhere('f.company_name', 'like', like).orWhere('f.description', 'like', like));
    }
    if (skill) query.where('f.skills', 'like', `%${skill}%`);
    if (location) query.where('f.location', 'like', `%${location}%`);
    if (type) query.where('f.type', type);
    if (postedByUserId) query.where('f.posted_by_user_id', postedByUserId);
    if (sort === 'oldest') query.orderBy('f.created_at', 'asc');
    else if (sort === 'most_applied') query.orderBy('applicant_count', 'desc');
    else query.orderBy('f.created_at', 'desc');
    const rows = await query.limit(limit).offset(offset);
    return rows.map(row => this.mapFreelanceJob(row));
  }

  async countFreelanceJobs(filters = {}) {
    const rows = await this.listFreelanceJobs({ ...filters, limit: 100000, offset: 0 });
    return rows.length;
  }

  async findFreelanceJob(idOrSlug, userId = null) {
    const row = await this.freelanceJobSelect(userId).where(q => q.where('f.id', idOrSlug).orWhere('f.slug', idOrSlug)).first();
    return this.mapFreelanceJob(row);
  }

  async createFreelanceJob(input) {
    const now = this.now();
    const id = uuidv4();
    await db('freelance_jobs').insert({
      id,
      slug: await this.uniqueSlug('freelance_jobs', input.title),
      title: input.title,
      company_name: input.companyName || input.company,
      posted_by_user_id: input.postedByUserId,
      location: input.location,
      type: input.type || 'project-based',
      skills: json(toArray(input.skills)),
      description: input.description,
      qualifications: input.qualifications,
      min_fee: input.minFee || null,
      max_fee: input.maxFee || null,
      currency: input.currency || 'NGN',
      fee_label: input.feeLabel || null,
      application_end_date: input.applicationEndDate,
      status: input.status || 'live',
      verified: input.verified ? 1 : 0,
      created_at: now,
      updated_at: now
    });
    return this.findFreelanceJob(id, input.postedByUserId);
  }

  async updateFreelanceJob(id, updates) {
    const payload = {};
    for (const [key, value] of Object.entries(updates || {})) {
      if (key === 'skills') payload.skills = json(toArray(value));
      else if (key === 'companyName') payload.company_name = value;
      else if (key === 'postedByUserId') payload.posted_by_user_id = value;
      else if (key === 'minFee') payload.min_fee = value;
      else if (key === 'maxFee') payload.max_fee = value;
      else if (key === 'feeLabel') payload.fee_label = value;
      else if (key === 'applicationEndDate') payload.application_end_date = value;
      else if (['title','location','type','description','qualifications','currency','status','verified'].includes(key)) payload[key] = value;
    }
    if (payload.title) payload.slug = await this.uniqueSlug('freelance_jobs', payload.title, id);
    payload.updated_at = this.now();
    await db('freelance_jobs').where({ id }).update(payload);
    return this.findFreelanceJob(id);
  }

  async deleteFreelanceJob(id) {
    await db('freelance_jobs').where({ id }).del();
    return true;
  }

  async createFreelanceJobApplication({ freelanceJobId, userId, proposal = null, bidAmount = null, currency = 'NGN', attachmentMediaIds = [] }) {
    const existing = await db('freelance_job_applications').where({ freelance_job_id: freelanceJobId, user_id: userId }).first();
    if (existing && existing.status !== 'withdrawn') throw new Error('already_applied');
    const now = this.now();
    const id = existing ? existing.id : uuidv4();
    const payload = { id, freelance_job_id: freelanceJobId, user_id: userId, proposal, bid_amount: bidAmount, currency, attachment_media_ids: json(attachmentMediaIds), status: 'submitted', created_at: existing ? existing.created_at : now, updated_at: now };
    if (existing) await db('freelance_job_applications').where({ id }).update(payload);
    else await db('freelance_job_applications').insert(payload);
    return this.mapFreelanceApplication(await db('freelance_job_applications').where({ id }).first());
  }

  mapFreelanceApplication(row, freelanceJob = null) {
    if (!row) return null;
    return {
      id: row.id,
      freelanceJobId: row.freelance_job_id,
      userId: row.user_id,
      freelanceJob,
      proposal: row.proposal,
      bidAmount: row.bid_amount === null ? null : Number(row.bid_amount),
      currency: row.currency,
      attachmentMediaIds: parseJson(row.attachment_media_ids),
      status: row.status,
      createdAt: row.created_at,
      appliedAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listMyFreelanceApplications(userId, { limit = 20, offset = 0 } = {}) {
    const rows = await db('freelance_job_applications').where({ user_id: userId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
    return Promise.all(rows.map(async row => ({ ...this.mapFreelanceApplication(row), freelanceJob: await this.findFreelanceJob(row.freelance_job_id, userId) })));
  }

  async countMyFreelanceApplications(userId) {
    const row = await db('freelance_job_applications').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async listFreelanceJobApplications(freelanceJobId, { limit = 20, offset = 0 } = {}) {
    const rows = await db('freelance_job_applications').where({ freelance_job_id: freelanceJobId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
    return rows.map(row => this.mapFreelanceApplication(row));
  }

  async countFreelanceJobApplications(freelanceJobId) {
    const row = await db('freelance_job_applications').where({ freelance_job_id: freelanceJobId }).count({ cnt: 'id' }).first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async updateFreelanceApplication(freelanceJobId, applicationId, status) {
    await db('freelance_job_applications').where({ id: applicationId, freelance_job_id: freelanceJobId }).update({ status, updated_at: this.now() });
    return this.mapFreelanceApplication(await db('freelance_job_applications').where({ id: applicationId, freelance_job_id: freelanceJobId }).first());
  }
}
