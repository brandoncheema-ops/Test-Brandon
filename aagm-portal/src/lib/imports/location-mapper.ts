// ---------------------------------------------------------------------------
// Import/Parsing Engine – Location Mapping & Aliases
// ---------------------------------------------------------------------------

/** Maps a raw source string to a canonical location name. */
export interface LocationMapping {
  /** The value as it appears in the source file (case-insensitive match). */
  sourceValue: string;
  /** The canonical / normalised location name used throughout the app. */
  canonicalValue: string;
}

/**
 * The set of canonical location names recognised by the portal.
 * Order matches the typical report layout.
 */
export const CANONICAL_LOCATIONS: string[] = [
  'SMH',
  'SMH-Cardiac',
  'WKH',
  'Doral',
  'Doctors Hospital',
  'BHHD',
];

/**
 * Default alias table covering known variations found across AAGM source
 * files.  Entries are matched case-insensitively.
 */
export const DEFAULT_ALIASES: LocationMapping[] = [
  // SMH
  { sourceValue: 'SMH', canonicalValue: 'SMH' },
  { sourceValue: 'South Miami Hospital', canonicalValue: 'SMH' },
  { sourceValue: 'South Miami', canonicalValue: 'SMH' },
  { sourceValue: 'S Miami', canonicalValue: 'SMH' },

  // SMH-Cardiac
  { sourceValue: 'SMH-Cardiac', canonicalValue: 'SMH-Cardiac' },
  { sourceValue: 'SMH Cardiac', canonicalValue: 'SMH-Cardiac' },
  { sourceValue: 'SMH - Cardiac', canonicalValue: 'SMH-Cardiac' },
  { sourceValue: 'Cardiac', canonicalValue: 'SMH-Cardiac' },
  { sourceValue: 'SMH-Card', canonicalValue: 'SMH-Cardiac' },

  // WKH / West Kendall
  { sourceValue: 'WKH', canonicalValue: 'WKH' },
  { sourceValue: 'WKBH', canonicalValue: 'WKH' },
  { sourceValue: 'WK', canonicalValue: 'WKH' },
  { sourceValue: 'West Kendall', canonicalValue: 'WKH' },
  { sourceValue: 'West Kendall Baptist', canonicalValue: 'WKH' },
  { sourceValue: 'West Kendall Baptist Hospital', canonicalValue: 'WKH' },

  // Doral
  { sourceValue: 'Doral', canonicalValue: 'Doral' },
  { sourceValue: 'Baptist Health Doral', canonicalValue: 'Doral' },
  { sourceValue: 'BH Doral', canonicalValue: 'Doral' },

  // Doctors Hospital
  { sourceValue: 'Doctors Hospital', canonicalValue: 'Doctors Hospital' },
  { sourceValue: 'Doctor Hospital', canonicalValue: 'Doctors Hospital' },
  { sourceValue: 'DH', canonicalValue: 'Doctors Hospital' },
  { sourceValue: "Doctor's Hospital", canonicalValue: 'Doctors Hospital' },
  { sourceValue: 'Drs Hospital', canonicalValue: 'Doctors Hospital' },
  { sourceValue: 'Doctors Hosp', canonicalValue: 'Doctors Hospital' },

  // BHHD (Baptist Health Hotel Dieu / Homestead)
  { sourceValue: 'BHHD', canonicalValue: 'BHHD' },
  { sourceValue: 'BH Homestead', canonicalValue: 'BHHD' },
  { sourceValue: 'Homestead', canonicalValue: 'BHHD' },
  { sourceValue: 'Baptist Homestead', canonicalValue: 'BHHD' },
  { sourceValue: 'Homestead Hospital', canonicalValue: 'BHHD' },
];

/**
 * Attempt to map a raw location string to its canonical form.
 *
 * Matching strategy (in order):
 *  1. Exact case-insensitive match against the alias table.
 *  2. Trimmed + collapsed-whitespace match.
 *  3. Substring containment (the alias is contained within the raw value).
 *
 * @returns The canonical location string, or `null` if no match is found.
 */
export function mapLocation(
  raw: string,
  aliases: LocationMapping[] = DEFAULT_ALIASES,
): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const normalised = normalise(raw);
  if (!normalised) return null;

  // 1. Exact match (after normalisation)
  for (const alias of aliases) {
    if (normalise(alias.sourceValue) === normalised) {
      return alias.canonicalValue;
    }
  }

  // 2. Substring match – the alias text is contained in the raw value
  //    (useful for cells like "SMH - South Miami Hospital Collections")
  for (const alias of aliases) {
    const aliasNorm = normalise(alias.sourceValue);
    if (aliasNorm && normalised.includes(aliasNorm)) {
      return alias.canonicalValue;
    }
  }

  // 3. Check if raw value is a prefix of a canonical location
  for (const canonical of CANONICAL_LOCATIONS) {
    if (normalise(canonical) === normalised) {
      return canonical;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase, trim, collapse whitespace, strip punctuation-like noise. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
