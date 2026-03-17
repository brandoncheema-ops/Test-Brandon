// ---------------------------------------------------------------------------
// Import/Parsing Engine – Excel & CSV Parsers
// ---------------------------------------------------------------------------

import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';

import type {
  ParseResult,
  ParsedCollectionsRow,
  ParsedExpenseRow,
} from './types';
import { detectFileType, detectFileCategory } from './detector';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse any supported file buffer. Detects format and category automatically.
 */
export async function parseFile(
  buffer: Buffer,
  filename: string,
): Promise<ParseResult> {
  const fileType = detectFileType(filename, buffer);

  if (fileType === 'xlsx') {
    return parseExcelFile(buffer, filename);
  }

  if (fileType === 'csv') {
    const content = buffer.toString('utf-8');
    return parseCsvFile(content, filename);
  }

  return emptyResult([`Unsupported file type for "${filename}".`]);
}

/**
 * Parse an Excel (.xlsx / .xls) buffer.
 */
export async function parseExcelFile(
  buffer: Buffer,
  filename: string,
): Promise<ParseResult> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (err) {
    return emptyResult([
      `Failed to read Excel file "${filename}": ${(err as Error).message}`,
    ]);
  }

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    return emptyResult([`Excel file "${filename}" contains no sheets.`]);
  }

  const category = detectFileCategory(filename, sheetNames);

  if (category === 'collections') {
    return parseCollectionsWorkbook(workbook, filename);
  }

  if (category === 'monthly_statement') {
    return parseMonthlyStatementWorkbook(workbook, filename);
  }

  // Fallback: try both strategies and merge
  const collectionsResult = parseCollectionsWorkbook(workbook, filename);
  const statementResult = parseMonthlyStatementWorkbook(workbook, filename);

  if (
    collectionsResult.collections.length > 0 ||
    statementResult.expenses.length > 0
  ) {
    return mergeResults(collectionsResult, statementResult);
  }

  return emptyResult([], [
    `Could not determine file category for "${filename}". ` +
      `Sheets found: ${sheetNames.join(', ')}`,
  ]);
}

/**
 * Parse CSV content.
 */
export function parseCsvFile(
  content: string,
  filename: string,
): ParseResult {
  const parsed = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0) {
    const errorMsgs = parsed.errors.map(
      (e) => `CSV parse error at row ${e.row}: ${e.message}`,
    );
    // Continue with whatever data was successfully parsed
    const result = parseCsvRows(parsed.data, filename);
    result.warnings.push(...errorMsgs);
    return result;
  }

  return parseCsvRows(parsed.data, filename);
}

// ---------------------------------------------------------------------------
// Collections workbook parsing
// ---------------------------------------------------------------------------

/**
 * Collections files have location sections (SMH, SMH-Cardiac, WKH, etc.)
 * Each section contains monthly rows: month label, payments, refunds, units,
 * net collections. We extract the CURRENT (most recent) month row for each
 * location.
 */
function parseCollectionsWorkbook(
  workbook: XLSX.WorkBook,
  filename: string,
): ParseResult {
  const result = emptyResult();
  const sheet = pickSheet(workbook, ['collection', 'data', 'sheet1']);

  if (!sheet) {
    result.warnings.push(
      `No suitable sheet found for collections in "${filename}".`,
    );
    return result;
  }

  const rows = sheetToRows(sheet);
  if (rows.length === 0) {
    result.warnings.push(`Collections sheet is empty in "${filename}".`);
    return result;
  }

  let currentLocation: string | null = null;
  let locationRows: { month: string; payments: number; refunds: number; units: number; net: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;

    const firstCell = cellToString(row[0]).trim();
    if (!firstCell) continue;

    // Detect location header: a row where the first cell looks like a
    // location name and the remaining cells are empty or header labels.
    if (isLocationHeader(firstCell, row)) {
      // Flush previous location
      if (currentLocation && locationRows.length > 0) {
        flushLocationRows(currentLocation, locationRows, result);
      }
      currentLocation = firstCell;
      locationRows = [];
      continue;
    }

    // Skip header rows (Month, Payments, Refunds, Units, Net...)
    if (isCollectionsHeaderRow(row)) {
      continue;
    }

    // Skip "Combined" or "Total" summary rows unless they are a location
    if (/^(combined|total|grand\s*total)/i.test(firstCell)) {
      // Treat Combined as a location section header
      if (/combined/i.test(firstCell)) {
        if (currentLocation && locationRows.length > 0) {
          flushLocationRows(currentLocation, locationRows, result);
        }
        currentLocation = firstCell;
        locationRows = [];
      }
      continue;
    }

    // Try to parse as a data row: month | payments | refunds | units | net
    if (currentLocation && looksLikeMonthLabel(firstCell)) {
      const payments = parseCurrency(row[1]);
      const refunds = parseCurrency(row[2]);
      const units = parseNumber(row[3]);
      const net = parseCurrency(row[4]);

      locationRows.push({
        month: firstCell,
        payments,
        refunds,
        units,
        net,
      });
    }
  }

  // Flush last location
  if (currentLocation && locationRows.length > 0) {
    flushLocationRows(currentLocation, locationRows, result);
  }

  if (result.collections.length === 0) {
    result.warnings.push(
      `No collections data rows found in "${filename}".`,
    );
  }

  return result;
}

