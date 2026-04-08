export default class UserOauthAccount {
  constructor({ id = null, user_id = null, provider = null, provider_id = null, provider_email = null, avatar_url = null, raw_data = null, created_at = null, updated_at = null } = {}) {
    this.id = id;
    this.userId = user_id || null;
    this.provider = provider || null;
    this.providerId = provider_id || null;
    this.providerEmail = provider_email || null;
    this.avatarUrl = avatar_url || null;
    this.rawData = raw_data || null;
    this.createdAt = created_at ? new Date(created_at) : null;
    this.updatedAt = updated_at ? new Date(updated_at) : null;
  }

  toRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      provider: this.provider,
      provider_id: this.providerId,
      provider_email: this.providerEmail,
      avatar_url: this.avatarUrl,
      raw_data: this.rawData,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      userId: this.userId,
      provider: this.provider,
      providerId: this.providerId,
      providerEmail: this.providerEmail,
      avatarUrl: this.avatarUrl
    };
  }
}
