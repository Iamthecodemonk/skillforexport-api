import db from '../knexConfig.js';

export default class MysqlUserAssetRepository {
  async create(asset) {
    const now = new Date();
    const payload = {
      id: asset.id,
      user_id: asset.userId,
      kind: asset.kind || 'other',
      provider: asset.provider || 'cloudinary',
      provider_public_id: asset.providerPublicId || null,
      url: asset.url || null,
      mime_type: asset.mimeType || null,
      size_bytes: asset.sizeBytes || null,
      metadata: asset.metadata || null,
      created_at: now,
      updated_at: now,
    };
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
