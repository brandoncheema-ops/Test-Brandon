import { WorkflowStatus } from '../../shared/types';
import { WorkflowTransitionError } from '../../shared/errors';

// =============================================================================
// Workflow State Machine
// Defines valid transitions between workflow statuses.
// =============================================================================

/**
 * Map of valid transitions: from -> allowed targets.
 * Each entry represents a state and the states it can transition to.
 */
const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  [WorkflowStatus.RECEIVED]: [
    WorkflowStatus.CLASSIFIED,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.CLASSIFIED]: [
    WorkflowStatus.NEEDS_MORE_INFO,
    WorkflowStatus.READY_FOR_REVIEW,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.NEEDS_MORE_INFO]: [
    WorkflowStatus.READY_FOR_REVIEW,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.READY_FOR_REVIEW]: [
    WorkflowStatus.READY_TO_GENERATE,
    WorkflowStatus.NEEDS_MORE_INFO,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.READY_TO_GENERATE]: [
    WorkflowStatus.GENERATED,
    WorkflowStatus.READY_FOR_REVIEW, // go back to review
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.GENERATED]: [
    WorkflowStatus.APPROVED,
    WorkflowStatus.REVISION_REQUESTED,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.APPROVED]: [
    WorkflowStatus.WAITING_FOR_SIGNATURE,
    WorkflowStatus.REVISION_REQUESTED,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.REVISION_REQUESTED]: [
    WorkflowStatus.READY_FOR_REVIEW,
    WorkflowStatus.READY_TO_GENERATE,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.WAITING_FOR_SIGNATURE]: [
    WorkflowStatus.SIGNED_MARKED,
    WorkflowStatus.REVISION_REQUESTED,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.SIGNED_MARKED]: [
    WorkflowStatus.FILED_TO_SHAREPOINT,
    WorkflowStatus.FAILED,
  ],
  [WorkflowStatus.FILED_TO_SHAREPOINT]: [],
  [WorkflowStatus.FAILED]: [
    // Allow retry from failed state back to received
    WorkflowStatus.RECEIVED,
  ],
};

/**
 * Validates whether a workflow transition is allowed.
 */
export function isValidTransition(
  from: WorkflowStatus,
  to: WorkflowStatus
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserts that a transition is valid, throws if not.
 */
export function assertValidTransition(
  from: WorkflowStatus,
  to: WorkflowStatus
): void {
  if (!isValidTransition(from, to)) {
    throw new WorkflowTransitionError(from, to);
  }
}

/**
 * Returns the list of valid next states from a given status.
 */
export function getValidNextStates(status: WorkflowStatus): WorkflowStatus[] {
  return VALID_TRANSITIONS[status] || [];
}

/**
 * Returns true if the workflow is in a terminal state.
 */
export function isTerminalState(status: WorkflowStatus): boolean {
  return status === WorkflowStatus.FILED_TO_SHAREPOINT;
}

/**
 * Returns true if the workflow is in a failed state.
 */
export function isFailedState(status: WorkflowStatus): boolean {
  return status === WorkflowStatus.FAILED;
}

/**
 * Returns true if the workflow is awaiting human action.
 */
export function requiresHumanAction(status: WorkflowStatus): boolean {
  return [
    WorkflowStatus.NEEDS_MORE_INFO,
    WorkflowStatus.READY_FOR_REVIEW,
    WorkflowStatus.GENERATED,
    WorkflowStatus.REVISION_REQUESTED,
    WorkflowStatus.WAITING_FOR_SIGNATURE,
    WorkflowStatus.SIGNED_MARKED,
  ].includes(status);
}
