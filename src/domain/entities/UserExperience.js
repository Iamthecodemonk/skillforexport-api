export default class UserExperience {
  constructor({ id = null, userId = null, company = null, title = null, employmentType = null, startDate = null, endDate = null, isCurrent = false, description = null, createdAt = null }) {
    this.id = id;
    this.userId = userId;
    this.company = company;
    this.title = title;
    this.employmentType = employmentType;
    this.startDate = startDate ? new Date(startDate) : startDate;
    this.endDate = endDate ? new Date(endDate) : endDate;
    this.isCurrent = !!isCurrent;
    this.description = description;
    this.createdAt = createdAt ? new Date(createdAt) : createdAt;
  }

  toRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      company: this.company,
      title: this.title,
      employment_type: this.employmentType,
      start_date: this.startDate,
      end_date: this.endDate,
      is_current: this.isCurrent,
      description: this.description
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      userId: this.userId,
      company: this.company,
      title: this.title,
      employmentType: this.employmentType,
      startDate: this.startDate,
      endDate: this.endDate,
      isCurrent: this.isCurrent,
      description: this.description,
      createdAt: this.createdAt
    };
  }
}
