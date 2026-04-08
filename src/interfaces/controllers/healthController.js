export function makeHealthController(options = {}) {
  const { emailQueue = null, emailWorker = null, queueInitError = null, cloudinary = null } = options;

  return {
    health: async (req, reply) => {
      try {
        // Get email queue status
        let emailQueueStatus = {
          status: 'unknown',
          message: 'Email queue not configured'
        };

        if (queueInitError) {
          emailQueueStatus = {
            status: 'error',
            message: `Queue initialization failed: ${queueInitError.message}`
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
