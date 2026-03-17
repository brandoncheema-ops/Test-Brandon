import { z } from "zod";

export const createMonthSchema = z.object({
  monthNumber: z.number().int().min(1).max(12),
  yearNumber: z.number().int().min(2020).max(2100),
  notes: z.string().optional(),
});

export const updateMonthStatusSchema = z.object({
  monthRunId: z.string().uuid(),
  status: z.enum([
    "pending",
    "needs_upload",
    "in_review",
    "ready_to_finalize",
    "finalized",
  ]),
});

export const overrideFieldSchema = z.object({
  monthRunId: z.string().uuid(),
  targetTable: z.string(),
  targetRecordId: z.string(),
  fieldName: z.string(),
  newValue: z.unknown(),
  reason: z.string().min(1, "Override reason is required"),
});

export const createContractVersionSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  effectiveStartDate: z.string().or(z.date()),
  effectiveEndDate: z.string().or(z.date()).nullable().optional(),
  invoiceAmount: z.number().positive(),
  requiredMonthlyRevenue: z.number().positive().optional(),
  quarterTargetRevenue: z.number().positive().optional(),
  annualFmvExpense: z.number().positive().optional(),
  annualRequiredRevenue: z.number().positive().optional(),
  maxAnnualSubsidy: z.number().positive().optional(),
  includedLocations: z.array(z.string()),
  periodMonths: z.number().int().positive().default(3),
  notes: z.string().optional(),
});

export const locationAliasSchema = z.object({
  sourceValue: z.string().min(1),
  canonicalValue: z.string().min(1),
  contractVersionId: z.string().optional(),
  notes: z.string().optional(),
});

export const uploadFileSchema = z.object({
  monthRunId: z.string().uuid(),
  category: z.enum([
    "collections",
    "monthly_statement",
    "invoice",
    "support_doc",
  ]),
});

export const updateFinancialSummarySchema = z.object({
  monthRunId: z.string().uuid(),
  actualPaymentReceived: z.number().optional(),
});

export type CreateMonthInput = z.infer<typeof createMonthSchema>;
export type UpdateMonthStatusInput = z.infer<typeof updateMonthStatusSchema>;
export type OverrideFieldInput = z.infer<typeof overrideFieldSchema>;
export type CreateContractVersionInput = z.infer<typeof createContractVersionSchema>;
export type LocationAliasInput = z.infer<typeof locationAliasSchema>;
