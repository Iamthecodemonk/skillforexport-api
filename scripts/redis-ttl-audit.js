#!/usr/bin/env node
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const client = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379', 10) });

async function audit(scanPattern = '*', fix = false, defaultTtl = (process.env.REDIS_DEFAULT_TTL_SECONDS ? parseInt(process.env.REDIS_DEFAULT_TTL_SECONDS,10) : 3600)) {
  console.log('Starting Redis TTL audit', { scanPattern, fix, defaultTtl });
  let cursor = '0';
  let missing = 0;
  do {
    const res = await client.scan(cursor, 'MATCH', scanPattern, 'COUNT', 1000);
    cursor = res[0];
    const keys = res[1];
    if (keys && keys.length) {
      const pipeline = client.pipeline();
      keys.forEach(k => pipeline.ttl(k));
      const ttls = await pipeline.exec();
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const ttlReply = ttls[i];
        const ttl = ttlReply && ttlReply[1];
        if (ttl === -1) {
          missing++;
          console.log('Key missing TTL:', key);
          if (fix) {
            await client.expire(key, defaultTtl);
            console.log('  -> Set TTL', defaultTtl);
          }
        }
      }
    }
  } while (cursor !== '0');
  console.log('Audit complete. Keys missing TTL:', missing);
  await client.quit();
}

const args = process.argv.slice(2);
const scanPattern = args[0] || '*';
const fix = args.includes('--fix');

audit(scanPattern, fix).catch(err => {
  console.error('Audit failed', err);
  process.exit(2);
});
