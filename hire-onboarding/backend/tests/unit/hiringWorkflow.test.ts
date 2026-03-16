import { describe, it, expect } from 'vitest';
import {
  emptyHiringFields,
  getMissingRequiredFields,
  computeOverallConfidence,
  resolveContractType,
  getLowConfidenceFields,
} from '../../src/domain/models/HiringWorkflow';
import { ContractType, ConfidenceLevel } from '../../src/shared/types';

describe('HiringWorkflow domain logic', () => {
  describe('getMissingRequiredFields', () => {
    it('returns all required fields when empty', () => {
      const fields = emptyHiringFields();
      const missing = getMissingRequiredFields(fields, null);

      expect(missing.length).toBeGreaterThanOrEqual(5);
      expect(missing.map((f) => f.fieldName)).toContain('fullLegalName');
      expect(missing.map((f) => f.fieldName)).toContain('role');
      expect(missing.map((f) => f.fieldName)).toContain('startDate');
      expect(missing.map((f) => f.fieldName)).toContain('salary');
      expect(missing.map((f) => f.fieldName)).toContain('vacation');
    });

    it('returns empty when all required fields are filled', () => {
      const fields = emptyHiringFields();
      fields.fullLegalName = { value: 'John Doe', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.role = { value: 'CRNA', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.startDate = { value: '2026-07-01', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.salary = { value: '$200,000', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.vacation = { value: '4 weeks', confidence: ConfidenceLevel.HIGH, source: 'llm' };

      const missing = getMissingRequiredFields(fields, ContractType.CRNA);
      expect(missing).toHaveLength(0);
    });

    it('includes shareholder status for MD contracts', () => {
      const fields = emptyHiringFields();
      fields.fullLegalName = { value: 'Dr. Smith', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.role = { value: 'Physician', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.startDate = { value: '2026-09-01', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.salary = { value: '$400,000', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.vacation = { value: '5 weeks', confidence: ConfidenceLevel.HIGH, source: 'llm' };

      const missing = getMissingRequiredFields(fields, ContractType.MD_SHAREHOLDER);
      expect(missing.map((f) => f.fieldName)).toContain('shareholderStatus');
    });
  });

  describe('computeOverallConfidence', () => {
    it('returns 0 for empty fields', () => {
      const fields = emptyHiringFields();
      expect(computeOverallConfidence(fields)).toBe(0);
    });

    it('returns 1.0 for all HIGH confidence fields', () => {
      const fields = emptyHiringFields();
      fields.fullLegalName = { value: 'Test', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.role = { value: 'CRNA', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.startDate = { value: '2026-07-01', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.salary = { value: '$200K', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.vacation = { value: '4 weeks', confidence: ConfidenceLevel.HIGH, source: 'llm' };

      expect(computeOverallConfidence(fields)).toBe(1.0);
    });

    it('returns lower confidence for mixed levels', () => {
      const fields = emptyHiringFields();
      fields.fullLegalName = { value: 'Test', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.role = { value: 'CRNA', confidence: ConfidenceLevel.LOW, source: 'llm' };

      const confidence = computeOverallConfidence(fields);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThan(1.0);
    });
  });

  describe('resolveContractType', () => {
    it('returns CRNA for nurse anesthetist role', () => {
      expect(resolveContractType('CRNA', null)).toBe(ContractType.CRNA);
      expect(resolveContractType('Certified Registered Nurse Anesthetist', null)).toBe(ContractType.CRNA);
    });

    it('returns MD_SHAREHOLDER when shareholder status indicates partner', () => {
      expect(resolveContractType('Physician', 'Shareholder track')).toBe(ContractType.MD_SHAREHOLDER);
      expect(resolveContractType('MD', 'partner')).toBe(ContractType.MD_SHAREHOLDER);
      expect(resolveContractType('Doctor', 'yes')).toBe(ContractType.MD_SHAREHOLDER);
    });

    it('returns MD_NON_SHAREHOLDER for physician without shareholder status', () => {
      expect(resolveContractType('Physician', null)).toBe(ContractType.MD_NON_SHAREHOLDER);
      expect(resolveContractType('MD', 'no')).toBe(ContractType.MD_NON_SHAREHOLDER);
    });

    it('returns null for unknown roles', () => {
      expect(resolveContractType('Office Manager', null)).toBeNull();
      expect(resolveContractType(null, null)).toBeNull();
    });
  });

  describe('getLowConfidenceFields', () => {
    it('returns fields below threshold', () => {
      const fields = emptyHiringFields();
      fields.fullLegalName = { value: 'Test', confidence: ConfidenceLevel.HIGH, source: 'llm' };
      fields.salary = { value: '$200K', confidence: ConfidenceLevel.LOW, source: 'llm' };
      fields.startDate = { value: 'August', confidence: ConfidenceLevel.MEDIUM, source: 'llm' };

      const low = getLowConfidenceFields(fields, 0.8);
      expect(low.map((f) => f.fieldName)).toContain('salary');
      expect(low.map((f) => f.fieldName)).toContain('startDate');
      expect(low.map((f) => f.fieldName)).not.toContain('fullLegalName');
    });
  });
});
