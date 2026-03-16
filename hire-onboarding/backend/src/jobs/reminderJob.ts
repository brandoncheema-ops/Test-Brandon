import { Queue, Worker } from 'bullmq';
import { getRedis } from '../config/redis';
import { getEnv } from '../config/env';
import { getLogger } from '../config/logger';
import { WorkflowRepository } from '../infrastructure/database/repositories/workflowRepository';
import { AuditService } from '../domain/services/auditService';
import { AuditEventType } from '../shared/types';

const logger = getLogger('reminder-job');

const QUEUE_NAME = 'reminders';

// =============================================================================
// Reminder Job - Checks for contracts awaiting signature and creates reminders
// =============================================================================

let reminderQueue: Queue | null = null;

export function initReminderJob(): Queue {
  const connection = getRedis();

  reminderQueue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      logger.info('Running reminder check...');

      const workflowRepo = new WorkflowRepository();
      const auditService = new AuditService();
      const env = getEnv();

      const dueReminders = await workflowRepo.findDueReminders(new Date());

      if (dueReminders.length === 0) {
        logger.debug('No reminders due');
        return { remindersProcessed: 0 };
      }

      logger.info({ count: dueReminders.length }, 'Processing due reminders');

      for (const workflow of dueReminders) {
        const candidateName = workflow.extractedFields?.fullLegalName.value || 'Unknown';

        // Log the reminder (in Phase 1, reminders are shown in dashboard only)
        await auditService.log({
          workflowId: workflow.id,
          eventType: AuditEventType.REMINDER_SENT,
          description: `Reminder: Contract for ${candidateName} has been waiting for signature for ${workflow.reminderInfo.reminderCount + 1} reminder cycle(s)`,
          metadata: {
            candidateName,
            reminderCount: workflow.reminderInfo.reminderCount + 1,
            daysSinceApproval: Math.floor(
              (Date.now() - workflow.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
            ),
          },
        });

        // Update reminder tracking
        const nextReminder = new Date();
        nextReminder.setDate(nextReminder.getDate() + env.REMINDER_DAYS_THRESHOLD);

        await workflowRepo.updateFields(workflow.id, {
          lastReminderAt: new Date(),
          reminderCount: workflow.reminderInfo.reminderCount + 1,
          nextReminderAt: nextReminder,
        });
      }

      return { remindersProcessed: dueReminders.length };
    },
    { connection, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Reminder job failed');
  });

  return reminderQueue;
}

export async function startReminderSchedule(): Promise<void> {
  if (!reminderQueue) {
    throw new Error('Reminder job not initialized');
  }

  const env = getEnv();

  // Remove existing repeatable jobs
  const repeatableJobs = await reminderQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await reminderQueue.removeRepeatableByKey(job.key);
  }

  // Schedule based on cron expression
  await reminderQueue.add(
    'check-reminders',
    {},
    {
      repeat: { pattern: env.REMINDER_CRON },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    }
  );

  logger.info({ cron: env.REMINDER_CRON }, 'Reminder schedule started');
}
