// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import logger from './utils/logger.js';

const appLogger = logger.child('APP_STARTUP');

// Then start server
import startServer from './server.js';

startServer().catch(err => {
  appLogger.error('Fatal error starting server', { error: err.message, stack: err.stack });
  process.exit(1);
});