/**
 * Take a location's monthly rows and push the most recent (last) one
 * into the result as a ParsedCollectionsRow.
 */
function flushLocationRows(
  location: string,
  rows: { month: string; payments: number; refunds: number; units: number; net: number }[],
  result: ParseResult,
): void {
  if (rows.length === 0) return;

  // The "current month" is the last row in the section
  const current = rows[rows.length - 1];

  result.collections.push({
    sourceMonthLabel: current.month,
    sourceLocationRaw: location,
    payments: current.payments,
    refunds: current.refunds,
    units: current.units,
    netCollections: current.net,
  });
}

// ---------------------------------------------------------------------------
// Monthly statement workbook parsing
// ---------------------------------------------------------------------------

/**
 * Monthly statement files typically have:
 *   - Collections by location at the top (AGGREGATE, SMH, SMH-Cardiac, WKBH, DH, BHHD)
 *   - Monthly ASA Units row
 *   - Expenses table below with category/amount rows
 */
function parseMonthlyStatementWorkbook(
  workbook: XLSX.WorkBook,
  filename: string,
): ParseResult {
  const result = emptyResult();
  const sheet = pickSheet(workbook, [
    'statement',
    'monthly',
    'summary',
    'p&l',
    'expenses',
    'sheet1',
  ]);

  if (!sheet) {
    result.warnings.push(
      `No suitable sheet found for monthly statement in "${filename}".`,
    );
    return result;
  }

  const rows = sheetToRows(sheet);
  if (rows.length === 0) {
    result.warnings.push(`Monthly statement sheet is empty in "${filename}".`);
    return result;
  }

  // --- Phase 1: Parse collections by location from the top section ---------
  parseStatementCollections(rows, result);

  // --- Phase 2: Parse expense rows -----------------------------------------
  parseStatementExpenses(rows, result);

  return result;
}

/**
 * Scan for a row that defines location columns (e.g. AGGREGATE, SMH, ...),
 * then read the collections amounts from the row(s) immediately following.
 */
