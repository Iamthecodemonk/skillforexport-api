import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlCommunityMemberRepository {
  async addMember(member) {
    const id = member.id || uuidv4();
    const payload = {
      id,
      user_id: member.user_id || member.userId,
      community_id: member.community_id || member.communityId,
      role: member.role || 'member'
    };
    await db('community_members').insert(payload);
    return db('community_members').where({ id }).first();
  }

  async removeMember(userId, communityId) {
    const existing = await db('community_members').where({ user_id: userId, community_id: communityId }).first();
    if (!existing) return null;
    await db('community_members').where({ id: existing.id }).del();
    return existing;
  }

  async listMembers(communityId) {
    return db('community_members').where({ community_id: communityId }).orderBy('id', 'asc');
  }

  async findByUserAndCommunity(userId, communityId) {
    return db('community_members').where({ user_id: userId, community_id: communityId }).first();
  }
}
