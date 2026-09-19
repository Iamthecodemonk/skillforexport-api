export function makeHealthController(options = {}) {
  const {
    emailQueue = null,
    emailWorker = null,
    queueInitError = null,
    cloudinary = null,
    redisClient = null,
    checkDatabaseHealth = null,
    workersEnabled = true,
    getQueueInitError = null
  } = options;

  const currentQueueError = () => typeof getQueueInitError === 'function'
    ? getQueueInitError()
    : queueInitError;

  const livenessPayload = () => ({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    }
  });

  const readinessState = async () => {
    const database = typeof checkDatabaseHealth === 'function'
      ? await checkDatabaseHealth()
      : { status: 'unknown' };
    const redis = redisClient
      ? { status: redisClient.status === 'ready' ? 'ready' : redisClient.status || 'unknown' }
      : { status: 'not_configured' };
    const queueError = currentQueueError();
    const queue = queueError
      ? { status: 'error', message: queueError.message }
      : { status: emailQueue ? 'ready' : 'not_configured', workersEnabled };
    const ready = database.status === 'ready'
      && (!redisClient || redis.status === 'ready')
      && !queueError;
    return { ready, database, redis, queue };
  };

  return {
    liveness: async (req, reply) => reply.code(200).send(livenessPayload()),

    readiness: async (req, reply) => {
      const state = await readinessState();
      return reply.code(state.ready ? 200 : 503).send({
        success: state.ready,
        data: {
          status: state.ready ? 'ready' : 'not_ready',
          timestamp: new Date().toISOString(),
          database: state.database,
          redis: state.redis,
          queue: state.queue
        }
      });
    },

    health: async (req, reply) => {
      try {
        // Get email queue status
        let emailQueueStatus = {
          status: 'unknown',
          message: 'Email queue not configured'
        };

        const queueError = currentQueueError();
        if (queueError) {
          emailQueueStatus = {
            status: 'error',
            message: `Queue initialization failed: ${queueError.message}`
          };
        } else if (emailQueue) {
          try {
            const count = await emailQueue.count();
            const isPaused = await emailQueue.isPaused();
            emailQueueStatus = {
              status: isPaused ? 'paused' : 'ready',
              pendingJobs: count,
              workerHealthy: emailWorker?.isHealthy?.() ?? false
            };
          } catch (err) {
            emailQueueStatus = {
              status: 'error',
              message: `Failed to check queue status: ${err.message}`
            };
          }
        }

        // Cloudinary health (optional)
        let cloudinaryStatus = { status: 'not_configured' };
        try {
          if (cloudinary && typeof cloudinary.healthCheck === 'function') {
            const res = await cloudinary.healthCheck();
            cloudinaryStatus = res.ok ? { status: 'ok' } : { status: 'error', reason: res.reason };
          }
        } catch (err) {
          cloudinaryStatus = { status: 'error', reason: err.message };
        }

        return reply.code(200).send({
          success: true,
          data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            workersEnabled,
            emailQueue: emailQueueStatus,
            cloudinary: cloudinaryStatus
          }
        });
      } catch (err) {
          return reply.code(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred'
          }
        });
      }
    }
  };
}
