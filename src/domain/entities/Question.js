export default class Question {
  constructor({
    id = null,
    userId = null,
    user_id = null,
    communityId = null,
    community_id = null,
    title = '',
    body = '',
    visibility = 'public',
    isClosed = false,
    is_closed = false,
    acceptedAnswerId = null,
    accepted_answer_id = null,
    createdAt = null,
    created_at = null,
    updatedAt = null,
    updated_at = null,
    asker = null,
    user = null,
    community = null,
    totalAnswers = 0,
    total_answers = 0,
    totalAnswerers = 0,
    total_answerers = 0,
    answers = [],
    type = 'QUESTION'
  } = {}) {
    this.id = id;
    this.userId = userId || user_id;
    this.communityId = communityId || community_id;
    this.title = title;
    this.body = body;
    this.visibility = visibility;
    this.isClosed = !!(isClosed || is_closed);
    this.acceptedAnswerId = acceptedAnswerId || accepted_answer_id;
    this.createdAt = createdAt instanceof Date ? createdAt : ((createdAt || created_at) ? new Date(createdAt || created_at) : null);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : ((updatedAt || updated_at) ? new Date(updatedAt || updated_at) : null);
    this.asker = asker;
    this.user = user || asker;
    this.community = community;
    this.totalAnswers = parseInt(totalAnswers || total_answers || 0, 10);
    this.totalAnswerers = parseInt(totalAnswerers || total_answerers || 0, 10);
    this.answers = answers;
    this.type = type || 'QUESTION';
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
      asker: this.asker,
      user: this.user,
      community: this.community,
      totalAnswers: this.totalAnswers,
      totalAnswerers: this.totalAnswerers,
      answers: this.answers,
      type: this.type
    };
  }
}
