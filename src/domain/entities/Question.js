export default class Question {
  constructor({ id = null, userId = null, communityId = null, title = '', body = '', visibility = 'public', isClosed = false, acceptedAnswerId = null, createdAt = null, updatedAt = null, answers = [] } = {}) {
    this.id = id;
    this.userId = userId;
    this.communityId = communityId;
    this.title = title;
    this.body = body;
    this.visibility = visibility;
    this.isClosed = !!isClosed;
    this.acceptedAnswerId = acceptedAnswerId;
    this.createdAt = createdAt instanceof Date ? createdAt : (createdAt ? new Date(createdAt) : null);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : (updatedAt ? new Date(updatedAt) : null);
    this.answers = answers;
  }

  toRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      community_id: this.communityId,
      title: this.title,
      body: this.body,
      visibility: this.visibility,
      is_closed: this.isClosed ? 1 : 0,
      accepted_answer_id: this.acceptedAnswerId,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      userId: this.userId,
      communityId: this.communityId,
      title: this.title,
      body: this.body,
      visibility: this.visibility,
      isClosed: !!this.isClosed,
      acceptedAnswerId: this.acceptedAnswerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      answers: this.answers
    };
  }
}
