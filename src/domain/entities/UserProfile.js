export default class UserProfile {
  constructor({ id = null, user_id = null, username = null, bio = null, location = null, avatar = null, banner = null, website = null, linkedin = null, github = null, created_at = null } = {}) {
    this.id = id;
    this.userId = user_id || null;
    this.username = username || null;
    this.bio = bio || null;
    this.location = location || null;
    this.avatar = avatar || null;
    this.banner = banner || null;
    this.website = website || null;
    this.linkedin = linkedin || null;
    this.github = github || null;
    this.createdAt = created_at ? new Date(created_at) : null;
  }

  toRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      username: this.username,
      bio: this.bio,
      location: this.location,
      avatar: this.avatar,
      banner: this.banner,
      website: this.website,
      linkedin: this.linkedin,
      github: this.github,
      created_at: this.createdAt
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      userId: this.userId,
      username: this.username,
      bio: this.bio,
      location: this.location,
      avatar: this.avatar,
      banner: this.banner,
      website: this.website,
      linkedin: this.linkedin,
      github: this.github,
      createdAt: this.createdAt ? (this.createdAt instanceof Date ? this.createdAt.toISOString() : String(this.createdAt)) : null
    };
  }
}
