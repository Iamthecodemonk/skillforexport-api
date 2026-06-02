import db from '../knexConfig.js';

function normalizeAssetKind(kind) {
  const allowedKinds = new Set(['avatar', 'image', 'video', 'document', 'other']);
  if (allowedKinds.has(kind)) {
    return kind;
  }
  if (kind === 'banner' || kind === 'post_image' || kind === 'advert_image') {
    return 'image';
  }
  return 'other';
}

export default class MysqlUserAssetRepository {
  async hasColumn(column) {
    this._columns = this._columns || {};
    if (typeof this._columns[column] !== 'undefined') return this._columns[column];
    this._columns[column] = await db.schema.hasColumn('user_assets', column);
    return this._columns[column];
  }

  async create(asset) {
    const now = new Date();
    const metadata = {
      ...(asset.metadata || {}),
      title: asset.title || asset.metadata && asset.metadata.title || null,
      pageId: asset.pageId || asset.metadata && asset.metadata.pageId || null,
      userId: asset.userId || asset.metadata && asset.metadata.userId || null,
      kind: asset.kind || asset.metadata && asset.metadata.kind || null
    };
    const payload = {
      id: asset.id,
      user_id: asset.userId,
      kind: normalizeAssetKind(asset.kind || 'other'),
      provider: asset.provider || 'cloudinary',
      provider_public_id: asset.providerPublicId || null,
      url: asset.url || null,
      mime_type: asset.mimeType || null,
      size_bytes: asset.sizeBytes || null,
      metadata: JSON.stringify(metadata),
      created_at: now,
      updated_at: now,
    };
    if (await this.hasColumn('title')) payload.title = asset.title || null;
    if (await this.hasColumn('page_id')) payload.page_id = asset.pageId || null;
    await db('user_assets').insert(payload);
    return db('user_assets').where({ id: asset.id }).first();
  }

  async findById(id) {
    return db('user_assets').where({ id }).first();
  }

  async findByUserId(userId) {
    return db('user_assets').where({ user_id: userId }).orderBy('created_at', 'desc');
  }

  async findByPublicId(publicId) {
    return db('user_assets').where({ provider_public_id: publicId }).first();
  }

  async update(id, patch) {
    const now = new Date();
    await db('user_assets').where({ id }).update({ ...patch, updated_at: now });
    return db('user_assets').where({ id }).first();
  }

  async delete(id) {
    await db('user_assets').where({ id }).del();
    return true;
  }
}
