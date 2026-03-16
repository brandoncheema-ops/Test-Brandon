import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Workflow status enum
  await knex.raw(`
    CREATE TYPE workflow_status AS ENUM (
      'RECEIVED', 'CLASSIFIED', 'NEEDS_MORE_INFO', 'READY_FOR_REVIEW',
      'READY_TO_GENERATE', 'GENERATED', 'APPROVED', 'REVISION_REQUESTED',
      'WAITING_FOR_SIGNATURE', 'SIGNED_MARKED', 'FILED_TO_SHAREPOINT', 'FAILED'
    )
  `);

  // Contract type enum
  await knex.raw(`
    CREATE TYPE contract_type AS ENUM (
      'MD_SHAREHOLDER', 'MD_NON_SHAREHOLDER', 'CRNA'
    )
  `);

  // Audit event type enum
  await knex.raw(`
    CREATE TYPE audit_event_type AS ENUM (
      'WORKFLOW_CREATED', 'STATUS_CHANGED', 'FIELDS_EXTRACTED', 'FIELDS_EDITED',
      'FIELDS_APPROVED', 'CONTRACT_GENERATED', 'CONTRACT_APPROVED',
      'REVISION_REQUESTED', 'MISSING_INFO_DRAFT_CREATED', 'MARKED_AS_SIGNED',
      'FILED_TO_SHAREPOINT', 'REMINDER_SENT', 'ERROR_OCCURRED',
      'EMAIL_SKIPPED_BETA', 'EMAIL_SKIPPED_DUPLICATE', 'EMAIL_CLASSIFIED_NOT_HIRE'
    )
  `);

  // Main hiring workflows table
  await knex.schema.createTable('hiring_workflows', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Email source data
    table.string('email_message_id').notNullable().unique();
    table.string('email_internet_message_id').notNullable();
    table.string('email_from').notNullable();
    table.string('email_subject').notNullable();
    table.text('email_body').notNullable();
    table.timestamp('email_received_at').notNullable();
    table.string('email_conversation_id').nullable();

    // Workflow state
    table.specificType('status', 'workflow_status').notNullable().defaultTo('RECEIVED');
    table.specificType('contract_type', 'contract_type').nullable();

    // Extracted data (JSONB for flexibility + schema validation in app layer)
    table.jsonb('extracted_fields').nullable();
    table.float('overall_extraction_confidence').nullable();

    // Classification result
    table.jsonb('classification_result').nullable();

    // Generated documents
    table.string('generated_contract_path').nullable();
    table.string('signed_contract_path').nullable();
    table.string('sharepoint_file_url').nullable();

    // Missing info
    table.text('missing_info_draft').nullable();

    // Reminders
    table.timestamp('last_reminder_at').nullable();
    table.integer('reminder_count').notNullable().defaultTo(0);
    table.timestamp('next_reminder_at').nullable();

    // Revisions
    table.text('revision_notes').nullable();
    table.integer('revision_count').notNullable().defaultTo(0);

    // Timestamps
    table.timestamps(true, true);

    // Indexes
    table.index('status');
    table.index('email_from');
    table.index('created_at');
  });

  // Audit log table
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('workflow_id').notNullable().references('id').inTable('hiring_workflows').onDelete('CASCADE');
    table.specificType('event_type', 'audit_event_type').notNullable();
    table.string('actor').notNullable().defaultTo('system');
    table.text('description').notNullable();
    table.jsonb('metadata').nullable();
    table.jsonb('previous_state').nullable();
    table.jsonb('new_state').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('workflow_id');
    table.index('event_type');
    table.index('created_at');
  });

  // Processed emails tracking (for idempotency)
  await knex.schema.createTable('processed_emails', (table) => {
    table.string('internet_message_id').primary();
    table.uuid('workflow_id').nullable().references('id').inTable('hiring_workflows');
    table.string('disposition').notNullable(); // 'processed', 'skipped_beta', 'skipped_not_hire', 'skipped_duplicate'
    table.timestamp('processed_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('processed_emails');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('hiring_workflows');
  await knex.raw('DROP TYPE IF EXISTS audit_event_type');
  await knex.raw('DROP TYPE IF EXISTS contract_type');
  await knex.raw('DROP TYPE IF EXISTS workflow_status');
}
