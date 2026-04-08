export default class UserEducation {
  constructor({ id = null, userId = null, school = null, degree = null, field = null, startDate = null, endDate = null, createdAt = null }) {
    this.id = id;
    this.userId = userId;
    this.school = school;
    this.degree = degree;
    this.field = field;
    this.startDate = startDate ? new Date(startDate) : startDate;
    this.endDate = endDate ? new Date(endDate) : endDate;
    this.createdAt = createdAt ? new Date(createdAt) : createdAt;
  }

  toRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      school: this.school,
      degree: this.degree,
      field: this.field,
      start_date: this.startDate,
      end_date: this.endDate
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      userId: this.userId,
      school: this.school,
      degree: this.degree,
      field: this.field,
      startDate: this.startDate,
      endDate: this.endDate,
      createdAt: this.createdAt
    };
  }
}
