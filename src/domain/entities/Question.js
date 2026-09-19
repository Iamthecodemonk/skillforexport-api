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
    user = null,
    asker = null,
    community = null,
    totalAnswers = 0,
    total_answers = 0,
    totalAnswerers = 0,
    total_answerers = 0,
    score = 0,
    is_liked = false,
    isLiked = false,
    is_saved = false,
    isSaved = false,
    is_follow = false,
    isFollow = false,
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
    this.user = user || asker;
    this.community = community;
    this.totalAnswers = parseInt(totalAnswers || total_answers || 0, 10);
    this.totalAnswerers = parseInt(totalAnswerers || total_answerers || 0, 10);
    this.score = parseInt(score || 0, 10);
    this.is_liked = [true, 1, '1'].includes(is_liked) || [true, 1, '1'].includes(isLiked);
    this.isLiked = this.is_liked;
    this.is_saved = [true, 1, '1'].includes(is_saved) || [true, 1, '1'].includes(isSaved);
    this.isSaved = this.is_saved;
    this.is_follow = [true, 1, '1'].includes(is_follow) || [true, 1, '1'].includes(isFollow);
    this.isFollow = this.is_follow;
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
      user: this.user,
      community: this.community,
      totalAnswers: this.totalAnswers,
      totalAnswerers: this.totalAnswerers,
      score: this.score,
      is_liked: this.is_liked,
      isLiked: this.isLiked,
      is_saved: this.is_saved,
      isSaved: this.isSaved,
      is_follow: this.is_follow,
      isFollow: this.isFollow,
      answers: this.answers,
      type: this.type
    };
  }
}
