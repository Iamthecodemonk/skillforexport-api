import { sendError } from '../errorResponse.js';

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
      // ignore logging failures
    }
    // Use standardized error response shape
    return sendError(reply, 500, 'internal_error', error && error.message);
  };
}
