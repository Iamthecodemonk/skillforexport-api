import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_TTL = process.env.REDIS_DEFAULT_TTL_SECONDS ? parseInt(process.env.REDIS_DEFAULT_TTL_SECONDS, 10) : 3600;

function isManager(redis) {
  return !!(redis && (typeof redis.setJson === 'function' || typeof redis.getJson === 'function'));
}

export async function setWithTTL(redis, key, value, ttlSeconds = DEFAULT_TTL) {
  if (!redis) return false;
  try {
    const ttl = Number.isFinite(ttlSeconds) ? ttlSeconds : DEFAULT_TTL;
    if (isManager(redis) && typeof redis.setJson === 'function') {
      return await redis.setJson(key, value, { EX: ttl });
    }
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof redis.set === 'function') {
      // ioredis / redis client signature
      try {
        await redis.set(key, str, 'EX', ttl);
        return true;
      } catch (e) {
        await redis.set(key, str);
        try { await redis.expire(key, ttl); } catch (_) {}
        return true;
      }
    }
  } catch (e) {
    console && console.warn && console.warn('setWithTTL failed', e && e.message);
  }
  return false;
}

export async function setJsonWithTTL(redis, key, obj, ttlSeconds = DEFAULT_TTL) {
  return setWithTTL(redis, key, obj, ttlSeconds);
}

export async function ensureDefaultTTL(redis, key, ttlSeconds = DEFAULT_TTL) {
  if (!redis) return false;
  try {
    if (typeof redis.ttl === 'function') {
      const current = await redis.ttl(key);
      if (current === -1) {
        // key exists but has no TTL
        if (typeof redis.expire === 'function') {
          await redis.expire(key, ttlSeconds);
          return true;
        }
      }
      return false;
    }
  } catch (e) {
    console && console.warn && console.warn('ensureDefaultTTL failed', e && e.message);
  }
  return false;
}

export default { setWithTTL, setJsonWithTTL, ensureDefaultTTL };
