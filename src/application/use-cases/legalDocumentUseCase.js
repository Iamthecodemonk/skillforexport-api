const DOCUMENT_KEYS = {
  'privacy-policy': 'privacyPolicy',
  'cookie-policy': 'cookiePolicy',
  'community-regulations': 'communityRegulations',
  'terms-of-service': 'termsOfService'
};

const normalizeSlug = (value) => String(value || '').trim().toLowerCase();

export default class LegalDocumentUseCase {
  constructor({ repository }) {
    if (!repository) throw new Error('repository_required');
    this.repository = repository;
  }

  groupDocuments(rows = []) {
    return (rows || []).reduce((acc, doc) => {
      const key = DOCUMENT_KEYS[doc.slug] || doc.slug.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      acc[key] = doc;
      return acc;
    }, {});
  }

  async ListPublicDocuments() {
    const rows = await this.repository.list({ includeDrafts: false });
    return this.groupDocuments(rows);
  }

  async ListAllDocuments() {
    return this.repository.list({ includeDrafts: true });
  }

  async GetPublicDocument(slug) {
    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) throw new Error('slug_required');
    const doc = await this.repository.findBySlug(normalizedSlug, { includeDrafts: false });
    if (!doc) throw new Error('document_not_found');
    return doc;
  }

  validateInput(input = {}, { partial = false } = {}) {
    if (!partial || typeof input.slug !== 'undefined') {
      if (!normalizeSlug(input.slug)) throw new Error('slug_required');
    }
    if (!partial || typeof input.title !== 'undefined') {
      if (!input.title || String(input.title).trim() === '') throw new Error('title_required');
    }
    if (!partial || typeof input.content !== 'undefined') {
      if (!input.content || String(input.content).trim() === '') throw new Error('content_required');
    }
    const contentType = input.contentType || input.content_type;
    if (typeof contentType !== 'undefined' && !['html', 'markdown', 'plain_text'].includes(contentType)) {
      throw new Error('invalid_content_type');
    }
    if (typeof input.status !== 'undefined' && !['draft', 'published', 'archived'].includes(input.status)) {
      throw new Error('invalid_status');
    }
  }

  async CreateDocument(input = {}) {
    this.validateInput(input);
    return this.repository.create({
      ...input,
      slug: normalizeSlug(input.slug),
      title: String(input.title).trim()
    });
  }

  async UpdateDocument(id, input = {}) {
    if (!id) throw new Error('id_required');
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error('document_not_found');
    this.validateInput(input, { partial: true });
    const payload = { ...input };
    if (typeof payload.slug !== 'undefined') payload.slug = normalizeSlug(payload.slug);
    if (typeof payload.title !== 'undefined') payload.title = String(payload.title).trim();
    return this.repository.update(id, payload);
  }

  async DeleteDocument(id) {
    if (!id) throw new Error('id_required');
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error('document_not_found');
    await this.repository.delete(id);
    return { id };
  }
}
