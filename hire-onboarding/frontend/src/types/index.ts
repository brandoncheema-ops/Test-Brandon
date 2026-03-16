// =============================================================================
// Frontend type definitions - mirrors backend shared types
// =============================================================================

export enum ContractType {
  MD_SHAREHOLDER = 'MD_SHAREHOLDER',
  MD_NON_SHAREHOLDER = 'MD_NON_SHAREHOLDER',
  CRNA = 'CRNA',
}

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

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export interface ExtractedField<T = string> {
  value: T | null;
  confidence: ConfidenceLevel;
  source: 'llm' | 'manual' | 'edited';
  rawExcerpt?: string;
}

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

export interface HiringWorkflow {
  id: string;
  emailMessageId: string;
  emailFrom: string;
  emailSubject: string;
  emailBody: string;
  emailReceivedAt: string;
  status: WorkflowStatus;
  contractType: ContractType | null;
  extractedFields: HiringFields | null;
  overallExtractionConfidence: number | null;
  classificationResult: {
    isHireRequest: boolean;
    confidence: number;
    reasoning: string;
  } | null;
  generatedContractPath: string | null;
  signedContractPath: string | null;
  sharepointFileUrl: string | null;
  missingInfoDraft: string | null;
  reminderInfo: {
    lastReminderAt: string | null;
    reminderCount: number;
    nextReminderAt: string | null;
  };
  revisionNotes: string | null;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  workflowId: string;
  eventType: string;
  actor: string;
  description: string;
  metadata: Record<string, unknown> | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  createdAt: string;
}

export const FIELD_LABELS: Record<keyof HiringFields, string> = {
  fullLegalName: 'Full Legal Name',
  role: 'Role / Position',
  contractType: 'Contract Type',
  startDate: 'Start Date',
  salary: 'Salary',
  baseSalaryYear1: 'Base Salary Year 1',
  baseSalaryYear2: 'Base Salary Year 2',
  vacation: 'Vacation',
  shareholderStatus: 'Shareholder Status',
  compensationNotes: 'Compensation Notes',
  roleSpecificTerms: 'Role-Specific Terms',
};

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  [WorkflowStatus.RECEIVED]: 'Received',
  [WorkflowStatus.CLASSIFIED]: 'Classified',
  [WorkflowStatus.NEEDS_MORE_INFO]: 'Needs More Info',
  [WorkflowStatus.READY_FOR_REVIEW]: 'Ready for Review',
  [WorkflowStatus.READY_TO_GENERATE]: 'Ready to Generate',
  [WorkflowStatus.GENERATED]: 'Contract Generated',
  [WorkflowStatus.APPROVED]: 'Approved',
  [WorkflowStatus.REVISION_REQUESTED]: 'Revision Requested',
  [WorkflowStatus.WAITING_FOR_SIGNATURE]: 'Waiting for Signature',
  [WorkflowStatus.SIGNED_MARKED]: 'Signed',
  [WorkflowStatus.FILED_TO_SHAREPOINT]: 'Filed to SharePoint',
  [WorkflowStatus.FAILED]: 'Failed',
};

export const STATUS_COLORS: Record<WorkflowStatus, string> = {
  [WorkflowStatus.RECEIVED]: 'bg-blue-100 text-blue-800',
  [WorkflowStatus.CLASSIFIED]: 'bg-blue-200 text-blue-900',
  [WorkflowStatus.NEEDS_MORE_INFO]: 'bg-yellow-100 text-yellow-800',
  [WorkflowStatus.READY_FOR_REVIEW]: 'bg-orange-100 text-orange-800',
  [WorkflowStatus.READY_TO_GENERATE]: 'bg-purple-100 text-purple-800',
  [WorkflowStatus.GENERATED]: 'bg-indigo-100 text-indigo-800',
  [WorkflowStatus.APPROVED]: 'bg-teal-100 text-teal-800',
  [WorkflowStatus.REVISION_REQUESTED]: 'bg-red-100 text-red-800',
  [WorkflowStatus.WAITING_FOR_SIGNATURE]: 'bg-amber-100 text-amber-800',
  [WorkflowStatus.SIGNED_MARKED]: 'bg-green-100 text-green-800',
  [WorkflowStatus.FILED_TO_SHAREPOINT]: 'bg-green-200 text-green-900',
  [WorkflowStatus.FAILED]: 'bg-red-200 text-red-900',
};
