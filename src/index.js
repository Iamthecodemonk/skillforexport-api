// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import logger from './utils/logger.js';

const appLogger = logger.child('APP_STARTUP');

import startServer from './server.js';

let app = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  appLogger.info('Shutdown signal received', { signal });
  const forceExit = setTimeout(() => {
    appLogger.error('Graceful shutdown timed out', { signal });
    process.exit(1);
  }, parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10));
  forceExit.unref();

  try {
    if (app) await app.close();
    clearTimeout(forceExit);
    appLogger.info('Graceful shutdown complete', { signal });
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExit);
    appLogger.error('Graceful shutdown failed', { signal, error: error.message, stack: error.stack });
    process.exit(1);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

startServer()
  .then((server) => { app = server; })
  .catch(err => {
    appLogger.error('Fatal error starting server', { error: err.message, stack: err.stack });
    process.exit(1);
  });
