import knex from 'knex';
// require('dotenv').config();
import 'dotenv/config';
import logger from '../utils/logger.js';

// Debug: Log what we're actually connecting with (use in-house logger)
const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};
logger.info('MySQL Connection Config');
logger.info(`Host: ${dbConfig.host}`);
logger.info(`Port: ${dbConfig.port}`);
logger.info(`User: ${dbConfig.user}`);
logger.info(`Password: ${dbConfig.password ? '***' + dbConfig.password.slice(-4) : '(empty)'}`);
logger.info(`Database: ${dbConfig.database}`);

export const db = knex({
  client: 'mysql2',
  connection: dbConfig,
  acquireConnectionTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS || '60000', 10),
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
    reapIntervalMillis: parseInt(process.env.DB_POOL_REAP_INTERVAL_MS || '1000', 10),
    createRetryIntervalMillis: parseInt(process.env.DB_POOL_CREATE_RETRY_INTERVAL_MS || '2000', 10),
    afterCreate: (connection, done) => {
      const waitTimeout = parseInt(process.env.DB_SESSION_WAIT_TIMEOUT_SECONDS || '28800', 10);
      connection.query(`SET SESSION wait_timeout = ${waitTimeout}, interactive_timeout = ${waitTimeout}`, (err) => {
        done(err, connection);
      });
    }
  },
});

const slowQueryMs = parseInt(process.env.DB_SLOW_QUERY_MS || '500', 10);
const queryStartedAt = new Map();
const queryMetrics = {
  count: 0,
  errors: 0,
  slowQueries: 0,
  totalDurationMs: 0,
  maxDurationMs: 0
};

db.on('query', (query) => {
  if (query && query.__knexQueryUid) queryStartedAt.set(query.__knexQueryUid, process.hrtime.bigint());
});

const finishQuery = (query, error = null) => {
  const queryId = query && query.__knexQueryUid;
  const started = queryId ? queryStartedAt.get(queryId) : null;
  if (queryId) queryStartedAt.delete(queryId);
  if (!started) return;
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
  queryMetrics.count += 1;
  queryMetrics.totalDurationMs += durationMs;
  queryMetrics.maxDurationMs = Math.max(queryMetrics.maxDurationMs, durationMs);
  if (error) queryMetrics.errors += 1;
  if (durationMs >= slowQueryMs) {
    queryMetrics.slowQueries += 1;
    logger.warn('Slow MySQL query', {
      durationMs: Number(durationMs.toFixed(2)),
      sql: query && query.sql ? String(query.sql).slice(0, 2000) : null,
      error: error ? error.message : undefined
    });
  }
};

db.on('query-response', (response, query) => finishQuery(query));
db.on('query-error', (error, query) => finishQuery(query, error));

export function getDatabaseMetrics() {
  const pool = db.client && db.client.pool;
  const used = pool && typeof pool.numUsed === 'function' ? pool.numUsed() : null;
  const free = pool && typeof pool.numFree === 'function' ? pool.numFree() : null;
  const pendingAcquires = pool && typeof pool.numPendingAcquires === 'function' ? pool.numPendingAcquires() : null;
  const pendingCreates = pool && typeof pool.numPendingCreates === 'function' ? pool.numPendingCreates() : null;
  return {
    queries: {
      count: queryMetrics.count,
      errors: queryMetrics.errors,
      slowQueries: queryMetrics.slowQueries,
      averageDurationMs: queryMetrics.count ? Number((queryMetrics.totalDurationMs / queryMetrics.count).toFixed(2)) : 0,
      maxDurationMs: Number(queryMetrics.maxDurationMs.toFixed(2)),
      slowQueryThresholdMs: slowQueryMs
    },
    pool: {
      used,
      free,
      pendingAcquires,
      pendingCreates,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10)
    }
  };
}

export async function checkDatabaseHealth(timeoutMs = 2000) {
  let timeout;
  try {
    await Promise.race([
      db.raw('SELECT 1 AS healthy'),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('database_health_timeout')), timeoutMs);
      })
    ]);
    return { status: 'ready' };
  } catch (error) {
    return { status: 'error', message: error.message };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default db;
