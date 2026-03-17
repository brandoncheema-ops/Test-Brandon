"use server";

import prisma from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function confirmAllRows(monthRunId: string) {
  const [collectionsResult, expensesResult] = await Promise.all([
    prisma.collectionsImportRow.updateMany({
      where: { monthRunId, reviewStatus: "pending" },
      data: { reviewStatus: "confirmed" },
    }),
    prisma.expenseImportRow.updateMany({
      where: { monthRunId, reviewStatus: "pending" },
      data: { reviewStatus: "confirmed" },
    }),
  ]);

  const totalConfirmed = collectionsResult.count + expensesResult.count;

  await logAuditEvent({
    monthRunId,
    eventType: "review_confirmed",
    description: `Bulk confirmed ${totalConfirmed} rows (${collectionsResult.count} collections, ${expensesResult.count} expenses)`,
    payload: {
      collectionsConfirmed: collectionsResult.count,
      expensesConfirmed: expensesResult.count,
    },
  });

  revalidatePath(`/months/${monthRunId}`);
  revalidatePath(`/months/${monthRunId}/review`);
  return { success: true, totalConfirmed };
}

export async function updateRowStatus(
  type: "collections" | "expenses",
  rowId: string,
  status: string
) {
  if (!["pending", "confirmed", "flagged", "excluded"].includes(status)) {
    return { error: "Invalid status" };
  }

  let monthRunId: string;

  if (type === "collections") {
    const row = await prisma.collectionsImportRow.findUnique({
      where: { id: rowId },
      select: { id: true, reviewStatus: true, monthRunId: true },
    });
    if (!row) return { error: "Row not found" };
    monthRunId = row.monthRunId;

    await prisma.collectionsImportRow.update({
      where: { id: rowId },
      data: { reviewStatus: status },
    });

    await logAuditEvent({
      monthRunId,
      eventType: status === "flagged" ? "review_flagged" : "review_confirmed",
      description: `Collections row ${rowId}: ${row.reviewStatus} → ${status}`,
      payload: { type, rowId, oldStatus: row.reviewStatus, newStatus: status },
    });
  } else {
    const row = await prisma.expenseImportRow.findUnique({
      where: { id: rowId },
      select: { id: true, reviewStatus: true, monthRunId: true },
    });
    if (!row) return { error: "Row not found" };
    monthRunId = row.monthRunId;

    await prisma.expenseImportRow.update({
      where: { id: rowId },
      data: { reviewStatus: status },
    });

    await logAuditEvent({
      monthRunId,
      eventType: status === "flagged" ? "review_flagged" : "review_confirmed",
      description: `Expense row ${rowId}: ${row.reviewStatus} → ${status}`,
      payload: { type, rowId, oldStatus: row.reviewStatus, newStatus: status },
    });
  }

  revalidatePath(`/months/${monthRunId}`);
  revalidatePath(`/months/${monthRunId}/review`);
  return { success: true };
}
