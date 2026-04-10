export default class Page {
  constructor({ id = null, ownerId = null, owner_id = null, categoryId = null, category_id = null, name = null, slug = null, description = null, avatar = null, coverImage = null, cover_image = null, isVerified = 0, is_verified = 0, isActive = 1, is_active = 1, isApproved = 0, is_approved = 0, approvalNotes = null, approval_notes = null, approvedAt = null, approved_at = null, approvedBy = null, approved_by = null, metadata = null, createdAt = null, created_at = null, updatedAt = null, updated_at = null }) {
    this.id = id;
    this.ownerId = ownerId || owner_id;
    this.categoryId = categoryId || category_id;
    this.name = name;
    this.slug = slug;
    this.description = description;
    this.avatar = avatar;
    this.coverImage = coverImage || cover_image;
    this.isVerified = isVerified || is_verified || 0;
    this.isActive = isActive || is_active || 1;
    this.isApproved = isApproved || is_approved || 0;
    this.approvalNotes = approvalNotes || approval_notes;
    this.approvedAt = approvedAt || approved_at;
    this.approvedBy = approvedBy || approved_by;
    this.metadata = metadata;
    this.createdAt = createdAt || created_at;
    this.updatedAt = updatedAt || updated_at;
  }

  toRecord() {
    return {
      id: this.id,
      owner_id: this.ownerId,
      category_id: this.categoryId,
      name: this.name,
      slug: this.slug,
      description: this.description,
      avatar: this.avatar,
      cover_image: this.coverImage,
      is_verified: this.isVerified,
      is_active: this.isActive,
      is_approved: this.isApproved,
      approval_notes: this.approvalNotes,
      approved_at: this.approvedAt,
      approved_by: this.approvedBy,
      metadata: this.metadata,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      categoryId: this.categoryId,
      name: this.name,
      slug: this.slug,
      description: this.description,
      avatar: this.avatar,
      coverImage: this.coverImage,
      isVerified: this.isVerified,
      isActive: this.isActive,
      isApproved: this.isApproved,
      approvalNotes: this.approvalNotes,
      approvedAt: this.approvedAt,
      approvedBy: this.approvedBy,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
