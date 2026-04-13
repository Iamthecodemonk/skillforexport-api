export default class Answer {
  constructor({ id = null, questionId = null, userId = null, parentAnswerId = null, content = '', createdAt = null, updatedAt = null } = {}) {
    this.id = id;
    this.questionId = questionId;
    this.userId = userId;
    this.parentAnswerId = parentAnswerId;
    this.content = content;
    this.createdAt = createdAt instanceof Date ? createdAt : (createdAt ? new Date(createdAt) : null);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : (updatedAt ? new Date(updatedAt) : null);
  }

  toRecord() {
    return {
      id: this.id,
      question_id: this.questionId,
      user_id: this.userId,
      parent_answer_id: this.parentAnswerId,
      content: this.content,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      questionId: this.questionId,
      userId: this.userId,
      parentAnswerId: this.parentAnswerId,
      content: this.content,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}