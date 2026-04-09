import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const mediaLogger = logger.child('POST_MEDIA_USECASE');

export default class PostMediaUseCase {
  constructor({ postMediaRepository, mediaQueue }) {
    if (!postMediaRepository) throw new Error('post_media_repository_required');
    this.postMediaRepository = postMediaRepository;
    this.mediaQueue = mediaQueue || null;
  }

  async AttachMediaByUrl({ postId, url, mediaType = 'image', displayOrder = 0 }) {
    if (!postId) throw new Error('post_required');
    if (!url) throw new Error('url_required');
    if (!this.mediaQueue) {
      mediaLogger.warn('media queue not available for AttachMediaByUrl');
      throw new Error('queue_unavailable');
    }
    const jobPayload = { postId, url, mediaType, displayOrder };
    const job = await this.mediaQueue.add('post_media_url', jobPayload, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    return { jobId: job.id };
  }

  async ListMediaByPost(postId) {
    if (!postId) throw new Error('post_required');
    return this.postMediaRepository.listByPost(postId);
  }

  async DeleteMediaById(mediaId) {
    if (!mediaId) throw new Error('media_id_required');
    return this.postMediaRepository.deleteById(mediaId);
  }
}
