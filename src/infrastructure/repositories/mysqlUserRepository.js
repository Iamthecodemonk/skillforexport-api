import db from '../knexConfig.js';
import User from '../../domain/entities/User.js';

const parseJsonObject = (value) => {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
};

const parseJsonArray = (value) => {
  const parsed = parseJsonObject(value);
  return Array.isArray(parsed) ? parsed : [];
};

const numberFromRow = (row) => {
  const value = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
  return parseInt(value || 0, 10);
};

export default class MysqlUserRepository {
  async findByEmail(email) {
    const user = await db('users').where({ email }).first();
    if (!user) return null;
    const u = new User(user);
    u.tokenVersion = user.token_version || 0;
    return u;
  }

  async findById(id) {
    const user = await db('users').where({ id }).first();
    if (!user) return null;
    const u = new User(user);
    u.tokenVersion = user.token_version || 0;
    return u;
  }

  async findByReferralCode(referralCode) {
    if (!referralCode) return null;
    const user = await db('users').where({ referral_code: referralCode }).first();
    if (!user) return null;
    const u = new User(user);
    u.tokenVersion = user.token_version || 0;
    return u;
  }

  async create(user) {
    const record = user.toRecord ? user.toRecord() : user;
    const now = new Date();
    await db('users').insert({
      id: record.id,
      email: record.email,
      password: record.password,
      token_version: record.token_version || 0,
      role: record.role || 'user',
      referral_code: record.referral_code || record.referralCode || null,
      referred_by_user_id: record.referred_by_user_id || record.referredByUserId || null,
      created_at: now,
      updated_at: now,
    });
    return new User({
      id: record.id,
      email: record.email,
      password: record.password,
      role: record.role || 'user',
      referral_code: record.referral_code || record.referralCode || null,
      referred_by_user_id: record.referred_by_user_id || record.referredByUserId || null,
      created_at: now,
      updated_at: now,
    });
  }

  async incrementTokenVersion(userId) {
    // Atomically increment token_version
    await db('users').where({ id: userId }).increment('token_version', 1);
    const row = await db('users').where({ id: userId }).first();
    return row ? (row.token_version || 0) : null;
  }

  async createOtp(otp) {
    const now = new Date();
    await db('user_otps').insert({
      id: otp.id,
      user_id: otp.userId,
      email: otp.email,
      otp_code: otp.otpCode,
      purpose: otp.purpose || 'login',
      is_used: otp.isUsed || false,
      temp_password_hash: otp.tempPasswordHash || '',
      temp_profile_full_name: otp.tempProfileFullName || '',
      expires_at: otp.expiresAt,
      created_at: now,
    });
    return { id: otp.id, user_id: otp.userId, email: otp.email, otp_code: otp.otpCode };
  }

  async findValidOtp(email, otpCode, purpose) {
    const now = new Date();
    const otp = await db('user_otps')
      .where({ email, otp_code: otpCode, purpose, is_used: false })
      .where('expires_at', '>', now)
      .orderBy('created_at', 'desc')
      .first();
    return otp || null;
  }

  async markOtpUsed(id) {
    const now = new Date();
    await db('user_otps').where({ id }).update({
      is_used: true,
      used_at: now,
    });
    return { id, is_used: true, used_at: now };
  }

  async markOtpVerified(id) {
    const now = new Date();
    await db('user_otps').where({ id }).update({
      used_at: now,
    });
    return { id, used_at: now };
  }

  async findLatestOtpByEmailPurpose(email, purpose) {
    const otp = await db('user_otps')
      .where({ email, purpose, is_used: false })
      .orderBy('created_at', 'desc')
      .first();

    return otp || null;
  }

  async updateOtpTempPassword(id, hashedPassword) {
    await db('user_otps').where({ id }).update({
      temp_password_hash: hashedPassword,
    });

    return { id, temp_password_hash: hashedPassword };
  }

  async deleteOtpsByEmailPurpose(email, purpose) {
    return db('user_otps').where({ email, purpose }).del();
  }

