export default class Follower {
  constructor({ id = null, follower_id = null, following_id = null, created_at = null } = {}) {
    this.id = id;
    this.followerId = follower_id || null;
    this.followingId = following_id || null;
    this.createdAt = created_at ? new Date(created_at) : null;
  }

  toRecord() {
    return { id: this.id, follower_id: this.followerId, following_id: this.followingId, created_at: this.createdAt };
  }

  toPlainObject() {
    return { id: this.id, followerId: this.followerId, followingId: this.followingId };
  }
}
