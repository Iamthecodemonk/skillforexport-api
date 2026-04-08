import { Queue, Worker } from 'bullmq';
import { sendEmail, emailTemplates } from '../../utils/emailService.js';
import logger from '../../utils/logger.js';

const queueLogger = logger.child('EMAIL_QUEUE');

/**
 * Create the email queue instance
 */
export function createEmailQueue(redisConnection) {
  return new Queue('emails', { connection: redisConnection });
}

/**
 * Create and register the email worker
 * Processes email jobs from the queue
 */
export function createEmailWorker(redisConnection) {
  const worker = new Worker(
    'emails',
    async (job) => {
      const { type, to, ...templateData } = job.data;
      
      try {
        // Get template and render email
        const template = emailTemplates[type];
        if (!template) {
          throw new Error(`Unknown email template: ${type}`);
        }

        const emailContent = template(to, ...Object.values(templateData ));

        // Send email using emailService
        const result = await sendEmail(to, emailContent.subject, emailContent.html, emailContent.text);
        
        // Check if email was skipped (not actually sent)
        if (result.skipped) {
          queueLogger.warn(`Job ${job.id} for ${to} skipped`, { reason: result.reason });
          return result;
        }
        
        queueLogger.info(`Job ${job.id} sent to ${to}`, { type, messageId: result.messageId });
        return result;
      } catch (error) {
        queueLogger.error(`Job ${job.id} failed for ${to}`, { message: error.message });
        throw error;
      }
    },
    {
      connection: redisConnection,
      maxStalledCount: 2,
      stalledInterval: 5000,
      removeOnComplete: { age: 3600 }, // Keep completed jobs for 1 hour for audit
      removeOnFail: { age: 86400 } // Keep failed jobs for 24 hours for debugging
    }
  );

  // Track connection state
  let isWorkerHealthy = false;
  
  worker.on('ready', () => {
    isWorkerHealthy = true;
    queueLogger.info('Worker ready to process jobs');
  });

  worker.on('completed', (job) => {
    queueLogger.info(`Job ${job.id} processed successfully`);
  });

  worker.on('failed', (job, err) => {
    queueLogger.error(`Job ${job.id} failed`, { attempt: `${job.attemptsMade}/${job.opts.attempts}`, error: err.message });
    if (job.attemptsMade >= job.opts.attempts) {
      queueLogger.error(`Job ${job.id} exceeded max attempts - moved to dead letter`);
    }
  });

  worker.on('error', (err) => {
    isWorkerHealthy = false;
    queueLogger.error('Worker encountered error', { error: err.message });
  });

  worker.on('close', () => {
    isWorkerHealthy = false;
    queueLogger.warn('Worker closed');
  });

  // Expose health check
  worker.isHealthy = () => isWorkerHealthy;

  return worker;
}

/**
 * Queue an email to be sent asynchronously
 * Usage: await queueEmail(emailQueue, 'otp', 'user@example.com', { otpCode: '123456', expiresInMinutes: 10 })
 */
export async function queueEmail(emailQueue, type, to, templateData = {}) {
  if (!emailQueue) {
    queueLogger.warn('Email queue not initialized, email will not be sent');
    return null;
  }

  try {
    const job = await emailQueue.add(
      type,
      { type, to, ...templateData },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    queueLogger.info(`Email queued: job ${job.id} (${type} to ${to})`, { type, to });
    return job;
  } catch (err) {
    queueLogger.error('Failed to queue email', { type, to, message: err.message });
    throw err;
  }
}
