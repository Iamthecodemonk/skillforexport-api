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
    return reply.code(500).send({ error: 'internal_error', message: error && error.message });
  };
}