function parseStatementCollections(
  rows: unknown[][],
  result: ParseResult,
): void {
  // Look for a header row containing location names
  let locationHeaderIdx = -1;
  let locationColumns: { col: number; name: string }[] = [];

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    const candidates: { col: number; name: string }[] = [];

    for (let c = 0; c < row.length; c++) {
      const val = cellToString(row[c]).trim();
      if (isKnownStatementLocation(val)) {
        candidates.push({ col: c, name: val });
      }
    }

    // Accept if we found at least 2 location-like columns
    if (candidates.length >= 2) {
      locationHeaderIdx = i;
      locationColumns = candidates;
      break;
    }
  }

  if (locationHeaderIdx < 0 || locationColumns.length === 0) {
    return; // No collections header found; not an error for statement files
  }

  // Read the data row(s) directly after the header.
  // Some statement files have a single "Collections" row; others have
  // "Payments" and "Refunds" rows. We try to handle both patterns.
  for (
    let i = locationHeaderIdx + 1;
    i < Math.min(locationHeaderIdx + 10, rows.length);
    i++
  ) {
    const row = rows[i];
    const label = cellToString(row[0]).trim().toLowerCase();

    // Skip empty rows
    if (!label) continue;

    // If the label is "collections", "net collections", "payments", etc.
    if (
      /collection|payment|net\s*rev/i.test(label) ||
      /^total$/i.test(label)
    ) {
      for (const loc of locationColumns) {
        const value = parseCurrency(row[loc.col]);
        if (value !== 0) {
          result.collections.push({
            sourceMonthLabel: '',
            sourceLocationRaw: loc.name,
            payments: value,
            refunds: 0,
            units: 0,
            netCollections: value,
          });
        }
      }
      break; // Only take the first matching data row
    }

    // If the row itself has numeric values in the location columns and
    // doesn't have a recognisable label, it might be the data row.
    const numericCount = locationColumns.filter(
      (loc) => parseCurrency(row[loc.col]) !== 0,
    ).length;

    if (numericCount >= 2) {
      for (const loc of locationColumns) {
        const value = parseCurrency(row[loc.col]);
        result.collections.push({
          sourceMonthLabel: label || '',
          sourceLocationRaw: loc.name,
          payments: value,
          refunds: 0,
          units: 0,
          netCollections: value,
        });
      }
      break;
    }
  }

  // Look for Monthly ASA Units row
  for (
    let i = locationHeaderIdx + 1;
    i < Math.min(locationHeaderIdx + 15, rows.length);
    i++
  ) {
    const row = rows[i];
    const label = cellToString(row[0]).trim().toLowerCase();
    if (/asa\s*unit|monthly.*unit|unit/i.test(label)) {
      // Patch units into the already-pushed collections rows
      for (const loc of locationColumns) {
        const units = parseNumber(row[loc.col]);
        const existing = result.collections.find(
          (c) => c.sourceLocationRaw === loc.name,
        );
        if (existing) {
          existing.units = units;
        }
      }
      break;
    }
  }
}

/**
 * Scan for an expenses section and extract category + amount rows.
 */
function parseStatementExpenses(
  rows: unknown[][],
  result: ParseResult,
): void {
  // Find the start of the expenses section
  let expenseStartIdx = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstCell = cellToString(row[0]).trim().toLowerCase();

    if (
      /^expense/i.test(firstCell) ||
      /operating\s*expense/i.test(firstCell) ||
      /^cost/i.test(firstCell)
    ) {
      expenseStartIdx = i;
      break;
    }
  }

  if (expenseStartIdx < 0) {
    // Try alternate: look for known expense category keywords
    for (let i = 0; i < rows.length; i++) {
      const label = cellToString(rows[i][0]).trim().toLowerCase();
      if (
        /^(salary|salaries|rent|insurance|supplies|billing|malpractice)/i.test(
          label,
        )
      ) {
        expenseStartIdx = i;
        break;
      }
    }
  }

  if (expenseStartIdx < 0) return;

  // Determine which column holds the amount. Usually it's column 1 or the
  // last non-empty column in the first data row.
  const amountCol = detectAmountColumn(rows, expenseStartIdx);

  for (let i = expenseStartIdx; i < rows.length; i++) {
    const row = rows[i];
    const category = cellToString(row[0]).trim();

    if (!category) continue;

    // Stop at a total / subtotal row (include it as an expense? No – skip it)
    if (/^(total\s*expense|total\s*operating|grand\s*total)/i.test(category)) {
      break;
    }

    // Skip section headers that aren't actual expense lines
    if (
      /^expense/i.test(category) &&
      !hasNumericValue(row, amountCol)
    ) {
      continue;
    }

    const amount = parseCurrency(row[amountCol]);

    // Only include rows where we have a meaningful category and amount
    if (amount !== 0 || /\S/.test(category)) {
      // Skip rows that look like sub-headers (no amount and no indent)
      if (amount === 0) continue;

      result.expenses.push({
        categoryRaw: category,
        amount: Math.abs(amount), // Expenses stored as positive
      });
    }
  }
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCsvRows(
  rows: string[][],
  filename: string,
): ParseResult {
  const category = detectFileCategory(filename);

  if (category === 'collections') {
    return parseCsvCollections(rows, filename);
  }

  if (category === 'monthly_statement') {
    return parseCsvStatement(rows, filename);
  }

  // Auto-detect: try both
  const collectionsResult = parseCsvCollections(rows, filename);
  const statementResult = parseCsvStatement(rows, filename);

  if (
    collectionsResult.collections.length > 0 ||
    statementResult.expenses.length > 0
  ) {
    return mergeResults(collectionsResult, statementResult);
  }

  return emptyResult([], [
    `Could not determine CSV file category for "${filename}".`,
  ]);
}

