/**
 * Types for the AAGM subsidy/income guarantee calculation engine.
 *
 * These types model the contract terms, monthly financial data,
 * and the full set of computed outputs for subsidy determination.
 */

// ---------------------------------------------------------------------------
// Contract configuration
// ---------------------------------------------------------------------------

/** Defines the financial terms of an income-guarantee contract. */
export interface ContractTerms {
  /** Monthly invoice amount (max subsidy per month), e.g. 941666.67 */
  invoiceAmount: number;

  /** Required monthly revenue target, e.g. 1837500 */
  requiredMonthlyRevenue: number;

  /** Aggregate revenue target for a full period, e.g. 5512500 */
  quarterTargetRevenue: number;

  /** Number of months in a settlement period, e.g. 3 */
  periodMonths: number;

  /** Month (1-12) in which the contract period cycle starts, e.g. 9 for September */
  contractStartMonth: number;

  /** Year the contract period cycle starts, e.g. 2025 */
  contractStartYear: number;
}

// ---------------------------------------------------------------------------
// Monthly financial data
// ---------------------------------------------------------------------------

/** Raw financial figures for a single month. */
export interface MonthlyFinancials {
  /** Calendar month (1-12) */
  month: number;

  /** Calendar year (e.g. 2025) */
  year: number;

  /** Total payments collected across all locations */
  payments: number;

  /** Total refunds issued across all locations */
  refunds: number;
}

// ---------------------------------------------------------------------------
// Calculation inputs
// ---------------------------------------------------------------------------

/** Everything needed to compute subsidy values for a target month. */
export interface CalculationInput {
  /** The contract terms in effect */
  contract: ContractTerms;

  /**
   * Financial data for every month in the current settlement period,
   * up to and including the target month.
   * Must be sorted chronologically.
   */
  periodMonths: MonthlyFinancials[];

  /**
   * Cumulative subsidy already paid in prior months of the current
   * fiscal year (before the current settlement period).
   * For example, if computing Nov in the Sep/Oct/Nov period and
   * Sep + Oct subsidies have already been paid, pass that total here.
   */
  priorYtdSubsidyPaid: number;
}

// ---------------------------------------------------------------------------
// Period position
// ---------------------------------------------------------------------------

/** Describes where a month sits within its settlement period. */
export interface PeriodPosition {
  /** 1-based position within the period (e.g. 1, 2, or 3 for a quarterly period) */
  positionInPeriod: number;

  /** True when this month is the last month of the period */
  isPeriodEnd: boolean;

  /** The calendar month (1-12) the period started */
  periodStartMonth: number;

  /** The calendar year the period started */
  periodStartYear: number;
}

// ---------------------------------------------------------------------------
// Calculation outputs
// ---------------------------------------------------------------------------

/** Per-month detail within the period. */
export interface MonthDetail {
  /** Calendar month (1-12) */
  month: number;

  /** Calendar year */
  year: number;

  /** payments - refunds */
  netCollections: number;

  /** netCollections - requiredMonthlyRevenue */
  monthlyOverage: number;

  /**
   * The subsidy check expected for this month.
   * - For non-period-end months: invoiceAmount
   * - For the period-end month: max(0, invoiceAmount - periodOverage)
   */
  subsidyCheckExpected: number;
}

/** Full output of the calculation engine. */
export interface CalculationOutput {
  /** Position of the target month within its settlement period */
  periodPosition: PeriodPosition;

  /** Detailed breakdown for each month in the period */
  monthDetails: MonthDetail[];

  /** Sum of netCollections for all months in the period so far */
  periodTotalCollections: number;

  /** The period revenue target from the contract */
  periodTargetRevenue: number;

  /** periodTotalCollections - periodTargetRevenue */
  periodOverage: number;

  /** The subsidy check expected for the target (last-supplied) month */
  subsidyCheckExpected: number;

  /**
   * Total subsidy paid year-to-date including the current month's expected check.
   * = priorYtdSubsidyPaid + sum of subsidyCheckExpected for all months in this period.
   */
  ytdSubsidyPayment: number;

  /** Sum of all monthly overages across the period */
  totalMonthlyOverage: number;

  /** The max possible subsidy for any single month (= invoiceAmount) */
  maxMonthlySubsidy: number;
}
