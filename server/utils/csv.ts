/**
 * CSV encoding utilities — pure functions, no dependencies.
 */

/**
 * Encodes a single CSV cell value per RFC 4180.
 * Quotes values containing commas, double-quotes, or newlines.
 */
export function encodeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? "" : String(val);
  return str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}
