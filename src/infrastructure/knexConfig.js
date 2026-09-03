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

export default db;
