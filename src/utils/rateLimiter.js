import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

// Create named rate limiters using a shared ioredis client
export function createRateLimiters(redisClient, deps = {}) {
  if (!redisClient || typeof redisClient !== 'object') {
    throw new Error('redis_client_required');
  }
  const { userRepository = null } = deps;

  const postCreation = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:posts:create',
    points: 5,
    duration: 60
  });

  const postDaily = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:posts:daily',
    points: 100,
    duration: 24 * 3600
  });

  const interactions = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:interactions',
    points: 30,
    duration: 60
  });

  // New targeted limiters per user action
  const commentLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:comments',
    points: 5,
    duration: 60
  });

  const reactionLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:reactions',
    points: 10,
    duration: 10
  });

  // Extremely strict limiter for unauthenticated requests (applies by IP)
  const unauthLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:unauth',
    points: 1,
    duration: 60
  });

  const mediaFile = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:media',
    points: 3,
    duration: 60
  });

  const guests = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:guests',
    points: 20,
    duration: 3600
  });

  // Helper to resolve a user key (prefer authenticated subject, fallback to body.userId, otherwise IP)
  async function resolveUserKey(req) {
    // Prefer an authenticated user attached by upstream auth middleware
    if (req && req.user && (req.user.id || req.user.sub)) {
      const userId = req.user.id || req.user.sub || req.user.userId;
      if (userId) return `user:${userId}`;
    }

    // Try JWT in Authorization header as a fallback (only if req.user wasn't provided)
    try {
      const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
      if (auth && String(auth).startsWith('Bearer ')) {
        const token = String(auth).slice(7);
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload && (payload.sub || payload.userId || payload.id);
        const tokenVersion = payload && (payload.tv || payload.tokenVersion || 0);
        if (userId) {
          // If a userRepository is provided, verify token version matches current user token_version
          if (userRepository && typeof userRepository.findById === 'function') {
            try {
              const user = await userRepository.findById(userId);
              const currentTv = user && (user.tokenVersion || 0);
              if (Number(currentTv) === Number(tokenVersion)) return `user:${userId}`;
              // token version mismatch -> treat as unauthenticated (fall through to IP)
            } catch (dbErr) {
              // On DB errors, ignore and fall back to IP to avoid blocking requests
            }
          } else {
            return `user:${userId}`;
          }
        }
      }
    } catch (e) {
      // ignore token errors and fall back to IP
    }

    // NOTE: Do NOT trust `req.body.userId` — this can be spoofed and used to poison another user's rate key.
    // Fallback to IP (safe for guests)
    const ip = req.ip || (req.headers && (req.headers['x-forwarded-for'] || (req.connection && req.connection.remoteAddress))) || 'unknown';
    return `ip:${ip}`;
  }

  // Generic middleware factory
  function makeMiddleware(limiter, keyResolver) {
    return async function (req, reply) {
      const key = keyResolver ? keyResolver(req) : resolveUserKey(req);
      try {
        await limiter.consume(key, 1);
        return;
      } catch (rej) {
        return reply.code(429).send({ success: false, error: { code: 'rate_limited', message: 'Too many requests, please try again later.' } });
      }
    };
  }

  // Helper to detect if resolved key represents an unauthenticated (IP) caller
  function isUnauthKey(resolvedKey) {
    return typeof resolvedKey === 'string' && resolvedKey.startsWith('ip:');
  }

  // Comments middleware: if unauthenticated enforce strict unauthLimiter, otherwise enforce commentLimiter
  const comments = async function (req, reply) {
    const key = await resolveUserKey(req);
    try {
      if (isUnauthKey(key)) {
        await unauthLimiter.consume(key, 1);
      } else {
        await commentLimiter.consume(key, 1);
      }
    } catch (rej) {
      return reply.code(429).send({ success: false, error: { code: 'rate_limited', message: 'Comment rate limit exceeded.' } });
    }
    return;
  };

  // Reactions middleware: if unauthenticated enforce strict unauthLimiter, otherwise enforce reactionLimiter
  const reactions = async function (req, reply) {
    const key = await resolveUserKey(req);
    try {
      if (isUnauthKey(key)) {
        await unauthLimiter.consume(key, 1);
      } else {
        await reactionLimiter.consume(key, 1);
      }
    } catch (rej) {
      return reply.code(429).send({ success: false, error: { code: 'rate_limited', message: 'Reaction rate limit exceeded.' } });
    }
    return;
  };

  // Composite middleware for create post (per-minute + daily)
  const createPost = async function (req, reply) {
    const key = resolveUserKey(req);
    try {
      await postCreation.consume(key, 1);
    } catch (rej) {
      return reply.code(429).send({ success: false, error: { code: 'rate_limited', message: 'Post creation rate limit exceeded (per minute).' } });
    }
    try {
      await postDaily.consume(key, 1);
    } catch (rej) {
      return reply.code(429).send({ success: false, error: { code: 'rate_limited', message: 'Daily post quota exceeded.' } });
    }
    return;
  };

  return {
    createPost,
    interactions: makeMiddleware(interactions, resolveUserKey),
    mediaFile: makeMiddleware(mediaFile, resolveUserKey),
    guests: makeMiddleware(guests, (req) => {
      const ip = req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.connection && req.connection.remoteAddress)) || 'unknown';
      return `ip:${ip}`;
    }),
    comments,
    reactions
  };
}

export function createRedisClient({ host, port }) {
  return new Redis({ host, port });
}
