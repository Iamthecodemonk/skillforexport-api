export default class Answer {
  constructor({
    id = null,
    questionId = null,
    question_id = null,
    userId = null,
    user_id = null,
    parentAnswerId = null,
    parent_answer_id = null,
    content = '',
    createdAt = null,
    created_at = null,
    updatedAt = null,
    updated_at = null,
    user = null
  } = {}) {
    this.id = id;
    this.questionId = questionId || question_id;
    this.userId = userId || user_id;
    this.parentAnswerId = parentAnswerId || parent_answer_id;
    this.content = content;
    this.createdAt = createdAt instanceof Date ? createdAt : ((createdAt || created_at) ? new Date(createdAt || created_at) : null);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : ((updatedAt || updated_at) ? new Date(updatedAt || updated_at) : null);
    this.user = user;
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
      updatedAt: this.updatedAt,
      user: this.user
    };
  }
}
