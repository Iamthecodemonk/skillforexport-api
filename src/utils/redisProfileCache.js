import dotenv from 'dotenv';
dotenv.config();

// Helpers to read/write serialized user profile JSON to Redis
export async function readProfileFromCache(redis, key) {
  if (!redis) return null;
  try {
    // Support both raw ioredis client and RedisManager wrapper
    if (typeof redis.getJson === 'function') {
      return await redis.getJson(key);
    }
    if (typeof redis.get === 'function') {
      const cached = await redis.get(key);
      if (!cached) return null;
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Avoid throwing for parse errors; caller will fallback to DB
        console && console.warn && console.warn('Failed to parse cached profile JSON', e.message);
        return null;
      }
    }
    return null;
  } catch (e) {
    console && console.warn && console.warn('Redis get failed for user profile', e.message);
    return null;
  }
}

export async function writeProfileToCache(redis, key, value) {
  if (!redis) return;
  try {
    const ttlEnv = process.env.PROFILE_CACHE_TTL_SECONDS;
    const ttl = ttlEnv ? parseInt(ttlEnv, 10) : null;
    const str = JSON.stringify(value);
    // Prefer JSON helpers if provided by manager
    if (typeof redis.setJson === 'function') {
      if (ttlEnv && Number.isFinite(ttl)) {
        await redis.setJson(key, value, { EX: ttl });
      } else {
        await redis.setJson(key, value);
      }
      return;
    }

    if (typeof redis.set === 'function') {
      if (ttlEnv && Number.isFinite(ttl)) {
        // try ioredis-style set with EX
        try {
          await redis.set(key, str, 'EX', ttl);
        } catch (e) {
          await redis.set(key, str);
        }
      } else {
        await redis.set(key, str);
      }
    }
  } catch (e) {
    console && console.warn && console.warn('Redis set failed for user profile', e.message);
  }
}
