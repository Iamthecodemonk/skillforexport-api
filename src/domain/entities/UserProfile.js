export default class UserProfile {
  constructor({ id = null, user_id = null, username = null, display_name = null, displayName = null, bio = null, location = null, avatar = null, banner = null, website = null, linkedin = null, github = null, current_job_title = null, currentJobTitle = null, current_workspace = null, currentWorkspace = null, created_at = null } = {}) {
    this.id = id;
    this.userId = user_id || null;
    this.username = username || null;
    this.displayName = displayName || display_name || null;
    this.bio = bio || null;
    this.location = location || null;
    this.avatar = avatar || null;
    this.banner = banner || null;
    this.website = website || null;
    this.linkedin = linkedin || null;
    this.github = github || null;
    this.currentJobTitle = currentJobTitle || current_job_title || null;
    this.currentWorkspace = currentWorkspace || current_workspace || null;
    this.createdAt = created_at ? new Date(created_at) : null;
  }

  toRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      username: this.username,
      display_name: this.displayName,
      bio: this.bio,
      location: this.location,
      avatar: this.avatar,
      banner: this.banner,
      website: this.website,
      linkedin: this.linkedin,
      github: this.github,
      current_job_title: this.currentJobTitle,
      current_workspace: this.currentWorkspace,
      created_at: this.createdAt
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      userId: this.userId,
      username: this.username,
      displayName: this.displayName,
      bio: this.bio,
      location: this.location,
      avatar: this.avatar,
      banner: this.banner,
      website: this.website,
      linkedin: this.linkedin,
      github: this.github,
      currentJobTitle: this.currentJobTitle,
      current_job_title: this.currentJobTitle,
      currentWorkspace: this.currentWorkspace,
      current_workspace: this.currentWorkspace,
      createdAt: this.createdAt ? (this.createdAt instanceof Date ? this.createdAt.toISOString() : String(this.createdAt)) : null
    };
  }
}
