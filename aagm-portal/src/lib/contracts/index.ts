import prisma from "@/lib/db";

/**
 * Find the active contract version for a given month/year.
 * Returns the contract whose effective date range contains the month.
 */
export async function getContractVersionForMonth(
  month: number,
  year: number
) {
  const monthDate = new Date(year, month - 1, 15); // mid-month to avoid edge issues

  const contracts = await prisma.contractVersion.findMany({
    where: {
      isActive: true,
      effectiveStartDate: { lte: monthDate },
    },
    orderBy: { effectiveStartDate: "desc" },
  });

  // Find the first contract whose end date is null or >= monthDate
  for (const contract of contracts) {
    if (!contract.effectiveEndDate || contract.effectiveEndDate >= monthDate) {
      return contract;
    }
  }

  return null;
}

/**
 * Get included locations for a contract version.
 */
export function getIncludedLocations(contract: {
  includedLocations: string;
}): string[] {
  try {
    return JSON.parse(contract.includedLocations);
  } catch {
    return [];
  }
}

/**
 * Get settlement rules for a contract version.
 */
export function getSettlementRules(contract: {
  settlementRules: string | null;
}): Record<string, unknown> {
  try {
    return contract.settlementRules
      ? JSON.parse(contract.settlementRules)
      : {};
  } catch {
    return {};
  }
}

/**
 * Get all contract versions, ordered by effective date.
 */
export async function getAllContractVersions() {
  return prisma.contractVersion.findMany({
    orderBy: { effectiveStartDate: "desc" },
  });
}
