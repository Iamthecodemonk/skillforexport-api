import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const commentLogger = logger.child('COMMENT_USECASE');

export default class CommentUseCase {
  constructor({ commentRepository }) {
    this.commentRepository = commentRepository;
  }

  async createComment({ postId, userId, parentCommentId = null, content }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    if (!content || String(content).trim() === '') throw new Error('content_required');
    const comment = {
      id: uuidv4(),
      post_id: postId,
      user_id: userId,
      parent_comment_id: parentCommentId,
      content: String(content)
    };
    return this.commentRepository.create(comment);
  }

  async listCommentsByPost(postId, { limit = 50, offset = 0 } = {}) {
    if (!postId) throw new Error('post_required');
    return this.commentRepository.listByPost(postId, { limit, offset });
  }
}
