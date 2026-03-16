import { WorkflowRepository } from '../../infrastructure/database/repositories/workflowRepository';
import { ProcessedEmailRepository } from '../../infrastructure/database/repositories/processedEmailRepository';
import { AuditService } from './auditService';
import { IExtractionService, LlmExtractionService } from '../../infrastructure/llm/llmService';
import { ContractGeneratorService } from '../../infrastructure/documents/contractGenerator';
import { SharePointService } from '../../infrastructure/sharepoint/sharepointService';
import { HiringWorkflowRecord, getMissingRequiredFields, computeOverallConfidence, resolveContractType, FIELD_LABELS } from '../models/HiringWorkflow';
import { assertValidTransition } from '../workflows/stateMachine';
import {
  WorkflowStatus,
  AuditEventType,
  IncomingEmail,
  HiringFields,
  ContractType,
  MissingFieldInfo,
} from '../../shared/types';
import { getEnv } from '../../config/env';
import { getLogger } from '../../config/logger';
import {
  BetaModeRestrictionError,
  DuplicateEmailError,
  ValidationError,
} from '../../shared/errors';

const logger = getLogger('workflow-manager');

// =============================================================================
// Workflow Manager - Orchestrates the hiring workflow lifecycle
// This is the main domain service that coordinates all business logic.
// =============================================================================

export class WorkflowManager {
  private workflowRepo: WorkflowRepository;
  private processedEmailRepo: ProcessedEmailRepository;
  private auditService: AuditService;
  private extractionService: IExtractionService;
  private contractGenerator: ContractGeneratorService;
  private sharepointService: SharePointService;

  constructor(deps?: {
    workflowRepo?: WorkflowRepository;
    processedEmailRepo?: ProcessedEmailRepository;
    auditService?: AuditService;
    extractionService?: IExtractionService;
    contractGenerator?: ContractGeneratorService;
    sharepointService?: SharePointService;
  }) {
    this.workflowRepo = deps?.workflowRepo || new WorkflowRepository();
    this.processedEmailRepo = deps?.processedEmailRepo || new ProcessedEmailRepository();
    this.auditService = deps?.auditService || new AuditService();
    this.extractionService = deps?.extractionService || new LlmExtractionService();
    this.contractGenerator = deps?.contractGenerator || new ContractGeneratorService();
    this.sharepointService = deps?.sharepointService || new SharePointService();
  }

  // ---------------------------------------------------------------------------
  // Step 1: Process incoming email
  // ---------------------------------------------------------------------------
  async processIncomingEmail(email: IncomingEmail): Promise<HiringWorkflowRecord | null> {
    const env = getEnv();

    // Idempotency check
    const alreadyProcessed = await this.processedEmailRepo.exists(email.internetMessageId);
    if (alreadyProcessed) {
      logger.info({ internetMessageId: email.internetMessageId }, 'Email already processed, skipping');
      return null;
    }

    // Beta mode sender restriction
    if (env.BETA_MODE) {
      const allowed = env.BETA_ALLOWED_DOMAINS.some(
        (domain) => email.fromDomain === domain
      );
      if (!allowed) {
        logger.info(
          { from: email.from, domain: email.fromDomain },
          'Email rejected: sender not in beta allowed domains'
        );
        await this.processedEmailRepo.record({
          internetMessageId: email.internetMessageId,
          disposition: 'skipped_beta',
        });
        return null;
      }
    }

    // Create workflow record
    const workflow = await this.workflowRepo.create({
      emailMessageId: email.messageId,
      emailInternetMessageId: email.internetMessageId,
      emailFrom: email.from,
      emailSubject: email.subject,
      emailBody: email.body,
      emailReceivedAt: email.receivedAt,
      emailConversationId: email.conversationId,
      status: WorkflowStatus.RECEIVED,
      contractType: null,
      extractedFields: null,
      overallExtractionConfidence: null,
      classificationResult: null,
      generatedContractPath: null,
      signedContractPath: null,
      sharepointFileUrl: null,
      missingInfoDraft: null,
      revisionNotes: null,
    });

    await this.auditService.log({
      workflowId: workflow.id,
      eventType: AuditEventType.WORKFLOW_CREATED,
      description: `Workflow created from email: ${email.subject}`,
      metadata: { from: email.from, subject: email.subject },
    });

    await this.processedEmailRepo.record({
      internetMessageId: email.internetMessageId,
      workflowId: workflow.id,
      disposition: 'processed',
    });

    // Step 2: Classify the email
    return this.classifyAndExtract(workflow);
  }

