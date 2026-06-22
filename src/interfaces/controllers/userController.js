import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { readProfileFromCache, writeProfileToCache } from '../../utils/redisProfileCache.js';
import { sendError } from '../errorResponse.js';
import { parsePagination, buildPaginatedResponse } from '../paginationResponse.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

const userLogger = logger.child('USER_CONTROLLER');

function isMultipartRequest(req) {
  return typeof req.isMultipart === 'function' ? req.isMultipart() : Boolean(req.isMultipart);
}

function shouldReplace(req) {
  return Boolean(req.query && (req.query.replace === 'true' || req.query.replace === true));
}

async function enqueueProfileImageFromUrl({ req, reply, useCase, mediaQueue, userId, kind }) {
  const body = req.body || {};
  const imageUrl = body.imageUrl || body.url || body.secureUrl || body.secure_url;
  const publicId = body.publicId || body.public_id;
  if (!userId) return sendError(reply, 422, 'validation_failed', 'User id is required');
  if (!imageUrl && !publicId) return sendError(reply, 422, 'validation_failed', 'Provide imageUrl or publicId');
  if (!mediaQueue) return sendError(reply, 503, 'service_unavailable', 'Service unavailable');

  const field = kind === 'banner' ? 'banner' : 'avatar';
  const existingProfile = await useCase.getProfile(userId);
  if (existingProfile && existingProfile[field] && !shouldReplace(req)) {
    return sendError(reply, 409, `${field}_already_set`, `${field === 'banner' ? 'Banner' : 'Avatar'} already set`);
  }

  const jobName = publicId ? 'register-direct' : kind;
  const payload = publicId
    ? { userId, publicId, kind, assetId: uuidv4() }
    : { userId, imageUrl, assetId: uuidv4() };
  const job = await mediaQueue.add(jobName, payload, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 }
  });
  return reply.code(202).send({ success: true, data: { jobId: job.id } });
}

const invalidateCompactFeedCache = async (req) => {
  try {
    const redis = req.server && (req.server.redisManager || req.server.redisClient);
    if (!redis || typeof redis.keys !== 'function') return;
    const keys = await redis.keys('feed:compact:*');
    if (!keys || keys.length === 0) return;
    if (redis.client && typeof redis.client === 'function') {
      const client = redis.client();
      if (client && typeof client.del === 'function') await client.del(...keys);
      return;
    }
    if (typeof redis.del === 'function') await redis.del(...keys);
  } catch (err) {
    userLogger.warn('compact feed cache invalidation failed', { message: err && err.message });
  }
};

const invalidateUserProfileCaches = async (req, userIds = []) => {
  try {
    const redis = req.server && (req.server.redisManager || req.server.redisClient);
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!redis || ids.length === 0) return;
    const keys = ids.map((id) => `user:profile:${id}`);
    if (redis.client && typeof redis.client === 'function') {
      const client = redis.client();
      if (client && typeof client.del === 'function') await client.del(...keys);
      return;
    }
    if (typeof redis.del === 'function') await redis.del(...keys);
  } catch (err) {
    userLogger.warn('profile cache invalidation failed', { message: err && err.message });
  }
};

