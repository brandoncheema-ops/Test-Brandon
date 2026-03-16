import { Knex } from 'knex';
import { getDb } from '../../../config/database';
import { HiringWorkflowRecord } from '../../../domain/models/HiringWorkflow';
import {
  WorkflowStatus,
  ContractType,
  HiringFields,
  ReminderInfo,
} from '../../../shared/types';
import { NotFoundError } from '../../../shared/errors';

// =============================================================================
// Workflow Repository - Database access for hiring workflows
// =============================================================================

interface WorkflowRow {
  id: string;
  email_message_id: string;
  email_internet_message_id: string;
  email_from: string;
  email_subject: string;
  email_body: string;
  email_received_at: Date;
  email_conversation_id: string | null;
  status: WorkflowStatus;
  contract_type: ContractType | null;
  extracted_fields: HiringFields | null;
  overall_extraction_confidence: number | null;
  classification_result: HiringWorkflowRecord['classificationResult'] | null;
  generated_contract_path: string | null;
  signed_contract_path: string | null;
  sharepoint_file_url: string | null;
  missing_info_draft: string | null;
  last_reminder_at: Date | null;
  reminder_count: number;
  next_reminder_at: Date | null;
  revision_notes: string | null;
  revision_count: number;
  created_at: Date;
  updated_at: Date;
}

