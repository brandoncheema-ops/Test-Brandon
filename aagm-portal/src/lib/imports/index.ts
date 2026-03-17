// ---------------------------------------------------------------------------
// Import/Parsing Engine – Barrel Export
// ---------------------------------------------------------------------------

// Types
export type {
  ParsedCollectionsRow,
  ParsedExpenseRow,
  ParseResult,
  FileType,
  FileCategory,
} from './types';

// Detection
export { detectFileType, detectFileCategory } from './detector';

// Parsing
export { parseFile, parseExcelFile, parseCsvFile } from './parser';

// Location mapping
export type { LocationMapping } from './location-mapper';
export {
  mapLocation,
  CANONICAL_LOCATIONS,
  DEFAULT_ALIASES,
} from './location-mapper';
