import prisma from "@/lib/db";

export type AuditEventType =
  | "month_created"
  | "month_status_changed"
  | "upload"
  | "parse_started"
  | "parse_completed"
  | "parse_failed"
  | "review_confirmed"
  | "review_flagged"
  | "calculation_draft"
  | "calculation_final"
  | "override"
  | "finalize"
  | "reopen"
  | "export"
  | "contract_created"
  | "contract_updated"
  | "location_alias_created"
  | "location_alias_updated";

export async function logAuditEvent(params: {
  monthRunId?: string;
  eventType: AuditEventType;
  description?: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.auditEvent.create({
    data: {
      monthRunId: params.monthRunId ?? null,
      eventType: params.eventType,
      eventDescription: params.description,
      eventPayloadJson: params.payload
        ? JSON.stringify(params.payload)
        : null,
    },
  });
}

export async function logOverride(params: {
  monthRunId: string;
  targetTable: string;
  targetRecordId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}) {
  const [override] = await Promise.all([
    prisma.overrideLog.create({
      data: {
        monthRunId: params.monthRunId,
        targetTable: params.targetTable,
        targetRecordId: params.targetRecordId,
        fieldName: params.fieldName,
        oldValueJson: JSON.stringify(params.oldValue),
        newValueJson: JSON.stringify(params.newValue),
        reason: params.reason,
      },
    }),
    logAuditEvent({
      monthRunId: params.monthRunId,
      eventType: "override",
      description: `Override on ${params.targetTable}.${params.fieldName}`,
      payload: {
        targetTable: params.targetTable,
        targetRecordId: params.targetRecordId,
        fieldName: params.fieldName,
        oldValue: params.oldValue,
        newValue: params.newValue,
        reason: params.reason,
      },
    }),
  ]);
  return override;
}
