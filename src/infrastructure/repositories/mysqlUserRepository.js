import db from '../knexConfig.js';
import User from '../../domain/entities/User.js';

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

  async create(user) {
    const record = user.toRecord ? user.toRecord() : user;
    const now = new Date();
    await db('users').insert({
      id: record.id,
      email: record.email,
      password: record.password,
      token_version: record.token_version || 0,
      role: record.role || 'user',
      created_at: now,
      updated_at: now,
    });
    return new User({
      id: record.id,
      email: record.email,
      password: record.password,
      role: record.role || 'user',
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
          'bio', up.bio,
          'location', up.location,
          'avatar', up.avatar,
          'banner', up.banner,
          'website', up.website,
          'linkedin', up.linkedin,
          'github', up.github
        ) as profile,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'skill', s.skill, 'level', s.level)) FROM user_skills s WHERE s.user_id = u.id), JSON_ARRAY()) as skills,
        IFNULL((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', p.id, 'title', p.title, 'description', p.description, 'link', p.link)) FROM user_portfolios p WHERE p.user_id = u.id), JSON_ARRAY()) as portfolios,
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

  async countPages(userId) {
    const row = await db('pages').where({ owner_id: userId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countCommunities(userId) {
    const row = await db('community_members').where({ user_id: userId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countPosts(userId) {
    const row = await db('posts').where({ user_id: userId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countComments(userId) {
    const row = await db('comments').where({ user_id: userId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }
}
