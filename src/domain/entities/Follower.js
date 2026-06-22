const parseJson = (value) => {
  if (!value || typeof value !== 'string') return value || null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export default class Follower {
  constructor({ id = null, follower_id = null, following_id = null, created_at = null, user = null } = {}) {
    this.id = id;
    this.followerId = follower_id || null;
    this.followingId = following_id || null;
    this.createdAt = created_at ? new Date(created_at) : null;
    this.user = parseJson(user);
  }

  toRecord() {
    return { id: this.id, follower_id: this.followerId, following_id: this.followingId, created_at: this.createdAt };
  }

  toPlainObject() {
    return {
      id: this.id,
      followerId: this.followerId,
      followingId: this.followingId,
      createdAt: this.createdAt,
      ...(this.user ? { user: this.user } : {})
    };
  }
}
