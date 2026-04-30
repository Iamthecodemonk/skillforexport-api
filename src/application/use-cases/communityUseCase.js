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

  async createCommunity({ id = null, categoryId = null, name, description = null, ownerId = null, defaultPostVisibility = 'public' }) {
    if (!name || !ownerId) 
        throw new Error('validation_failed');
    const allowedVisibility = ['public', 'connections', 'community'];
    if (defaultPostVisibility && !allowedVisibility.includes(defaultPostVisibility)) {
      throw new Error('validation_failed');
    }
    const payload = { id: id || uuidv4(), category_id: categoryId, name, description, created_at: new Date(), owner_id: ownerId, default_post_visibility: defaultPostVisibility };
    const created = await this.communityRepository.create(payload);
    // add owner as admin member
    if (this.communityMemberRepository) {
      await this.communityMemberRepository.addMember({ id: uuidv4(), user_id: ownerId, community_id: created.id, role: 'admin' });
    }
    return created;
  }
  
  async getCommunity(id) {
    if (!id) throw new Error('id_required');
    return this.communityRepository.findById(id);
  }
  
  async updateCommunity({ id, updates = {} }) {
    const existing = await this.communityRepository.findById(id);
    if (!existing) 
        throw new Error('community_not_found');
    return this.communityRepository.update(id, updates);
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
}
