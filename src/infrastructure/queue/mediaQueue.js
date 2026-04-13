import { Queue, Worker } from 'bullmq';
import { fileTypeFromFile } from 'file-type';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';
import fs from 'fs';
import fsPromises from 'fs/promises';
import 'dotenv/config';

//initially I had the queue and worker creation logic directly in server.js, but it was getting a bit unwieldy. 
// So I moved it here to keep things organized. This file now handles all media-related background processing, including avatar uploads and direct Cloudinary registrations. 
// The worker is designed to be robust with error handling and logging, and it can be easily extended in the future for other media tasks if needed.(because i saw this issue initially)
//i trusted buffer for upload but i am using streams sha for speed and memory efficiency, especially for larger files. The file-type library is used to validate MIME types without fully loading the file into memory, which adds an extra layer of security against malicious uploads.
const queueLogger = logger.child('MEDIA_QUEUE');

export function createMediaQueue(redisConnection) {
  return new Queue('media', { connection: redisConnection });
}

export function createMediaWorker(redisConnection, { cloudinary, profileRepository = null, assetAdapter = null, postMediaAdapter = null, pageRepository = null, concurrency = 2 } = {}) {
  const safeCreateAsset = async (asset) => {
    if (!assetAdapter) return null;
    try {
      return await assetAdapter.create(asset);
    } catch (err) {
      const msg = String(err.message || '');
      const lower = msg.toLowerCase();
      if (err.code === 'ER_DUP_ENTRY' || lower.includes('duplicate entry')) {
        const existing = await assetAdapter.findById(asset.id).catch(() => null);
        if (existing) {
          queueLogger.warn('Asset already exists, skipping create', { assetId: asset.id });
          return existing;
        }
      }
      throw err;
    }
  };
  const worker = new Worker(
    'media',
    async (job) => { 
      const { name, data } = job;
      queueLogger.info(`Processing job ${job.id} (${name})`, { data });

      try {
        if (name === 'avatar') {
          const { userId, imageUrl } = data;
          // Upload from URL to Cloudinary
          const result = await cloudinary.uploadFromUrl(imageUrl, { folder: 'avatars' });
          // Create asset record if adapter available
          if (assetAdapter) {
            const assetId = data.assetId || job.id;
            const asset = await safeCreateAsset({
              id: assetId,
              userId,
              kind: 'avatar',
              provider: 'cloudinary',
              providerPublicId: result.public_id,
              url: result.secure_url || result.url,
              mimeType: result.format || null,
              sizeBytes: result.bytes || null,
              metadata: result
            });
            if (asset && asset.id) queueLogger.info('Asset record created', { assetId: asset.id });
          }

          // Update user profile avatar if profileRepository provided
          if (profileRepository) {
            const profile = await profileRepository.findByUserId(userId);
            if (profile) {
              await profileRepository.update(profile.id, { avatar: result.secure_url || result.url });
              queueLogger.info('Profile avatar updated', { userId });
            }
          }
          // Update page avatar if a pageId was supplied and pageRepository available
          if (pageRepository && data.pageId) {
            try {
              await pageRepository.update(data.pageId, { avatar: result.secure_url || result.url });
              queueLogger.info('Page avatar updated', { pageId: data.pageId });
            } catch (e) {
              queueLogger.warn('Failed to update page avatar', { pageId: data.pageId, err: e && e.message });
            }
          }

          return result;
        }
        if (name === 'banner') {
          const { userId, imageUrl } = data;
          const folder = process.env.CLOUDINARY_FOLDER_BANNERS || 'banners';
          const result = await cloudinary.uploadFromUrl(imageUrl, { folder });
          if (assetAdapter) {
            const assetId = data.assetId || job.id;
            const asset = await safeCreateAsset({
              id: assetId,
              userId,
              kind: 'banner',
              provider: 'cloudinary',
              providerPublicId: result.public_id,
              url: result.secure_url || result.url,
              mimeType: result.format || null,
              sizeBytes: result.bytes || null,
              metadata: result
            });
            if (asset && asset.id) queueLogger.info('Asset record created (banner)', { assetId: asset.id });
          }
          if (profileRepository) {
            const profile = await profileRepository.findByUserId(userId);
            if (profile) {
              await profileRepository.update(profile.id, { banner: result.secure_url || result.url });
              queueLogger.info('Profile banner updated', { userId });
            }
          }
          return result;
        }

        if (name === 'avatar-file' || name === 'banner-file') {
          const { userId, tmpFilePath } = data;
          const kind = data.kind || 'avatar';
          // ensure file exists
          try { 
            await fsPromises.access(tmpFilePath);
          } catch (e) {
            throw new Error('tmp_file_not_found');
          }
          // Per-kind validation rules
          const kindConfig = {
            avatar: { 
              allowedMime: 
              [
                'image/jpeg', 'image/png', 'image/webp'
              ], 
              maxBytes: 
              parseInt(process.env.MAX_AVATAR_BYTES), folder: process.env.CLOUDINARY_FOLDER || 'avatars' },
            banner: { 
              allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
              maxBytes: parseInt(process.env.MAX_BANNER_BYTES || process.env.MAX_AVATAR_BYTES || '5242880', 10),
              folder: process.env.CLOUDINARY_FOLDER_BANNERS || 'banners'
            },
            post_image: { allowedMime: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: parseInt(process.env.MAX_POST_IMAGE_BYTES), folder: process.env.CLOUDINARY_FOLDER_POSTS || 'posts' },
            document: { allowedMime: ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxBytes: parseInt(process.env.MAX_DOCUMENT_BYTES || '52428800', 10), folder: process.env.CLOUDINARY_FOLDER_DOCS || 'documents' }
          };
          const cfg = kindConfig[kind] || kindConfig.avatar;

          // size check
          const stats = await fsPromises.stat(tmpFilePath).catch(() => null);
          const sizeBytes = stats ? stats.size : null;
          if (sizeBytes && cfg.maxBytes && sizeBytes > cfg.maxBytes) {
            throw new Error('file_too_large');
          }

          // MIME detection using minimal file read
          const ft = await fileTypeFromFile(tmpFilePath).catch(() => null);
          if (ft && Array.isArray(cfg.allowedMime) && !cfg.allowedMime.includes(ft.mime)) {
            throw new Error('invalid_file_type');
          }

          // Stream file to Cloudinary to avoid buffering large files in memory
          const readStream = fs.createReadStream(tmpFilePath);
          const result = await cloudinary.uploadFromStream(readStream, { folder: cfg.folder });

          if (assetAdapter) {
            const assetId = data.assetId || job.id;
            const asset = await safeCreateAsset({
              id: assetId,
              userId,
              kind: kind || 'avatar',
              provider: 'cloudinary',
              providerPublicId: result.public_id,
              url: result.secure_url || result.url,
              mimeType: result.format || (ft && ft.mime) || null,
              sizeBytes: result.bytes || null,
              metadata: result
            });
            if (asset && asset.id) queueLogger.info('Asset record created from file upload', { assetId: asset.id });
          }

          if (profileRepository) {
            const profile = await profileRepository.findByUserId(userId);
            if (profile) {
              if (kind === 'banner') {
                await profileRepository.update(profile.id, { banner: result.secure_url || result.url });
                queueLogger.info('Profile banner updated from file', { userId });
              } else {
                await profileRepository.update(profile.id, { avatar: result.secure_url || result.url });
                queueLogger.info('Profile avatar updated from file', { userId });
              }
            }
          }
          // Update page record if pageId provided
          if (pageRepository && data.pageId) {
            try {
              if (kind === 'banner') {
                await pageRepository.update(data.pageId, { cover_image: result.secure_url || result.url });
                queueLogger.info('Page cover image updated from file', { pageId: data.pageId });
              } else {
                await pageRepository.update(data.pageId, { avatar: result.secure_url || result.url });
                queueLogger.info('Page avatar updated from file', { pageId: data.pageId });
              }
            } catch (e) {
              queueLogger.warn('Failed to update page from file upload', { pageId: data.pageId, err: e && e.message });
            }
          }

          // Cleanup temp file
          try {
            await fsPromises.unlink(tmpFilePath);
          } catch (e) {
            /* ignore cleanup errors */
          }

          return result;
        }

        if (name === 'register-direct') {
          const { userId, publicId, kind } = data;
          // Verify resource exists in Cloudinary
          let info = null;
          try {
            const cloud = cloudinary.configure ? cloudinary.configure() : cloudinary;
            info = await cloud.api.resource(publicId);
          } catch (e) {
            throw new Error('cloudinary_resource_not_found');
          }
          if (assetAdapter) {
            const assetId = data.assetId || job.id;
            const asset = await safeCreateAsset({
              id: assetId,
              userId,
              kind: kind || 'other',
              provider: 'cloudinary',
              providerPublicId: info.public_id,
              url: info.secure_url || info.url,
              mimeType: info.format || null,
              sizeBytes: info.bytes || null,
              metadata: info
            });
            if (asset && asset.id) queueLogger.info('Asset record created for direct upload', { assetId: asset.id });
          }
          // Optionally update profile image for avatar/banner-kind
          if ((kind === 'avatar' || kind === 'banner') && profileRepository) {
            const profile = await profileRepository.findByUserId(userId);
            if (profile) {
              if (kind === 'banner') {
                await profileRepository.update(profile.id, { banner: info.secure_url || info.url });
              } else {
                await profileRepository.update(profile.id, { avatar: info.secure_url || info.url });
              }
            }
          }
          // Optionally update page image for avatar/banner-kind
          if ((kind === 'avatar' || kind === 'banner') && pageRepository && data.pageId) {
            try {
              if (kind === 'banner') {
                await pageRepository.update(data.pageId, { cover_image: info.secure_url || info.url });
                queueLogger.info('Page cover image updated for direct register', { pageId: data.pageId });
              } else {
                await pageRepository.update(data.pageId, { avatar: info.secure_url || info.url });
                queueLogger.info('Page avatar updated for direct register', { pageId: data.pageId });
              }
            } catch (e) {
              queueLogger.warn('Failed to update page for direct register', { pageId: data.pageId, err: e && e.message });
            }
          }
          return info;
        }

        if (name === 'post_media_url') {
          const { postId, url, mediaType = 'image', displayOrder = 0 } = data;
          if (!url) throw new Error('url_required');
          // upload to cloudinary
          const folder = process.env.CLOUDINARY_FOLDER_POSTS || 'posts';
          const result = await cloudinary.uploadFromUrl(url, { folder });
          // persist post media record
          if (postMediaAdapter) {
            const mediaId = data.mediaId || uuidv4();
            await postMediaAdapter.create({ id: mediaId, post_id: postId, media_type: mediaType, url: result.secure_url || result.url, thumbnail_url: result.secure_url || result.url, display_order: displayOrder });
            queueLogger.info('Post media record created', { mediaId });
          }
          return result;
        }

        throw new Error(`Unknown job name: ${name}`);
      } catch (err) {
        queueLogger.error(`Job ${job.id} failed`, { error: err.message });
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency,
      maxStalledCount: 2,
      stalledInterval: 5000,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 }
    }
  );

  let isWorkerHealthy = false;
  worker.on('ready', () => { isWorkerHealthy = true; queueLogger.info('Media worker ready'); });
  worker.on('completed', (job) => queueLogger.info(`Job ${job.id} completed`));
  worker.on('failed', (job, err) => queueLogger.error(`Job ${job.id} failed`, { error: err.message }));
  worker.on('error', (err) => { isWorkerHealthy = false; queueLogger.error('Worker error', { error: err.message }); });
  worker.on('close', () => { isWorkerHealthy = false; queueLogger.warn('Worker closed'); });

  worker.isHealthy = () => isWorkerHealthy;
  return worker;
}

export async function queueMedia(mediaQueue, name, data = {}) {
  if (!mediaQueue) {
    queueLogger.warn('Media queue not initialized');
    return null;
  }
  try {
    const job = await mediaQueue.add(name, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false
    });
    queueLogger.info(`Queued media job ${job.id} (${name})`);
    return job;
  } catch (err) {
    queueLogger.error('Failed to queue media job', { error: err.message });
    throw err;
  }
}
