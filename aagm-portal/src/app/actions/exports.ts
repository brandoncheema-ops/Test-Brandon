"use server";

import prisma from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { formatCurrency } from "@/lib/utils";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { revalidatePath } from "next/cache";

const UPLOAD_BASE = process.env.UPLOAD_DIR || "./uploads";

export async function generateExport(
  monthRunId: string,
  type: "summary" | "invoice" | "csv"
) {
  const monthRun = await prisma.monthRun.findUnique({
    where: { id: monthRunId },
    include: {
      contractVersion: true,
      financialSummary: true,
      collectionsRows: { orderBy: { sourceLocationCanonical: "asc" } },
      expenseRows: { orderBy: { categoryRaw: "asc" } },
    },
  });

  if (!monthRun) return { error: "Month not found" };

  const dir = join(UPLOAD_BASE, "processed", monthRun.periodKey);
  await mkdir(dir, { recursive: true });

  let filename: string;
  let content: string;
  let artifactType: string;

  switch (type) {
    case "summary": {
      filename = `AAGM_Summary_${monthRun.periodKey}.csv`;
      artifactType = "csv_export";
      const summary = monthRun.financialSummary;
      if (!summary) return { error: "No financial summary available" };

      const lines = [
        "AAGM Monthly Summary Report",
        `Month,${monthRun.monthLabel}`,
        `Contract,${monthRun.contractVersion.name}`,
        `Status,${monthRun.status}`,
        "",
        "FINANCIAL SUMMARY",
        `Net Collections,${summary.collectionsTotal}`,
        `Total ASA Units,${summary.totalUnits}`,
        `Required Net Revenue,${summary.requiredNetRevenue}`,
        `Monthly Overage,${summary.overage}`,
        "",
        `Invoice Amount,${summary.invoiceAmount}`,
        `Expected Payment (Subsidy Check),${summary.expectedPayment}`,
        `Actual Payment Received,${summary.actualPaymentReceived ?? "N/A"}`,
        "",
        "PERIOD CONTEXT",
        `Period Collections Total,${summary.periodCollectionsTotal}`,
        `Period Target Revenue,${summary.periodTargetRevenue}`,
        `Period Overage,${summary.periodOverage}`,
        `YTD Subsidy Paid,${summary.ytdSubsidyPaid}`,
        "",
        "RECONCILIATION",
        `Invoice vs Expected Delta,${summary.reconciliationDeltaInvoiceVsExpected}`,
        `Expected vs Actual Delta,${summary.reconciliationDeltaExpectedVsActual ?? "N/A"}`,
        "",
        "COLLECTIONS BY LOCATION",
        "Location,Payments,Refunds,Net Collections,Units",
      ];

      for (const row of monthRun.collectionsRows) {
        lines.push(
          `${row.sourceLocationCanonical},${row.payments},${row.refunds},${row.netCollections},${row.units}`
        );
      }

      if (monthRun.expenseRows.length > 0) {
        lines.push("", "EXPENSES (Reporting Only)", "Category,Amount");
        for (const row of monthRun.expenseRows) {
          lines.push(`${row.categoryRaw},${row.amount}`);
        }
        lines.push(
          `Total Expenses,${monthRun.expenseRows.reduce((s, r) => s + r.amount, 0)}`
        );
      }

      content = lines.join("\n");
      break;
    }

    case "invoice": {
      filename = `AAGM_Invoice_${monthRun.periodKey}.csv`;
      artifactType = "invoice_pdf";

      let templateConfig: Record<string, string> = {};
      try {
        templateConfig = monthRun.contractVersion.invoiceTemplateConfig
          ? JSON.parse(monthRun.contractVersion.invoiceTemplateConfig)
          : {};
      } catch {
        // defaults
      }

      const lines = [
        templateConfig.companyName || "ANESTHESIA ASSOCIATES OF GREATER MIAMI, PA",
        templateConfig.address || "",
        templateConfig.city || "",
        `Phone: ${templateConfig.phone || ""}`,
        `Fax: ${templateConfig.fax || ""}`,
        "",
        templateConfig.hospitalList || "",
        "",
        templateConfig.subsidyNote || "",
        "",
        "Month,Invoice per contract",
        `${monthRun.monthLabel},${formatCurrency(monthRun.contractVersion.invoiceAmount)}`,
        "",
        `Total,${formatCurrency(monthRun.contractVersion.invoiceAmount)}`,
      ];

      content = lines.join("\n");
      break;
    }

    case "csv": {
      filename = `AAGM_Data_${monthRun.periodKey}.csv`;
      artifactType = "csv_export";

      const lines = [
        "type,location,category,payments,refunds,net_collections,units,amount,review_status",
      ];

      for (const row of monthRun.collectionsRows) {
        lines.push(
          `collections,${row.sourceLocationCanonical},,${row.payments},${row.refunds},${row.netCollections},${row.units},,${row.reviewStatus}`
        );
      }

      for (const row of monthRun.expenseRows) {
        lines.push(
          `expense,,${row.categoryRaw},,,,,,${row.amount},${row.reviewStatus}`
        );
      }

      content = lines.join("\n");
      break;
    }

    default:
      return { error: "Unknown export type" };
  }

  const storagePath = join(dir, filename);
  await writeFile(storagePath, content, "utf-8");

  await prisma.exportArtifact.create({
    data: {
      monthRunId,
      artifactType,
      filename,
      storagePath,
      fileSizeBytes: Buffer.byteLength(content),
    },
  });

  await logAuditEvent({
    monthRunId,
    eventType: "export",
    description: `Export generated: ${filename}`,
    payload: { type, filename },
  });

  revalidatePath(`/months/${monthRunId}/exports`);

  // Return a download URL (served via API route)
  return { downloadUrl: `/api/exports/${monthRunId}/${filename}` };
}
