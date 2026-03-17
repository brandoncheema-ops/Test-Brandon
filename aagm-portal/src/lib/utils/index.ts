import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMonthLabel(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function periodKeyFromDate(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-gray-100 text-gray-700";
    case "needs_upload":
      return "bg-amber-50 text-amber-700";
    case "in_review":
      return "bg-blue-50 text-blue-700";
    case "ready_to_finalize":
      return "bg-emerald-50 text-emerald-700";
    case "finalized":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "needs_upload":
      return "Needs Upload";
    case "in_review":
      return "In Review";
    case "ready_to_finalize":
      return "Ready to Finalize";
    case "finalized":
      return "Finalized";
    default:
      return status;
  }
}

/** Get the period start month (1-indexed) for a given month based on contract period length */
export function getPeriodStartMonth(
  month: number,
  year: number,
  contractStartMonth: number,
  periodMonths: number
): { startMonth: number; startYear: number } {
  // Calculate months since contract start
  const contractStartDate = new Date(year, contractStartMonth - 1, 1);
  const currentDate = new Date(year, month - 1, 1);
  const monthsSinceStart =
    (currentDate.getFullYear() - contractStartDate.getFullYear()) * 12 +
    (currentDate.getMonth() - contractStartDate.getMonth());

  const periodIndex = Math.floor(monthsSinceStart / periodMonths);
  const periodStartMonthsSinceStart = periodIndex * periodMonths;

  const startDate = new Date(contractStartDate);
  startDate.setMonth(startDate.getMonth() + periodStartMonthsSinceStart);

  return {
    startMonth: startDate.getMonth() + 1,
    startYear: startDate.getFullYear(),
  };
}
