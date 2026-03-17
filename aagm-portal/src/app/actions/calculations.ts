"use server";

import prisma from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { periodKeyFromDate } from "@/lib/utils";

export async function runMonthCalculation(monthRunId: string) {
  const monthRun = await prisma.monthRun.findUnique({
    where: { id: monthRunId },
    include: {
      contractVersion: true,
      financialSummary: true,
      collectionsRows: { where: { reviewStatus: { not: "excluded" } } },
      expenseRows: true,
    },
  });
  if (!monthRun) return { error: "Month not found" };

  const contract = monthRun.contractVersion;

  const { runCalculation, determinePeriodPosition } = await import(
    "@/lib/calculations"
  );

  // Parse settlement rules for contract start
  let contractStartMonth = 9;
  let contractStartYear = 2025;
  try {
    const rules = contract.settlementRules
      ? JSON.parse(contract.settlementRules)
      : {};
    contractStartMonth = rules.contractStartMonth ?? 9;
    contractStartYear = rules.contractStartYear ?? 2025;
  } catch {
    // defaults above
  }

  // Determine period position
  const periodPos = determinePeriodPosition(
    monthRun.monthNumber,
    monthRun.yearNumber,
    contractStartMonth,
    contractStartYear,
    contract.periodMonths
  );

  // Get all months in this period from DB
  const periodKeys: string[] = [];
  for (let i = 0; i < periodPos.positionInPeriod; i++) {
    const absMonth =
      (periodPos.periodStartYear - 2000) * 12 +
      (periodPos.periodStartMonth - 1) +
      i;
    const m = (absMonth % 12) + 1;
    const y = Math.floor(absMonth / 12) + 2000;
    periodKeys.push(periodKeyFromDate(m, y));
  }

  const periodMonthRuns = await prisma.monthRun.findMany({
    where: { periodKey: { in: periodKeys } },
    include: {
      financialSummary: true,
      collectionsRows: { where: { reviewStatus: { not: "excluded" } } },
    },
    orderBy: [{ yearNumber: "asc" }, { monthNumber: "asc" }],
  });

  // Compute prior YTD subsidy (before this period)
  // Get all months in this fiscal year before the period start
  let priorYtdSubsidyPaid = 0;
  const allPriorMonths = await prisma.monthRun.findMany({
    where: {
      contractVersionId: contract.id,
      NOT: { periodKey: { in: periodKeys } },
    },
    include: { financialSummary: true },
    orderBy: [{ yearNumber: "asc" }, { monthNumber: "asc" }],
  });

  for (const pm of allPriorMonths) {
    if (
      pm.yearNumber < monthRun.yearNumber ||
      (pm.yearNumber === monthRun.yearNumber &&
        pm.monthNumber < monthRun.monthNumber)
    ) {
      if (pm.financialSummary) {
        priorYtdSubsidyPaid +=
          pm.financialSummary.actualPaymentReceived ??
          pm.financialSummary.expectedPayment;
      }
    }
  }

  // Build MonthlyFinancials[] for the period
  // For the current month, use live collections data. For prior months, use saved summaries.
  const periodMonthsData = periodMonthRuns.map((pmr) => {
    if (pmr.id === monthRunId) {
      // Current month: sum from rows
      const totalPayments = monthRun.collectionsRows.reduce(
        (s, r) => s + r.payments,
        0
      );
      const totalRefunds = monthRun.collectionsRows.reduce(
        (s, r) => s + r.refunds,
        0
      );
      return {
        month: pmr.monthNumber,
        year: pmr.yearNumber,
        payments: totalPayments,
        refunds: totalRefunds,
      };
    } else {
      // Prior month: use stored summary
      const nc = pmr.financialSummary?.collectionsTotal ?? 0;
      return {
        month: pmr.monthNumber,
        year: pmr.yearNumber,
        payments: nc,
        refunds: 0,
      };
    }
  });

  // Compute current month totals for summary
  const collectionsTotal = monthRun.collectionsRows.reduce(
    (s, r) => s + r.netCollections,
    0
  );
  const totalUnits = monthRun.collectionsRows.reduce(
    (s, r) => s + r.units,
    0
  );
  const totalExpenses = monthRun.expenseRows.reduce(
    (s, r) => s + r.amount,
    0
  );

  // Run calculation engine
  const input = {
    contract: {
      invoiceAmount: contract.invoiceAmount,
      requiredMonthlyRevenue: contract.requiredMonthlyRevenue ?? 0,
      quarterTargetRevenue: contract.quarterTargetRevenue ?? 0,
      periodMonths: contract.periodMonths,
      contractStartMonth,
      contractStartYear,
    },
    periodMonths: periodMonthsData,
    priorYtdSubsidyPaid,
  };

  const output = runCalculation(input);

  // Save financial summary
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const summaryData = {
    collectionsTotal: round2(collectionsTotal),
    totalUnits: round2(totalUnits),
    totalExpenses: round2(totalExpenses),
    requiredNetRevenue: contract.requiredMonthlyRevenue ?? 0,
    overage: output.monthDetails[output.monthDetails.length - 1].monthlyOverage,
    invoiceAmount: contract.invoiceAmount,
    expectedPayment: output.subsidyCheckExpected,
    actualPaymentReceived:
      monthRun.financialSummary?.actualPaymentReceived ?? null,
    periodCollectionsTotal: output.periodTotalCollections,
    periodTargetRevenue: output.periodTargetRevenue,
    periodOverage: output.periodOverage,
    ytdSubsidyPaid: output.ytdSubsidyPayment,
    reconciliationDeltaInvoiceVsExpected: round2(
      contract.invoiceAmount - output.subsidyCheckExpected
    ),
    reconciliationDeltaExpectedVsActual:
      monthRun.financialSummary?.actualPaymentReceived != null
        ? round2(
            monthRun.financialSummary.actualPaymentReceived -
              output.subsidyCheckExpected
          )
        : null,
    isDraft: monthRun.status !== "finalized",
    calculationVersion:
      (monthRun.financialSummary?.calculationVersion ?? 0) + 1,
  };

  await prisma.monthFinancialSummary.upsert({
    where: { monthRunId },
    update: summaryData,
    create: { monthRunId, ...summaryData },
  });

  // Update carryforward out
  await prisma.monthRun.update({
    where: { id: monthRunId },
    data: {
      carryforwardOut: output.periodOverage > 0 ? output.periodOverage : 0,
    },
  });

  // Save calculation snapshot
  const snapshotType = monthRun.status === "finalized" ? "final" : "draft";
  const existingSnapshots = await prisma.calculationSnapshot.count({
    where: { monthRunId },
  });

  await prisma.calculationSnapshot.create({
    data: {
      monthRunId,
      snapshotType,
      inputJson: JSON.stringify(input),
      outputJson: JSON.stringify(output),
      version: existingSnapshots + 1,
    },
  });

  await logAuditEvent({
    monthRunId,
    eventType:
      snapshotType === "final" ? "calculation_final" : "calculation_draft",
    description: `Calculation ${snapshotType} v${existingSnapshots + 1}: expected=$${output.subsidyCheckExpected.toFixed(2)}`,
    payload: {
      version: existingSnapshots + 1,
      collectionsTotal: summaryData.collectionsTotal,
      expectedPayment: output.subsidyCheckExpected,
      periodOverage: output.periodOverage,
      isPeriodEnd: output.periodPosition.isPeriodEnd,
    },
  });

  revalidatePath(`/months/${monthRunId}`);
  revalidatePath(`/months/${monthRunId}/reconciliation`);
  return { data: output };
}
