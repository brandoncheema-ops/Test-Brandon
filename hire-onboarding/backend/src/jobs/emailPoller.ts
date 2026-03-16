import { Queue, Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis';
import { getEnv } from '../config/env';
import { getLogger } from '../config/logger';
import { OutlookService } from '../infrastructure/email/outlookService';
import { WorkflowManager } from '../domain/services/workflowManager';

const logger = getLogger('email-poller');

const QUEUE_NAME = 'email-polling';
const PROCESS_QUEUE_NAME = 'email-processing';

// =============================================================================
// Email Poller Job - Periodically polls the automation inbox for new emails
// =============================================================================

let pollingQueue: Queue | null = null;
let processingQueue: Queue | null = null;

/**
 * Initializes the email polling and processing queues.
 */
export function initEmailPoller(): { pollingQueue: Queue; processingQueue: Queue } {
  const connection = getRedis();

  pollingQueue = new Queue(QUEUE_NAME, { connection });
  processingQueue = new Queue(PROCESS_QUEUE_NAME, { connection });

  // Set up the polling worker
  const pollingWorker = new Worker(
    QUEUE_NAME,
    async () => {
      logger.debug('Polling automation inbox for new emails...');

      const outlookService = new OutlookService();
      const messages = await outlookService.fetchUnreadMessages();

      if (messages.length === 0) {
        logger.debug('No new messages found');
        return { processed: 0 };
      }

      logger.info({ count: messages.length }, 'Found new messages to process');

      // Queue each message for individual processing
      for (const msg of messages) {
        await processingQueue!.add('process-email', { email: msg }, {
          jobId: `email-${msg.internetMessageId}`, // Prevents duplicate jobs
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
      }

      return { queued: messages.length };
    },
    { connection, concurrency: 1 }
  );

  // Set up the processing worker
  const processingWorker = new Worker(
    PROCESS_QUEUE_NAME,
    async (job: Job) => {
      const { email } = job.data;
      logger.info(
        { internetMessageId: email.internetMessageId, subject: email.subject },
        'Processing email'
      );

      const workflowManager = new WorkflowManager();
      const workflow = await workflowManager.processIncomingEmail(email);

      if (workflow) {
        logger.info(
          { workflowId: workflow.id, status: workflow.status },
          'Workflow created/updated from email'
        );

        // Mark the email as read in Outlook
        const outlookService = new OutlookService();
        await outlookService.markAsRead(email.messageId);
      }

      return { workflowId: workflow?.id || null };
    },
    { connection, concurrency: 2 }
  );

  // Error handlers
  pollingWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Polling job failed');
  });

  processingWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Email processing job failed');
  });

  pollingWorker.on('completed', (job, result) => {
    logger.debug({ jobId: job.id, result }, 'Polling job completed');
  });

  processingWorker.on('completed', (job, result) => {
    logger.debug({ jobId: job.id, result }, 'Email processing job completed');
  });

  return { pollingQueue, processingQueue };
}

/**
 * Schedules the recurring polling job.
 */
export async function startEmailPolling(): Promise<void> {
  if (!pollingQueue) {
    throw new Error('Email poller not initialized. Call initEmailPoller() first.');
  }

  const env = getEnv();
  const intervalMs = env.EMAIL_POLL_INTERVAL_SECONDS * 1000;

  // Remove existing repeatable jobs to avoid duplicates
  const repeatableJobs = await pollingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await pollingQueue.removeRepeatableByKey(job.key);
  }

  // Add repeatable polling job
  await pollingQueue.add(
    'poll-inbox',
    {},
    {
      repeat: { every: intervalMs },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  logger.info(
    { intervalSeconds: env.EMAIL_POLL_INTERVAL_SECONDS },
    'Email polling scheduled'
  );
}

/**
 * Triggers an immediate poll (for manual trigger from dashboard).
 */
export async function triggerImmediatePoll(): Promise<void> {
  if (!pollingQueue) {
    throw new Error('Email poller not initialized');
  }

  await pollingQueue.add('poll-inbox-manual', {}, {
    priority: 1,
    removeOnComplete: true,
  });

  logger.info('Manual email poll triggered');
}
