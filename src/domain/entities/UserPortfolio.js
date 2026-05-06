export default class UserPortfolio {
  constructor({ id = null, user_id = null, title = null, description = null, link = null, pictures = [] } = {}) {
    this.id = id;
    this.userId = user_id || null;
    this.title = title || null;
    this.description = description || null;
    this.link = link || null;
    this.pictures = this.normalizePictures(pictures);
  }

  normalizePictures(pictures) {
    if (!pictures) return [];
    if (Array.isArray(pictures)) return pictures.filter(Boolean);
    if (typeof pictures === 'string') {
      try {
        const parsed = JSON.parse(pictures);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (e) {
        return pictures ? [pictures] : [];
      }
    }
    return [];
  }

  toRecord() {
    return { id: this.id, user_id: this.userId, title: this.title, description: this.description, link: this.link, pictures: this.pictures };
  }

  toPlainObject() {
    return { id: this.id, userId: this.userId, title: this.title, description: this.description, link: this.link, pictures: this.pictures };
  }
}
