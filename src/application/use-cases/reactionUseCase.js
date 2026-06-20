import logger from '../../utils/logger.js';

const reactionLogger = logger.child('REACTION_USECASE');

export default class ReactionUseCase {
  constructor({ postReactionRepository = null, commentReactionRepository = null, questionReactionRepository = null }) {
    this.postReactionRepository = postReactionRepository;
    this.commentReactionRepository = commentReactionRepository;
    this.questionReactionRepository = questionReactionRepository;
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

  async toggleQuestionReaction({ questionId, userId, type = 'like' }) {
    if (!questionId) throw new Error('question_required');
    if (!userId) throw new Error('user_required');
    const res = await this.questionReactionRepository.toggle({ user_id: userId, question_id: questionId, type });
    const count = await this.questionReactionRepository.countByQuestion(questionId);
    return { result: res, count };
  }
}
