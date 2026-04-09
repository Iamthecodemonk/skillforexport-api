import logger from '../../utils/logger.js';

const piLogger = logger.child('POST_INTERACTION_USECASE');

export default class PostInteractionUseCase {
  constructor({ postSaveRepository = null, postReportRepository = null }) {
    this.postSaveRepository = postSaveRepository;
    this.postReportRepository = postReportRepository;
  }

  async toggleSave({ postId, userId }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    return this.postSaveRepository.toggle({ user_id: userId, post_id: postId });
  }

  async reportPost({ postId, userId, reason = null, details = null }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    const report = { postId, userId, reason, details };
    return this.postReportRepository.create({ post_id: postId, user_id: userId, reason, details });
  }
}
