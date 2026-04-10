import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPageRepository {
  async create(page) {
    const id = page.id || uuidv4();
    const now = new Date();
    await db('pages').insert({
      id,
      owner_id: page.owner_id || page.ownerId,
      category_id: page.category_id || page.categoryId || null,
      name: page.name,
      slug: page.slug,
      description: page.description || null,
      avatar: page.avatar || null,
      cover_image: page.cover_image || page.coverImage || null,
      is_verified: typeof page.is_verified !== 'undefined' ? page.is_verified : (page.isVerified || 0),
      is_active: typeof page.is_active !== 'undefined' ? page.is_active : (page.isActive || 1),
      is_approved: typeof page.is_approved !== 'undefined' ? page.is_approved : (page.isApproved || 0),
      approval_notes: page.approval_notes || page.approvalNotes || null,
      approved_at: page.approved_at || page.approvedAt || null,
      approved_by: page.approved_by || page.approvedBy || null,
      metadata: page.metadata || null,
      created_at: now,
      updated_at: now
    });
    return { id, owner_id: page.owner_id || page.ownerId, category_id: page.category_id || page.categoryId || null, name: page.name, slug: page.slug, description: page.description || null, avatar: page.avatar || null, cover_image: page.cover_image || page.coverImage || null, is_verified: page.is_verified || page.isVerified || 0, is_active: page.is_active || page.isActive || 1, is_approved: page.is_approved || page.isApproved || 0, approval_notes: page.approval_notes || page.approvalNotes || null, approved_at: page.approved_at || page.approvedAt || null, approved_by: page.approved_by || page.approvedBy || null, metadata: page.metadata || null, created_at: now, updated_at: now };
  }

  async findById(id) {
    const row = await db('pages').where({ id }).first();
    return row || null;
  }

  async list({ limit = 20, offset = 0 } = {}) {
    const rows = await db('pages').orderBy('created_at', 'desc').limit(limit).offset(offset);
    return rows || [];
  }

  async update(id, updates) {
    const now = new Date();
    const payload = {};
    if (typeof updates.name !== 'undefined') payload.name = updates.name;
    if (typeof updates.slug !== 'undefined') payload.slug = updates.slug;
    if (typeof updates.description !== 'undefined') payload.description = updates.description;
    if (typeof updates.avatar !== 'undefined') payload.avatar = updates.avatar;
    if (typeof updates.cover_image !== 'undefined') payload.cover_image = updates.cover_image;
    if (typeof updates.is_active !== 'undefined') payload.is_active = updates.is_active;
    if (typeof updates.is_approved !== 'undefined') payload.is_approved = updates.is_approved;
    if (typeof updates.approval_notes !== 'undefined') payload.approval_notes = updates.approval_notes;
    if (typeof updates.approved_at !== 'undefined') payload.approved_at = updates.approved_at;
    if (typeof updates.approved_by !== 'undefined') payload.approved_by = updates.approved_by;
    if (typeof updates.metadata !== 'undefined') payload.metadata = updates.metadata;
    if (Object.keys(payload).length === 0) return this.findById(id);
    payload.updated_at = now;
    await db('pages').where({ id }).update(payload);
    return this.findById(id);
  }

  async delete(id) {
    await db('pages').where({ id }).del();
    return true;
  }

  async incrementPostCount(pageId, delta = 1) {
    await db('pages').where({ id: pageId }).increment('post_count', delta);
    return true;
  }

  async countByOwnerAndCategory(ownerId, categoryId) {
    const q = db('pages').where({ owner_id: ownerId });
    if (categoryId) 
        q.andWhere('category_id', categoryId);
    const row = await q.count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }
}
