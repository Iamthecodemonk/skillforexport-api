import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const postLogger = logger.child('POST_USECASE');

export default class PostUseCase {
  constructor({ postRepository }) {
    this.postRepository = postRepository;
  }

  async CreatePost({ userId, communityId = null, content }) {
    if (!userId) throw new Error('user_required');
    if (!content || String(content).trim() === '') throw new Error('content_required');
    const post = {
      id: uuidv4(),
      user_id: userId,
      community_id: communityId,
      content: String(content)
    };
    return this.postRepository.create(post);
  }

  async GetPost(id) {
    if (!id) throw new Error('id_required');
    const row = await this.postRepository.findById(id);
    if (!row) throw new Error('post_not_found');
    return row;
  }

  async ListPosts({ limit = 20, offset = 0 } = {}) {
    return this.postRepository.list({ limit, offset });
  }

  async UpdatePost({ id, userId, content }) {
    if (!id) throw new Error('id_required');
    const existing = await this.postRepository.findById(id);
    if (!existing) throw new Error('post_not_found');
    if (existing.user_id !== userId) throw new Error('not_authorized');
    return this.postRepository.update(id, { content });
  }

  async DeletePost({ id, userId }) {
    if (!id) throw new Error('id_required');
    const existing = await this.postRepository.findById(id);
    if (!existing) throw new Error('post_not_found');
    if (existing.user_id !== userId) throw new Error('not_authorized');
    await this.postRepository.delete(id);
    return { id };
  }
}