  async deleteOtp(id) {
    await db('user_otps').where({ id }).del();
    return true;
  }

  async deleteExpiredOtps(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
    // Remove registration OTPs that are expired or used and older than cutoff
    const deleted = await db('user_otps')
      .where(function () {
        this.where('purpose', 'registration').andWhere(function () {
          this.where('is_used', true).orWhere('expires_at', '<', new Date());
        });
      })
      .andWhere('created_at', '<', cutoff)
      .del();
    return deleted;
  }

  async updatePassword(userId, hashedPassword) {
    const now = new Date();
    await db('users').where({ id: userId }).update({
      password: hashedPassword,
      updated_at: now,
    });
    return { id: userId, updated_at: now };
  }

  // Optimized single-query denormalized fetch for full user profile
  async findFullProfileById(id) {
    const sql = `
      SELECT
        u.id as user_id,
        u.email,
        u.role,
        u.created_at as user_created_at,
        JSON_OBJECT(
          'id', up.id,
          'username', up.username,
          'displayName', up.display_name,
          'bio', up.bio,
          'location', up.location,
          'avatar', up.avatar,
          'banner', up.banner,
          'website', up.website,
          'linkedin', up.linkedin,
          'github', up.github,
          'currentJobTitle', up.current_job_title,
          'current_job_title', up.current_job_title,
          'currentWorkspace', up.current_workspace,
          'current_workspace', up.current_workspace
        ) as profile,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'skill', s.skill, 'level', s.level)) FROM user_skills s WHERE s.user_id = u.id), JSON_ARRAY()) as skills,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', p.id, 'title', p.title, 'description', p.description, 'link', p.link, 'pictures', IFNULL(p.pictures, JSON_ARRAY()))) FROM user_portfolios p WHERE p.user_id = u.id), JSON_ARRAY()) as portfolios,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', c.id, 'name', c.name, 'issuer', c.issuer, 'issue_date', c.issue_date)) FROM user_certifications c WHERE c.user_id = u.id), JSON_ARRAY()) as certifications,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', e.id, 'school', e.school, 'degree', e.degree, 'field', e.field, 'start_date', e.start_date, 'end_date', e.end_date)) FROM user_education e WHERE e.user_id = u.id), JSON_ARRAY()) as education,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ex.id, 'company', ex.company, 'title', ex.title, 'employment_type', ex.employment_type, 'start_date', ex.start_date, 'end_date', ex.end_date, 'is_current', ex.is_current, 'description', ex.description)) FROM user_experiences ex WHERE ex.user_id = u.id), JSON_ARRAY()) as experiences,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', f.id, 'follower_id', f.follower_id)) FROM followers f WHERE f.following_id = u.id), JSON_ARRAY()) as followers,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', oa.id, 'provider', oa.provider, 'provider_id', oa.provider_id, 'provider_email', oa.provider_email, 'avatar_url', oa.avatar_url)) FROM user_oauth_accounts oa WHERE oa.user_id = u.id), JSON_ARRAY()) as oauth_accounts
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `;
    const res = await db.raw(sql, [id]);
    // knex/mysql returns [rows, fields] for raw; normalize across drivers
    const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : (res.rows || res[0] || res);
    return rows && rows.length ? rows[0] : null;
  }

