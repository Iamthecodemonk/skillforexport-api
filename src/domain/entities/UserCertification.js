export default class UserCertification {
  constructor({ id = null, userId = null, name = null, issuer = null, issueDate = null, createdAt = null }) {
    this.id = id;
    this.userId = userId;
    this.name = name;
    this.issuer = issuer;
    this.issueDate = issueDate ? new Date(issueDate) : issueDate;
    this.createdAt = createdAt ? new Date(createdAt) : createdAt;
  }

  toRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      name: this.name,
      issuer: this.issuer,
      issue_date: this.issueDate
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      issuer: this.issuer,
      issueDate: this.issueDate,
      createdAt: this.createdAt
    };
  }
}
