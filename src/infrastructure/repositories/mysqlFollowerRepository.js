import db from '../knexConfig.js';

export default class MysqlFollowerRepository {
  async listFollowers(userId) {
    return db('followers as f')
      .leftJoin('users as u', 'u.id', 'f.follower_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .where('f.following_id', userId)
      .orderBy('f.created_at', 'desc')
      .select(
        'f.id',
        'f.follower_id',
        'f.following_id',
        'f.created_at',
        db.raw(`
          JSON_OBJECT(
            'id', u.id,
            'name', COALESCE(NULLIF(up.display_name, ''), NULLIF(up.username, ''), u.email),
            'email', u.email,
            'role', u.role,
            'avatar', up.avatar
          ) as user
        `)
      );
  }

  async listFollowing(userId) {
    return db('followers as f')
      .leftJoin('users as u', 'u.id', 'f.following_id')
      .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .where('f.follower_id', userId)
      .orderBy('f.created_at', 'desc')
      .select(
        'f.id',
        'f.follower_id',
        'f.following_id',
        'f.created_at',
        db.raw(`
          JSON_OBJECT(
            'id', u.id,
            'name', COALESCE(NULLIF(up.display_name, ''), NULLIF(up.username, ''), u.email),
            'email', u.email,
            'role', u.role,
            'avatar', up.avatar
          ) as user
        `)
      );
  }

  async create(record) {
    const followerId = record.follower_id || record.followerId;
    const followingId = record.following_id || record.followingId;
    if (followerId && followingId && String(followerId) === String(followingId)) throw new Error('self_follow_not_allowed');
    const existing = await this.findByFollowerAndFollowing(followerId, followingId);
    if (existing) return existing;
    const now = new Date();
    const payload = { ...record, created_at: now };
    try {
      await db('followers').insert(payload);
    } catch (err) {
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        return this.findByFollowerAndFollowing(followerId, followingId);
      }
      throw err;
    }
    return db('followers').where({ id: record.id }).first();
  }

  async findByFollowerAndFollowing(followerId, followingId) {
    return db('followers').where({ follower_id: followerId, following_id: followingId }).first();
  }

  async deleteByFollowerAndFollowing(followerId, followingId) {
    const existing = await db('followers').where({ follower_id: followerId, following_id: followingId }).orderBy('created_at', 'asc').first();
    if (!existing) return null;
    const deletedCount = await db('followers').where({ follower_id: followerId, following_id: followingId }).del();
    return { ...existing, deletedCount };
  }
}
