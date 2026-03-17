import type {
  CalculationInput,
  CalculationOutput,
  ContractTerms,
  MonthDetail,
  MonthlyFinancials,
  PeriodPosition,
} from './types';

// Re-export types so consumers can import from engine directly if desired.
export type {
  CalculationInput,
  CalculationOutput,
  ContractTerms,
  MonthDetail,
  MonthlyFinancials,
  PeriodPosition,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a (month, year) pair to an absolute month index for easy arithmetic.
 * January 2000 = 0, February 2000 = 1, etc.
 */
function toAbsoluteMonth(month: number, year: number): number {
  return (year - 2000) * 12 + (month - 1);
}

/**
 * Convert an absolute month index back to (month, year).
 */
function fromAbsoluteMonth(abs: number): { month: number; year: number } {
  const year = Math.floor(abs / 12) + 2000;
  const month = (abs % 12) + 1;
  return { month, year };
}

/**
 * Round a number to 2 decimal places using banker-friendly rounding.
 * This avoids floating-point drift in monetary calculations.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Period position
// ---------------------------------------------------------------------------

/**
 * Determine where a given month falls within its settlement period.
 *
 * Settlement periods are fixed-length windows (e.g. 3 months) that start
 * from the contract start month and repeat indefinitely. For a contract
 * starting in September with periodMonths=3, the periods are:
 *   Sep-Nov, Dec-Feb, Mar-May, Jun-Aug, Sep-Nov, ...
 *
 * @param month           - Calendar month (1-12)
 * @param year            - Calendar year
 * @param contractStartMonth - The month (1-12) the contract period cycle begins
 * @param periodMonths    - Length of each settlement period in months
 * @returns Position information for the given month within its period
 *
 * @example
 * // November 2025 in a contract starting Sep 2025 with 3-month periods
 * determinePeriodPosition(11, 2025, 9, 3)
 * // => { positionInPeriod: 3, isPeriodEnd: true, periodStartMonth: 9, periodStartYear: 2025 }
 */
export function determinePeriodPosition(
  month: number,
  year: number,
  contractStartMonth: number,
  contractStartYear: number,
  periodMonths: number,
): PeriodPosition {
  const targetAbs = toAbsoluteMonth(month, year);
  const startAbs = toAbsoluteMonth(contractStartMonth, contractStartYear);

  // How many months since the contract start
  const monthsElapsed = targetAbs - startAbs;

  if (monthsElapsed < 0) {
    throw new Error(
      `Month ${month}/${year} is before the contract start ${contractStartMonth}/${contractStartYear}`,
    );
  }

  // Which period are we in (0-indexed), and where within it (0-indexed)
  const positionZeroBased = monthsElapsed % periodMonths;
  const periodIndex = Math.floor(monthsElapsed / periodMonths);

  // Derive the period start month/year
  const periodStartAbs = startAbs + periodIndex * periodMonths;
  const { month: periodStartMonth, year: periodStartYear } =
    fromAbsoluteMonth(periodStartAbs);

  const positionInPeriod = positionZeroBased + 1; // 1-based
  const isPeriodEnd = positionInPeriod === periodMonths;

  return {
    positionInPeriod,
    isPeriodEnd,
    periodStartMonth,
    periodStartYear,
  };
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Run the AAGM subsidy / income-guarantee calculation for a settlement period.
 *
 * ## Settlement logic
 *
 * The contract guarantees a minimum monthly revenue (`requiredMonthlyRevenue`).
 * When collections fall short, AAGM receives a subsidy check up to
 * `invoiceAmount`. The settlement works as follows:
 *
 * 1. **Non-period-end months** (e.g. months 1 and 2 of a quarterly period):
 *    The full `invoiceAmount` is paid as the subsidy check, regardless of
 *    whether collections exceeded the monthly target. Overage tracking is
 *    informational only at this stage.
 *
 * 2. **Period-end month** (e.g. month 3 of a quarterly period):
 *    A settlement occurs. Total collections across all months in the period
 *    are compared against the aggregate period target (`quarterTargetRevenue`).
 *    - If total collections <= period target: full `invoiceAmount` is paid.
 *    - If total collections > period target: the period overage is deducted
 *      from the final month's subsidy check.
 *      `subsidyCheck = max(0, invoiceAmount - periodOverage)`
 *    This ensures that strong collection months offset the subsidy, but
 *    the provider never owes money back (floor of $0).
 *
 * 3. **YTD tracking**: Cumulative subsidy paid is tracked across the fiscal
 *    year by summing `priorYtdSubsidyPaid` with all subsidy checks in the
 *    current period.
 *
 * All computations are pure and deterministic -- no database access, no
 * side effects. Monetary values are rounded to 2 decimal places.
 *
 * @param input - Contract terms, monthly financials, and prior YTD subsidy
 * @returns Full calculation output with per-month details and period totals
 *
 * @example
 * ```ts
 * const result = runCalculation({
 *   contract: {
 *     invoiceAmount: 941666.67,
 *     requiredMonthlyRevenue: 1837500,
 *     quarterTargetRevenue: 5512500,
 *     periodMonths: 3,
 *     contractStartMonth: 9,
 *     contractStartYear: 2025,
 *   },
 *   periodMonths: [
 *     { month: 9,  year: 2025, payments: 2041207.86, refunds: 0 },
 *     { month: 10, year: 2025, payments: 2119642.59, refunds: 0 },
 *     { month: 11, year: 2025, payments: 2158293.12, refunds: 0 },
 *   ],
 *   priorYtdSubsidyPaid: 0,
 * });
 * // result.subsidyCheckExpected === 135023.10
 * // result.periodOverage === 806643.57
 * ```
 */
export function runCalculation(input: CalculationInput): CalculationOutput {
  const { contract, periodMonths: monthsData, priorYtdSubsidyPaid } = input;

  if (monthsData.length === 0) {
    throw new Error('periodMonths must contain at least one month of data');
  }

  if (monthsData.length > contract.periodMonths) {
    throw new Error(
      `periodMonths contains ${monthsData.length} entries but the contract period is only ${contract.periodMonths} months`,
    );
  }

  // The target month is the last entry in the supplied data.
  const targetMonth = monthsData[monthsData.length - 1];

  // Determine period position of the target month.
  const periodPosition = determinePeriodPosition(
    targetMonth.month,
    targetMonth.year,
    contract.contractStartMonth,
    contract.contractStartYear,
    contract.periodMonths,
  );

  // Validate that the supplied months count matches the position.
  if (monthsData.length !== periodPosition.positionInPeriod) {
    throw new Error(
      `Expected ${periodPosition.positionInPeriod} months of data for position ` +
        `${periodPosition.positionInPeriod} in period, but received ${monthsData.length}`,
    );
  }

  // --- Compute per-month details ---

  let periodTotalCollections = 0;
  const monthDetails: MonthDetail[] = [];

  for (const md of monthsData) {
    const netCollections = round2(md.payments - md.refunds);
    const monthlyOverage = round2(netCollections - contract.requiredMonthlyRevenue);
    periodTotalCollections = round2(periodTotalCollections + netCollections);

    monthDetails.push({
      month: md.month,
      year: md.year,
      netCollections,
      monthlyOverage,
      // Will be set below after we know the period overage
      subsidyCheckExpected: 0,
    });
  }

  // --- Period-level aggregates ---

  const periodTargetRevenue = contract.quarterTargetRevenue;
  const periodOverage = round2(periodTotalCollections - periodTargetRevenue);
  const totalMonthlyOverage = round2(
    monthDetails.reduce((sum, d) => sum + d.monthlyOverage, 0),
  );

  // --- Assign subsidy checks ---

  for (let i = 0; i < monthDetails.length; i++) {
    const isLast = i === monthDetails.length - 1;
    const isThisPeriodEnd = isLast && periodPosition.isPeriodEnd;

    if (isThisPeriodEnd) {
      // Settlement month: deduct period overage from invoice amount.
      // If overage is negative (under-collected), full invoice is paid.
      monthDetails[i].subsidyCheckExpected = round2(
        Math.max(0, contract.invoiceAmount - Math.max(0, periodOverage)),
      );
    } else {
      // Non-period-end months always receive the full invoice amount.
      monthDetails[i].subsidyCheckExpected = contract.invoiceAmount;
    }
  }

  // --- YTD subsidy ---

  const periodSubsidyTotal = round2(
    monthDetails.reduce((sum, d) => sum + d.subsidyCheckExpected, 0),
  );
  const ytdSubsidyPayment = round2(priorYtdSubsidyPaid + periodSubsidyTotal);

  // The subsidy check for the target month specifically.
  const subsidyCheckExpected =
    monthDetails[monthDetails.length - 1].subsidyCheckExpected;

  return {
    periodPosition,
    monthDetails,
    periodTotalCollections,
    periodTargetRevenue,
    periodOverage,
    subsidyCheckExpected,
    ytdSubsidyPayment,
    totalMonthlyOverage,
    maxMonthlySubsidy: contract.invoiceAmount,
  };
}
