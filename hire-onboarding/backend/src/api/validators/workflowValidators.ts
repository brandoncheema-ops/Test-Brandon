import { z } from 'zod';
import { ContractType, WorkflowStatus } from '../../shared/types';

// =============================================================================
// Request Validators (Zod schemas)
// =============================================================================

export const updateFieldsSchema = z.object({
  fields: z.record(z.string().nullable()),
});

export const revisionRequestSchema = z.object({
  notes: z.string().min(1, 'Revision notes are required'),
});

export const markSignedSchema = z.object({
  signedContractPath: z.string().optional(),
});

export const listWorkflowsSchema = z.object({
  status: z.nativeEnum(WorkflowStatus).optional(),
  contractType: z.nativeEnum(ContractType).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
