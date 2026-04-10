import Redis from 'ioredis';
import logger from './logger.js';

const log = logger.child('REDIS_MANAGER');

class RedisManager {
  constructor(opts = {}) {
    this._client = null;
    this._opts = opts;
    // allow passing an existing client
    if (opts.client) {
      this._client = opts.client;
    }
    this.prefix = opts.prefix || '';
  }

  // initialize a new ioredis client if one wasn't provided
  connect() {
    if (this._client) return this._client;
    const { host = process.env.REDIS_HOST || 'localhost', port = parseInt(process.env.REDIS_PORT || '6379', 10) } = this._opts;
    this._client = new Redis({ host, port });
    this._attachListeners();
    return this._client;
  }

  // attach event listeners for logging
  _attachListeners() {
    if (!this._client) return;
    this._client.on('connect', () => log.info('Redis client connect'));
    this._client.on('ready', () => log.info('Redis client ready'));
    this._client.on('error', (err) => log.error('Redis client error', { message: err && err.message }));
    this._client.on('close', () => log.info('Redis client closed'));
    this._client.on('reconnecting', () => log.info('Redis client reconnecting'));
  }

  // allow replacing/setting a client (e.g., one created elsewhere)
  setClient(client) {
    this._client = client;
    this._attachListeners();
  }

  client() {
    return this._client;
  }

  _key(key) {
    if (!this.prefix) return key;
    return `${this.prefix}:${key}`;
  }

  async get(key) {
    if (!this._client) return null;
    try {
      return await this._client.get(this._key(key));
    } catch (e) {
      log.warn('Redis GET failed', { key, err: e.message });
      return null;
    }
  }

  async set(key, value, opts = {}) {
    if (!this._client) return;
    try {
      const k = this._key(key);
      if (opts.EX || opts.ex) {
        const ttl = opts.EX || opts.ex;
        return await this._client.set(k, value, 'EX', ttl);
      }
      if (opts.PX || opts.px) {
        const ttl = opts.PX || opts.px;
        return await this._client.set(k, value, 'PX', ttl);
      }
      return await this._client.set(k, value);
    } catch (e) {
      log.warn('Redis SET failed', { key, err: e.message });
    }
  }

  async del(key) {
    if (!this._client) return 0;
    try {
      return await this._client.del(this._key(key));
    } catch (e) {
      log.warn('Redis DEL failed', { key, err: e.message });
      return 0;
    }
  }

  async getJson(key) {
    const val = await this.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch (e) {
      log.warn('JSON parse failed for key', { key, err: e.message });
      return null;
    }
  }

  async setJson(key, obj, opts = {}) {
    try {
      const str = JSON.stringify(obj);
      return await this.set(key, str, opts);
    } catch (e) {
      log.warn('JSON stringify failed for setJson', { key, err: e.message });
    }
  }

  async exists(key) {
    if (!this._client) return false;
    try {
      const r = await this._client.exists(this._key(key));
      return r === 1;
    } catch (e) {
      log.warn('Redis EXISTS failed', { key, err: e.message });
      return false;
    }
  }

  async keys(pattern) {
    if (!this._client) return [];
    try {
      return await this._client.keys(pattern);
    } catch (e) {
      log.warn('Redis KEYS failed', { pattern, err: e.message });
      return [];
    }
  }

  async flushdb() {
    if (!this._client) return;
    try {
      return await this._client.flushdb();
    } catch (e) {
      log.warn('Redis FLUSHDB failed', { err: e.message });
    }
  }

  async quit() {
    if (!this._client) return;
    try {
      await this._client.quit();
    } catch (e) {
      log.warn('Redis QUIT failed', { err: e.message });
    }
  }
}

export default RedisManager;
