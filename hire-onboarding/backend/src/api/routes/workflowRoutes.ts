import { Router, Request, Response, NextFunction } from 'express';
import { WorkflowManager } from '../../domain/services/workflowManager';
import { AuditService } from '../../domain/services/auditService';
import { requireAuth } from '../middleware/auth';
import {
  updateFieldsSchema,
  revisionRequestSchema,
  markSignedSchema,
  listWorkflowsSchema,
} from '../validators/workflowValidators';
import { triggerImmediatePoll } from '../../jobs/emailPoller';
import { getLogger } from '../../config/logger';

const logger = getLogger('workflow-routes');
const router = Router();

// All workflow routes require authentication
router.use(requireAuth);

const workflowManager = new WorkflowManager();
const auditService = new AuditService();

// Helper to wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// =============================================================================
// Workflow CRUD & Actions
// =============================================================================

/**
 * GET /api/workflows
 * Lists all workflows with optional filtering.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = listWorkflowsSchema.parse(req.query);
    const result = await workflowManager.listWorkflows(filters);
    res.json(result);
  })
);

/**
 * GET /api/workflows/stats
 * Returns workflow status counts for dashboard summary.
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const counts = await workflowManager.getStatusCounts();
    res.json(counts);
  })
);

/**
 * GET /api/workflows/:id
 * Returns a single workflow with full details.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const workflow = await workflowManager.getWorkflow(req.params.id);
    res.json(workflow);
  })
);

/**
 * GET /api/workflows/:id/audit
 * Returns audit history for a workflow.
 */
router.get(
  '/:id/audit',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const result = await workflowManager.getAuditHistory(req.params.id, { limit, offset });
    res.json(result);
  })
);

/**
 * PUT /api/workflows/:id/fields
 * Updates extracted fields (dashboard edit).
 */
router.put(
  '/:id/fields',
  asyncHandler(async (req, res) => {
    const { fields } = updateFieldsSchema.parse(req.body);
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.updateExtractedFields(req.params.id, fields, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/approve-fields
 * Approves extracted fields, moving to READY_TO_GENERATE.
 */
router.post(
  '/:id/approve-fields',
  asyncHandler(async (req, res) => {
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.approveFields(req.params.id, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/generate
 * Generates the contract document.
 */
router.post(
  '/:id/generate',
  asyncHandler(async (req, res) => {
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.generateContract(req.params.id, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/approve-contract
 * Approves the generated contract.
 */
router.post(
  '/:id/approve-contract',
  asyncHandler(async (req, res) => {
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.approveContract(req.params.id, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/request-revision
 * Requests a revision with notes.
 */
router.post(
  '/:id/request-revision',
  asyncHandler(async (req, res) => {
    const { notes } = revisionRequestSchema.parse(req.body);
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.requestRevision(req.params.id, notes, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/back-to-review
 * Sends a revision back to review stage.
 */
router.post(
  '/:id/back-to-review',
  asyncHandler(async (req, res) => {
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.sendBackToReview(req.params.id, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/mark-signed
 * Marks a contract as signed (Phase 1: manual).
 */
router.post(
  '/:id/mark-signed',
  asyncHandler(async (req, res) => {
    const { signedContractPath } = markSignedSchema.parse(req.body);
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.markAsSigned(req.params.id, signedContractPath, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/file-to-sharepoint
 * Files the signed contract to SharePoint.
 */
router.post(
  '/:id/file-to-sharepoint',
  asyncHandler(async (req, res) => {
    const actor = req.session?.username || 'dashboard';
    const workflow = await workflowManager.fileToSharePoint(req.params.id, actor);
    res.json(workflow);
  })
);

/**
 * POST /api/workflows/:id/missing-info-draft
 * Prepares a draft follow-up email for missing information.
 */
router.post(
  '/:id/missing-info-draft',
  asyncHandler(async (req, res) => {
    const draft = await workflowManager.prepareMissingInfoDraft(req.params.id);
    res.json({ draft });
  })
);

/**
 * POST /api/workflows/poll-now
 * Triggers an immediate email poll.
 */
router.post(
  '/poll-now',
  asyncHandler(async (_req, res) => {
    await triggerImmediatePoll();
    res.json({ success: true, message: 'Email poll triggered' });
  })
);

/**
 * GET /api/workflows/recent-activity
 * Returns recent audit log entries across all workflows.
 */
router.get(
  '/recent-activity',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const activity = await auditService.getRecentActivity(limit);
    res.json(activity);
  })
);

export default router;