  // ---------------------------------------------------------------------------
  // Step 2: Classify email and extract fields
  // ---------------------------------------------------------------------------
  private async classifyAndExtract(
    workflow: HiringWorkflowRecord
  ): Promise<HiringWorkflowRecord | null> {
    // Classify
    const classification = await this.extractionService.classifyEmail(
      workflow.emailSubject,
      workflow.emailBody
    );

    // Update classification result
    workflow = await this.workflowRepo.updateFields(workflow.id, {
      classificationResult: classification,
    });

    if (!classification.isHireRequest) {
      logger.info(
        { workflowId: workflow.id, reasoning: classification.reasoning },
        'Email classified as NOT a hire request'
      );
      await this.auditService.log({
        workflowId: workflow.id,
        eventType: AuditEventType.EMAIL_CLASSIFIED_NOT_HIRE,
        description: `Email classified as not a hire request: ${classification.reasoning}`,
        metadata: { classification },
      });
      // Keep the workflow for review but mark it
      await this.transitionStatus(workflow.id, workflow.status, WorkflowStatus.CLASSIFIED);
      return workflow;
    }

    // Extract fields
    const extractedFields = await this.extractionService.extractHiringFields(
      workflow.emailSubject,
      workflow.emailBody
    );

    const overallConfidence = computeOverallConfidence(extractedFields);

    // Resolve contract type from extracted role + shareholder status
    const contractType = resolveContractType(
      extractedFields.role.value,
      extractedFields.shareholderStatus.value
    );

    // If the LLM extracted a contract type, use it if we couldn't resolve one
    const finalContractType =
      contractType || (extractedFields.contractType.value as ContractType) || null;

    workflow = await this.workflowRepo.updateFields(workflow.id, {
      extractedFields,
      overallExtractionConfidence: overallConfidence,
      contractType: finalContractType,
    });

    await this.auditService.log({
      workflowId: workflow.id,
      eventType: AuditEventType.FIELDS_EXTRACTED,
      description: `Fields extracted with ${(overallConfidence * 100).toFixed(0)}% overall confidence`,
      metadata: { overallConfidence, contractType: finalContractType },
    });

    // Transition to CLASSIFIED
    workflow = await this.transitionStatus(workflow.id, WorkflowStatus.RECEIVED, WorkflowStatus.CLASSIFIED);

    // Check for missing required fields
    const missingFields = getMissingRequiredFields(extractedFields, finalContractType);

    if (missingFields.length > 0) {
      // Generate missing info draft
      const draft = this.generateMissingInfoDraft(workflow, missingFields);
      workflow = await this.workflowRepo.updateFields(workflow.id, { missingInfoDraft: draft });
      workflow = await this.transitionStatus(
        workflow.id,
        WorkflowStatus.CLASSIFIED,
        WorkflowStatus.NEEDS_MORE_INFO
      );
    } else {
      workflow = await this.transitionStatus(
        workflow.id,
        WorkflowStatus.CLASSIFIED,
        WorkflowStatus.READY_FOR_REVIEW
      );
    }

    return workflow;
  }

  // ---------------------------------------------------------------------------
  // Dashboard actions
  // ---------------------------------------------------------------------------

