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
  pool: {
    min: 2,
    max: 10,
  },
});

export default db;
