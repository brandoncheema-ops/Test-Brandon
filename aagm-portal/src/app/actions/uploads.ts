"use server";

import prisma from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

const UPLOAD_BASE = process.env.UPLOAD_DIR || "./uploads";

export async function uploadFile(formData: FormData) {
  const monthRunId = formData.get("monthRunId") as string;
  const category = formData.get("category") as string;
  const file = formData.get("file") as File;

  if (!monthRunId || !category || !file) {
    return { error: "Missing required fields" };
  }

  const monthRun = await prisma.monthRun.findUnique({
    where: { id: monthRunId },
  });
  if (!monthRun) return { error: "Month not found" };
  if (monthRun.status === "finalized")
    return { error: "Cannot upload to a finalized month" };

  // Read file buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Compute hash
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  // Store file
  const dir = join(UPLOAD_BASE, "raw", monthRun.periodKey);
  await mkdir(dir, { recursive: true });
  const safeFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storagePath = join(dir, safeFilename);
  await writeFile(storagePath, buffer);

  const uploadFile = await prisma.uploadFile.create({
    data: {
      monthRunId,
      category,
      originalFilename: file.name,
      mimeType: file.type || null,
      storagePath,
      fileHash,
      fileSizeBytes: buffer.length,
      parseStatus: "pending",
    },
  });

  // Auto-transition status if still pending
  if (monthRun.status === "pending" || monthRun.status === "needs_upload") {
    await prisma.monthRun.update({
      where: { id: monthRunId },
      data: { status: "needs_upload" },
    });
  }

  await logAuditEvent({
    monthRunId,
    eventType: "upload",
    description: `File uploaded: ${file.name} (${category})`,
    payload: {
      uploadFileId: uploadFile.id,
      category,
      filename: file.name,
      size: buffer.length,
      hash: fileHash,
    },
  });

  revalidatePath(`/months/${monthRunId}`);
  return { data: uploadFile };
}

export async function parseUploadedFile(uploadFileId: string) {
  const upload = await prisma.uploadFile.findUnique({
    where: { id: uploadFileId },
    include: { monthRun: { include: { contractVersion: true } } },
  });
  if (!upload) return { error: "Upload not found" };

  const monthRunId = upload.monthRunId;

  await logAuditEvent({
    monthRunId,
    eventType: "parse_started",
    description: `Parsing file: ${upload.originalFilename}`,
    payload: { uploadFileId },
  });

  try {
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(upload.storagePath);

    // Dynamic import to avoid issues with SSR
    const { parseFile } = await import("@/lib/imports/parser");
    const { mapLocation } = await import("@/lib/imports/location-mapper");

    const result = await parseFile(buffer, upload.originalFilename);

    // Get location aliases for this contract
    const aliases = await prisma.locationAlias.findMany({
      where: {
        OR: [
          { contractVersionId: upload.monthRun.contractVersionId },
          { contractVersionId: null },
        ],
        isActive: true,
      },
    });

    const aliasMap = aliases.map((a) => ({
      sourceValue: a.sourceValue,
      canonicalValue: a.canonicalValue,
    }));

    // Save collections rows
    if (result.collections.length > 0) {
      // Delete prior rows from this upload
      await prisma.collectionsImportRow.deleteMany({
        where: { uploadFileId },
      });

      await prisma.collectionsImportRow.createMany({
        data: result.collections.map((row) => ({
          monthRunId,
          uploadFileId,
          sourceMonthLabel: row.sourceMonthLabel || null,
          sourceLocationRaw: row.sourceLocationRaw,
          sourceLocationCanonical:
            mapLocation(row.sourceLocationRaw, aliasMap) || row.sourceLocationRaw,
          payments: row.payments,
          refunds: row.refunds,
          units: row.units,
          netCollections: row.netCollections,
          reviewStatus: "pending",
        })),
      });
    }

    // Save expense rows
    if (result.expenses.length > 0) {
      await prisma.expenseImportRow.deleteMany({
        where: { uploadFileId },
      });

      await prisma.expenseImportRow.createMany({
        data: result.expenses.map((row) => ({
          monthRunId,
          uploadFileId,
          categoryRaw: row.categoryRaw,
          categoryCanonical: row.categoryRaw, // 1:1 for now
          amount: row.amount,
          reviewStatus: "pending",
        })),
      });
    }

    // Update upload status
    await prisma.uploadFile.update({
      where: { id: uploadFileId },
      data: {
        parseStatus: result.errors.length > 0 ? "failed" : "parsed",
        parseNotes: [
          ...result.warnings.map((w) => `WARN: ${w}`),
          ...result.errors.map((e) => `ERROR: ${e}`),
          `Parsed ${result.collections.length} collection rows, ${result.expenses.length} expense rows`,
        ].join("\n"),
      },
    });

    // Transition month to in_review if we parsed data
    if (result.collections.length > 0 || result.expenses.length > 0) {
      await prisma.monthRun.update({
        where: { id: monthRunId },
        data: { status: "in_review" },
      });
    }

    await logAuditEvent({
      monthRunId,
      eventType: "parse_completed",
      description: `Parsed ${result.collections.length} collections, ${result.expenses.length} expenses`,
      payload: {
        uploadFileId,
        collectionsCount: result.collections.length,
        expensesCount: result.expenses.length,
        warnings: result.warnings,
        errors: result.errors,
      },
    });

    revalidatePath(`/months/${monthRunId}`);
    revalidatePath(`/months/${monthRunId}/review`);
    return {
      data: {
        collections: result.collections.length,
        expenses: result.expenses.length,
        warnings: result.warnings,
        errors: result.errors,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parse error";

    await prisma.uploadFile.update({
      where: { id: uploadFileId },
      data: { parseStatus: "failed", parseNotes: message },
    });

    await logAuditEvent({
      monthRunId,
      eventType: "parse_failed",
      description: `Parse failed: ${message}`,
      payload: { uploadFileId, error: message },
    });

    return { error: message };
  }
}

export async function getUploadFiles(monthRunId: string) {
  return prisma.uploadFile.findMany({
    where: { monthRunId },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function deleteUploadFile(uploadFileId: string) {
  const upload = await prisma.uploadFile.findUnique({
    where: { id: uploadFileId },
    include: { monthRun: true },
  });
  if (!upload) return { error: "Upload not found" };
  if (upload.monthRun.status === "finalized")
    return { error: "Cannot delete from finalized month" };

  // Delete associated import rows
  await prisma.collectionsImportRow.deleteMany({
    where: { uploadFileId },
  });
  await prisma.expenseImportRow.deleteMany({
    where: { uploadFileId },
  });

  // Delete upload record (keep file on disk for audit)
  await prisma.uploadFile.delete({ where: { id: uploadFileId } });

  await logAuditEvent({
    monthRunId: upload.monthRunId,
    eventType: "upload",
    description: `File deleted: ${upload.originalFilename} (record removed, file preserved on disk)`,
    payload: { uploadFileId, filename: upload.originalFilename },
  });

  revalidatePath(`/months/${upload.monthRunId}`);
  return { success: true };
}
