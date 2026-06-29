import { v4 as uuidv4 } from 'uuid';

export default class CommunityUseCase {
  constructor({ communityRepository = null, communityCategoryRepository = null, communityMemberRepository = null }) {
    this.communityRepository = communityRepository;
    this.communityCategoryRepository = communityCategoryRepository;
    this.communityMemberRepository = communityMemberRepository;
  }

  async createCategory({ id = null, name }) {
    if (!name) throw new Error('validation_failed');
    if (this.communityCategoryRepository && typeof this.communityCategoryRepository.findByName === 'function') {
      const existing = await this.communityCategoryRepository.findByName(name);
      if (existing) throw new Error('category_exists');
    }
    const payload = { id: id || uuidv4(), name };
    return this.communityCategoryRepository.create(payload);
  }

  async updateCategory({ id, updates }) {
    const existing = await this.communityCategoryRepository.findById(id);
    if (!existing) throw new Error('category_not_found');
    if (updates.name) {
      const other = await this.communityCategoryRepository.findByName(updates.name);
      if (other && other.id !== id) throw new Error('category_name_taken');
    }
    return this.communityCategoryRepository.update(id, updates);
  }

  async deleteCategory({ id }) {
    // Optionally unassign communities in this category before delete
    const existing = await this.communityCategoryRepository.findById(id);
    if (!existing) 
        throw new Error('category_not_found');
    return this.communityCategoryRepository.delete(id);
  }

  async getDefaultCategoryId() {
    if (!this.communityCategoryRepository) return null;

    let category = null;
    if (typeof this.communityCategoryRepository.findByName === 'function') {
      category = await this.communityCategoryRepository.findByName('default');
    }

    if (!category && typeof this.communityCategoryRepository.create === 'function') {
      category = await this.communityCategoryRepository.create({ id: uuidv4(), name: 'default' });
    }

    return category ? category.id : null;
  }

  normalizeCommunityVisibility({ defaultPostVisibility = null, isPrivate = null } = {}) {
    if (typeof isPrivate !== 'undefined' && isPrivate !== null && !defaultPostVisibility) {
      return isPrivate === true || isPrivate === 1 || isPrivate === '1' ? 'community' : 'public';
    }
    return defaultPostVisibility || 'public';
  }

  toFlag(value) {
    return value === true || value === 1 || value === '1';
  }

  slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  async createCommunity({ id = null, categoryId = null, name, icon = null, description = null, ownerId = null, defaultPostVisibility = null, membersOnlyPosting = false, isPrivate = null, onlyAdmin = false }) {
    if (!name || !ownerId) 
        throw new Error('validation_failed');
    defaultPostVisibility = this.normalizeCommunityVisibility({ defaultPostVisibility, isPrivate });
    const allowedVisibility = ['public', 'connections', 'community'];
    if (defaultPostVisibility && !allowedVisibility.includes(defaultPostVisibility)) {
      throw new Error('validation_failed');
    }
    const communityCategoryId = categoryId || await this.getDefaultCategoryId();
    const payload = { id: id || uuidv4(), category_id: communityCategoryId, name, icon, description, created_at: new Date(), owner_id: ownerId, default_post_visibility: defaultPostVisibility, is_private: defaultPostVisibility === 'community' ? 1 : 0, members_only_posting: this.toFlag(membersOnlyPosting) ? 1 : 0, only_admin: this.toFlag(onlyAdmin) ? 1 : 0 };
    const created = await this.communityRepository.create(payload);
    // add owner as admin member
    if (this.communityMemberRepository) {
      await this.communityMemberRepository.addMember({ id: uuidv4(), user_id: ownerId, community_id: created.id, role: 'admin' });
    }
    return created;
  }

  async createChannel({ id = null, name, slug = null, icon = null, description = null, ownerId = null }) {
    if (!name || !ownerId) throw new Error('validation_failed');
    const nextSlug = this.slugify(slug || name);
    if (!nextSlug) throw new Error('validation_failed');
    if (this.communityRepository && typeof this.communityRepository.findBySlug === 'function') {
      const existing = await this.communityRepository.findBySlug(nextSlug, { communityType: 'channel' });
      if (existing) throw new Error('slug_taken');
    }
    const created = await this.createCommunity({
      id,
      name,
      icon,
      description,
      ownerId,
      defaultPostVisibility: 'community',
      membersOnlyPosting: true,
      isPrivate: true,
      onlyAdmin: true
    });
    return this.communityRepository.update(created.id, {
      slug: nextSlug,
      community_type: 'channel',
      parent_community_id: null
    });
  }

  async createChannelTopic({ channelId = null, channelSlug = null, id = null, name, slug = null, icon = null, description = null, ownerId = null }) {
    if (!name || !ownerId || (!channelId && !channelSlug)) throw new Error('validation_failed');
    const parent = channelId
      ? await this.communityRepository.findById(channelId)
      : await this.communityRepository.findBySlug(channelSlug, { communityType: 'channel' });
    if (!parent || parent.community_type !== 'channel') throw new Error('channel_not_found');
    const nextSlug = this.slugify(slug || name);
    if (!nextSlug) throw new Error('validation_failed');
    if (this.communityRepository && typeof this.communityRepository.findBySlug === 'function') {
      const existing = await this.communityRepository.findBySlug(nextSlug, { communityType: 'topic', parentCommunityId: parent.id });
      if (existing) throw new Error('slug_taken');
    }
    const created = await this.createCommunity({
      id,
      name,
      icon,
      description,
      ownerId,
      defaultPostVisibility: 'community',
      membersOnlyPosting: true,
      isPrivate: true,
      onlyAdmin: true
    });
    return this.communityRepository.update(created.id, {
      slug: nextSlug,
      community_type: 'topic',
      parent_community_id: parent.id
    });
  }
  