function rowToRecord(row: WorkflowRow): HiringWorkflowRecord {
  return {
    id: row.id,
    emailMessageId: row.email_message_id,
    emailInternetMessageId: row.email_internet_message_id,
    emailFrom: row.email_from,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
    emailReceivedAt: row.email_received_at,
    emailConversationId: row.email_conversation_id ?? '',
    status: row.status,
    contractType: row.contract_type,
    extractedFields: row.extracted_fields,
    overallExtractionConfidence: row.overall_extraction_confidence,
    classificationResult: row.classification_result,
    generatedContractPath: row.generated_contract_path,
    signedContractPath: row.signed_contract_path,
    sharepointFileUrl: row.sharepoint_file_url,
    missingInfoDraft: row.missing_info_draft,
    reminderInfo: {
      lastReminderAt: row.last_reminder_at,
      reminderCount: row.reminder_count,
      nextReminderAt: row.next_reminder_at,
    },
    revisionNotes: row.revision_notes,
    revisionCount: row.revision_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WorkflowRepository {
  private db: Knex;

  constructor(db?: Knex) {
    this.db = db || getDb();
  }

  private table() {
    return this.db('hiring_workflows');
  }

  async create(
    data: Omit<HiringWorkflowRecord, 'id' | 'createdAt' | 'updatedAt' | 'reminderInfo' | 'revisionCount'> & {
      reminderInfo?: Partial<ReminderInfo>;
    }
  ): Promise<HiringWorkflowRecord> {
    const [row] = await this.table()
      .insert({
        email_message_id: data.emailMessageId,
        email_internet_message_id: data.emailInternetMessageId,
        email_from: data.emailFrom,
        email_subject: data.emailSubject,
        email_body: data.emailBody,
        email_received_at: data.emailReceivedAt,
        email_conversation_id: data.emailConversationId,
        status: data.status,
        contract_type: data.contractType,
        extracted_fields: data.extractedFields ? JSON.stringify(data.extractedFields) : null,
        overall_extraction_confidence: data.overallExtractionConfidence,
        classification_result: data.classificationResult
          ? JSON.stringify(data.classificationResult)
          : null,
        generated_contract_path: data.generatedContractPath,
        signed_contract_path: data.signedContractPath,
        sharepoint_file_url: data.sharepointFileUrl,
        missing_info_draft: data.missingInfoDraft,
        revision_notes: data.revisionNotes,
      })
      .returning('*');

    return rowToRecord(row);
  }

  async findById(id: string): Promise<HiringWorkflowRecord> {
    const row = await this.table().where({ id }).first();
    if (!row) throw new NotFoundError('HiringWorkflow', id);
    return rowToRecord(row);
  }

  async findByEmailMessageId(messageId: string): Promise<HiringWorkflowRecord | null> {
    const row = await this.table().where({ email_message_id: messageId }).first();
    return row ? rowToRecord(row) : null;
  }

  async findAll(filters?: {
    status?: WorkflowStatus;
    contractType?: ContractType;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
  }): Promise<{ items: HiringWorkflowRecord[]; total: number }> {
    const query = this.table();

    if (filters?.status) query.where('status', filters.status);
    if (filters?.contractType) query.where('contract_type', filters.contractType);

    const countResult = await query.clone().count('id as count').first();
    const total = Number(countResult?.count ?? 0);

    const orderBy = filters?.orderBy || 'created_at';
    const orderDir = filters?.orderDir || 'desc';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const rows = await query.orderBy(orderBy, orderDir).limit(limit).offset(offset);

    return {
      items: rows.map(rowToRecord),
      total,
    };
  }

  async updateStatus(id: string, status: WorkflowStatus): Promise<HiringWorkflowRecord> {
    const [row] = await this.table()
      .where({ id })
      .update({ status, updated_at: this.db.fn.now() })
      .returning('*');

    if (!row) throw new NotFoundError('HiringWorkflow', id);
    return rowToRecord(row);
  }

  async updateFields(
    id: string,
    updates: Partial<{
      status: WorkflowStatus;
      contractType: ContractType | null;
      extractedFields: HiringFields;
      overallExtractionConfidence: number;
      classificationResult: HiringWorkflowRecord['classificationResult'];
      generatedContractPath: string;
      signedContractPath: string;
      sharepointFileUrl: string;
      missingInfoDraft: string;
      revisionNotes: string;
      revisionCount: number;
      lastReminderAt: Date;
      reminderCount: number;
      nextReminderAt: Date | null;
    }>
  ): Promise<HiringWorkflowRecord> {
    const dbUpdates: Record<string, unknown> = { updated_at: this.db.fn.now() };

    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.contractType !== undefined) dbUpdates.contract_type = updates.contractType;
    if (updates.extractedFields !== undefined)
      dbUpdates.extracted_fields = JSON.stringify(updates.extractedFields);
    if (updates.overallExtractionConfidence !== undefined)
      dbUpdates.overall_extraction_confidence = updates.overallExtractionConfidence;
    if (updates.classificationResult !== undefined)
      dbUpdates.classification_result = JSON.stringify(updates.classificationResult);
    if (updates.generatedContractPath !== undefined)
      dbUpdates.generated_contract_path = updates.generatedContractPath;
    if (updates.signedContractPath !== undefined)
      dbUpdates.signed_contract_path = updates.signedContractPath;
    if (updates.sharepointFileUrl !== undefined)
      dbUpdates.sharepoint_file_url = updates.sharepointFileUrl;
    if (updates.missingInfoDraft !== undefined)
      dbUpdates.missing_info_draft = updates.missingInfoDraft;
    if (updates.revisionNotes !== undefined) dbUpdates.revision_notes = updates.revisionNotes;
    if (updates.revisionCount !== undefined) dbUpdates.revision_count = updates.revisionCount;
    if (updates.lastReminderAt !== undefined) dbUpdates.last_reminder_at = updates.lastReminderAt;
    if (updates.reminderCount !== undefined) dbUpdates.reminder_count = updates.reminderCount;
    if (updates.nextReminderAt !== undefined) dbUpdates.next_reminder_at = updates.nextReminderAt;

    const [row] = await this.table().where({ id }).update(dbUpdates).returning('*');
    if (!row) throw new NotFoundError('HiringWorkflow', id);
    return rowToRecord(row);
  }

  async findDueReminders(now: Date): Promise<HiringWorkflowRecord[]> {
    const rows = await this.table()
      .where('status', WorkflowStatus.WAITING_FOR_SIGNATURE)
      .where('next_reminder_at', '<=', now)
      .orderBy('next_reminder_at', 'asc');

    return rows.map(rowToRecord);
  }

  async getStatusCounts(): Promise<Record<WorkflowStatus, number>> {
    const rows = await this.table()
      .select('status')
      .count('id as count')
      .groupBy('status');

    const counts = {} as Record<WorkflowStatus, number>;
    for (const s of Object.values(WorkflowStatus)) {
      counts[s] = 0;
    }
    for (const row of rows) {
      counts[row.status as WorkflowStatus] = Number(row.count);
    }
    return counts;
  }
}
