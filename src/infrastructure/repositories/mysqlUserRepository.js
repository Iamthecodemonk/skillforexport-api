import db from '../knexConfig.js';
import User from '../../domain/entities/User.js';

export default class MysqlUserRepository {
  async findByEmail(email) {
    const user = await db('users').where({ email }).first();
    return user ? new User(user) : null;
  }

  async findById(id) {
    const user = await db('users').where({ id }).first();
    return user ? new User(user) : null;
  }

  async create(user) {
    const record = user.toRecord ? user.toRecord() : user;
    const now = new Date();
    await db('users').insert({
      id: record.id,
      email: record.email,
      password: record.password,
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

  async createOtp(otp) {
    const now = new Date();
    await db('user_otps').insert({
      id: otp.id,
      user_id: otp.userId,
      email: otp.email,
      otp_code: otp.otpCode,
      purpose: otp.purpose || 'login',
      is_used: otp.isUsed || false,
      temp_password_hash: otp.tempPasswordHash || null,
      temp_profile_full_name: otp.tempProfileFullName || null,
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
}
