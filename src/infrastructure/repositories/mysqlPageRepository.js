import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPageRepository {
  mapPage(row) {
    if (!row) return null;
    const page = { ...row };
    if (page.metadata && typeof page.metadata === 'string') {
      try { page.metadata = JSON.parse(page.metadata); } catch (e) { /* leave as-is */ }
    }
    page.ownerId = page.ownerId || page.owner_id || null;
    page.categoryId = page.categoryId || page.category_id || null;
    page.type = page.type || page.pageType || page.page_type || 'business';
    page.pageType = page.pageType || page.type || page.page_type || 'business';
    page.coverImage = page.coverImage || page.cover_image || null;
    page.isVerified = typeof page.isVerified !== 'undefined' ? page.isVerified : page.is_verified;
    page.isActive = typeof page.isActive !== 'undefined' ? page.isActive : page.is_active;
    page.isApproved = typeof page.isApproved !== 'undefined' ? page.isApproved : page.is_approved;
    page.approvalNotes = page.approvalNotes || page.approval_notes || null;
    page.approvedAt = page.approvedAt || page.approved_at || null;
    page.approvedBy = page.approvedBy || page.approved_by || null;
    page.createdAt = page.createdAt || page.created_at || null;
    page.updatedAt = page.updatedAt || page.updated_at || null;
    return page;
  }

  async create(page) {
    const id = page.id || uuidv4();
    const now = new Date();
    await db('pages').insert({
      id,
      owner_id: page.owner_id || page.ownerId,
      category_id: page.category_id || page.categoryId || null,
      page_type: page.page_type || page.pageType || page.type || 'business',
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
      metadata: typeof page.metadata !== 'undefined' && page.metadata !== null ? JSON.stringify(page.metadata) : null,
      created_at: now,
      updated_at: now
    });
    return this.mapPage({ id, owner_id: page.owner_id || page.ownerId, category_id: page.category_id || page.categoryId || null, page_type: page.page_type || page.pageType || page.type || 'business', name: page.name, slug: page.slug, description: page.description || null, avatar: page.avatar || null, cover_image: page.cover_image || page.coverImage || null, is_verified: page.is_verified || page.isVerified || 0, is_active: page.is_active || page.isActive || 1, is_approved: page.is_approved || page.isApproved || 0, approval_notes: page.approval_notes || page.approvalNotes || null, approved_at: page.approved_at || page.approvedAt || null, approved_by: page.approved_by || page.approvedBy || null, metadata: page.metadata || null, created_at: now, updated_at: now });
  }

  async findById(id) {
    const row = await db('pages').where({ id }).first();
    return this.mapPage(row);
  }

  async findByName(name) {
    if (!name) return null;
    const row = await db('pages').where({ name }).first();
    return row || null;
  }

  async list({ limit = 20, offset = 0 } = {}) {
    const rows = await db('pages').orderBy('created_at', 'desc').limit(limit).offset(offset);
    return (rows || []).map(row => this.mapPage(row));
  }

  async listByOwner(ownerId, { limit = 20, offset = 0 } = {}) {
    const rows = await db('pages').where({ owner_id: ownerId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
    return (rows || []).map(row => this.mapPage(row));
  }

  async countByOwner(ownerId) {
    const row = await db('pages').where({ owner_id: ownerId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async countAll() {
    const row = await db('pages').count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async update(id, updates) {
    const now = new Date();
    const payload = {};
    if (typeof updates.name !== 'undefined') payload.name = updates.name;
    if (typeof updates.type !== 'undefined') payload.page_type = updates.type;
    if (typeof updates.pageType !== 'undefined') payload.page_type = updates.pageType;
    if (typeof updates.page_type !== 'undefined') payload.page_type = updates.page_type;
    if (typeof updates.slug !== 'undefined') payload.slug = updates.slug;
    if (typeof updates.description !== 'undefined') payload.description = updates.description;
    if (typeof updates.avatar !== 'undefined') payload.avatar = updates.avatar;
    if (typeof updates.coverImage !== 'undefined') payload.cover_image = updates.coverImage;
    if (typeof updates.cover_image !== 'undefined') payload.cover_image = updates.cover_image;
    if (typeof updates.is_active !== 'undefined') payload.is_active = updates.is_active;
    if (typeof updates.is_approved !== 'undefined') payload.is_approved = updates.is_approved;
    if (typeof updates.approval_notes !== 'undefined') payload.approval_notes = updates.approval_notes;
    if (typeof updates.approved_at !== 'undefined') payload.approved_at = updates.approved_at;
    if (typeof updates.approved_by !== 'undefined') payload.approved_by = updates.approved_by;
    if (typeof updates.metadata !== 'undefined') payload.metadata = updates.metadata !== null ? JSON.stringify(updates.metadata) : null;
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

  async countByCategory(categoryId) {
    const row = await db('pages').where({ category_id: categoryId }).count({ cnt: 'id' }).first();
    const cnt = row && (row.cnt || row['cnt'] || Object.values(row)[0]);
    return parseInt(cnt || 0, 10);
  }

  async listByCategory(categoryId, { limit = 20, offset = 0 } = {}) {
    const rows = await db('pages').where({ category_id: categoryId }).orderBy('created_at', 'desc').limit(limit).offset(offset);
    return (rows || []).map(row => this.mapPage(row));
  }

  async unassignCategory(categoryId) {
    await db('pages').where({ category_id: categoryId }).update({ category_id: null, updated_at: new Date() });
    return true;
  }
}
