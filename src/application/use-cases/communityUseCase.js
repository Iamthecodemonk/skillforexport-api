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

  async createCommunity({ id = null, categoryId = null, name, description = null, ownerId = null }) {
    if (!name || !ownerId) 
        throw new Error('validation_failed');
    const payload = { id: id || uuidv4(), category_id: categoryId, name, description, created_at: new Date(), owner_id: ownerId };
    const created = await this.communityRepository.create(payload);
    // add owner as admin member
    if (this.communityMemberRepository) {
      await this.communityMemberRepository.addMember({ id: uuidv4(), user_id: ownerId, community_id: created.id, role: 'admin' });
    }
    return created;
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
}
