import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';
import db from '../../infrastructure/knexConfig.js';

const mediaLogger = logger.child('MEDIA_CONTROLLER');

export function makeMediaController({ cloudinary = null, mediaQueue = null, assetAdapter = null } = {}) {
  const uploadFileToCloudinary = async ({ mp, actorId, pageId = null, kind, title = null, folder = null }) => {
    const isVideo = kind === 'video' || (mp.mimetype || '').startsWith('video/');
    const isDocument = kind === 'document' || (!isVideo && !(mp.mimetype || '').startsWith('image/'));
    const uploadFolder = folder || (isVideo
      ? (process.env.CLOUDINARY_FOLDER_VIDEOS || process.env.CLOUDINARY_FOLDER_POSTS || 'posts')
      : isDocument
        ? (process.env.CLOUDINARY_FOLDER_DOCS || 'documents')
        : (process.env.CLOUDINARY_FOLDER_POSTS || 'posts'));
    const resourceType = isVideo ? 'video' : (isDocument ? 'raw' : 'image');
    const result = await cloudinary.uploadFromStream(mp.file, {
      folder: uploadFolder,
      resource_type: resourceType
    });
    const assetId = uuidv4();
    const asset = await assetAdapter.create({
      id: assetId,
      userId: actorId,
      pageId,
      kind,
      title: title || mp.filename || null,
      provider: 'cloudinary',
      providerPublicId: result.public_id,
      url: result.secure_url || result.url,
      mimeType: mp.mimetype || result.resource_type || result.format || null,
      sizeBytes: result.bytes || null,
      metadata: { ...result, title: title || mp.filename || null, pageId, userId: actorId, kind, originalFilename: mp.filename || null }
    });

    return {
      assetId,
      id: assetId,
      url: result.secure_url || result.url,
      publicId: result.public_id,
      kind,
      title: title || mp.filename || null,
      mimeType: mp.mimetype || null,
      sizeBytes: result.bytes || null,
      asset
    };
  };

  const profileToPlain = (profile) => profile && typeof profile.toPlainObject === 'function'
    ? profile.toPlainObject()
    : profile;

  return {
    getCloudinarySignature: async (req, reply) => {
      try {
        // Ensure Cloudinary is configured via env
        if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
          mediaLogger.warn('Cloudinary not configured');
          return reply.code(503).send({ success: false, error: { code: 'cloudinary_not_configured' } });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const apiSecret = process.env.CLOUDINARY_API_SECRET || '';
        const signature = crypto.createHash('sha1').update(`timestamp=${timestamp}${apiSecret}`).digest('hex');

        return reply.code(200).send({
          success: true,
          data: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            timestamp,
            signature
          }
        });
      } catch (err) {
        mediaLogger.error('getCloudinarySignature error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    registerMedia: async (req, reply) => {
      try {
        const body = req.body || {};
        const publicId = body.publicId || body.public_id;
        const actorId = req.user && req.user.id;
        const actorRole = req.user && req.user.role;
        const requestedUserId = body.userId || body.user_id || null;
        const pageId = body.pageId || body.page_id || null;
        const title = body.title || null;
        const kind = body.kind || 'other';
        const userId = pageId && !requestedUserId ? null : (requestedUserId || actorId);

        if (!publicId) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }
        if (!actorId) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        }
        if (requestedUserId && requestedUserId !== actorId && actorRole !== 'admin') {
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        }
        if (!pageId && !userId) {
          return reply.code(422).send({ success: false, error: { code: 'owner_required', message: 'Provide pageId or userId' } });
        }

        if (!mediaQueue) {
          return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        }

        if ((kind === 'avatar' || kind === 'banner') && req.server && req.server.profileRepository) {
          const replace = (req.query && (req.query.replace === 'true' || req.query.replace === true)) || false;
          const existingProfile = await req.server.profileRepository.findByUserId(userId);
          if (existingProfile) {
            if (kind === 'avatar' && existingProfile.avatar && !replace) {
              return reply.code(409).send({ success: false, error: { code: 'avatar_already_set' } });
            }
            if (kind === 'banner' && existingProfile.banner && !replace) {
              return reply.code(409).send({ success: false, error: { code: 'banner_already_set' } });
            }
          }
        }
        const assetId = uuidv4();
        const job = await mediaQueue.add('register-direct', { userId, pageId, publicId, kind, title, assetId }, { attempts: 2, backoff: { type: 'exponential', delay: 2000 } });
        return reply.code(202).send({ success: true, data: { jobId: job.id, assetId } });
      } catch (err) {
        mediaLogger.error('registerMedia error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    uploadMediaFile: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        if (!actorId) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        }
        if (!cloudinary || typeof cloudinary.uploadFromStream !== 'function' || !assetAdapter) {
          return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        }

        const mp = await req.file();
        if (!mp) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed', message: 'file is required' } });
        }

        const fieldValue = (name) => {
          const field = mp.fields && mp.fields[name];
          if (!field) return null;
          return typeof field.value === 'undefined' ? field : field.value;
        };
        const title = fieldValue('title') || mp.filename || null;
        const pageId = fieldValue('pageId') || fieldValue('page_id') || null;
        const rawKind = fieldValue('kind') || (mp.mimetype && mp.mimetype.startsWith('video/') ? 'video' : 'post_image');
        const kind = rawKind === 'image' ? 'post_image' : rawKind;
        const isVideo = kind === 'video' || (mp.mimetype || '').startsWith('video/');
        const isDocument = kind === 'document' || (!isVideo && !(mp.mimetype || '').startsWith('image/'));
        const folder = isVideo
          ? (process.env.CLOUDINARY_FOLDER_VIDEOS || process.env.CLOUDINARY_FOLDER_POSTS || 'posts')
          : isDocument
            ? (process.env.CLOUDINARY_FOLDER_DOCS || 'documents')
            : (process.env.CLOUDINARY_FOLDER_POSTS || 'posts');
        const resourceType = isVideo ? 'video' : (isDocument ? 'raw' : 'image');

        const result = await cloudinary.uploadFromStream(mp.file, {
          folder,
          resource_type: resourceType
        });
        const assetId = uuidv4();
        const asset = await assetAdapter.create({
          id: assetId,
          userId: actorId,
          pageId,
          kind,
          title,
          provider: 'cloudinary',
          providerPublicId: result.public_id,
          url: result.secure_url || result.url,
          mimeType: mp.mimetype || result.resource_type || result.format || null,
          sizeBytes: result.bytes || null,
          metadata: { ...result, title, pageId, userId: actorId, kind, originalFilename: mp.filename || null }
        });

        return reply.code(201).send({
          success: true,
          message: 'Media uploaded successfully',
          data: {
            assetId,
            id: assetId,
            url: result.secure_url || result.url,
            publicId: result.public_id,
            kind,
            title,
            mimeType: mp.mimetype || null,
            sizeBytes: result.bytes || null,
            asset
          }
        });
      } catch (err) {
        mediaLogger.error('uploadMediaFile error', { message: err.message, stack: err.stack });
        if (err.message === 'cloudinary_not_configured') {
          return reply.code(503).send({ success: false, error: { code: 'cloudinary_not_configured' } });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    uploadAvatarFile: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        const actorRole = req.user && req.user.role;
        const userId = (req.params && req.params.id) || actorId;
        const kind = (req.query && req.query.kind) === 'banner' ? 'banner' : 'avatar';
        const field = kind === 'banner' ? 'banner' : 'avatar';
        const replace = (req.query && (req.query.replace === 'true' || req.query.replace === true)) || false;

        if (!actorId) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        }
        if (userId !== actorId && actorRole !== 'admin') {
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        }
        if (!cloudinary || typeof cloudinary.uploadFromStream !== 'function' || !assetAdapter) {
          return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        }

        const profileRepository = req.server && req.server.profileRepository;
        let profile = profileRepository && await profileRepository.findByUserId(userId);
        const plainProfile = profileToPlain(profile);
        if (plainProfile && plainProfile[field] && !replace) {
          return reply.code(409).send({ success: false, error: { code: `${field}_already_set` } });
        }

        const mp = await req.file();
        if (!mp) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed', message: 'file is required' } });
        }

        const upload = await uploadFileToCloudinary({
          mp,
          actorId,
          kind,
          folder: kind === 'banner' ? (process.env.CLOUDINARY_FOLDER_BANNERS || 'banners') : (process.env.CLOUDINARY_FOLDER_AVATARS || 'avatars')
        });

        if (profileRepository) {
          if (profile) {
            profile = await profileRepository.update(profile.id, { [field]: upload.url });
          } else {
            profile = await profileRepository.create({
              id: uuidv4(),
              user_id: userId,
              [field]: upload.url,
              created_at: new Date()
            });
          }
        }

        return reply.code(201).send({
          success: true,
          message: `${field === 'banner' ? 'Banner' : 'Avatar'} uploaded successfully`,
          data: {
            ...upload,
            [field]: upload.url,
            profile: profileToPlain(profile)
          }
        });
      } catch (err) {
        mediaLogger.error('uploadAvatarFile error', { message: err.message, stack: err.stack });
        if (err.message === 'cloudinary_not_configured') {
          return reply.code(503).send({ success: false, error: { code: 'cloudinary_not_configured' } });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    uploadPageAvatarFile: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        const actorRole = req.user && req.user.role;
        if (!actorId) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        }
        if (!cloudinary || typeof cloudinary.uploadFromStream !== 'function' || !assetAdapter) {
          return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        }

        const pageId = req.params && req.params.id;
        if (!pageId) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const page = await db('pages').where({ id: pageId }).first();
        if (!page) return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        if (page.owner_id !== actorId && actorRole !== 'admin') {
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        }

        const mp = await req.file();
        if (!mp) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed', message: 'file is required' } });
        }

        const upload = await uploadFileToCloudinary({
          mp,
          actorId,
          pageId,
          kind: 'avatar',
          folder: process.env.CLOUDINARY_FOLDER_PAGE_AVATARS || 'pages'
        });

        await db('pages').where({ id: pageId }).update({ avatar: upload.url, updated_at: new Date() });
        const updatedPage = await db('pages').where({ id: pageId }).first();
        return reply.code(201).send({
          success: true,
          message: 'Page avatar uploaded successfully',
          data: {
            ...upload,
            avatar: upload.url,
            page: updatedPage
          }
        });
      } catch (err) {
        mediaLogger.error('uploadPageAvatarFile error', { message: err.message, stack: err.stack });
        if (err.message === 'cloudinary_not_configured') {
          return reply.code(503).send({ success: false, error: { code: 'cloudinary_not_configured' } });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    uploadPageCoverFile: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        const actorRole = req.user && req.user.role;
        if (!actorId) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        }
        if (!cloudinary || typeof cloudinary.uploadFromStream !== 'function' || !assetAdapter) {
          return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        }

        const pageId = req.params && req.params.id;
        if (!pageId) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const page = await db('pages').where({ id: pageId }).first();
        if (!page) return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        if (page.owner_id !== actorId && actorRole !== 'admin') {
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        }

        const mp = await req.file();
        if (!mp) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed', message: 'file is required' } });
        }

        const upload = await uploadFileToCloudinary({
          mp,
          actorId,
          pageId,
          kind: 'banner',
          folder: process.env.CLOUDINARY_FOLDER_PAGE_COVERS || 'pages'
        });

        await db('pages').where({ id: pageId }).update({ cover_image: upload.url, updated_at: new Date() });
        const updatedPage = await db('pages').where({ id: pageId }).first();
        return reply.code(201).send({
          success: true,
          message: 'Page cover uploaded successfully',
          data: {
            ...upload,
            coverImage: upload.url,
            cover_image: upload.url,
            page: updatedPage
          }
        });
      } catch (err) {
        mediaLogger.error('uploadPageCoverFile error', { message: err.message, stack: err.stack });
        if (err.message === 'cloudinary_not_configured') {
          return reply.code(503).send({ success: false, error: { code: 'cloudinary_not_configured' } });
        }
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    uploadPageImageFile: async (req, reply) => {
      try {
        const actorId = req.user && req.user.id;
        const actorRole = req.user && req.user.role;
        if (!actorId) 
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (!cloudinary || typeof cloudinary.uploadFromStream !== 'function' || !assetAdapter) {
          return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        }

        const pageId = req.params && req.params.id;
        if (!pageId) 
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const page = await db('pages').where({ id: pageId }).first();
        if (!page) 
          return reply.code(404).send({ success: false, error: { code: 'page_not_found' } });
        if (page.owner_id !== actorId && actorRole !== 'admin') return reply.code(403).send({ success: false, error: { code: 'forbidden' } });

        const mp = await req.file();
        if (!mp) 
          return reply.code(422).send({ success: false, error: { code: 'validation_failed', message: 'file is required' } });

        const titleField = (mp.fields && mp.fields.title) ? (mp.fields.title.value || mp.fields.title) : null;
        const title = titleField || mp.filename || null;

        const folder = process.env.CLOUDINARY_FOLDER_PAGE_IMAGES || 'page_images';
        const result = await cloudinary.uploadFromStream(mp.file, { folder });

        const assetId = uuidv4();
        const asset = await assetAdapter.create({
          id: assetId,
          userId: actorId,
          pageId,
          kind: 'page_image',
          title,
          provider: 'cloudinary',
          providerPublicId: result.public_id,
          url: result.secure_url || result.url,
          mimeType: mp.mimetype || result.format || null,
          sizeBytes: result.bytes || null,
          metadata: { ...result, title, pageId, userId: actorId }
        });

        return reply.code(201).send({
          success: true,
          message: 'Page image uploaded successfully',
          data: {
            assetId,
            id: assetId,
            url: result.secure_url || result.url,
            publicId: result.public_id,
            kind: 'page_image',
            title,
            mimeType: mp.mimetype || null,
            sizeBytes: result.bytes || null,
            asset
          }
        });
      } catch (err) {
        mediaLogger.error('uploadPageImageFile error', { message: err.message, stack: err.stack });
        if (err.message === 'cloudinary_not_configured') 
          return reply.code(503).send({ success: false, error: { code: 'cloudinary_not_configured' } });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // Poll job status for a media job
    getJobStatus: async (req, reply) => {
      try {
        const jobId = req.params && req.params.id;
        if (!jobId) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        if (!mediaQueue) return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });

        const job = await mediaQueue.getJob(jobId);
        if (!job) return reply.code(404).send({ success: false, error: { code: 'job_not_found' } });

        const state = await job.getState();
        // Map common failure reasons to friendly messages for clients
        const failureMessages = {
          invalid_file_type: 'Only JPG, PNG or WEBP images are allowed.',
          invalid_image_url: 'The provided URL did not return a valid image. Upload the image file or provide a direct image URL.',
          tmp_file_not_found: 'Uploaded file not found on server; please retry.',
          cloudinary_resource_not_found: 'Uploaded resource not found on Cloudinary.',
          invalid_media_kind: 'Uploaded resource type does not match the requested media kind.',
          cloudinary_not_configured: 'Image service is not configured. Contact support.',
          upload_failed: 'Failed to upload image. Please try again later.',
          file_too_large: 'The uploaded file exceeds the allowed size for this type.'
        };

        const result = {
          id: job.id,
          name: job.name,
          state,
          attemptsMade: job.attemptsMade || 0,
          failedReason: job.failedReason || null,
          friendlyMessage: job.failedReason ? (failureMessages[job.failedReason] || 'An error occurred while processing the image.') : null,
          returnvalue: job.returnvalue || null,
          data: job.data || null
        };
        return reply.send({ success: true, data: result });
      } catch (err) {
        mediaLogger.error('getJobStatus error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}

