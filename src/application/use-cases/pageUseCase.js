import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const pageLogger = logger.child('PAGE_USECASE');

export default class PageUseCase {
  constructor({ pageRepository }) {
    this.pageRepository = pageRepository;
    this.pageCategoryRepository = null;
  }

  normalizePageType(type, pageType) {
    const value = String(type || pageType || 'business').trim().toLowerCase();
    if (!['business', 'student'].includes(value)) throw new Error('invalid_page_type');
    return value;
  }

  validateTypedPage({ type, name, description, metadata = {}, typeWasProvided = false }) {
    if (typeWasProvided && !type) throw new Error('page_type_required');
    if (!name || String(name).trim() === '') throw new Error('name_required');
    if (type === 'business') {
      if (typeWasProvided && !metadata.contactEmail) throw new Error('contact_email_required');
      if (typeWasProvided && !metadata.website) throw new Error('website_required');
    }
    if (type === 'student') {
      if (!metadata.courseOfStudy) throw new Error('course_of_study_required');
      if (!metadata.graduationDate) throw new Error('graduation_date_required');
      if (!description || String(description).trim() === '') throw new Error('description_required');
    }
  }

  normalizeMetadata(metadata = null) {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (e) {
        return {};
      }
    }
    return typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  }

  mergePageMetadata(baseMetadata = null, submittedMetadata = null, topLevelFields = {}) {
    const merged = {
      ...this.normalizeMetadata(baseMetadata),
      ...this.normalizeMetadata(submittedMetadata)
    };
    const data = this.normalizeMetadata(topLevelFields);
    const aliases = {
      contact_email: 'contactEmail',
      staff_size: 'staffSize',
      business_category: 'businessCategory',
      course_of_study: 'courseOfStudy',
      graduation_date: 'graduationDate'
    };
    for (const [legacyKey, canonicalKey] of Object.entries(aliases)) {
      if (typeof data[legacyKey] !== 'undefined' && typeof data[canonicalKey] === 'undefined') {
        merged[canonicalKey] = data[legacyKey];
      }
    }
    for (const key of ['slogan', 'contactEmail', 'website', 'staffSize', 'businessCategory', 'email', 'phone', 'courseOfStudy', 'graduationDate', 'skills']) {
      if (typeof data[key] !== 'undefined') {
        merged[key] = data[key];
      }
    }
    return merged;
  }

  async CreatePage({ ownerId, categoryId = null, type = null, pageType = null, page_type = null, name, slug, description = null, avatar = null, coverImage = null, metadata = null, ...extra }) {
    if (!ownerId) throw new Error('owner_required');
    if (!slug || String(slug).trim() === '') throw new Error('slug_required');
    const typeWasProvided = typeof type !== 'undefined' && type !== null || typeof pageType !== 'undefined' && pageType !== null || typeof page_type !== 'undefined' && page_type !== null;
    const normalizedType = this.normalizePageType(type || page_type, pageType);
    const mergedMetadata = this.mergePageMetadata(null, metadata, extra);
    this.validateTypedPage({ type: normalizedType, name, description, metadata: mergedMetadata, typeWasProvided });
    // Ensure page name is unique
    try {
      if (this.pageRepository && typeof this.pageRepository.findByName === 'function') {
        const existing = await this.pageRepository.findByName(String(name));
        if (existing) throw new Error('name_exists');
      }
    } catch (e) {
      if (e && e.message === 'name_exists') throw e;
      // If findByName is not implemented or fails, continue — creation will rely on DB constraints where applicable
      pageLogger.debug('findByName check skipped or failed', { message: e && e.message });
    }
    // Enforce per-category max_pages_per_user if category provided and repository available
    try {
      if (categoryId && this.pageCategoryRepository && typeof this.pageCategoryRepository.findById === 'function') {
        const category = await this.pageCategoryRepository.findById(categoryId);
        if (category && category.max_pages_per_user !== null && typeof category.max_pages_per_user !== 'undefined') {
          const current = await this.pageRepository.countByOwnerAndCategory(ownerId, categoryId);
          const maxAllowed = parseInt(category.max_pages_per_user, 10);
          if (!isNaN(maxAllowed) && current >= maxAllowed) {
            throw new Error('max_pages_exceeded');
          }
        }
        // Enforce validation rules from category if present
        if (category && category.validation_rules) {
          const vr = category.validation_rules || {};
          const minNameLength = typeof vr.minNameLength !== 'undefined' ? parseInt(vr.minNameLength, 10) : null;
          const maxNameLength = typeof vr.maxNameLength !== 'undefined' ? parseInt(vr.maxNameLength, 10) : null;
          if (minNameLength && String(name).length < minNameLength) throw new Error('name_too_short');
          if (maxNameLength && String(name).length > maxNameLength) throw new Error('name_too_long');
          // Skipping slugPattern enforcement for now (disabled per user request)
          // if (vr.slugPattern) {
          //   let re = null;
          //   try {
          //     re = new RegExp(vr.slugPattern);
          //   } catch (e) {
          //     pageLogger.warn('Invalid slugPattern regex on category', { pattern: vr.slugPattern, err: e && e.message });
          //   }
          //   if (re) {
          //     if (!re.test(String(slug))) {
          //       pageLogger.debug('Page slug does not match category slugPattern', { pattern: vr.slugPattern, slug });
          //       // Disabled: throw new Error('invalid_slug_format');
          //     }
          //   }
          // }
        }
      }
    } catch (e) {
      // Bubble up known errors
      if (e && e.message === 'max_pages_exceeded') throw e;
      if (e && (e.message === 'name_too_short' || e.message === 'name_too_long' || e.message === 'invalid_slug_format')) throw e;
      // Otherwise continue (do not block create if category lookup fails)
      pageLogger.warn('Category lookup failed during CreatePage', { message: e && e.message });
    }
    const page = {
      id: uuidv4(),
      owner_id: ownerId,
      category_id: categoryId,
      page_type: normalizedType,
      name: String(name),
      slug: String(slug),
      description: description || null,
      avatar: avatar || null,
      coverImage: coverImage || null,
      metadata: Object.keys(mergedMetadata).length ? mergedMetadata : null
    };
    // Apply requires_approval flag from category if present
    try {
      if (categoryId && this.pageCategoryRepository && typeof this.pageCategoryRepository.findById === 'function') {
        const category = await this.pageCategoryRepository.findById(categoryId);
        if (category && typeof category.requires_approval !== 'undefined' && category.requires_approval !== null) {
          page.is_approved = (parseInt(category.requires_approval, 10) === 1) ? 0 : 1;
        } else {
          page.is_approved = 1;
        }
      } else {
        page.is_approved = 1;
      }
    } catch (e) {
      page.is_approved = 1;
    }
    return this.pageRepository.create(page);
  }

  async GetPagePrefill({ ownerId, type, userRepository = null, profileRepository = null, skillRepository = null }) {
    if (!ownerId) throw new Error('owner_required');
    const normalizedType = this.normalizePageType(type, type);
    const [user, profile, skills] = await Promise.all([
      userRepository && typeof userRepository.findById === 'function' ? userRepository.findById(ownerId) : Promise.resolve(null),
      profileRepository && typeof profileRepository.findByUserId === 'function' ? profileRepository.findByUserId(ownerId) : Promise.resolve(null),
      skillRepository && typeof skillRepository.listByUserId === 'function' ? skillRepository.listByUserId(ownerId) : Promise.resolve([])
    ]);
    const userData = user && user.toPlainObject ? user.toPlainObject() : user;
    const profileData = profile && profile.toPlainObject ? profile.toPlainObject() : profile;
    const skillNames = (skills || []).map(skill => {
      const item = skill && skill.toPlainObject ? skill.toPlainObject() : skill;
      return item && (item.skill || item.name);
    }).filter(Boolean);

    if (normalizedType === 'student') {
      return {
        type: 'student',
        pageType: 'student',
        name: (profileData && (profileData.displayName || profileData.username)) || null,
        email: userData && userData.email || null,
        phone: profileData && profileData.phone || null,
        courseOfStudy: profileData && (profileData.courseOfStudy || profileData.course_of_study) || null,
        skills: skillNames,
        avatar: profileData && profileData.avatar || null
      };
    }

    return {
      type: 'business',
      pageType: 'business',
      contactEmail: userData && userData.email || null,
      website: profileData && profileData.website || null,
      businessCategory: null,
      avatar: profileData && profileData.avatar || null
    };
  }

  async UpdatePageCategory({ id, updates = {} }) {
    if (!id) throw new Error('id_required');
    const existing = await this.pageCategoryRepository.findById(id);
    if (!existing) throw new Error('category_not_found');
    // Validate updates for name/slug if present
    if (updates.name && String(updates.name).trim() === '') throw new Error('name_required');
    if (updates.slug && String(updates.slug).trim() === '') throw new Error('slug_required');
    // Check uniqueness if name changed
    if (updates.name && typeof this.pageCategoryRepository.findByName === 'function') {
      const other = await this.pageCategoryRepository.findByName(updates.name);
      if (other && other.id !== id) throw new Error('name_exists');
    }
    return this.pageCategoryRepository.update(id, updates);
  }

  async DeletePageCategory({ id }) {
    if (!id) throw new Error('id_required');
    const existing = await this.pageCategoryRepository.findById(id);
    if (!existing) throw new Error('category_not_found');
    // Unassign pages referencing this category to avoid FK constraint errors
    try {
      if (this.pageRepository && typeof this.pageRepository.unassignCategory === 'function') {
        await this.pageRepository.unassignCategory(id);
      }
    } catch (e) {
      pageLogger.warn('Failed to unassign pages before deleting category', { message: e && e.message });
    }
    return this.pageCategoryRepository.delete(id);
  }

  async CreatePageCategory({ id = null, name, slug, description = null, icon = null, is_active = 1, rules = null, max_pages_per_user = null, requires_approval = 0, validation_rules = null }) {
    if (!name || String(name).trim() === '') throw new Error('name_required');
    if (!slug || String(slug).trim() === '') throw new Error('slug_required');
    // ensure uniqueness by name or slug if repository supports it
    try {
      if (this.pageCategoryRepository && typeof this.pageCategoryRepository.findByName === 'function') {
        const existing = await this.pageCategoryRepository.findByName(name);
        if (existing) throw new Error('name_exists');
      }
    } catch (e) {
      if (e && e.message === 'name_exists') throw e;
      // otherwise continue
    }
    const cat = {
      id: id || uuidv4(),
      name: String(name),
      slug: String(slug),
      description: description || null,
      icon: icon || null,
      is_active: is_active,
      rules: rules || null,
      max_pages_per_user: max_pages_per_user,
      requires_approval: requires_approval,
      validation_rules: validation_rules || null
    };
    if (!this.pageCategoryRepository || typeof this.pageCategoryRepository.create !== 'function') {
      throw new Error('not_implemented');
    }
    return this.pageCategoryRepository.create(cat);
  }

  async ListPageCategories({ limit = 50, offset = 0, ownerId = null } = {}) {
    if (!this.pageCategoryRepository || typeof this.pageCategoryRepository.list !== 'function') {
      throw new Error('not_implemented');
    }
    if (ownerId && typeof this.pageCategoryRepository.listForOwner === 'function') {
      return this.pageCategoryRepository.listForOwner(ownerId, { limit, offset });
    }
    return this.pageCategoryRepository.list({ limit, offset });
  }

  async ListAllPageCategories({ limit = 50, offset = 0 } = {}) {
    if (!this.pageCategoryRepository || typeof this.pageCategoryRepository.list !== 'function') {
      throw new Error('not_implemented');
    }
    return this.pageCategoryRepository.list({ limit, offset });
  }

  async CountPageCategories() {
    if (!this.pageCategoryRepository || typeof this.pageCategoryRepository.countAll !== 'function') {
      return 0;
    }
    return this.pageCategoryRepository.countAll();
  }

  async GetPage(id) {
    if (!id) throw new Error('id_required');
    const row = await this.pageRepository.findById(id);
    if (!row) throw new Error('page_not_found');
    return row;
  }

  async ListPages({ limit = 20, offset = 0 } = {}) {
    return this.pageRepository.list({ limit, offset });
  }

  async ListMyPages({ ownerId, limit = 20, offset = 0 } = {}) {
    if (!ownerId) throw new Error('owner_required');
    if (!this.pageRepository || typeof this.pageRepository.listByOwner !== 'function') {
      throw new Error('not_implemented');
    }
    return this.pageRepository.listByOwner(ownerId, { limit, offset });
  }

  async CountMyPages(ownerId) {
    if (!ownerId) throw new Error('owner_required');
    return this.pageRepository && typeof this.pageRepository.countByOwner === 'function'
      ? this.pageRepository.countByOwner(ownerId)
      : 0;
  }

  async UpdatePage({ id, ownerId, updates = {} }) {
    if (!id) throw new Error('id_required');
    const existing = await this.pageRepository.findById(id);
    if (!existing) throw new Error('page_not_found');
    if (existing.owner_id !== ownerId) throw new Error('not_authorized');
    const typeWasProvided = typeof updates.type !== 'undefined' && updates.type !== null || typeof updates.pageType !== 'undefined' && updates.pageType !== null || typeof updates.page_type !== 'undefined' && updates.page_type !== null;
    const nextType = typeWasProvided
      ? this.normalizePageType(updates.type || updates.page_type, updates.pageType)
      : this.normalizePageType(existing.type || existing.page_type, existing.pageType);
    const mergedMetadata = this.mergePageMetadata(existing.metadata, updates.metadata, updates);
    const nextName = typeof updates.name !== 'undefined' ? updates.name : existing.name;
    const nextDescription = typeof updates.description !== 'undefined' ? updates.description : existing.description;
    this.validateTypedPage({ type: nextType, name: nextName, description: nextDescription, metadata: mergedMetadata, typeWasProvided });
    const payload = { ...updates, page_type: nextType, metadata: Object.keys(mergedMetadata).length ? mergedMetadata : null };
    return this.pageRepository.update(id, payload);
  }

  async DeletePage({ id, ownerId }) {
    if (!id) throw new Error('id_required');
    const existing = await this.pageRepository.findById(id);
    if (!existing) throw new Error('page_not_found');
    if (existing.owner_id !== ownerId) throw new Error('not_authorized');
    await this.pageRepository.delete(id);
    return { id };
  }

  async ApprovePage({ id, approverId, approverRole }) {
    if (!id) throw new Error('id_required');
    if (!approverId) throw new Error('approver_required');
    // Only allow admins to approve
    if (approverRole !== 'admin') throw new Error('not_authorized');
    const existing = await this.pageRepository.findById(id);
    if (!existing) throw new Error('page_not_found');
    return this.pageRepository.update(id, { is_approved: 1, approved_by: approverId, approved_at: new Date() });
  }
}
