import { Knex } from 'knex';
import { getDb } from '../../../config/database';

// =============================================================================
// Processed Email Repository - Tracks processed emails for idempotency
// =============================================================================

export interface ProcessedEmailRecord {
  internetMessageId: string;
  workflowId: string | null;
  disposition: 'processed' | 'skipped_beta' | 'skipped_not_hire' | 'skipped_duplicate';
  processedAt: Date;
}

export class ProcessedEmailRepository {
  private db: Knex;

  constructor(db?: Knex) {
    this.db = db || getDb();
  }

  private table() {
    return this.db('processed_emails');
  }

  async exists(internetMessageId: string): Promise<boolean> {
    const row = await this.table()
      .where({ internet_message_id: internetMessageId })
      .first();
    return !!row;
  }

  async record(data: {
    internetMessageId: string;
    workflowId?: string | null;
    disposition: ProcessedEmailRecord['disposition'];
  }): Promise<void> {
    await this.table()
      .insert({
        internet_message_id: data.internetMessageId,
        workflow_id: data.workflowId || null,
        disposition: data.disposition,
      })
      .onConflict('internet_message_id')
      .ignore();
  }
}
