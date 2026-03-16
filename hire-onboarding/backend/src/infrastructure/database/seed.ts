/**
 * Database Seed Script
 * Run with: npx tsx src/infrastructure/database/seed.ts
 *
 * Inserts sample workflow data for development/testing.
 */
import { getDb, destroyDb } from '../../config/database';
import { WorkflowStatus, ContractType, ConfidenceLevel, AuditEventType } from '../../shared/types';
import { v4 as uuid } from 'uuid';

async function seed() {
  const db = getDb();

  console.log('Running migrations...');
  await db.migrate.latest();

  console.log('Seeding sample data...');

  const workflowId = uuid();

  // Insert a sample workflow in READY_FOR_REVIEW state
  await db('hiring_workflows').insert({
    id: workflowId,
    email_message_id: 'sample-msg-001',
    email_internet_message_id: '<sample-001@balcpa.com>',
    email_from: 'hiring.manager@balcpa.com',
    email_subject: 'FW: New Physician Hire - Dr. Sarah Chen',
    email_body: `Hi team,

We've finalized details with Dr. Sarah Chen. Please prepare the employment contract with the following terms:

Name: Dr. Sarah Elizabeth Chen
Position: Physician (Anesthesiologist)
Track: Shareholder/Partner track
Start Date: July 1, 2026

Compensation:
- Year 1 base salary: $420,000
- Year 2 base salary: $450,000
- Production bonus: 25% of collections above $600K threshold

Vacation: 5 weeks PTO plus CME time

Thanks,
Dr. Michael Roberts`,
    email_received_at: new Date('2026-03-15T10:30:00Z'),
    email_conversation_id: 'conv-sample-001',
    status: WorkflowStatus.READY_FOR_REVIEW,
    contract_type: ContractType.MD_SHAREHOLDER,
    extracted_fields: JSON.stringify({
      fullLegalName: { value: 'Dr. Sarah Elizabeth Chen', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Dr. Sarah Elizabeth Chen' },
      role: { value: 'Physician (Anesthesiologist)', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Position: Physician (Anesthesiologist)' },
      contractType: { value: 'MD_SHAREHOLDER', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Shareholder/Partner track' },
      startDate: { value: 'July 1, 2026', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Start Date: July 1, 2026' },
      salary: { value: '$420,000', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Year 1 base salary: $420,000' },
      baseSalaryYear1: { value: '$420,000', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Year 1 base salary: $420,000' },
      baseSalaryYear2: { value: '$450,000', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Year 2 base salary: $450,000' },
      vacation: { value: '5 weeks PTO plus CME time', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Vacation: 5 weeks PTO plus CME time' },
      shareholderStatus: { value: 'Shareholder/Partner track', confidence: 'HIGH', source: 'llm', rawExcerpt: 'Track: Shareholder/Partner track' },
      compensationNotes: { value: 'Production bonus: 25% of collections above $600K threshold', confidence: 'MEDIUM', source: 'llm', rawExcerpt: 'Production bonus: 25% of collections above $600K threshold' },
      roleSpecificTerms: { value: null, confidence: 'LOW', source: 'llm' },
    }),
    overall_extraction_confidence: 0.92,
    classification_result: JSON.stringify({
      isHireRequest: true,
      confidence: 0.98,
      reasoning: 'Email contains explicit request to prepare employment contract with compensation details and start date.',
    }),
  });

  // Insert audit entries
  await db('audit_logs').insert([
    {
      workflow_id: workflowId,
      event_type: AuditEventType.WORKFLOW_CREATED,
      actor: 'system',
      description: 'Workflow created from email: FW: New Physician Hire - Dr. Sarah Chen',
      created_at: new Date('2026-03-15T10:30:05Z'),
    },
    {
      workflow_id: workflowId,
      event_type: AuditEventType.FIELDS_EXTRACTED,
      actor: 'system',
      description: 'Fields extracted with 92% overall confidence',
      created_at: new Date('2026-03-15T10:30:15Z'),
    },
    {
      workflow_id: workflowId,
      event_type: AuditEventType.STATUS_CHANGED,
      actor: 'system',
      description: 'Status changed: RECEIVED → CLASSIFIED',
      created_at: new Date('2026-03-15T10:30:16Z'),
    },
    {
      workflow_id: workflowId,
      event_type: AuditEventType.STATUS_CHANGED,
      actor: 'system',
      description: 'Status changed: CLASSIFIED → READY_FOR_REVIEW',
      created_at: new Date('2026-03-15T10:30:17Z'),
    },
  ]);

  // Record as processed
  await db('processed_emails').insert({
    internet_message_id: '<sample-001@balcpa.com>',
    workflow_id: workflowId,
    disposition: 'processed',
  });

  console.log(`Seeded workflow: ${workflowId}`);
  console.log('Done!');

  await destroyDb();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
