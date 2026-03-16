import {
  WorkflowStatus,
  ContractType,
  HiringFields,
  ExtractedField,
  ConfidenceLevel,
  ReminderInfo,
  REQUIRED_FIELDS,
  CONDITIONAL_REQUIRED_FIELDS,
  MissingFieldInfo,
} from '../../shared/types';

// =============================================================================
// HiringWorkflow - Core domain entity
// =============================================================================

export interface HiringWorkflowRecord {
  id: string;
  emailMessageId: string;
  emailInternetMessageId: string;
  emailFrom: string;
  emailSubject: string;
  emailBody: string;
  emailReceivedAt: Date;
  emailConversationId: string;

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

  reminderInfo: ReminderInfo;

  revisionNotes: string | null;
  revisionCount: number;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Field label mapping for human-readable display
// =============================================================================

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
  compensationNotes: 'Compensation Notes / Bonus Terms',
  roleSpecificTerms: 'Role-Specific Terms',
};

// =============================================================================
// Domain logic functions operating on HiringWorkflow
// =============================================================================

/**
 * Creates an empty extracted field.
 */
export function emptyField<T = string>(): ExtractedField<T> {
  return {
    value: null,
    confidence: ConfidenceLevel.LOW,
    source: 'llm',
  };
}

/**
 * Creates a default empty HiringFields object.
 */
export function emptyHiringFields(): HiringFields {
  return {
    fullLegalName: emptyField(),
    role: emptyField(),
    contractType: emptyField<ContractType>(),
    startDate: emptyField(),
    salary: emptyField(),
    baseSalaryYear1: emptyField(),
    baseSalaryYear2: emptyField(),
    vacation: emptyField(),
    shareholderStatus: emptyField(),
    compensationNotes: emptyField(),
    roleSpecificTerms: emptyField(),
  };
}

/**
 * Identifies missing required fields for a given set of extracted fields.
 */
export function getMissingRequiredFields(
  fields: HiringFields,
  contractType: ContractType | null
): MissingFieldInfo[] {
  const missing: MissingFieldInfo[] = [];

  for (const fieldName of REQUIRED_FIELDS) {
    const field = fields[fieldName];
    if (!field.value || (typeof field.value === 'string' && field.value.trim() === '')) {
      missing.push({
        fieldName,
        label: FIELD_LABELS[fieldName],
        reason: `${FIELD_LABELS[fieldName]} is required but was not found in the email`,
      });
    }
  }

  // Check conditional required fields based on contract type
  if (contractType) {
    const conditionalFields = CONDITIONAL_REQUIRED_FIELDS[contractType];
    if (conditionalFields) {
      for (const fieldName of conditionalFields) {
        const field = fields[fieldName];
        if (!field.value || (typeof field.value === 'string' && field.value.trim() === '')) {
          missing.push({
            fieldName,
            label: FIELD_LABELS[fieldName],
            reason: `${FIELD_LABELS[fieldName]} is required for ${contractType} contracts`,
          });
        }
      }
    }
  }

  return missing;
}

/**
 * Returns fields with low confidence that need human review.
 */
export function getLowConfidenceFields(
  fields: HiringFields,
  threshold: number
): { fieldName: keyof HiringFields; label: string; confidence: ConfidenceLevel }[] {
  const lowConfidence: { fieldName: keyof HiringFields; label: string; confidence: ConfidenceLevel }[] = [];

  for (const [key, field] of Object.entries(fields)) {
    const fieldName = key as keyof HiringFields;
    if (field.value !== null && field.confidence !== ConfidenceLevel.HIGH) {
      lowConfidence.push({
        fieldName,
        label: FIELD_LABELS[fieldName],
        confidence: field.confidence,
      });
    }
  }

  return lowConfidence;
}

/**
 * Computes overall extraction confidence as weighted average.
 * Required fields count 2x.
 */
export function computeOverallConfidence(fields: HiringFields): number {
  const confidenceValues: Record<ConfidenceLevel, number> = {
    [ConfidenceLevel.HIGH]: 1.0,
    [ConfidenceLevel.MEDIUM]: 0.6,
    [ConfidenceLevel.LOW]: 0.2,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, field] of Object.entries(fields)) {
    if (field.value === null) continue;

    const isRequired = REQUIRED_FIELDS.includes(key as keyof HiringFields);
    const weight = isRequired ? 2 : 1;
    totalWeight += weight;
    weightedSum += confidenceValues[field.confidence] * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Maps a contract type string from extracted text to the enum.
 */
export function resolveContractType(
  role: string | null,
  shareholderStatus: string | null
): ContractType | null {
  if (!role) return null;

  const roleLower = role.toLowerCase();

  if (roleLower.includes('crna') || roleLower.includes('nurse anesthetist')) {
    return ContractType.CRNA;
  }

  if (
    roleLower.includes('md') ||
    roleLower.includes('physician') ||
    roleLower.includes('doctor')
  ) {
    if (shareholderStatus) {
      const shLower = shareholderStatus.toLowerCase();
      if (
        shLower.includes('shareholder') ||
        shLower.includes('partner') ||
        shLower === 'yes'
      ) {
        return ContractType.MD_SHAREHOLDER;
      }
    }
    return ContractType.MD_NON_SHAREHOLDER;
  }

  return null;
}
