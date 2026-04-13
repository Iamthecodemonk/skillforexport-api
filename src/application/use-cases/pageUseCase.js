import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const pageLogger = logger.child('PAGE_USECASE');

export default class PageUseCase {
  constructor({ pageRepository }) {
    this.pageRepository = pageRepository;
    this.pageCategoryRepository = null;
  }

  async CreatePage({ ownerId, categoryId = null, name, slug, description = null, metadata = null }) {
    if (!ownerId) throw new Error('owner_required');
    if (!name || String(name).trim() === '') throw new Error('name_required');
    if (!slug || String(slug).trim() === '') throw new Error('slug_required');
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
      name: String(name),
      slug: String(slug),
      description: description || null,
      metadata: metadata || null
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

  async GetPage(id) {
    if (!id) throw new Error('id_required');
    const row = await this.pageRepository.findById(id);
    if (!row) throw new Error('page_not_found');
    return row;
  }

  async ListPages({ limit = 20, offset = 0 } = {}) {
    return this.pageRepository.list({ limit, offset });
  }

  async UpdatePage({ id, ownerId, updates = {} }) {
    if (!id) throw new Error('id_required');
    const existing = await this.pageRepository.findById(id);
    if (!existing) throw new Error('page_not_found');
    if (existing.owner_id !== ownerId) throw new Error('not_authorized');
    return this.pageRepository.update(id, updates);
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
