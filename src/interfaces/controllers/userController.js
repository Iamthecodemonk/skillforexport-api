import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { readProfileFromCache, writeProfileToCache } from '../../utils/redisProfileCache.js';
import { sendError } from '../errorResponse.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

const userLogger = logger.child('USER_CONTROLLER');

export function makeUserController({ useCase = null }) {
  if (!useCase) {
    userLogger.error('makeUserController requires a useCase');
    throw new Error('useCase_required');
  }

  return {
    getUser: async (req, reply) => {
      try {
        const { id } = req.params;
        const user = await useCase.getUser(id);
        if (!user)
          return reply.code(404).send({
            success: false,
            error: { code: 'user_not_found' }
          });
        return reply.send({ success: true, data: user.toPlainObject() });
      } catch (err) {
        userLogger.error('getUser error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    createUser: async (req, reply) => {
      try {
        const { email, password } = req.body;
        if (!email || !password) 
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.createUser({ email, password });
        return reply.code(201).send({ success: true, data: created.toPlainObject() });
      } catch (err) {
        if (err.message === 'invalid_email_format')
          return reply.code(422).send({
            success: false,
            error: { code: 'validation_failed' }
          });
        if (err.message === 'email_taken')
          return reply.code(409).send({
            success: false,
            error: { code: 'email_already_exists' }
          });
        userLogger.error('createUser error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getUserProfile: async (req, reply) => {
      try {
        const { id } = req.params; // user id
        const redis = req.server && (req.server.redisManager || req.server.redisClient);
        const cacheKey = `user:profile:${id}`;

        const cachedParsed = await readProfileFromCache(redis, cacheKey);
        if (cachedParsed) 
          return reply.send({ success: true, data: cachedParsed });

        const full = await useCase.getFullProfile(id);
        if (!full) 
          return reply.code(404).send({ success: false, error: { code: 'user_not_found' } });

        await writeProfileToCache(redis, cacheKey, full);

        return reply.send({ success: true, data: full });
      } catch (err) {
        userLogger.error('getUserProfile error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getMyProfile: async (req, reply) => {
      try {
        const userId = req.user && req.user.id;
        if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });

        const redis = req.server && (req.server.redisManager || req.server.redisClient);
        const cacheKey = `user:profile:${userId}`;

        const cachedParsed = await readProfileFromCache(redis, cacheKey);
        if (cachedParsed) return reply.send({ success: true, data: cachedParsed });

        const full = await useCase.getFullProfile(userId);
        if (!full) 
          return reply.code(404).send({ success: false, error: { code: 'user_not_found' } });

        await writeProfileToCache(redis, cacheKey, full);

        return reply.send({ success: true, data: full });
      } catch (err) {
        userLogger.error('getMyProfile error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },
    getMyStats: async (req, reply) => {
      try {
        const userId = req.user && req.user.id;
        if (!userId) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        const stats = await useCase.getUserStats(userId);
        return reply.send({ success: true, data: stats });
      } catch (err) {
        userLogger.error('getMyStats error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    updateUserProfile: async (req, reply) => {
      try {
        const { id } = req.params; // user id
        const patch = req.body ;
        const updated = await useCase.updateProfile(id, patch);
        // Invalidate cached profile for this user if Redis is available
        try {
          const redis = req.server && req.server.redisClient;
          if (redis) {
            const cacheKey = `user:profile:${id}`;
            await redis.del(cacheKey);
          }
        } catch (e) {
          userLogger.warn('Failed to invalidate profile cache', { err: e.message });
        }
        return reply.send({ success: true, data: updated.toPlainObject() });
      } catch (err) {
        if (err.message === 'profile_not_found')
          return reply.code(404).send({
            success: false,
            error: { code: 'profile_not_found' }
          });
        userLogger.error('updateUserProfile error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listUserSkills: async (req, reply) => {
      try {
        const { id } = req.params;
        const skills = await useCase.listSkills(id);
        return reply.send({ success: true, data: skills.map(s => s.toPlainObject()) });
      } catch (err) {
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    addUserSkill: async (req, reply) => {
      try {
        const { id } = req.params;
        const { skill, level } = req.body ;
        if (!skill)
          return reply.code(422).send({
            success: false,
            error: { code: 'validation_failed' }
          });
        const created = await useCase.addSkill(id, { skill, level });
        return reply.code(201).send({ success: true, data: created.toPlainObject() });
      } catch (err) {
        userLogger.error('addUserSkill error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listUserPortfolios: async (req, reply) => {
      try {
        const { id } = req.params;
        const portfolios = await useCase.listPortfolios(id);
        return reply.send({ success: true, data: portfolios.map(p => p.toPlainObject()) });
      } catch (err) {
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    addUserPortfolio: async (req, reply) => {
      try {
        const { id } = req.params;
        const { title, description, link } = req.body ;
        if (!title)
          return reply.code(422).send({
            success: false,
            error: { code: 'validation_failed' }
          });
        const created = await useCase.addPortfolio(id, { title, description, link });
        return reply.code(201).send({ success: true, data: created.toPlainObject() });
      } catch (err) {
        userLogger.error('addUserPortfolio error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // Enqueue avatar upload for background validation + Cloudinary upload
    uploadAvatar: async (req, reply) => {
      try {
        const { id } = req.params;
        const mediaQueue = req.server && req.server.mediaQueue ? req.server.mediaQueue : null;

        // If multipart/form-data (file upload)
        if (req.isMultipart && typeof req.file === 'function') {
          if (!mediaQueue) 
            return sendError(reply, 503, 'service_unavailable', 'Service unavailable');
          const mp = await req.file();
          if (!mp) 
            return sendError(reply, 422, 'validation_failed', 'Validation failed');

          const ext = path.extname(mp.filename || '') || '.jpg';
          const tmpDir = process.env.UPLOAD_TMP_DIR || os.tmpdir();
          const tmpName = `${uuidv4()}${ext}`;
          const tmpPath = path.join(tmpDir, tmpName);

          const writeStream = fs.createWriteStream(tmpPath);
          await new Promise((resolve, reject) => {
            mp.file.pipe(writeStream);
            mp.file.on('error', (err) => reject(err));
            writeStream.on('error', (err) => reject(err));
            writeStream.on('finish', resolve);
          });

          const job = await mediaQueue.add('avatar-file', { userId: id, tmpFilePath: tmpPath, kind: 'avatar', assetId: uuidv4() }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
          return reply.code(202).send({ success: true, data: { jobId: job.id } });
        }

        // Fallback: JSON body with imageUrl not needed for now sha
        // const { imageUrl } = req.body || {};
        // if (!imageUrl) 
        //   return sendError(reply, 422, 'validation_failed', 'Validation failed');
        // if (!mediaQueue) 
        //   return sendError(reply, 503, 'service_unavailable', 'Service unavailable');
        // // Prevent re-upload if avatar already exists unless replace=true
        // const replace = (req.query && (req.query.replace === 'true' || req.query.replace === true)) || false;
        // const existingProfile = await useCase.getProfile(id);
        // if (existingProfile && existingProfile.avatar && !replace) {
        //   return sendError(reply, 409, 'avatar_already_set', 'Avatar already set');
        // }
        // const job = await mediaQueue.add('avatar', { userId: id, imageUrl, assetId: uuidv4() }, { attempts: 2, backoff: { type: 'exponential', delay: 2000 } });
        // return reply.code(202).send({ success: true, data: { jobId: job.id } });
      } catch (err) {
        userLogger.error('uploadAvatar error', { message: err.message, stack: err.stack });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },
    // Enqueue banner upload for background validation + Cloudinary upload
    uploadBanner: async (req, reply) => {
      try {
        const { id } = req.params;
        const mediaQueue = req.server && req.server.mediaQueue ? req.server.mediaQueue : null;

        // If multipart/form-data (file upload)
        if (req.isMultipart && typeof req.file === 'function') {
          if (!mediaQueue) 
            return sendError(reply, 503, 'service_unavailable', 'Service unavailable');
          const mp = await req.file();
          if (!mp) 
            return sendError(reply, 422, 'validation_failed', 'Validation failed');

          const ext = path.extname(mp.filename || '') || '.jpg';
          const tmpDir = process.env.UPLOAD_TMP_DIR || os.tmpdir();
          const tmpName = `${uuidv4()}${ext}`;
          const tmpPath = path.join(tmpDir, tmpName);

          const writeStream = fs.createWriteStream(tmpPath);
          await new Promise((resolve, reject) => {
            mp.file.pipe(writeStream);
            mp.file.on('error', (err) => reject(err));
            writeStream.on('error', (err) => reject(err));
            writeStream.on('finish', resolve);
          });

          const job = await mediaQueue.add('banner-file', 
            {
              userId: id, 
              tmpFilePath: tmpPath, 
              kind: 'banner', 
              assetId: uuidv4() 
            }, 
            { 
              attempts: 3, 
              backoff: { 
                type: 'exponential', delay: 2000 
              } 
            }
          );
          return reply.code(202).send({ success: true, data: { jobId: job.id } });
        }
        
        //omo i dont need a fall back oo for code consistency
        // Fallback: JSON body with imageUrl
        // const { imageUrl } = req.body || {};
        // if (!imageUrl) return sendError(reply, 422, 'validation_failed', 'Validation failed');
        // if (!mediaQueue) return sendError(reply, 503, 'service_unavailable', 'Service unavailable');
        // const replace = (req.query && (req.query.replace === 'true' || req.query.replace === true)) || false;
        // const existingProfile = await useCase.getProfile(id);
        // if (existingProfile && existingProfile.banner && !replace) {
        //   return sendError(reply, 409, 'banner_already_set', 'Banner already set');
        // }
        // const job = await mediaQueue.add('banner', { userId: id, imageUrl, assetId: uuidv4() }, { attempts: 2, backoff: { type: 'exponential', delay: 2000 } });
        // return reply.code(202).send({ success: true, data: { jobId: job.id } });
      } catch (err) {
        userLogger.error('uploadBanner error', { message: err.message, stack: err.stack });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    followUser: async (req, reply) => {
      try {
        const { id } = req.params; // target user id
        const actorId = req.user && req.user.id;
        if (!actorId)
          return reply.code(422).send({
            success: false,
            error: { code: 'validation_failed' }
          });
        const created = await useCase.followUser(id, actorId);
        return reply.code(201).send({ success: true, data: created.toPlainObject() });
      } catch (err) {
        userLogger.error('followUser error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listFollowers: async (req, reply) => {
      try {
        const { id } = req.params;
          const rows = await useCase.listFollowers(id);
        return reply.send({ success: true, data: rows.map(r => r.toPlainObject()) });
      } catch (err) {
        userLogger.error('listFollowers error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listLoginHistory: async (req, reply) => {
      try {
        const { id } = req.params;
          const rows = await useCase.listLoginHistory(id);
        return reply.send({ success: true, data: rows.map(r => r.toPlainObject()) });
      } catch (err) {
        userLogger.error('listLoginHistory error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // Create profile for user
    createProfile: async (req, reply) => {
      try {
        // Prefer authenticated subject; fall back to path param if absent
        const actorId = req.user && req.user.id;
        const { id: paramId } = req.params;
        const userId = actorId || paramId;
        if (!userId) 
          return sendError(reply, 401, 'unauthorized', 'Unauthorized');

        // Prevent clients from supplying their own profile id
        const data = Object.assign({}, req.body || {});
        if ('id' in data) 
          delete data.id;

        const created = await useCase.createProfile(userId, data);
        const payload = created && typeof created.toPlainObject === 'function' ? created.toPlainObject() : created;
        return reply.code(201).send({ success: true, data: payload });
      } catch (err) {
        if (err && err.message === 'user_not_found') {
          return sendError(reply, 404, 'user_not_found', 'User not found');
        }
        if (err && err.message === 'profile_already_exists') {
          return sendError(reply, 409, 'profile_already_exists', 'Profile already exists');
        }
        if (err && err.message === 'username_taken') {
          return sendError(reply, 409, 'username_taken', 'Username already taken');
        }
        // Handle duplicate key errors (e.g., unique username)
        if (err) {
          const msg = String(err.message || err.sqlMessage || '');
          const lower = msg.toLowerCase();
          if (err.code === 'ER_DUP_ENTRY' || lower.includes('duplicate entry')) {//just incase sha
            // Detect whether the username unique constraint caused the failure
            const isUsername = msg.includes('user_profiles.username') || lower.includes('username');
            const errorCode = isUsername ? 'username_taken' : 'duplicate_entry';
            userLogger.warn('createProfile duplicate key', { code: err.code, message: msg });
            return sendError(reply, 409, errorCode, 'Duplicate entry');
          }
        }
        userLogger.error('createProfile error', { message: err.message, stack: err.stack });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    // Delete a specific user skill
    deleteSkill: async (req, reply) => {
      try {
        const { id, skillId } = req.params;
        await useCase.deleteSkill(id, skillId);
        return reply.code(204).send();
      } catch (err) {
        userLogger.error('deleteSkill error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // Delete a user portfolio
    deletePortfolio: async (req, reply) => {
      try {
        const { id, portfolioId } = req.params;
        await useCase.deletePortfolio(id, portfolioId);
        return reply.code(204).send();
      } catch (err) {
        userLogger.error('deletePortfolio error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    createOauthAccount: async (req, reply) => {
      try {
        const { id } = req.params; // user id
        const { provider, providerId, providerEmail, avatarUrl, rawData } = req.body ;
        if (!provider || !providerId)
          return reply.code(422).send({
            success: false,
            error: { code: 'validation_failed' }
          });
        const created = await useCase.createOauthAccount(id, { provider, providerId, providerEmail, avatarUrl, rawData });
        return reply.code(201).send({ success: true, data: created.toPlainObject() });
      } catch (err) {
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,listCertifications: async (req, reply) => {
      try {
        const { id } = req.params;
        const rows = await useCase.listCertifications(id);
        return reply.send({ success: true, data: rows.map(r => r.toPlainObject()) });
      } catch (err) {
        userLogger.error('listCertifications error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,addCertification: async (req, reply) => {
      try {
        const { id } = req.params;
        const { name, issuer, issueDate } = req.body || {};
        if (!name) 
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.addCertification(id, { name, issuer, issueDate });
        return reply.code(201).send({ success: true, data: created.toPlainObject ? created.toPlainObject() : created });
      } catch (err) {
        userLogger.error('addCertification error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,deleteCertification: async (req, reply) => {
      try {
        const { id, certId } = req.params;
        await useCase.deleteCertification(id, certId);
        return reply.code(204).send();
      } catch (err) {
        userLogger.error('deleteCertification error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,listEducation: async (req, reply) => {
      try {
        const { id } = req.params;
        const rows = await useCase.listEducation(id);
        return reply.send({ success: true, data: rows.map(r => r.toPlainObject()) });
      } catch (err) {
        userLogger.error('listEducation error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,addEducation: async (req, reply) => {
      try {
        const { id } = req.params;
        const { school, degree, field, startDate, endDate } = req.body || {};
        if (!school) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.addEducation(id, { school, degree, field, startDate, endDate });
        return reply.code(201).send({ success: true, data: created.toPlainObject ? created.toPlainObject() : created });
      } catch (err) {
        userLogger.error('addEducation error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,deleteEducation: async (req, reply) => {
      try {
        const { id, eduId } = req.params;
        await useCase.deleteEducation(id, eduId);
        return reply.code(204).send();
      } catch (err) {
        userLogger.error('deleteEducation error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,listExperiences: async (req, reply) => {
      try {
        const { id } = req.params;
        const rows = await useCase.listExperiences(id);
        return reply.send({ success: true, data: rows.map(r => r.toPlainObject()) });
      } catch (err) {
        userLogger.error('listExperiences error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,addExperience: async (req, reply) => {
      try {
        const { id } = req.params;
        const { company, title, employmentType, startDate, endDate, isCurrent, description } = req.body || {};
        if (!company || !title) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        const created = await useCase.addExperience(id, { company, title, employmentType, startDate, endDate, isCurrent, description });
        return reply.code(201).send({ success: true, data: created.toPlainObject ? created.toPlainObject() : created });
      } catch (err) {
        userLogger.error('addExperience error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }

    ,deleteExperience: async (req, reply) => {
      try {
        const { id, expId } = req.params;
        await useCase.deleteExperience(id, expId);
        return reply.code(204).send();
      } catch (err) {
        userLogger.error('deleteExperience error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
