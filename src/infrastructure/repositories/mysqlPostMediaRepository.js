import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

export default class MysqlPostMediaRepository {
  async create(media) {
    const id = media.id || uuidv4();
    const now = new Date();
    await db('post_media').insert({
      id,
      post_id: media.post_id || media.postId,
      media_type: media.media_type || media.mediaType || 'image',
      url: media.url,
      thumbnail_url: media.thumbnail_url || media.thumbnailUrl || null,
      display_order: typeof media.display_order !== 'undefined' ? media.display_order : 0,
      created_at: now
    });
    return { id, post_id: media.post_id || media.postId, media_type: media.media_type || media.mediaType || 'image', url: media.url, thumbnail_url: media.thumbnail_url || media.thumbnailUrl || null, display_order: media.display_order || 0, created_at: now };
  }

  async listByPost(postId) {
    const rows = await db('post_media').where({ post_id: postId }).orderBy('display_order', 'asc');
    return rows || [];
  }

  async deleteById(id) {
    await db('post_media').where({ id }).del();
    return true;
  }
}
