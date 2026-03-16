import { AuditLogRepository, AuditLogRecord } from '../../infrastructure/database/repositories/auditLogRepository';
import { AuditEventType } from '../../shared/types';
import { getLogger } from '../../config/logger';

const logger = getLogger('audit-service');

// =============================================================================
// Audit Service - Centralized audit logging for all workflow events
// =============================================================================

export class AuditService {
  private repo: AuditLogRepository;

  constructor(repo?: AuditLogRepository) {
    this.repo = repo || new AuditLogRepository();
  }

  async log(params: {
    workflowId: string;
    eventType: AuditEventType;
    description: string;
    actor?: string;
    metadata?: Record<string, unknown>;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    logger.info(
      {
        workflowId: params.workflowId,
        eventType: params.eventType,
        actor: params.actor || 'system',
      },
      params.description
    );

    return this.repo.create({
      workflowId: params.workflowId,
      eventType: params.eventType,
      description: params.description,
      actor: params.actor,
      metadata: params.metadata,
      previousState: params.previousState,
      newState: params.newState,
    });
  }

  async getWorkflowHistory(
    workflowId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ items: AuditLogRecord[]; total: number }> {
    return this.repo.findByWorkflowId(workflowId, options);
  }

  async getRecentActivity(limit?: number): Promise<AuditLogRecord[]> {
    return this.repo.findRecent(limit);
  }
}
