import { Knex } from 'knex';
import { getDb } from '../../../config/database';
import { AuditEventType } from '../../../shared/types';

// =============================================================================
// Audit Log Repository
// =============================================================================

export interface AuditLogRecord {
  id: string;
  workflowId: string;
  eventType: AuditEventType;
  actor: string;
  description: string;
  metadata: Record<string, unknown> | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  createdAt: Date;
}

interface AuditLogRow {
  id: string;
  workflow_id: string;
  event_type: AuditEventType;
  actor: string;
  description: string;
  metadata: Record<string, unknown> | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  created_at: Date;
}

function rowToRecord(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    eventType: row.event_type,
    actor: row.actor,
    description: row.description,
    metadata: row.metadata,
    previousState: row.previous_state,
    newState: row.new_state,
    createdAt: row.created_at,
  };
}

export class AuditLogRepository {
  private db: Knex;

  constructor(db?: Knex) {
    this.db = db || getDb();
  }

  private table() {
    return this.db('audit_logs');
  }

  async create(data: {
    workflowId: string;
    eventType: AuditEventType;
    actor?: string;
    description: string;
    metadata?: Record<string, unknown>;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    const [row] = await this.table()
      .insert({
        workflow_id: data.workflowId,
        event_type: data.eventType,
        actor: data.actor || 'system',
        description: data.description,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        previous_state: data.previousState ? JSON.stringify(data.previousState) : null,
        new_state: data.newState ? JSON.stringify(data.newState) : null,
      })
      .returning('*');

    return rowToRecord(row);
  }

  async findByWorkflowId(
    workflowId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ items: AuditLogRecord[]; total: number }> {
    const query = this.table().where({ workflow_id: workflowId });

    const countResult = await query.clone().count('id as count').first();
    const total = Number(countResult?.count ?? 0);

    const rows = await query
      .orderBy('created_at', 'desc')
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);

    return { items: rows.map(rowToRecord), total };
  }

  async findRecent(limit: number = 50): Promise<AuditLogRecord[]> {
    const rows = await this.table()
      .orderBy('created_at', 'desc')
      .limit(limit);

    return rows.map(rowToRecord);
  }
}