export function makeUserController({ useCase = null, followerRepository = null, notificationRepository = null }) {
  if (!useCase) {
    userLogger.error('makeUserController requires a useCase');
    throw new Error('useCase_required');
  }

  return {
    listUsers: async (req, reply) => {
      try {
        const { page, perPage, limit, offset } = parsePagination(req.query, 20);
        const result = await useCase.listUsersWithActivity({ limit, offset });
        const payload = buildPaginatedResponse(req, {
          data: result.users,
          page,
          perPage,
          total: result.total
        });
        return reply.send(payload);
      } catch (err) {
        userLogger.error('listUsers error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getUser: async (req, reply) => {
      try {
        const { id } = req.params;
        const user = await useCase.getUserWithActivity(id);
        if (!user)
          return reply.code(404).send({
            success: false,
            error: { code: 'user_not_found' }
          });
        return reply.send({ success: true, message: 'Success', data: user });
      } catch (err) {
        userLogger.error('getUser error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    getPublicProfile: async (req, reply) => {
      try {
        const { id } = req.params;
        const profile = await useCase.getPublicProfile(id);
        if (!profile) {
          return reply.code(404).send({ success: false, error: { code: 'user_not_found' } });
        }
        return reply.send({ success: true, message: 'Success', data: profile });
      } catch (err) {
        userLogger.error('getPublicProfile error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    updateUser: async (req, reply) => {
      try {
        const { id } = req.params;
        const body = req.body || {};
        const actor = req.user || null;
        const updated = await useCase.updateUserDisplayName(id, actor, body);
        try {
          const redis = req.server && req.server.redisClient;
          if (redis) await redis.del(`user:profile:${id}`);
        } catch (e) {
          userLogger.warn('Failed to invalidate profile cache', { err: e.message });
        }
        return reply.send({ success: true, data: updated });
      } catch (err) {
        if (err.message === 'unauthorized') return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        if (err.message === 'forbidden') return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        if (err.message === 'user_not_found') return reply.code(404).send({ success: false, error: { code: 'user_not_found' } });
        if (err.message === 'name_required' || err.message === 'user_required') return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        userLogger.error('updateUser error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    createUser: async (req, reply) => {
      try {
        const { email, password, role } = req.body;
        if (!email || !password)
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });

        // Validate role if provided; only allow 'user' or 'admin'
        const allowedRoles = ['user', 'admin'];
        const roleToUse = role && typeof role === 'string' ? role : undefined;
        if (typeof roleToUse !== 'undefined' && !allowedRoles.includes(roleToUse)) {
          return reply.code(422).send({ 
            success: false, 
            error: { 
              code: 'validation_failed', 
              message: 'role must be one of: user, admin' 
            } 
          });
        }

        const created = await useCase.createUser({ email, password, role: roleToUse });
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
          return reply.send({ success: true, message: 'Profile fetched successfully', data: cachedParsed });

        const full = await useCase.getFullProfile(id);
        if (!full) 
          return reply.code(404).send({ success: false, error: { code: 'user_not_found' } });

        await writeProfileToCache(redis, cacheKey, full);

        return reply.send({ success: true, message: 'Profile fetched successfully', data: full });
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
        if (cachedParsed) return reply.send({ success: true, message: 'Profile fetched successfully', data: cachedParsed });

        const full = await useCase.getFullProfile(userId);
        if (!full) 
          return reply.code(404).send({ success: false, error: { code: 'user_not_found' } });

        await writeProfileToCache(redis, cacheKey, full);

        return reply.send({ success: true, message: 'Profile fetched successfully', data: full });
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
        const patch = req.body || {};
        const actor = req.user || null;
        if (!actor) 
          return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
        // Only allow owners or admins to update a profile
        if (actor.id !== id && actor.role !== 'admin') 
          return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
        const updated = await useCase.updateProfile(id, patch);
        if (!updated) 
          return reply.code(404).send({ success: false, error: { code: 'profile_not_found' } });
        // Invalidate cached profile for this user if Redis is available
        try {
          const redis = req.server && (req.server.redisManager || req.server.redisClient);
          if (redis) {
            const cacheKey = `user:profile:${id}`;
            await redis.del(cacheKey);
          }
        } catch (e) {
          userLogger.warn('Failed to invalidate profile cache', { err: e.message });
        }
        return reply.send({ success: true, message: 'Profile updated successfully', data: (typeof updated.toPlainObject === 'function' ? updated.toPlainObject() : updated) });
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
        return reply.code(201).send({ success: true, message: 'Skill added', data: created.toPlainObject() });
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
        const { title, description, link, pictures } = req.body ;
        if (!title)
          return reply.code(422).send({
            success: false,
            error: { code: 'validation_failed' }
          });
        const created = await useCase.addPortfolio(id, { title, description, link, pictures });
        return reply.code(201).send({ success: true, message: 'Portfolio added', data: created.toPlainObject() });
      } catch (err) {
        userLogger.error('addUserPortfolio error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    // Enqueue avatar upload for background validation + Cloudinary upload
    uploadAvatar: async (req, reply) => {
      try {
        const { id } = req.params;
        const userId = (req.user && req.user.id) || id;
        const mediaQueue = req.server && req.server.mediaQueue ? req.server.mediaQueue : null;

        // If multipart/form-data (file upload)
        if (isMultipartRequest(req) && typeof req.file === 'function') {
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

          const job = await mediaQueue.add('avatar-file', { userId, tmpFilePath: tmpPath, kind: 'avatar', assetId: uuidv4() }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
          return reply.code(202).send({ success: true, data: { jobId: job.id } });
        }

        return enqueueProfileImageFromUrl({ req, reply, useCase, mediaQueue, userId, kind: 'avatar' });
      } catch (err) {
        userLogger.error('uploadAvatar error', { message: err.message, stack: err.stack });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },
    // Enqueue banner upload for background validation + Cloudinary upload
    uploadBanner: async (req, reply) => {
      try {
        const { id } = req.params;
        const userId = (req.user && req.user.id) || id;
        const mediaQueue = req.server && req.server.mediaQueue ? req.server.mediaQueue : null;

        // If multipart/form-data (file upload)
        if (isMultipartRequest(req) && typeof req.file === 'function') {
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
              userId, 
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
        
        return enqueueProfileImageFromUrl({ req, reply, useCase, mediaQueue, userId, kind: 'banner' });
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
        // If controller has a followerRepository, prefer to check for existing relation first (idempotent)
        try {
          if (followerRepository && typeof followerRepository.findByFollowerAndFollowing === 'function') {
            const existing = await followerRepository.findByFollowerAndFollowing(actorId, id);
            if (existing) {
              await invalidateCompactFeedCache(req);
              await invalidateUserProfileCaches(req, [actorId, id]);
              return reply.code(200).send({ success: true, message: 'Followed', data: { following: true } });
            }
          }
        } catch (e) {
          // ignore and proceed to create
        }

        const created = await useCase.followUser(id, actorId);
        await invalidateCompactFeedCache(req);
        await invalidateUserProfileCaches(req, [actorId, id]);
        if (notificationRepository) {
          try {
            await notificationRepository.create({
              userId: id,
              actorUserId: actorId,
              type: 'user_follow',
              title: 'New follower',
              body: 'Someone followed you.',
              target: { type: 'user', id: actorId, title: null, url: `/users/${actorId}` },
              metadata: { followId: created && created.id }
            });
          } catch (notifyErr) {
            userLogger.warn('follow notification failed', { message: notifyErr.message });
          }
        }
        return reply.code(201).send({ success: true, message: 'Followed', data: { following: true } });
      } catch (err) {
        userLogger.error('followUser error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    unfollowUser: async (req, reply) => {
      try {
        const { id } = req.params; // target user id
        const actorId = req.user && req.user.id;
        if (!actorId)
          return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
        // Attempt to unfollow; idempotent: if not following, return 200
        const deleted = await useCase.unfollowUser(id, actorId);
        await invalidateCompactFeedCache(req);
        await invalidateUserProfileCaches(req, [actorId, id]);
        if (!deleted) return reply.code(200).send({ success: true, message: 'Unfollowed', data: { following: false } });
        return reply.code(200).send({ success: true, message: 'Unfollowed', data: { following: false } });
      } catch (err) {
        userLogger.error('unfollowUser error', { message: err.message, stack: err.stack });
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

    listFollowing: async (req, reply) => {
      try {
        const { id } = req.params;
        const rows = await useCase.listFollowing(id);
        return reply.send({ success: true, data: rows.map(r => r.toPlainObject()) });
      } catch (err) {
        userLogger.error('listFollowing error', { message: err.message, stack: err.stack });
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
        return reply.code(201).send({ success: true, message: 'Profile created successfully', data: payload });
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
          if (err.code === 'ER_DUP_ENTRY' || lower.includes('duplicate entry')) {
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
        return reply.code(200).send({ success: true, data: { id: skillId } });
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
        return reply.code(200).send({ success: true, data: { id: portfolioId } });
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
        return reply.code(200).send({ success: true, data: { id: certId } });
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
        return reply.code(200).send({ success: true, data: { id: eduId } });
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
        return reply.code(200).send({ success: true, data: { id: expId } });
      } catch (err) {
        userLogger.error('deleteExperience error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