  async getCommunity(id) {
    if (!id) throw new Error('id_required');
    return this.communityRepository.findById(id);
  }
  
  async updateCommunity({ id, updates = {} }) {
    const existing = await this.communityRepository.findById(id);
    if (!existing) 
        throw new Error('community_not_found');
    const hasPrivacyUpdate = Object.prototype.hasOwnProperty.call(updates, 'isPrivate') || Object.prototype.hasOwnProperty.call(updates, 'is_private');
    const explicitPrivate = Object.prototype.hasOwnProperty.call(updates, 'isPrivate') ? updates.isPrivate : updates.is_private;
    if (hasPrivacyUpdate && !Object.prototype.hasOwnProperty.call(updates, 'defaultPostVisibility') && !Object.prototype.hasOwnProperty.call(updates, 'default_post_visibility')) {
      updates.default_post_visibility = this.normalizeCommunityVisibility({ isPrivate: explicitPrivate });
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'defaultPostVisibility') || Object.prototype.hasOwnProperty.call(updates, 'default_post_visibility')) {
      const visibility = Object.prototype.hasOwnProperty.call(updates, 'defaultPostVisibility') ? updates.defaultPostVisibility : updates.default_post_visibility;
      const allowedVisibility = ['public', 'connections', 'community'];
      if (visibility && !allowedVisibility.includes(visibility)) throw new Error('validation_failed');
      updates.is_private = visibility === 'community' ? 1 : 0;
    }
    return this.communityRepository.update(id, updates);
  }

  async canManageCommunity({ communityId, userId, actorRole = null }) {
    if (!communityId || !userId) return false;
    if (actorRole === 'admin') return true;

    const existing = await this.communityRepository.findById(communityId);
    if (!existing) throw new Error('community_not_found');
    if (existing.owner_id && existing.owner_id === userId) return true;

    if (!this.communityMemberRepository || typeof this.communityMemberRepository.findByUserAndCommunity !== 'function') {
      return false;
    }
    const membership = await this.communityMemberRepository.findByUserAndCommunity(userId, communityId);
    return Boolean(membership && membership.role === 'admin');
  }
  
  async deleteCommunity({ id }) {
    const existing = await this.communityRepository.findById(id);
    if (!existing) 
        throw new Error('community_not_found');
    return this.communityRepository.delete(id);
  }

  async joinCommunity({ communityId, userId }) {
    if (!communityId || !userId) 
        throw new Error('validation_failed');
    const existing = await this.communityMemberRepository.findByUserAndCommunity(userId, communityId);
    if (existing) 
        return existing; // idempotent
    return this.communityMemberRepository.addMember({ id: uuidv4(), user_id: userId, community_id: communityId, role: 'member' });
  }

  async leaveCommunity({ communityId, userId }) {
    if (!communityId || !userId) 
        throw new Error('validation_failed');
    return this.communityMemberRepository.removeMember(userId, communityId);
  }

  async listMembers(communityId) {
    return this.communityMemberRepository.listMembers(communityId);
  }

  async listCommunities({ page = 1, perPage = 20, q = null, categoryId = null, offset = undefined } = {}) {
    const limit = parseInt(perPage, 10) || 20;
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const off = typeof offset !== 'undefined' && offset !== null ? Math.max(parseInt(offset, 10) || 0, 0) : (pg - 1) * limit;

    if (this.communityRepository && typeof this.communityRepository.list === 'function') {
      const data = await this.communityRepository.list({ offset: off, limit, q, categoryId });
      const total = await (typeof this.communityRepository.count === 'function' ? this.communityRepository.count({ q, categoryId }) : (data.length || 0));
      return { data, page: pg, perPage: limit, total };
    }
    // Fallback to listAll if list not implemented
    const rows = (this.communityRepository && typeof this.communityRepository.listAll === 'function') ? await this.communityRepository.listAll() : [];
    return { data: rows, page: 1, perPage: rows.length, total: rows.length };
  }

  async listCategories() {
    if (this.communityCategoryRepository && typeof this.communityCategoryRepository.listAll === 'function') {
      return this.communityCategoryRepository.listAll();
    }
    return [];
  }

  async listChannels({ page = 1, perPage = 20, q = null, offset = undefined } = {}) {
    const limit = parseInt(perPage, 10) || 20;
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const off = typeof offset !== 'undefined' && offset !== null ? Math.max(parseInt(offset, 10) || 0, 0) : (pg - 1) * limit;
    const data = await this.communityRepository.listChannels({ offset: off, limit, q });
    const total = await this.communityRepository.countChannels({ q });
    return { data, page: pg, perPage: limit, total };
  }

  async getChannel(slugOrId) {
    if (!slugOrId) throw new Error('id_required');
    const byId = await this.communityRepository.findById(slugOrId);
    if (byId && byId.community_type === 'channel') return byId;
    return this.communityRepository.findBySlug(slugOrId, { communityType: 'channel' });
  }

  async listChannelTopics({ channelId = null, channelSlug = null, page = 1, perPage = 50, q = null, offset = undefined } = {}) {
    const parent = channelId
      ? await this.communityRepository.findById(channelId)
      : await this.communityRepository.findBySlug(channelSlug, { communityType: 'channel' });
    if (!parent || parent.community_type !== 'channel') throw new Error('channel_not_found');
    const limit = parseInt(perPage, 10) || 50;
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const off = typeof offset !== 'undefined' && offset !== null ? Math.max(parseInt(offset, 10) || 0, 0) : (pg - 1) * limit;
    const data = await this.communityRepository.listTopics(parent.id, { offset: off, limit, q });
    const total = await this.communityRepository.countTopics(parent.id, { q });
    return { data, page: pg, perPage: limit, total, channel: parent };
  }
}