  mapUserActivityRow(row) {
    if (!row) return null;
    const stats = {
      posts: parseInt(row.total_posts || 0, 10),
      questions: parseInt(row.total_questions || 0, 10),
      answers: parseInt(row.total_answers || 0, 10),
      comments: parseInt(row.total_comments || 0, 10),
      jobs: parseInt(row.total_jobs || 0, 10),
      jobApplications: parseInt(row.total_job_applications || 0, 10),
      freelanceJobs: parseInt(row.total_freelance_jobs || 0, 10),
      freelanceApplications: parseInt(row.total_freelance_applications || 0, 10),
      pages: parseInt(row.total_pages || 0, 10),
      communities: parseInt(row.total_communities || 0, 10),
      ownedCommunities: parseInt(row.total_owned_communities || 0, 10),
      skills: parseInt(row.total_skills || 0, 10),
      portfolios: parseInt(row.total_portfolios || 0, 10),
      certifications: parseInt(row.total_certifications || 0, 10),
      education: parseInt(row.total_education || 0, 10),
      experiences: parseInt(row.total_experiences || 0, 10),
      followers: parseInt(row.total_followers || 0, 10),
      totalFollowers: parseInt(row.total_followers || 0, 10),
      following: parseInt(row.total_following || 0, 10)
    };

    return {
      id: row.id,
      email: row.email,
      referral_code: row.referral_code || null,
      role: row.role,
      created_at: row.created_at,
      updated_at: row.updated_at,
      profile: {
        username: row.username || null,
        displayName: row.display_name || null,
        avatar: row.avatar || null,
        bio: row.bio || null,
        location: row.location || null
      },
      skills: parseJsonArray(row.skills),
      portfolios: parseJsonArray(row.portfolios),
      certifications: parseJsonArray(row.certifications),
      education: parseJsonArray(row.education),
      experiences: parseJsonArray(row.experiences),
      stats,
      latest: {
        post: parseJsonObject(row.latest_post),
        question: parseJsonObject(row.latest_question),
        job: parseJsonObject(row.latest_job),
        freelanceJob: parseJsonObject(row.latest_freelance_job),
        page: parseJsonObject(row.latest_page)
      }
    };
  }

