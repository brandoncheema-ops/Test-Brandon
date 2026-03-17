"use server";

import prisma from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getContractVersions() {
  return prisma.contractVersion.findMany({
    orderBy: { effectiveStartDate: "desc" },
    include: {
      _count: { select: { monthRuns: true, locationAliases: true } },
    },
  });
}

export async function getContractVersion(id: string) {
  return prisma.contractVersion.findUnique({
    where: { id },
    include: {
      locationAliases: { orderBy: { sourceValue: "asc" } },
      monthRuns: {
        orderBy: [{ yearNumber: "desc" }, { monthNumber: "desc" }],
        include: { financialSummary: true },
      },
    },
  });
}

export async function createContractVersion(data: {
  name: string;
  code: string;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  invoiceAmount: number;
  requiredMonthlyRevenue?: number;
  quarterTargetRevenue?: number;
  annualFmvExpense?: number;
  annualRequiredRevenue?: number;
  maxAnnualSubsidy?: number;
  includedLocations: string[];
  periodMonths?: number;
  notes?: string;
}) {
  const contract = await prisma.contractVersion.create({
    data: {
      name: data.name,
      code: data.code,
      effectiveStartDate: new Date(data.effectiveStartDate),
      effectiveEndDate: data.effectiveEndDate
        ? new Date(data.effectiveEndDate)
        : null,
      invoiceAmount: data.invoiceAmount,
      requiredMonthlyRevenue: data.requiredMonthlyRevenue ?? null,
      quarterTargetRevenue: data.quarterTargetRevenue ?? null,
      annualFmvExpense: data.annualFmvExpense ?? null,
      annualRequiredRevenue: data.annualRequiredRevenue ?? null,
      maxAnnualSubsidy: data.maxAnnualSubsidy ?? null,
      includedLocations: JSON.stringify(data.includedLocations),
      periodMonths: data.periodMonths ?? 3,
      notes: data.notes ?? null,
      isActive: true,
    },
  });

  await logAuditEvent({
    eventType: "contract_created",
    description: `Contract created: ${contract.name} (${contract.code})`,
    payload: { contractId: contract.id },
  });

  revalidatePath("/settings/contracts");
  return { data: contract };
}

export async function getLocationAliases(contractVersionId?: string) {
  return prisma.locationAlias.findMany({
    where: contractVersionId ? { contractVersionId } : undefined,
    orderBy: { canonicalValue: "asc" },
  });
}

export async function createLocationAlias(data: {
  sourceValue: string;
  canonicalValue: string;
  contractVersionId?: string;
  notes?: string;
}) {
  const alias = await prisma.locationAlias.create({
    data: {
      sourceValue: data.sourceValue,
      canonicalValue: data.canonicalValue,
      contractVersionId: data.contractVersionId ?? null,
      notes: data.notes ?? null,
      isActive: true,
    },
  });

  await logAuditEvent({
    eventType: "location_alias_created",
    description: `Alias created: "${data.sourceValue}" → "${data.canonicalValue}"`,
    payload: { aliasId: alias.id },
  });

  revalidatePath("/settings/contracts");
  return { data: alias };
}
