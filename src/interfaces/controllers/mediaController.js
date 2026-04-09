import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

const mediaLogger = logger.child('MEDIA_CONTROLLER');

export function makeMediaController({ cloudinary = null, mediaQueue = null, assetAdapter = null } = {}) {
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
        const publicId = body.publicId;
        const userId = (req.user && req.user.id) || body.userId;
        const kind = body.kind || 'other';

        if (!publicId || !userId) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
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
        const job = await mediaQueue.add('register-direct', { userId, publicId, kind, assetId: uuidv4() }, { attempts: 2, backoff: { type: 'exponential', delay: 2000 } });
        return reply.code(202).send({ success: true, data: { jobId: job.id } });
      } catch (err) {
        mediaLogger.error('registerMedia error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    uploadAvatarFile: async (req, reply) => {
      try {
        if (!mediaQueue) {
          return reply.code(503).send({ success: false, error: { code: 'service_unavailable' } });
        }

        const userId = req.params && req.params.id;
        // Allow clients to provide an optional kind query param (e.g. ?kind=post_image)
        const kind = (req.query && req.query.kind) || 'avatar';
        // Prevent re-upload if avatar already exists
        if ((kind === 'avatar' || kind === 'banner') && req.server && req.server.profileRepository) {
          const replace = !!body.replace;
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

        // Accept a single file field named 'file'
        const mp = await req.file();
        if (!mp) {
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        }

        const ext = path.extname(mp.filename || '') || '.jpg';
        const tmpDir = process.env.UPLOAD_TMP_DIR || os.tmpdir();
        const tmpName = `${uuidv4()}${ext}`;
        const tmpPath = path.join(tmpDir, tmpName);

        // Stream file to temporary location
        const writeStream = fs.createWriteStream(tmpPath);
        await new Promise((resolve, reject) => {
          mp.file.pipe(writeStream);
          mp.file.on('error', (err) => reject(err));
          writeStream.on('error', (err) => reject(err));
          writeStream.on('finish', resolve);
        });

        const job = await mediaQueue.add('avatar-file', { userId, tmpFilePath: tmpPath, kind, assetId: uuidv4() }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
        return reply.code(202).send({ success: true, data: { jobId: job.id } });
      } catch (err) {
        mediaLogger.error('uploadAvatarFile error', { message: err.message, stack: err.stack });
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
          tmp_file_not_found: 'Uploaded file not found on server; please retry.',
          cloudinary_resource_not_found: 'Uploaded resource not found on Cloudinary.',
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

