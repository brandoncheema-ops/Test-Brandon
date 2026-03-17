"use server";

import prisma from "@/lib/db";
import { getContractVersionForMonth } from "@/lib/contracts";
import { logAuditEvent } from "@/lib/audit";
import { formatMonthLabel, periodKeyFromDate } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export async function getMonthRuns() {
  return prisma.monthRun.findMany({
    include: {
      contractVersion: true,
      financialSummary: true,
      uploadFiles: { select: { id: true, category: true, parseStatus: true } },
    },
    orderBy: [{ yearNumber: "desc" }, { monthNumber: "desc" }],
  });
}

export async function getMonthRun(id: string) {
  return prisma.monthRun.findUnique({
    where: { id },
    include: {
      contractVersion: true,
      financialSummary: true,
      uploadFiles: true,
      collectionsRows: { orderBy: { sourceLocationCanonical: "asc" } },
      expenseRows: { orderBy: { categoryRaw: "asc" } },
      overrideLogs: { orderBy: { createdAt: "desc" } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      calculationSnapshots: { orderBy: { createdAt: "desc" } },
      exportArtifacts: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createMonthRun(monthNumber: number, yearNumber: number, notes?: string) {
  const periodKey = periodKeyFromDate(monthNumber, yearNumber);

  // Check if already exists
  const existing = await prisma.monthRun.findUnique({
    where: { periodKey },
  });
  if (existing) {
    return { error: `Month ${periodKey} already exists.` };
  }

  // Find contract version
  const contract = await getContractVersionForMonth(monthNumber, yearNumber);
  if (!contract) {
    return { error: `No active contract version found for ${formatMonthLabel(monthNumber, yearNumber)}` };
  }

  // Determine carryforward from prior month
  const priorMonth = monthNumber === 1 ? 12 : monthNumber - 1;
  const priorYear = monthNumber === 1 ? yearNumber - 1 : yearNumber;
  const priorRun = await prisma.monthRun.findFirst({
    where: { monthNumber: priorMonth, yearNumber: priorYear },
    include: { financialSummary: true },
  });
  const carryforwardIn = priorRun?.carryforwardOut ?? 0;

  const monthRun = await prisma.monthRun.create({
    data: {
      monthNumber,
      yearNumber,
      monthLabel: formatMonthLabel(monthNumber, yearNumber),
      periodKey,
      status: "pending",
      contractVersionId: contract.id,
      carryforwardIn,
      notes: notes || null,
    },
  });

  await logAuditEvent({
    monthRunId: monthRun.id,
    eventType: "month_created",
    description: `Month ${monthRun.monthLabel} created with contract ${contract.code}`,
    payload: { contractVersionId: contract.id, carryforwardIn },
  });

  revalidatePath("/dashboard");
  return { data: monthRun };
}

export async function updateMonthStatus(
  monthRunId: string,
  status: string
) {
  const monthRun = await prisma.monthRun.findUnique({
    where: { id: monthRunId },
  });
  if (!monthRun) return { error: "Month not found" };

  const oldStatus = monthRun.status;

  const updateData: Record<string, unknown> = { status };
  if (status === "finalized") {
    updateData.finalizedAt = new Date();
  }

  const updated = await prisma.monthRun.update({
    where: { id: monthRunId },
    data: updateData,
  });

  await logAuditEvent({
    monthRunId,
    eventType: status === "finalized" ? "finalize" : "month_status_changed",
    description: `Status changed: ${oldStatus} → ${status}`,
    payload: { oldStatus, newStatus: status },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/months/${monthRunId}`);
  return { data: updated };
}

export async function reopenMonth(monthRunId: string) {
  const monthRun = await prisma.monthRun.findUnique({
    where: { id: monthRunId },
  });
  if (!monthRun) return { error: "Month not found" };
  if (monthRun.status !== "finalized")
    return { error: "Only finalized months can be reopened" };

  const updated = await prisma.monthRun.update({
    where: { id: monthRunId },
    data: { status: "in_review", finalizedAt: null },
  });

  await logAuditEvent({
    monthRunId,
    eventType: "reopen",
    description: `Month ${monthRun.monthLabel} reopened from finalized state`,
    payload: { previousFinalizedAt: monthRun.finalizedAt },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/months/${monthRunId}`);
  return { data: updated };
}

export async function updateMonthNotes(monthRunId: string, notes: string) {
  await prisma.monthRun.update({
    where: { id: monthRunId },
    data: { notes },
  });
  revalidatePath(`/months/${monthRunId}`);
}

export async function updateActualPayment(
  monthRunId: string,
  amount: number
) {
  const summary = await prisma.monthFinancialSummary.findUnique({
    where: { monthRunId },
  });
  if (!summary) return { error: "No financial summary found" };

  const reconciliationDeltaExpectedVsActual = amount - summary.expectedPayment;

  await prisma.monthFinancialSummary.update({
    where: { monthRunId },
    data: {
      actualPaymentReceived: amount,
      reconciliationDeltaExpectedVsActual,
    },
  });

  await logAuditEvent({
    monthRunId,
    eventType: "override",
    description: `Actual payment received updated to $${amount.toFixed(2)}`,
    payload: {
      previousValue: summary.actualPaymentReceived,
      newValue: amount,
      delta: reconciliationDeltaExpectedVsActual,
    },
  });

  revalidatePath(`/months/${monthRunId}`);
  revalidatePath(`/months/${monthRunId}/reconciliation`);
  return { success: true };
}

export async function getAdjacentMonths(monthRunId: string) {
  const month = await prisma.monthRun.findUnique({
    where: { id: monthRunId },
  });
  if (!month) return null;

  const prevMonth = month.monthNumber === 1 ? 12 : month.monthNumber - 1;
  const prevYear =
    month.monthNumber === 1 ? month.yearNumber - 1 : month.yearNumber;
  const nextMonth = month.monthNumber === 12 ? 1 : month.monthNumber + 1;
  const nextYear =
    month.monthNumber === 12 ? month.yearNumber + 1 : month.yearNumber;

  const [prev, next] = await Promise.all([
    prisma.monthRun.findFirst({
      where: { monthNumber: prevMonth, yearNumber: prevYear },
      include: { financialSummary: true },
    }),
    prisma.monthRun.findFirst({
      where: { monthNumber: nextMonth, yearNumber: nextYear },
      include: { financialSummary: true },
    }),
  ]);

  return { previous: prev, next };
}

export async function getPeriodMonths(monthRunId: string) {
  const month = await prisma.monthRun.findUnique({
    where: { id: monthRunId },
    include: { contractVersion: true },
  });
  if (!month) return [];

  // Get all months that share the same contract and fall in the same period
  const contractStart = month.contractVersion.effectiveStartDate;
  const periodMonths = month.contractVersion.periodMonths;
  const startMonth = contractStart.getMonth() + 1;
  const startYear = contractStart.getFullYear();

  // Calculate which period this month belongs to
  const totalMonthsSinceStart =
    (month.yearNumber - startYear) * 12 +
    (month.monthNumber - startMonth);
  const periodIndex = Math.floor(totalMonthsSinceStart / periodMonths);
  const periodStartOffset = periodIndex * periodMonths;

  // Get months in this period
  const periodKeys: string[] = [];
  for (let i = 0; i < periodMonths; i++) {
    const offsetMonths = periodStartOffset + i;
    const m = ((startMonth - 1 + offsetMonths) % 12) + 1;
    const y = startYear + Math.floor((startMonth - 1 + offsetMonths) / 12);
    periodKeys.push(periodKeyFromDate(m, y));
  }

  return prisma.monthRun.findMany({
    where: { periodKey: { in: periodKeys } },
    include: { financialSummary: true },
    orderBy: [{ yearNumber: "asc" }, { monthNumber: "asc" }],
  });
}
