import Follower from '../../domain/entities/Follower.js';

export class FollowerRepository {
  async listFollowers(userId) {
    throw new Error('listFollowers() not implemented');
  }
  async listFollowing(userId) {
    throw new Error('listFollowing() not implemented');
  }
  async create(follow) {
    throw new Error('create() not implemented');
  }
}

export class FollowerRepositoryImpl extends FollowerRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async listFollowers(userId) {
    const rows = await this.adapter.listFollowers(userId);
    return rows.map(r => new Follower(r));
  }

  async listFollowing(userId) {
    const rows = await this.adapter.listFollowing(userId);
    return rows.map(r => new Follower(r));
  }

  async create(follow) {
    const record = follow && follow.toRecord ? follow.toRecord() : follow;
    const created = await this.adapter.create(record);
    return created ? new Follower(created) : null;
  }

  async deleteByFollowerAndFollowing(followerId, followingId) {
    // Adapter should implement deletion; return deleted record or null
    if (typeof this.adapter.deleteByFollowerAndFollowing === 'function') {
      const deleted = await this.adapter.deleteByFollowerAndFollowing(followerId, followingId);
      return deleted ? new Follower(deleted) : null;
    }
    throw new Error('deleteByFollowerAndFollowing_not_implemented');
  }
}
