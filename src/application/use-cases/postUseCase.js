import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const postLogger = logger.child('POST_USECASE');

export default class PostUseCase {
  constructor({ postRepository }) {
    this.postRepository = postRepository;
  }

  async CreatePost({ userId, communityId = null, pageId = null, title, content, visibility = null }) {
    if (!userId) throw new Error('user_required');
    if (!title || String(title).trim() === '') throw new Error('title_required');
    if (!content || String(content).trim() === '') throw new Error('content_required');
    // If posting to a community, ensure community exists and user is allowed
    if (communityId) {
      if (this.communityRepository && typeof this.communityRepository.findById === 'function') {
        const community = await this.communityRepository.findById(communityId);
        if (!community) throw new Error('community_not_found');
        if (typeof community.is_active !== 'undefined' && parseInt(community.is_active, 10) === 0) {
          throw new Error('community_inactive');
        }
      }
      if (this.communityMemberRepository && typeof this.communityMemberRepository.findByUserAndCommunity === 'function') {
        const member = await this.communityMemberRepository.findByUserAndCommunity(userId, communityId);
        if (!member) throw new Error('not_a_member');
      }
      // If no explicit visibility provided, and community defines a default, use it
      if (!visibility && community && community.default_post_visibility) {
        visibility = community.default_post_visibility;
      }
    }
    const post = {
      id: uuidv4(),
      user_id: userId,
      community_id: communityId,
      page_id: pageId,
      visibility: visibility || 'public',
      title: String(title),
      content: String(content)
    };
    const created = await this.postRepository.create(post);
    try {
      if (pageId && this.pageRepository && typeof this.pageRepository.incrementPostCount === 'function') {
        await this.pageRepository.incrementPostCount(pageId, 1);
      }
    } catch (e) {
      postLogger.warn('incrementPostCount failed', { message: e && e.message });
    }
    return created;
  }

  async GetPost(id) {
    if (!id) throw new Error('id_required');
    const row = await this.postRepository.findById(id);
    if (!row) throw new Error('post_not_found');
    return row;
  }

  async ListPosts({ limit = 20, offset = 0, lastCreatedAt = null, lastId = null } = {}) {
    return this.postRepository.list({ limit, offset, lastCreatedAt, lastId });
  }

  async UpdatePost({ id, userId, title, content }) {
    if (!id) throw new Error('id_required');
    const existing = await this.postRepository.findById(id);
    if (!existing) throw new Error('post_not_found');
    if (existing.user_id !== userId) throw new Error('not_authorized');
    return this.postRepository.update(id, { title, content });
  }

  async DeletePost({ id, userId }) {
    if (!id) throw new Error('id_required');
    const existing = await this.postRepository.findById(id);
    if (!existing) throw new Error('post_not_found');
    if (existing.user_id !== userId) throw new Error('not_authorized');
    await this.postRepository.delete(id);
    try {
      if (existing && existing.page_id && this.pageRepository && typeof this.pageRepository.incrementPostCount === 'function') {
        await this.pageRepository.incrementPostCount(existing.page_id, -1);
      }
    } catch (e) {
      postLogger.warn('decrementPostCount failed', { message: e && e.message });
    }
    return { id };
  }
}
