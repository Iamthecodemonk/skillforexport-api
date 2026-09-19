import { createHash } from 'crypto';
import logger from './logger.js';

const cacheLogger = logger.child('FEED_CACHE');
const VERSION_KEY = 'feed:version';
const configuredTtl = parseInt(process.env.FEED_CACHE_TTL_SECONDS || '20', 10);
const DEFAULT_TTL_SECONDS = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 20;
const pendingLoads = new Map();
const metrics = { hits: 0, misses: 0, coalesced: 0, writes: 0, invalidations: 0, errors: 0 };

export const getFeedCacheMetrics = () => {
  const attempts = metrics.hits + metrics.misses;
  return {
    ...metrics,
    hitRate: attempts ? Number((metrics.hits / attempts).toFixed(4)) : 0,
    pendingLoads: pendingLoads.size,
    ttlSeconds: DEFAULT_TTL_SECONDS
  };
};

export const getRequestRedis = (req) => req && req.server
  ? (req.server.redisManager || req.server.redisClient || null)
  : null;

const cacheHash = (value) => createHash('sha1')
  .update(JSON.stringify(value))
  .digest('hex');

async function readJson(redis, key) {
  if (typeof redis.getJson === 'function') return redis.getJson(key);
  if (typeof redis.get !== 'function') return null;
  const value = await redis.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

async function writeJson(redis, key, value, ttlSeconds) {
  if (typeof redis.setJson === 'function') {
    return redis.setJson(key, value, { EX: ttlSeconds });
  }
  if (typeof redis.set === 'function') {
    return redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
}

async function feedVersion(redis) {
  if (!redis || typeof redis.get !== 'function') return '0';
  return String(await redis.get(VERSION_KEY) || '0');
}

export async function rememberFeedResponse(req, { namespace, identity, ttlSeconds = DEFAULT_TTL_SECONDS }, loader) {
  const redis = getRequestRedis(req);
  if (!redis) return loader();

  try {
    const version = await feedVersion(redis);
    const key = `feed:${namespace}:v${version}:${cacheHash(identity)}`;
    const cached = await readJson(redis, key);
    if (cached !== null) {
      metrics.hits += 1;
      return cached;
    }
    metrics.misses += 1;

    if (pendingLoads.has(key)) {
      metrics.coalesced += 1;
      return pendingLoads.get(key);
    }
    const pending = Promise.resolve()
      .then(loader)
      .then(async (response) => {
        try {
          await writeJson(redis, key, response, ttlSeconds);
          metrics.writes += 1;
        } catch (err) {
          metrics.errors += 1;
          cacheLogger.warn('Feed cache write failed', { message: err.message });
        }
        return response;
      })
      .finally(() => pendingLoads.delete(key));
    pendingLoads.set(key, pending);
    return pending;
  } catch (err) {
    metrics.errors += 1;
    cacheLogger.warn('Feed cache read/write failed', { message: err.message });
    return loader();
  }
}

export async function invalidateFeedCache(req) {
  const redis = getRequestRedis(req);
  if (!redis) return false;
  try {
    if (typeof redis.incr === 'function') {
      await redis.incr(VERSION_KEY);
      metrics.invalidations += 1;
      return true;
    }
    const client = typeof redis.client === 'function' ? redis.client() : null;
    if (client && typeof client.incr === 'function') {
      await client.incr(VERSION_KEY);
      metrics.invalidations += 1;
      return true;
    }
  } catch (err) {
    metrics.errors += 1;
    cacheLogger.warn('Feed cache invalidation failed', { message: err.message });
  }
  return false;
}
