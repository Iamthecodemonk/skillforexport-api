import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const mapDocument = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: row.content,
    contentType: row.content_type,
    version: row.version,
    status: row.status,
    effectiveDate: row.effective_date,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export default class MysqlLegalDocumentRepository {
  async list({ includeDrafts = false } = {}) {
    const q = db('legal_documents').orderBy('slug', 'asc');
    if (!includeDrafts) q.where({ status: 'published' });
    const rows = await q;
    return (rows || []).map(mapDocument);
  }

  async findBySlug(slug, { includeDrafts = false } = {}) {
    const q = db('legal_documents').where({ slug });
    if (!includeDrafts) q.andWhere({ status: 'published' });
    return mapDocument(await q.first());
  }

  async findById(id) {
    return mapDocument(await db('legal_documents').where({ id }).first());
  }

  async create(input = {}) {
    const now = new Date();
    const id = input.id || uuidv4();
    const payload = {
      id,
      slug: input.slug,
      title: input.title,
      content: input.content,
      content_type: input.contentType || input.content_type || 'html',
      version: input.version || '1.0',
      status: input.status || 'published',
      effective_date: input.effectiveDate || input.effective_date || null,
      published_at: input.publishedAt || input.published_at || now,
      created_at: now,
      updated_at: now
    };
    await db('legal_documents').insert(payload);
    return this.findById(id);
  }

  async update(id, input = {}) {
    const payload = {};
    if (typeof input.slug !== 'undefined') payload.slug = input.slug;
    if (typeof input.title !== 'undefined') payload.title = input.title;
    if (typeof input.content !== 'undefined') payload.content = input.content;
    if (typeof input.contentType !== 'undefined') payload.content_type = input.contentType;
    if (typeof input.content_type !== 'undefined') payload.content_type = input.content_type;
    if (typeof input.version !== 'undefined') payload.version = input.version;
    if (typeof input.status !== 'undefined') payload.status = input.status;
    if (typeof input.effectiveDate !== 'undefined') payload.effective_date = input.effectiveDate;
    if (typeof input.effective_date !== 'undefined') payload.effective_date = input.effective_date;
    if (typeof input.publishedAt !== 'undefined') payload.published_at = input.publishedAt;
    if (typeof input.published_at !== 'undefined') payload.published_at = input.published_at;
    if (Object.keys(payload).length === 0) return this.findById(id);
    payload.updated_at = new Date();
    await db('legal_documents').where({ id }).update(payload);
    return this.findById(id);
  }

  async delete(id) {
    await db('legal_documents').where({ id }).del();
    return true;
  }
}
