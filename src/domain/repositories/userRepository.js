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
  async deleteOtp(id) {
    throw new Error('deleteOtp() not implemented');
  }
  async deleteExpiredOtps(olderThanHours = 24) {
    throw new Error('deleteExpiredOtps() not implemented');
  }
  async updatePassword(userId, hashedPassword) {
    throw new Error('updatePassword() not implemented');
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
}
