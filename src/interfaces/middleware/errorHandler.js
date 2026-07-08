import { sendError } from '../errorResponse.js';
import logger from '../../utils/logger.js';

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';

export default function errorHandler(serverLogger) {
  return function globalErrorHandler(error, request, reply) {
    if (error && Array.isArray(error.validation)) {
      const passwordError = error.validation.find((item) => {
        const path = item.instancePath || item.dataPath || '';
        const params = item.params || {};
        return path.includes('/password') || params.missingProperty === 'password';
      });
      const message = passwordError && ['pattern', 'minLength'].includes(passwordError.keyword)
        ? PASSWORD_POLICY_MESSAGE
        : (error.validation[0] && error.validation[0].message) || 'Validation failed';

      return reply.code(422).send({
        success: false,
        message,
        data: {
          errors: passwordError
            ? { password: [message] }
            : { body: [message] }
        },
        error: {
          code: 'validation_failed',
          message
        }
      });
    }

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
