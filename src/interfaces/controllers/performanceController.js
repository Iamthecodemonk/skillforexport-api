import logger from '../../utils/logger.js';

const performanceLogger = logger.child('PERFORMANCE_CONTROLLER');

export function makePerformanceController({ getRequestMetrics, getDatabaseMetrics, getFeedCacheMetrics }) {
  return {
    performanceMetrics: async (req, reply) => {
      try {
        if (!req.user) {
          return reply.code(401).send({ success: false, error: { code: 'unauthorized', message: 'Unauthorized' } });
        }
        if (req.user.role !== 'admin') {
          return reply.code(403).send({ success: false, error: { code: 'forbidden', message: 'Admin access required' } });
        }
        return reply.send({
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            process: {
              uptimeSeconds: Math.floor(process.uptime()),
              memory: process.memoryUsage()
            },
            requests: typeof getRequestMetrics === 'function' ? getRequestMetrics() : null,
            database: typeof getDatabaseMetrics === 'function' ? getDatabaseMetrics() : null,
            feedCache: typeof getFeedCacheMetrics === 'function' ? getFeedCacheMetrics() : null
          }
        });
      } catch (error) {
        performanceLogger.error('Failed to collect performance metrics', { message: error.message, stack: error.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error', message: 'Unable to collect performance metrics' } });
      }
    }
  };
}

export default makePerformanceController;
