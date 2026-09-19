import dotenv from 'dotenv';
dotenv.config();

import Redis from 'ioredis';
import cloudinary from './utils/cloudinary.js';
import logger from './utils/logger.js';
import db from './infrastructure/knexConfig.js';
import { createEmailWorker } from './infrastructure/queue/emailQueue.js';
import { createMediaWorker } from './infrastructure/queue/mediaQueue.js';
import MysqlPostMediaRepository from './infrastructure/repositories/mysqlPostMediaRepository.js';
import MysqlPageRepository from './infrastructure/repositories/mysqlPageRepository.js';
import MysqlUserAssetRepository from './infrastructure/repositories/mysqlUserAssetRepository.js';
import { MysqlUserProfileRepository } from './infrastructure/repositories/index.js';
import { PageRepositoryImpl } from './domain/repositories/pageRepository.js';
import { UserProfileRepositoryImpl } from './domain/repositories/userProfileRepository.js';

const workerLogger = logger.child('WORKER');
const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

if (!redisHost) throw new Error('REDIS_HOST is required for queue workers');

if (cloudinary && typeof cloudinary.configure === 'function') cloudinary.configure();

const connection = {
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};
const redisClient = new Redis({ host: redisHost, port: redisPort });
const profileRepository = new UserProfileRepositoryImpl({ adapter: new MysqlUserProfileRepository() });
const pageRepository = new PageRepositoryImpl({ adapter: new MysqlPageRepository() });
const assetAdapter = new MysqlUserAssetRepository();
const postMediaAdapter = new MysqlPostMediaRepository();
const emailWorker = createEmailWorker(connection);
const mediaWorker = createMediaWorker(connection, {
  cloudinary,
  profileRepository,
  assetAdapter,
  postMediaAdapter,
  pageRepository,
  redisClient,
  concurrency: parseInt(process.env.MEDIA_WORKER_CONCURRENCY || '2', 10)
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  workerLogger.info('Worker shutdown signal received', { signal });
  const timeout = setTimeout(() => process.exit(1), parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10));
  timeout.unref();
  await Promise.allSettled([emailWorker.close(), mediaWorker.close()]);
  await redisClient.quit().catch(() => redisClient.disconnect());
  await db.destroy();
  clearTimeout(timeout);
  workerLogger.info('Workers stopped');
  process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
workerLogger.info('Email and media workers started', {
  redis: `${redisHost}:${redisPort}`,
  mediaConcurrency: parseInt(process.env.MEDIA_WORKER_CONCURRENCY || '2', 10)
});