function parseCsvCollections(
  rows: string[][],
  _filename: string,
): ParseResult {
  const result = emptyResult();
  let currentLocation: string | null = null;
  let locationRows: { month: string; payments: number; refunds: number; units: number; net: number }[] = [];

  for (const row of rows) {
    if (row.length === 0) continue;

    const firstCell = (row[0] ?? '').trim();
    if (!firstCell) continue;

    if (isLocationHeader(firstCell, row.map((c) => c as unknown))) {
      if (currentLocation && locationRows.length > 0) {
        flushLocationRows(currentLocation, locationRows, result);
      }
      currentLocation = firstCell;
      locationRows = [];
      continue;
    }

    if (isCollectionsHeaderRow(row.map((c) => c as unknown))) continue;

    if (/^(combined|total|grand\s*total)/i.test(firstCell)) {
      if (/combined/i.test(firstCell)) {
        if (currentLocation && locationRows.length > 0) {
          flushLocationRows(currentLocation, locationRows, result);
        }
        currentLocation = firstCell;
        locationRows = [];
      }
      continue;
    }

    if (currentLocation && looksLikeMonthLabel(firstCell)) {
      locationRows.push({
        month: firstCell,
        payments: parseCurrency(row[1]),
        refunds: parseCurrency(row[2]),
        units: parseNumber(row[3]),
        net: parseCurrency(row[4]),
      });
    }
  }

  if (currentLocation && locationRows.length > 0) {
    flushLocationRows(currentLocation, locationRows, result);
  }

  return result;
}

