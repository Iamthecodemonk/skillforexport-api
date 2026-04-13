export class CommunityMemberRepository {
  async addMember(member) { 
    throw new Error('addMember() not implemented'); 
  }
  async removeMember(userId, communityId) { 
    throw new Error('removeMember() not implemented'); 
  }
  async listMembers(communityId) { 
    throw new Error('listMembers() not implemented'); 
  }
  async findByUserAndCommunity(userId, communityId) { 
    throw new Error('findByUserAndCommunity() not implemented'); 
  }
}

export class CommunityMemberRepositoryImpl extends CommunityMemberRepository {
  constructor({ adapter }) { 
    super(); 
    if (!adapter) 
        throw new Error('adapter is required'); 
    this.adapter = adapter; 
   }
  async addMember(member) { 
    return this.adapter.addMember(member); 
  }
  async removeMember(userId, communityId) { 
    return this.adapter.removeMember(userId, communityId); 
  }
  async listMembers(communityId) { 
    return this.adapter.listMembers(communityId); 
  }
  async findByUserAndCommunity(userId, communityId) { 
    return this.adapter.findByUserAndCommunity(userId, communityId); 
  }
}
