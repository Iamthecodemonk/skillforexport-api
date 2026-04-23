import User from '../../domain/entities/User.js';

// Repository interface / base class
export class UserRepository {
  constructor() {}
  async findByEmail(email) {
    throw new Error('findByEmail() not implemented');
  }
  async findById(id) {
    throw new Error('findById() not implemented');
  }
  async create(user) {
    throw new Error('create() not implemented');
  }
  async createOtp(otp) {
    throw new Error('createOtp() not implemented');
  }
  async findValidOtp(email, otpCode, purpose) {
    throw new Error('findValidOtp() not implemented');
  }
  async markOtpUsed(id) {
    throw new Error('markOtpUsed() not implemented');
  }
  async markOtpVerified(id) {
    throw new Error('markOtpVerified() not implemented');
  }
  async findLatestOtpByEmailPurpose(email, purpose) {
    throw new Error('findLatestOtpByEmailPurpose() not implemented');
  }
  async updateOtpTempPassword(id, hashedPassword) {
    throw new Error('updateOtpTempPassword() not implemented');
  }
  async deleteOtpsByEmailPurpose(email, purpose) {
    throw new Error('deleteOtpsByEmailPurpose() not implemented');
  }
  async deleteOtp(id) {
    throw new Error('deleteOtp() not implemented');
  }
  async deleteExpiredOtps(olderThanHours = 24) {
    throw new Error('deleteExpiredOtps() not implemented');
  }
  async updatePassword(userId, hashedPassword) {
    throw new Error('updatePassword() not implemented');
  }
  async findFullProfileById(id) {
    throw new Error('findFullProfileById() not implemented');
  }
}

// Concrete implementation that delegates to a persistence adapter
export class UserRepositoryImpl extends UserRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async findByEmail(email) {
    const row = await this.adapter.findByEmail(email);
    return row ? new User(row) : null;
  }

  async findById(id) {
    const row = await this.adapter.findById(id);
    return row ? new User(row) : null;
  }

  async create(user) {
    const record = user && user.toRecord ? user.toRecord() : user;
    const created = await this.adapter.create(record);
    return created ? new User(created) : null;
  }

  async createOtp(otp) {
    return this.adapter.createOtp(otp);
  }

  async findValidOtp(email, otpCode, purpose) {
    return this.adapter.findValidOtp(email, otpCode, purpose);
  }

  async markOtpUsed(id) {
    return this.adapter.markOtpUsed(id);
  }

  async markOtpVerified(id) {
    return this.adapter.markOtpVerified(id);
  }

  async findLatestOtpByEmailPurpose(email, purpose) {
    return this.adapter.findLatestOtpByEmailPurpose(email, purpose);
  }

  async updateOtpTempPassword(id, hashedPassword) {
    return this.adapter.updateOtpTempPassword(id, hashedPassword);
  }

  async deleteOtpsByEmailPurpose(email, purpose) {
    return this.adapter.deleteOtpsByEmailPurpose(email, purpose);
  }

  async deleteOtp(id) {
    return this.adapter.deleteOtp(id);
  }

  async deleteExpiredOtps(olderThanHours = 24) {
    return this.adapter.deleteExpiredOtps ? this.adapter.deleteExpiredOtps(olderThanHours) : null;
  }

  async updatePassword(userId, hashedPassword) {
    const updated = await this.adapter.updatePassword(userId, hashedPassword);
    return updated ? new User(updated) : null;
  }

  async findFullProfileById(id) {
    return this.adapter.findFullProfileById ? await this.adapter.findFullProfileById(id) : null;
  }

  async countPages(userId) {
    return this.adapter.countPages ? await this.adapter.countPages(userId) : 0;
  }

  async countCommunities(userId) {
    return this.adapter.countCommunities ? await this.adapter.countCommunities(userId) : 0;
  }

  async countPosts(userId) {
    return this.adapter.countPosts ? await this.adapter.countPosts(userId) : 0;
  }

  async countComments(userId) {
    return this.adapter.countComments ? await this.adapter.countComments(userId) : 0;
  }
}