  async listWithActivity({ limit = 20, offset = 0, userId = null } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit || 20, 10), 1), 100);
    const safeOffset = Math.max(parseInt(offset || 0, 10), 0);

    const query = db('users as u')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .select(
        'u.id',
        'u.email',
        'u.referral_code',
        'u.role',
        'u.created_at',
        'u.updated_at',
        'up.username',
        'up.display_name',
        'up.avatar',
        'up.bio',
        'up.location',
        db.raw('(SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) as total_posts'),
        db.raw('(SELECT COUNT(*) FROM questions q WHERE q.user_id = u.id) as total_questions'),
        db.raw('(SELECT COUNT(*) FROM answers a WHERE a.user_id = u.id) as total_answers'),
        db.raw('(SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) as total_comments'),
        db.raw('(SELECT COUNT(*) FROM jobs j WHERE j.created_by_user_id = u.id) as total_jobs'),
        db.raw('(SELECT COUNT(*) FROM job_applications ja WHERE ja.user_id = u.id) as total_job_applications'),
        db.raw('(SELECT COUNT(*) FROM freelance_jobs fj WHERE fj.posted_by_user_id = u.id) as total_freelance_jobs'),
        db.raw('(SELECT COUNT(*) FROM freelance_job_applications fja WHERE fja.user_id = u.id) as total_freelance_applications'),
        db.raw('(SELECT COUNT(*) FROM pages pg WHERE pg.owner_id = u.id) as total_pages'),
        db.raw('(SELECT COUNT(*) FROM community_members cm WHERE cm.user_id = u.id) as total_communities'),
        db.raw('(SELECT COUNT(*) FROM communities co WHERE co.owner_id = u.id) as total_owned_communities'),
        db.raw('(SELECT COUNT(*) FROM user_skills s WHERE s.user_id = u.id) as total_skills'),
        db.raw('(SELECT COUNT(*) FROM user_portfolios pfo WHERE pfo.user_id = u.id) as total_portfolios'),
        db.raw('(SELECT COUNT(*) FROM user_certifications cert WHERE cert.user_id = u.id) as total_certifications'),
        db.raw('(SELECT COUNT(*) FROM user_education edu WHERE edu.user_id = u.id) as total_education'),
        db.raw('(SELECT COUNT(*) FROM user_experiences exp WHERE exp.user_id = u.id) as total_experiences'),
        db.raw('(SELECT COUNT(*) FROM followers f WHERE f.following_id = u.id) as total_followers'),
        db.raw('(SELECT COUNT(*) FROM followers f WHERE f.follower_id = u.id) as total_following'),
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'skill', s.skill, 'level', s.level, 'created_at', s.created_at))
          FROM user_skills s
          WHERE s.user_id = u.id
        ), JSON_ARRAY()) as skills`),
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pfo.id, 'title', pfo.title, 'description', pfo.description, 'link', pfo.link, 'pictures', IFNULL(pfo.pictures, JSON_ARRAY()), 'created_at', pfo.created_at, 'updated_at', pfo.updated_at))
          FROM user_portfolios pfo
          WHERE pfo.user_id = u.id
        ), JSON_ARRAY()) as portfolios`),
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', cert.id, 'name', cert.name, 'issuer', cert.issuer, 'issue_date', cert.issue_date, 'created_at', cert.created_at, 'updated_at', cert.updated_at))
          FROM user_certifications cert
          WHERE cert.user_id = u.id
        ), JSON_ARRAY()) as certifications`),
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', edu.id, 'school', edu.school, 'degree', edu.degree, 'field', edu.field, 'start_date', edu.start_date, 'end_date', edu.end_date, 'created_at', edu.created_at, 'updated_at', edu.updated_at))
          FROM user_education edu
          WHERE edu.user_id = u.id
        ), JSON_ARRAY()) as education`),
        db.raw(`IFNULL((
          SELECT JSON_ARRAYAGG(JSON_OBJECT('id', exp.id, 'company', exp.company, 'title', exp.title, 'employment_type', exp.employment_type, 'start_date', exp.start_date, 'end_date', exp.end_date, 'is_current', exp.is_current, 'description', exp.description, 'created_at', exp.created_at, 'updated_at', exp.updated_at))
          FROM user_experiences exp
          WHERE exp.user_id = u.id
        ), JSON_ARRAY()) as experiences`),
        db.raw(`(
          SELECT JSON_OBJECT('id', p.id, 'title', p.title, 'content', p.content, 'visibility', p.visibility, 'community_id', p.community_id, 'page_id', p.page_id, 'created_at', p.created_at, 'updated_at', p.updated_at)
          FROM posts p
          WHERE p.user_id = u.id
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT 1
        ) as latest_post`),
        db.raw(`(
          SELECT JSON_OBJECT('id', q.id, 'title', q.title, 'body', q.body, 'visibility', q.visibility, 'community_id', q.community_id, 'is_closed', q.is_closed, 'created_at', q.created_at, 'updated_at', q.updated_at)
          FROM questions q
          WHERE q.user_id = u.id
          ORDER BY q.created_at DESC, q.id DESC
          LIMIT 1
        ) as latest_question`),
        db.raw(`(
          SELECT JSON_OBJECT('id', j.id, 'slug', j.slug, 'title', j.title, 'companyName', j.company_name, 'location', j.location, 'type', j.type, 'status', j.status, 'createdAt', j.created_at, 'updatedAt', j.updated_at)
          FROM jobs j
          WHERE j.created_by_user_id = u.id
          ORDER BY j.created_at DESC, j.id DESC
          LIMIT 1
        ) as latest_job`),
        db.raw(`(
          SELECT JSON_OBJECT('id', fj.id, 'slug', fj.slug, 'title', fj.title, 'companyName', fj.company_name, 'location', fj.location, 'type', fj.type, 'status', fj.status, 'createdAt', fj.created_at, 'updatedAt', fj.updated_at)
          FROM freelance_jobs fj
          WHERE fj.posted_by_user_id = u.id
          ORDER BY fj.created_at DESC, fj.id DESC
          LIMIT 1
        ) as latest_freelance_job`),
        db.raw(`(
          SELECT JSON_OBJECT('id', pg.id, 'name', pg.name, 'slug', pg.slug, 'description', pg.description, 'isActive', pg.is_active, 'createdAt', pg.created_at, 'updatedAt', pg.updated_at)
          FROM pages pg
          WHERE pg.owner_id = u.id
          ORDER BY pg.created_at DESC, pg.id DESC
          LIMIT 1
        ) as latest_page`)
      )
      .orderBy('u.created_at', 'desc');

    if (userId) query.where('u.id', userId);

    const rows = await query.limit(safeLimit).offset(safeOffset);

    return rows.map(row => this.mapUserActivityRow(row));
  }

  async findWithActivity(id) {
    const rows = await this.listWithActivity({ limit: 1, offset: 0, userId: id });
    return rows[0] || null;
  }

  async findPublicProfileById(id) {
    const sql = `
      SELECT
        u.id,
        up.display_name as displayName,
        up.username,
        up.avatar,
        up.bio,
        up.location,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'skill', s.skill, 'level', s.level)) FROM user_skills s WHERE s.user_id = u.id), JSON_ARRAY()) as skills,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', edu.id, 'school', edu.school, 'degree', edu.degree, 'field', edu.field, 'start_date', edu.start_date, 'end_date', edu.end_date)) FROM user_education edu WHERE edu.user_id = u.id), JSON_ARRAY()) as education,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', exp.id, 'company', exp.company, 'title', exp.title, 'employment_type', exp.employment_type, 'start_date', exp.start_date, 'end_date', exp.end_date, 'is_current', exp.is_current, 'description', exp.description)) FROM user_experiences exp WHERE exp.user_id = u.id), JSON_ARRAY()) as experiences,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pfo.id, 'title', pfo.title, 'description', pfo.description, 'link', pfo.link, 'pictures', IFNULL(pfo.pictures, JSON_ARRAY()))) FROM user_portfolios pfo WHERE pfo.user_id = u.id), JSON_ARRAY()) as portfolios,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', p.id, 'title', p.title, 'content', p.content, 'visibility', p.visibility, 'community_id', p.community_id, 'page_id', p.page_id, 'created_at', p.created_at, 'updated_at', p.updated_at)) FROM posts p WHERE p.user_id = u.id AND p.visibility = 'public'), JSON_ARRAY()) as posts,
        (SELECT COUNT(*) FROM followers f WHERE f.following_id = u.id) as followerCount,
        (SELECT COUNT(*) FROM post_reactions pr JOIN posts p ON p.id = pr.post_id WHERE p.user_id = u.id) as postScore,
        (SELECT COUNT(*) FROM comment_reactions cr JOIN comments cm ON cm.id = cr.comment_id WHERE cm.user_id = u.id) as commentScore
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `;
    const res = await db.raw(sql, [id]);
    const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : (res.rows || res[0] || res);
    const row = rows && rows.length ? rows[0] : null;
    if (!row) return null;
    const postScore = parseInt(row.postScore || 0, 10);
    const commentScore = parseInt(row.commentScore || 0, 10);
    return {
      id: row.id,
      name: row.displayName || row.username || null,
      displayName: row.displayName || null,
      username: row.username || null,
      avatar: row.avatar || null,
      bio: row.bio || null,
      location: row.location || null,
      skills: parseJsonArray(row.skills),
      education: parseJsonArray(row.education),
      experiences: parseJsonArray(row.experiences),
      portfolios: parseJsonArray(row.portfolios),
      posts: parseJsonArray(row.posts),
      scoreTotals: { posts: postScore, comments: commentScore, total: postScore + commentScore },
      followerCount: parseInt(row.followerCount || 0, 10)
    };
  }

  async countAll() {
    const row = await db('users').count({ cnt: 'id' }).first();
    return numberFromRow(row);
  }

  async countPages(userId) {
    const row = await db('pages').where({ owner_id: userId }).count({ cnt: 'id' }).first();
    return numberFromRow(row);
  }

  async countCommunities(userId) {
    const row = await db('community_members').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return numberFromRow(row);
  }

  async countPosts(userId) {
    const row = await db('posts').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return numberFromRow(row);
  }

  async countQuestions(userId) {
    const row = await db('questions').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return numberFromRow(row);
  }

  async countComments(userId) {
    const row = await db('comments').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return numberFromRow(row);
  }

  async countAnswers(userId) {
    const row = await db('answers').where({ user_id: userId }).count({ cnt: 'id' }).first();
    return numberFromRow(row);
  }
}
