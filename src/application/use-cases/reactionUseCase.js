import logger from '../../utils/logger.js';

const reactionLogger = logger.child('REACTION_USECASE');

export default class ReactionUseCase {
  constructor({ postReactionRepository = null, commentReactionRepository = null }) {
    this.postReactionRepository = postReactionRepository;
    this.commentReactionRepository = commentReactionRepository;
  }

  async togglePostReaction({ postId, userId, type = 'like' }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    const res = await this.postReactionRepository.toggle({ user_id: userId, post_id: postId, type });
    const count = await this.postReactionRepository.countByPost(postId);
    return { result: res, count };
  }

  async toggleCommentReaction({ commentId, userId, type = 'like' }) {
    if (!commentId) throw new Error('comment_required');
    if (!userId) throw new Error('user_required');
    const res = await this.commentReactionRepository.toggle({ user_id: userId, comment_id: commentId, type });
    const count = await this.commentReactionRepository.countByComment(commentId);
    return { result: res, count };
  }
}
