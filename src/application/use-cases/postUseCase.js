import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const postLogger = logger.child('POST_USECASE');

export default class PostUseCase {
  constructor({ postRepository, notificationRepository = null }) {
    this.postRepository = postRepository;
    this.notificationRepository = notificationRepository;
  }

  async CreatePost({ userId, communityId = null, pageId = null, title, content, visibility = null, parentPostId = null, originalPostId = null, mediaAssetIds = [] }) {
    if (!userId) throw new Error('user_required');
    if (!title || String(title).trim() === '') throw new Error('title_required');
    if (!content || String(content).trim() === '') throw new Error('content_required');
    // If posting to a community, ensure community exists and user is allowed
    let community = null;
    if (communityId) {
      if (this.communityRepository && typeof this.communityRepository.findById === 'function') {
        community = await this.communityRepository.findById(communityId);
        if (!community) throw new Error('community_not_found');
        if (typeof community.is_active !== 'undefined' && parseInt(community.is_active, 10) === 0) {
          throw new Error('community_inactive');
        }
      }
      const membersOnlyPosting = typeof community.members_only_posting === 'undefined'
        ? true
        : !(community.members_only_posting === 0 || community.members_only_posting === false || community.members_only_posting === '0');
      if (membersOnlyPosting && this.communityMemberRepository && typeof this.communityMemberRepository.findByUserAndCommunity === 'function') {
        const member = await this.communityMemberRepository.findByUserAndCommunity(userId, communityId);
        if (!member) throw new Error('not_a_member');
      }
      // If no explicit visibility provided, and community defines a default, use it
      if (!visibility && community && community.default_post_visibility) {
        visibility = community.default_post_visibility;
      }
    }
    // Validate provided media assets (if any) to ensure uploads completed
    let mediaAssets = [];
    if (Array.isArray(mediaAssetIds) && mediaAssetIds.length > 0) {
      const assetIds = mediaAssetIds;
      if (!this.assetRepository || typeof this.assetRepository.findById !== 'function') {
        throw new Error('media_validation_unavailable');
      }
      for (const aid of assetIds) {
        const asset = await this.assetRepository.findById(aid).catch(() => null);
        if (!asset || !asset.url) {
          // asset missing or not yet processed/uploaded
          throw new Error('media_not_ready');
        }
        mediaAssets.push(asset);
      }
    }

    const post = {
      id: uuidv4(),
      user_id: userId,
      community_id: communityId,
      page_id: pageId,
      parent_post_id: parentPostId || originalPostId || null,
      visibility: visibility || 'public',
      title: String(title),
      content: String(content)
    };
    let created = await this.postRepository.create(post);
    if (mediaAssets.length > 0 && this.postMediaRepository && typeof this.postMediaRepository.create === 'function') {
      let displayOrder = 0;
      for (const asset of mediaAssets) {
        const mimeType = asset.mime_type || asset.mimeType || '';
        const mediaType = String(mimeType).startsWith('video/') || asset.kind === 'video' ? 'video' : 'image';
        await this.postMediaRepository.create({
          post_id: created.id,
          media_type: mediaType,
          url: asset.url,
          thumbnail_url: asset.url,
          display_order: displayOrder++
        });
      }
      created = await this.postRepository.findById(created.id, { userId });
    }
    try {
      if (pageId && this.pageRepository && typeof this.pageRepository.incrementPostCount === 'function') {
        await this.pageRepository.incrementPostCount(pageId, 1);
      }
    } catch (e) {
      postLogger.warn('incrementPostCount failed', { message: e && e.message });
    }
    if (this.notificationRepository) {
      try {
        if (pageId && this.pageRepository && typeof this.pageRepository.findById === 'function') {
          const page = await this.pageRepository.findById(pageId);
          await this.notificationRepository.create({
            userId: page && (page.ownerId || page.owner_id),
            actorUserId: userId,
            type: 'page_post',
            title: 'New post on your page',
            body: `A new post was created on ${page && page.name ? page.name : 'your page'}.`,
            target: { type: 'post', id: created.id, title: created.title, url: `/posts/${created.id}` },
            metadata: { pageId }
          });
        } else if (communityId && community && (community.owner_id || community.ownerId)) {
          await this.notificationRepository.create({
            userId: community.owner_id || community.ownerId,
            actorUserId: userId,
            type: 'community_post',
            title: 'New post in your community',
            body: `A new post was created in ${community.name || 'your community'}.`,
            target: { type: 'post', id: created.id, title: created.title, url: `/posts/${created.id}` },
            metadata: { communityId }
          });
        }
      } catch (notifyErr) {
        postLogger.warn('post notification failed', { message: notifyErr && notifyErr.message });
      }
    }
    return created;
  }

  async GetPost(id, { userId = null } = {}) {
    if (!id) throw new Error('id_required');
    const row = await this.postRepository.findById(id, { userId });
    if (!row) throw new Error('post_not_found');
    return row;
  }

  async ListPosts({ limit = 20, offset = 0, lastCreatedAt = null, lastId = null, userId = null, communityId = null } = {}) {
    return this.postRepository.list({ limit, offset, lastCreatedAt, lastId, userId, communityId });
  }

  async SharePost({ postId, userId, communityId, comment = null }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    if (!communityId) throw new Error('community_required');

    const original = await this.postRepository.findById(postId, { userId });
    if (!original) throw new Error('post_not_found');

    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
    const shared = await this.CreatePost({
      userId,
      communityId,
      title: original.title ? `Shared: ${original.title}` : 'Shared post',
      content: trimmedComment || original.content || 'Shared a post',
      visibility: 'community',
      parentPostId: original.id
    });

    return {
      ...shared,
      originalPostId: original.id,
      comment: trimmedComment,
      communityId: shared.community_id || communityId,
      createdAt: shared.created_at
    };
  }

  async RecordShareEvent({ postId, userId, type = 'copy_link' }) {
    if (!postId) throw new Error('post_required');
    if (!userId) throw new Error('user_required');
    const post = await this.postRepository.findById(postId, { userId });
    if (!post) throw new Error('post_not_found');
    return { postId, userId, type: type || 'copy_link', recorded: true, createdAt: new Date().toISOString() };
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
