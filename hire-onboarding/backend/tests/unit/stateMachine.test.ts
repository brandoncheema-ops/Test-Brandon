import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  assertValidTransition,
  getValidNextStates,
  isTerminalState,
  requiresHumanAction,
} from '../../src/domain/workflows/stateMachine';
import { WorkflowStatus } from '../../src/shared/types';
import { WorkflowTransitionError } from '../../src/shared/errors';

describe('WorkflowStateMachine', () => {
  describe('isValidTransition', () => {
    it('allows RECEIVED -> CLASSIFIED', () => {
      expect(isValidTransition(WorkflowStatus.RECEIVED, WorkflowStatus.CLASSIFIED)).toBe(true);
    });

    it('allows RECEIVED -> FAILED', () => {
      expect(isValidTransition(WorkflowStatus.RECEIVED, WorkflowStatus.FAILED)).toBe(true);
    });

    it('rejects RECEIVED -> GENERATED', () => {
      expect(isValidTransition(WorkflowStatus.RECEIVED, WorkflowStatus.GENERATED)).toBe(false);
    });

    it('allows CLASSIFIED -> NEEDS_MORE_INFO', () => {
      expect(isValidTransition(WorkflowStatus.CLASSIFIED, WorkflowStatus.NEEDS_MORE_INFO)).toBe(true);
    });

    it('allows CLASSIFIED -> READY_FOR_REVIEW', () => {
      expect(isValidTransition(WorkflowStatus.CLASSIFIED, WorkflowStatus.READY_FOR_REVIEW)).toBe(true);
    });

    it('allows READY_FOR_REVIEW -> READY_TO_GENERATE', () => {
      expect(
        isValidTransition(WorkflowStatus.READY_FOR_REVIEW, WorkflowStatus.READY_TO_GENERATE)
      ).toBe(true);
    });

    it('allows GENERATED -> APPROVED', () => {
      expect(isValidTransition(WorkflowStatus.GENERATED, WorkflowStatus.APPROVED)).toBe(true);
    });

    it('allows GENERATED -> REVISION_REQUESTED', () => {
      expect(isValidTransition(WorkflowStatus.GENERATED, WorkflowStatus.REVISION_REQUESTED)).toBe(true);
    });

    it('allows WAITING_FOR_SIGNATURE -> SIGNED_MARKED', () => {
      expect(
        isValidTransition(WorkflowStatus.WAITING_FOR_SIGNATURE, WorkflowStatus.SIGNED_MARKED)
      ).toBe(true);
    });

    it('allows SIGNED_MARKED -> FILED_TO_SHAREPOINT', () => {
      expect(
        isValidTransition(WorkflowStatus.SIGNED_MARKED, WorkflowStatus.FILED_TO_SHAREPOINT)
      ).toBe(true);
    });

    it('rejects transitions from terminal state FILED_TO_SHAREPOINT', () => {
      expect(
        isValidTransition(WorkflowStatus.FILED_TO_SHAREPOINT, WorkflowStatus.RECEIVED)
      ).toBe(false);
    });

    it('allows FAILED -> RECEIVED (retry)', () => {
      expect(isValidTransition(WorkflowStatus.FAILED, WorkflowStatus.RECEIVED)).toBe(true);
    });
  });

  describe('assertValidTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() =>
        assertValidTransition(WorkflowStatus.RECEIVED, WorkflowStatus.CLASSIFIED)
      ).not.toThrow();
    });

    it('throws WorkflowTransitionError for invalid transition', () => {
      expect(() =>
        assertValidTransition(WorkflowStatus.RECEIVED, WorkflowStatus.FILED_TO_SHAREPOINT)
      ).toThrow(WorkflowTransitionError);
    });
  });

  describe('getValidNextStates', () => {
    it('returns correct next states for RECEIVED', () => {
      const next = getValidNextStates(WorkflowStatus.RECEIVED);
      expect(next).toContain(WorkflowStatus.CLASSIFIED);
      expect(next).toContain(WorkflowStatus.FAILED);
      expect(next).toHaveLength(2);
    });

    it('returns empty array for terminal state', () => {
      const next = getValidNextStates(WorkflowStatus.FILED_TO_SHAREPOINT);
      expect(next).toHaveLength(0);
    });
  });

  describe('isTerminalState', () => {
    it('FILED_TO_SHAREPOINT is terminal', () => {
      expect(isTerminalState(WorkflowStatus.FILED_TO_SHAREPOINT)).toBe(true);
    });

    it('WAITING_FOR_SIGNATURE is not terminal', () => {
      expect(isTerminalState(WorkflowStatus.WAITING_FOR_SIGNATURE)).toBe(false);
    });
  });

  describe('requiresHumanAction', () => {
    it('READY_FOR_REVIEW requires human action', () => {
      expect(requiresHumanAction(WorkflowStatus.READY_FOR_REVIEW)).toBe(true);
    });

    it('WAITING_FOR_SIGNATURE requires human action', () => {
      expect(requiresHumanAction(WorkflowStatus.WAITING_FOR_SIGNATURE)).toBe(true);
    });

    it('RECEIVED does not require human action', () => {
      expect(requiresHumanAction(WorkflowStatus.RECEIVED)).toBe(false);
    });

    it('FILED_TO_SHAREPOINT does not require human action', () => {
      expect(requiresHumanAction(WorkflowStatus.FILED_TO_SHAREPOINT)).toBe(false);
    });
  });
});
