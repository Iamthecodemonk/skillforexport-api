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

  async listCommentsByPost(postId, { limit = 50, offset = 0, userId = null } = {}) {
    if (!postId) throw new Error('post_required');
    return this.commentRepository.listByPost(postId, { limit, offset, userId });
  }

  async deleteComment({ id, userId, actorRole = null }) {
    if (!id) throw new Error('comment_required');
    if (!userId) throw new Error('user_required');
    const existing = await this.commentRepository.findById(id, { includeHidden: true });
    if (!existing) throw new Error('comment_not_found');
    if (existing.user_id !== userId && actorRole !== 'admin') throw new Error('not_authorized');
    await this.commentRepository.delete(id);
    return { id };
  }
}
