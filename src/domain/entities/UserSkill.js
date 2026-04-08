export default class UserSkill {
  constructor({ id = null, user_id = null, skill = null, level = null } = {}) {
    this.id = id;
    this.userId = user_id || null;
    this.skill = skill || null;
    this.level = level || null;
  }

  toRecord() {
    return { id: this.id, user_id: this.userId, skill: this.skill, level: this.level };
  }

  toPlainObject() {
    return { id: this.id, userId: this.userId, skill: this.skill, level: this.level };
  }
}
