import UserProfile from '../../domain/entities/UserProfile.js';

export class UserProfileRepository {
  async findByUserId(userId) {
    throw new Error('findByUserId() not implemented');
  }
  async create(profile) {
    throw new Error('create() not implemented');
  }
  async update(id, patch) {
    throw new Error('update() not implemented');
  }
}

export class UserProfileRepositoryImpl extends UserProfileRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async findByUserId(userId) {
    const row = await this.adapter.findByUserId(userId);
    return row ? new UserProfile(row) : null;
  }

  async create(profile) {
    const record = profile && profile.toRecord ? profile.toRecord() : profile;
    const created = await this.adapter.create(record);
    return created ? new UserProfile(created) : null;
  }

  async update(id, patch) {
    const updated = await this.adapter.update(id, patch);
    return updated ? new UserProfile(updated) : null;
  }
}
