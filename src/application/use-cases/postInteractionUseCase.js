import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import db from '../../infrastructure/knexConfig.js';

const piLogger = logger.child('POST_INTERACTION_USECASE');

export default class PostInteractionUseCase {
  constructor({ postSaveRepository = null, postReportRepository = null, commentReportRepository = null }) {
    this.postSaveRepository = postSaveRepository;
    this.postReportRepository = postReportRepository;
    this.commentReportRepository = commentReportRepository;
  }

  async toggleSave({ postId, userId }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    const result = await this.postSaveRepository.toggle({ user_id: userId, post_id: postId });
    return {
      postId,
      userId,
      saved: result && result.action !== 'removed'
    };
  }

  async reportPost({ postId, userId, reason = null, details = null }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    const payload = { id: uuidv4(), user_id: userId, target_id: postId, target_type: 'post', reason, details, created_at: new Date() };
    await db('generic_reports').insert(payload);
    return payload;
  }

  async reportComment({ commentId, userId, reason = null, details = null }) {
    if (!commentId) throw new Error('comment_required');
    if (!userId) throw new Error('user_required');
    const payload = { id: uuidv4(), user_id: userId, target_id: commentId, target_type: 'comment', reason, details, created_at: new Date() };
    await db('generic_reports').insert(payload);
    return payload;
  }
}
