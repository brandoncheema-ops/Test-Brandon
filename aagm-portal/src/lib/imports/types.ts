// ---------------------------------------------------------------------------
// Import/Parsing Engine – Shared Types
// ---------------------------------------------------------------------------

/** A single row of collections data parsed from a source file. */
export interface ParsedCollectionsRow {
  /** Month label as it appears in the source (e.g. "January 2025", "Jan-25"). */
  sourceMonthLabel: string;
  /** Raw location string before canonical mapping (e.g. "SMH", "WKBH"). */
  sourceLocationRaw: string;
  /** Total payments (positive currency value). */
  payments: number;
  /** Total refunds (positive currency value – sign is handled by consumers). */
  refunds: number;
  /** Number of ASA / billing units. */
  units: number;
  /** Net collections = payments − refunds. */
  netCollections: number;
}

/** A single expense row parsed from a monthly statement. */
export interface ParsedExpenseRow {
  /** Raw expense category string before normalisation. */
  categoryRaw: string;
  /** Dollar amount of the expense (positive). */
  amount: number;
}

/** Aggregated result returned by every parse function. */
export interface ParseResult {
  /** Parsed collections rows (may be empty). */
  collections: ParsedCollectionsRow[];
  /** Parsed expense rows (may be empty). */
  expenses: ParsedExpenseRow[];
  /** Non-fatal issues encountered during parsing. */
  warnings: string[];
  /** Fatal issues that prevented part of the parse. */
  errors: string[];
}

/** Detected file format. */
export type FileType = 'xlsx' | 'csv' | 'unknown';

/** Detected semantic category of a file. */
export type FileCategory =
  | 'collections'
  | 'monthly_statement'
  | 'invoice'
  | 'support_doc'
  | 'unknown';
