import { sendError } from '../errorResponse.js';
import logger from '../../utils/logger.js';

export default function errorHandler(serverLogger) {
  return function globalErrorHandler(error, request, reply) {
    try {
      serverLogger.error('Unhandled error', {
        message: error && error.message,
        stack: error && error.stack,
        method: request && request.method,
        url: request && request.url
      });
    } catch (logErr) {
      // If logging fails, we can't do much about it, but we should at least try to log that failure
      logger.error('Failed to log error', { message: logErr.message });
    }

    return sendError(reply, 500, 'internal_error', error && error.message);
  };
}