  /**
   * Updates extracted fields (from dashboard edit).
   */
  async updateExtractedFields(
    workflowId: string,
    updates: Partial<Record<keyof HiringFields, string | null>>,
    actor: string = 'dashboard'
  ): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);

    if (!workflow.extractedFields) {
      throw new ValidationError('No extracted fields to update');
    }

    const previousFields = { ...workflow.extractedFields };
    const fields = { ...workflow.extractedFields };

    for (const [key, value] of Object.entries(updates)) {
      const fieldName = key as keyof HiringFields;
      if (fieldName in fields) {
        (fields[fieldName] as any) = {
          ...fields[fieldName],
          value,
          source: 'edited',
        };
      }
    }

    // Recompute contract type if role or shareholder status changed
    let contractType = workflow.contractType;
    if (updates.role !== undefined || updates.shareholderStatus !== undefined) {
      contractType = resolveContractType(
        fields.role.value,
        fields.shareholderStatus.value
      ) || contractType;
    }

    const overallConfidence = computeOverallConfidence(fields);

    const updated = await this.workflowRepo.updateFields(workflowId, {
      extractedFields: fields,
      overallExtractionConfidence: overallConfidence,
      contractType,
    });

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.FIELDS_EDITED,
      description: `Fields edited: ${Object.keys(updates).join(', ')}`,
      actor,
      metadata: { updatedFields: Object.keys(updates) },
      previousState: previousFields as unknown as Record<string, unknown>,
      newState: fields as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * Approves extracted fields and moves to READY_TO_GENERATE.
   */
  async approveFields(workflowId: string, actor: string = 'dashboard'): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);

    if (!workflow.extractedFields) {
      throw new ValidationError('No extracted fields to approve');
    }

    // Validate all required fields are present
    const missing = getMissingRequiredFields(workflow.extractedFields, workflow.contractType);
    if (missing.length > 0) {
      throw new ValidationError('Cannot approve: missing required fields', {
        missingFields: missing.map((f) => f.label),
      });
    }

    if (!workflow.contractType) {
      throw new ValidationError('Cannot approve: contract type not determined');
    }

    const currentStatus = workflow.status;
    const updated = await this.transitionStatus(workflowId, currentStatus, WorkflowStatus.READY_TO_GENERATE);

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.FIELDS_APPROVED,
      description: 'Extracted fields approved for contract generation',
      actor,
    });

    return updated;
  }

  /**
   * Generates the contract document.
   */
  async generateContract(workflowId: string, actor: string = 'dashboard'): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);

    if (workflow.status !== WorkflowStatus.READY_TO_GENERATE) {
      throw new ValidationError(`Cannot generate contract in status: ${workflow.status}`);
    }
    if (!workflow.contractType || !workflow.extractedFields) {
      throw new ValidationError('Missing contract type or extracted fields');
    }

    const result = await this.contractGenerator.generate(
      workflowId,
      workflow.contractType,
      workflow.extractedFields
    );

    let updated = await this.workflowRepo.updateFields(workflowId, {
      generatedContractPath: result.pdfPath,
    });

    updated = await this.transitionStatus(
      workflowId,
      WorkflowStatus.READY_TO_GENERATE,
      WorkflowStatus.GENERATED
    );

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.CONTRACT_GENERATED,
      description: `Contract generated: ${result.pdfPath}`,
      actor,
      metadata: { pdfPath: result.pdfPath, docxPath: result.docxPath },
    });

    return updated;
  }

  /**
   * Approves a generated contract.
   */
  async approveContract(workflowId: string, actor: string = 'dashboard'): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);

    let updated = await this.transitionStatus(
      workflowId,
      workflow.status,
      WorkflowStatus.APPROVED
    );

    updated = await this.transitionStatus(
      workflowId,
      WorkflowStatus.APPROVED,
      WorkflowStatus.WAITING_FOR_SIGNATURE
    );

    // Set first reminder
    const env = getEnv();
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + env.REMINDER_DAYS_THRESHOLD);

    updated = await this.workflowRepo.updateFields(workflowId, {
      nextReminderAt: reminderDate,
    });

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.CONTRACT_APPROVED,
      description: 'Contract approved, waiting for signature',
      actor,
    });

    return updated;
  }

  /**
   * Requests a revision of the contract.
   */
  async requestRevision(
    workflowId: string,
    notes: string,
    actor: string = 'dashboard'
  ): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);

    let updated = await this.transitionStatus(
      workflowId,
      workflow.status,
      WorkflowStatus.REVISION_REQUESTED
    );

    updated = await this.workflowRepo.updateFields(workflowId, {
      revisionNotes: notes,
      revisionCount: workflow.revisionCount + 1,
    });

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.REVISION_REQUESTED,
      description: `Revision requested: ${notes}`,
      actor,
      metadata: { notes, revisionCount: workflow.revisionCount + 1 },
    });

    return updated;
  }

  /**
   * Sends revision back to review.
   */
  async sendBackToReview(workflowId: string, actor: string = 'dashboard'): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);
    return this.transitionStatus(workflowId, workflow.status, WorkflowStatus.READY_FOR_REVIEW);
  }

  /**
   * Marks a contract as signed (Phase 1: manual action).
   */
  async markAsSigned(
    workflowId: string,
    signedContractPath?: string,
    actor: string = 'dashboard'
  ): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);

    let updated = await this.transitionStatus(
      workflowId,
      workflow.status,
      WorkflowStatus.SIGNED_MARKED
    );

    if (signedContractPath) {
      updated = await this.workflowRepo.updateFields(workflowId, {
        signedContractPath,
      });
    }

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.MARKED_AS_SIGNED,
      description: 'Contract marked as signed',
      actor,
      metadata: { signedContractPath },
    });

    return updated;
  }

  /**
   * Files the signed contract to SharePoint.
   */
  async fileToSharePoint(workflowId: string, actor: string = 'dashboard'): Promise<HiringWorkflowRecord> {
    const workflow = await this.workflowRepo.findById(workflowId);

    if (workflow.status !== WorkflowStatus.SIGNED_MARKED) {
      throw new ValidationError(`Cannot file to SharePoint in status: ${workflow.status}`);
    }

    const contractPath = workflow.signedContractPath || workflow.generatedContractPath;
    if (!contractPath) {
      throw new ValidationError('No contract file to upload');
    }

    const employeeName = workflow.extractedFields?.fullLegalName.value || 'Unknown';
    const { fileUrl } = await this.sharepointService.fileContract(employeeName, contractPath);

    let updated = await this.workflowRepo.updateFields(workflowId, {
      sharepointFileUrl: fileUrl,
    });

    updated = await this.transitionStatus(
      workflowId,
      WorkflowStatus.SIGNED_MARKED,
      WorkflowStatus.FILED_TO_SHAREPOINT
    );

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.FILED_TO_SHAREPOINT,
      description: `Contract filed to SharePoint: ${fileUrl}`,
      actor,
      metadata: { fileUrl, employeeName },
    });

    return updated;
  }

  /**
   * Prepares a missing-info follow-up email draft.
   */
  async prepareMissingInfoDraft(workflowId: string): Promise<string> {
    const workflow = await this.workflowRepo.findById(workflowId);

    if (!workflow.extractedFields) {
      throw new ValidationError('No extracted fields available');
    }

    const missing = getMissingRequiredFields(workflow.extractedFields, workflow.contractType);
    const draft = this.generateMissingInfoDraft(workflow, missing);

    await this.workflowRepo.updateFields(workflowId, { missingInfoDraft: draft });

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.MISSING_INFO_DRAFT_CREATED,
      description: `Missing info draft prepared for ${missing.length} fields`,
      metadata: { missingFields: missing.map((f) => f.label) },
    });

    return draft;
  }

  // ---------------------------------------------------------------------------
  // Query methods
  // ---------------------------------------------------------------------------

  async getWorkflow(workflowId: string): Promise<HiringWorkflowRecord> {
    return this.workflowRepo.findById(workflowId);
  }

  async listWorkflows(filters?: {
    status?: WorkflowStatus;
    contractType?: ContractType;
    limit?: number;
    offset?: number;
  }) {
    return this.workflowRepo.findAll(filters);
  }

  async getStatusCounts() {
    return this.workflowRepo.getStatusCounts();
  }

  async getAuditHistory(workflowId: string, options?: { limit?: number; offset?: number }) {
    return this.auditService.getWorkflowHistory(workflowId, options);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async transitionStatus(
    workflowId: string,
    from: WorkflowStatus,
    to: WorkflowStatus
  ): Promise<HiringWorkflowRecord> {
    assertValidTransition(from, to);

    const updated = await this.workflowRepo.updateStatus(workflowId, to);

    await this.auditService.log({
      workflowId,
      eventType: AuditEventType.STATUS_CHANGED,
      description: `Status changed: ${from} → ${to}`,
      previousState: { status: from },
      newState: { status: to },
    });

    return updated;
  }

  private generateMissingInfoDraft(
    workflow: HiringWorkflowRecord,
    missingFields: MissingFieldInfo[]
  ): string {
    const fieldList = missingFields
      .map((f, i) => `${i + 1}. ${f.label}`)
      .join('\n');

    const candidateName = workflow.extractedFields?.fullLegalName.value || 'the new hire';

    return `Hi,

Thank you for sending over the details for ${candidateName}. Before I can prepare the employment contract, I need a few more pieces of information:

${fieldList}

Could you please provide these details at your earliest convenience?

Thank you,
[Your Name]`;
  }
}
