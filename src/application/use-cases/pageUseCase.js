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
      }
    } catch (e) {
      // Bubble up known errors
      if (e && e.message === 'max_pages_exceeded') throw e;
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
    return this.pageRepository.create(page);
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
