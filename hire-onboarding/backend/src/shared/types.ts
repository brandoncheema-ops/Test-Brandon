// =============================================================================
// Core shared types for the hire onboarding system
// =============================================================================

/** Contract types supported by the system */
export enum ContractType {
  MD_SHAREHOLDER = 'MD_SHAREHOLDER',
  MD_NON_SHAREHOLDER = 'MD_NON_SHAREHOLDER',
  CRNA = 'CRNA',
}

/** Workflow states - explicit state machine */
export enum WorkflowStatus {
  RECEIVED = 'RECEIVED',
  CLASSIFIED = 'CLASSIFIED',
  NEEDS_MORE_INFO = 'NEEDS_MORE_INFO',
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  READY_TO_GENERATE = 'READY_TO_GENERATE',
  GENERATED = 'GENERATED',
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  WAITING_FOR_SIGNATURE = 'WAITING_FOR_SIGNATURE',
  SIGNED_MARKED = 'SIGNED_MARKED',
  FILED_TO_SHAREPOINT = 'FILED_TO_SHAREPOINT',
  FAILED = 'FAILED',
}

/** Confidence level for LLM-extracted fields */
export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/** Audit event types */
export enum AuditEventType {
  WORKFLOW_CREATED = 'WORKFLOW_CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  FIELDS_EXTRACTED = 'FIELDS_EXTRACTED',
  FIELDS_EDITED = 'FIELDS_EDITED',
  FIELDS_APPROVED = 'FIELDS_APPROVED',
  CONTRACT_GENERATED = 'CONTRACT_GENERATED',
  CONTRACT_APPROVED = 'CONTRACT_APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  MISSING_INFO_DRAFT_CREATED = 'MISSING_INFO_DRAFT_CREATED',
  MARKED_AS_SIGNED = 'MARKED_AS_SIGNED',
  FILED_TO_SHAREPOINT = 'FILED_TO_SHAREPOINT',
  REMINDER_SENT = 'REMINDER_SENT',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  EMAIL_SKIPPED_BETA = 'EMAIL_SKIPPED_BETA',
  EMAIL_SKIPPED_DUPLICATE = 'EMAIL_SKIPPED_DUPLICATE',
  EMAIL_CLASSIFIED_NOT_HIRE = 'EMAIL_CLASSIFIED_NOT_HIRE',
}

/** Extracted field with confidence tracking */
export interface ExtractedField<T = string> {
  value: T | null;
  confidence: ConfidenceLevel;
  source: 'llm' | 'manual' | 'edited';
  rawExcerpt?: string; // Original text that was parsed
}

/** All extractable hiring fields */
export interface HiringFields {
  fullLegalName: ExtractedField;
  role: ExtractedField;
  contractType: ExtractedField<ContractType>;
  startDate: ExtractedField;
  salary: ExtractedField;
  baseSalaryYear1: ExtractedField;
  baseSalaryYear2: ExtractedField;
  vacation: ExtractedField;
  shareholderStatus: ExtractedField;
  compensationNotes: ExtractedField;
  roleSpecificTerms: ExtractedField;
}

/** Required fields that must be present before contract generation */
export const REQUIRED_FIELDS: (keyof HiringFields)[] = [
  'fullLegalName',
  'role',
  'startDate',
  'salary',
  'vacation',
];

/** Fields required conditionally */
export const CONDITIONAL_REQUIRED_FIELDS: Record<string, (keyof HiringFields)[]> = {
  [ContractType.MD_SHAREHOLDER]: ['shareholderStatus'],
  [ContractType.MD_NON_SHAREHOLDER]: ['shareholderStatus'],
};

/** Email message as received from the inbox */
export interface IncomingEmail {
  messageId: string;
  internetMessageId: string;
  subject: string;
  from: string;
  fromDomain: string;
  receivedAt: Date;
  body: string;
  bodyPreview: string;
  hasAttachments: boolean;
  conversationId: string;
  rawHeaders?: Record<string, string>;
}

/** Result of email classification */
export interface ClassificationResult {
  isHireRequest: boolean;
  confidence: number;
  reasoning: string;
}

/** Missing field info for follow-up */
export interface MissingFieldInfo {
  fieldName: keyof HiringFields;
  label: string;
  reason: string;
}

/** Reminder tracking */
export interface ReminderInfo {
  lastReminderAt: Date | null;
  reminderCount: number;
  nextReminderAt: Date | null;
}
