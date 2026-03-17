// ---------------------------------------------------------------------------
// Import/Parsing Engine – File Type & Category Detection
// ---------------------------------------------------------------------------

import type { FileType, FileCategory } from './types';

// Excel XLSX magic bytes: PK zip header (50 4B 03 04)
const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Detect whether a file is xlsx, csv, or unknown based on its filename
 * extension and, when available, a peek at the leading bytes of the buffer.
 */
export function detectFileType(filename: string, buffer: Buffer): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  // Extension-based detection
  if (ext === 'xlsx' || ext === 'xls') {
    return 'xlsx';
  }
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    return 'csv';
  }

  // Fallback: magic-byte sniffing
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(XLSX_MAGIC)) {
    return 'xlsx';
  }

  // If the first chunk looks like printable text / UTF-8, treat as CSV
  if (buffer.length > 0 && looksLikeText(buffer.subarray(0, Math.min(512, buffer.length)))) {
    return 'csv';
  }

  return 'unknown';
}

/**
 * Classify a file into a semantic category so the parser knows which
 * extraction strategy to apply.
 *
 * Heuristics (evaluated in order):
 *  1. Filename keywords / patterns.
 *  2. Sheet names (for multi-sheet xlsx workbooks).
 */
export function detectFileCategory(
  filename: string,
  sheetNames?: string[],
): FileCategory {
  const lower = filename.toLowerCase();

  // ---- Filename-based rules ------------------------------------------------

  if (/invoice/i.test(lower)) {
    return 'invoice';
  }

  // "monthly.*statement", "stmt", "month.*stmt"
  if (/month(ly)?[\s_-]*(statement|stmt)/i.test(lower) || /stmt/i.test(lower)) {
    return 'monthly_statement';
  }

  // "collection" anywhere in name
  if (/collection/i.test(lower)) {
    return 'collections';
  }

  // Support documents: receipts, backup, supporting, etc.
  if (/support|receipt|backup|attach/i.test(lower)) {
    return 'support_doc';
  }

  // ---- Sheet-name-based rules (xlsx only) ----------------------------------

  if (sheetNames && sheetNames.length > 0) {
    const joined = sheetNames.join(' ').toLowerCase();

    if (/collection/i.test(joined)) {
      return 'collections';
    }

    // Sheets named "Expenses", "Revenue", "P&L", "Statement"
    if (/expense|revenue|p\s*&\s*l|statement/i.test(joined)) {
      return 'monthly_statement';
    }

    if (/invoice/i.test(joined)) {
      return 'invoice';
    }
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Quick heuristic: does a buffer look like printable ASCII / UTF-8 text?
 * We allow common control chars (tab, CR, LF) and anything >= 0x20.
 */
function looksLikeText(buf: Buffer): boolean {
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue; // tab, LF, CR
    if (byte < 0x20 && byte !== 0x00) return false; // non-printable control char
    // 0x00 can appear in UTF-16 – we are lenient here
  }
  return true;
}
