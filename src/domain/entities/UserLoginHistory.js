export default class UserLoginHistory {
  constructor({ id = null, user_id = null, login_method = null, ip_address = null, user_agent = null, login_at = null } = {}) {
    this.id = id;
    this.userId = user_id || null;
    this.loginMethod = login_method || null;
    this.ipAddress = ip_address || null;
    this.userAgent = user_agent || null;
    this.loginAt = login_at ? new Date(login_at) : null;
  }

  toRecord() {
    return { id: this.id, user_id: this.userId, login_method: this.loginMethod, ip_address: this.ipAddress, user_agent: this.userAgent, login_at: this.loginAt };
  }

  toPlainObject() {
    return { id: this.id, userId: this.userId, loginMethod: this.loginMethod, ipAddress: this.ipAddress, loginAt: this.loginAt };
  }
}