function parseCsvStatement(
  rows: string[][],
  _filename: string,
): ParseResult {
  const result = emptyResult();

  // Look for expense rows (category, amount pairs)
  let inExpenses = false;

  for (const row of rows) {
    const label = (row[0] ?? '').trim();
    if (!label) continue;

    if (
      /^expense/i.test(label) ||
      /operating\s*expense/i.test(label)
    ) {
      inExpenses = true;
      continue;
    }

    if (inExpenses) {
      if (/^(total\s*expense|grand\s*total)/i.test(label)) break;

      const amount = parseCurrency(row[1]);
      if (amount !== 0) {
        result.expenses.push({
          categoryRaw: label,
          amount: Math.abs(amount),
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers – Sheet selection & conversion
// ---------------------------------------------------------------------------

/**
 * Pick the best sheet from a workbook by matching preferred name patterns.
 * Falls back to the first sheet.
 */
function pickSheet(
  workbook: XLSX.WorkBook,
  preferredPatterns: string[],
): XLSX.WorkSheet | null {
  for (const pattern of preferredPatterns) {
    for (const name of workbook.SheetNames) {
      if (name.toLowerCase().includes(pattern.toLowerCase())) {
        return workbook.Sheets[name];
      }
    }
  }
  // Fallback: first sheet
  const first = workbook.SheetNames[0];
  return first ? workbook.Sheets[first] : null;
}

/**
 * Convert a worksheet to a 2D array of raw cell values.
 */
function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    rawNumbers: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers – Cell value handling
// ---------------------------------------------------------------------------

/** Coerce any cell value to a string. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Format as a readable month/date string
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[value.getMonth()]} ${value.getFullYear()}`;
  }
  return String(value);
}

/**
 * Parse a currency string or number into a float.
 * Handles: "$1,234.56", "(1,234.56)", "-$1234.56", plain numbers.
 */
function parseCurrency(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  const str = String(value).trim();
  if (!str) return 0;

  // Detect negative: parentheses or leading minus
  const isNegative = /^\(.*\)$/.test(str) || str.startsWith('-');

  // Strip currency symbols, commas, parentheses, spaces
  const cleaned = str.replace(/[$,\s()]/g, '').replace(/^-/, '');

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  return isNegative ? -num : num;
}

/** Parse a value as a plain number (for units, counts, etc.). */
function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  const str = String(value).replace(/[,\s]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// ---------------------------------------------------------------------------
// Helpers – Row classification
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const MONTH_PATTERN = new RegExp(
  `^(${MONTH_NAMES.join('|')})[\\s._-]*(\\d{2,4})?$`,
  'i',
);

/** Does a string look like a month label? e.g. "January 2025", "Jan-25" */
function looksLikeMonthLabel(s: string): boolean {
  const trimmed = s.trim();
  if (MONTH_PATTERN.test(trimmed)) return true;
  // Also accept "1/2025", "01/2025" style
  if (/^\d{1,2}[/\-]\d{2,4}$/.test(trimmed)) return true;
  return false;
}

/** Is this a collections header row? (Month, Payments, Refunds, etc.) */
function isCollectionsHeaderRow(row: unknown[]): boolean {
  const labels = row.map((c) => cellToString(c).trim().toLowerCase());
  const headerKeywords = ['month', 'payment', 'refund', 'unit', 'net', 'collection'];
  const matches = labels.filter((l) =>
    headerKeywords.some((kw) => l.includes(kw)),
  );
  return matches.length >= 2;
}

/**
 * Is this row a location header?
 * A location header typically has a name in the first cell and most other
 * cells are empty.
 */
function isLocationHeader(firstCell: string, row: unknown[]): boolean {
  // Known location-like patterns
  const locationPatterns = [
    /^smh/i, /cardiac/i, /^wk/i, /^doral/i, /doctor/i, /^dh$/i,
    /^bhhd/i, /homestead/i, /^combined/i, /baptist/i, /kendall/i,
    /^south\s*miami/i, /aggregate/i,
  ];

  const isLocationLike = locationPatterns.some((p) => p.test(firstCell));
  if (!isLocationLike) return false;

  // Most remaining cells should be empty (allow up to 1 non-empty)
  let nonEmpty = 0;
  for (let c = 1; c < row.length; c++) {
    const val = cellToString(row[c]).trim();
    if (val && !/^\s*$/.test(val)) nonEmpty++;
  }

  return nonEmpty <= 1;
}

/** Known location names that appear in monthly statement headers. */
function isKnownStatementLocation(s: string): boolean {
  const patterns = [
    /^aggregate$/i, /^smh$/i, /^smh[\s-]*cardiac$/i,
    /^wk(b)?h$/i, /^dh$/i, /^bhhd$/i, /^doral$/i,
    /^doctor/i, /^south\s*miami/i, /^west\s*kendall/i,
    /^homestead/i, /^combined$/i,
  ];
  return patterns.some((p) => p.test(s.trim()));
}

/**
 * Try to detect which column contains the amount values in an expense table.
 * Scans a few rows after the start index looking for numeric values.
 */
function detectAmountColumn(rows: unknown[][], startIdx: number): number {
  const columnScores: Record<number, number> = {};

  for (
    let i = startIdx;
    i < Math.min(startIdx + 10, rows.length);
    i++
  ) {
    const row = rows[i];
    for (let c = 1; c < row.length; c++) {
      const val = parseCurrency(row[c]);
      if (val !== 0) {
        columnScores[c] = (columnScores[c] ?? 0) + 1;
      }
    }
  }

  // Return the column with the most numeric hits, defaulting to column 1
  let bestCol = 1;
  let bestScore = 0;
  for (const [col, score] of Object.entries(columnScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCol = Number(col);
    }
  }

  return bestCol;
}

/** Check if a row has a numeric value at the given column index. */
function hasNumericValue(row: unknown[], col: number): boolean {
  if (col >= row.length) return false;
  return parseCurrency(row[col]) !== 0;
}

// ---------------------------------------------------------------------------
// Helpers – Result construction
// ---------------------------------------------------------------------------

function emptyResult(
  errors: string[] = [],
  warnings: string[] = [],
): ParseResult {
  return {
    collections: [],
    expenses: [],
    warnings,
    errors,
  };
}

function mergeResults(...results: ParseResult[]): ParseResult {
  const merged = emptyResult();
  for (const r of results) {
    merged.collections.push(...r.collections);
    merged.expenses.push(...r.expenses);
    merged.warnings.push(...r.warnings);
    merged.errors.push(...r.errors);
  }
  return merged;
}
