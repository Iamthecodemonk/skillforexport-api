export default class UserPortfolio {
  constructor({ id = null, user_id = null, title = null, description = null, link = null } = {}) {
    this.id = id;
    this.userId = user_id || null;
    this.title = title || null;
    this.description = description || null;
    this.link = link || null;
  }

  toRecord() {
    return { id: this.id, user_id: this.userId, title: this.title, description: this.description, link: this.link };
  }

  toPlainObject() {
    return { id: this.id, userId: this.userId, title: this.title, description: this.description, link: this.link };
  }
}
