/**
 * HTTP response sanitization utilities.
 *
 * Pure functions with no external dependencies — safe to import
 * from both the main server and the sandboxed worker (env: false).
 */

const SAFE_HEADER_NAME_PATTERN = /^[a-zA-Z0-9\-]+$/;

const BLOCKED_HEADERS = [
  "set-cookie",
  "access-control-allow-origin",
  "access-control-allow-credentials",
] as const;

const STATUS_CODE_MIN = 100;
const STATUS_CODE_MAX = 599;

/**
 * Validates and sanitizes HTTP response headers.
 *
 * Filters out unsafe header names, blocked headers, and non-string values.
 * Strips CRLF characters to prevent header injection attacks.
 *
 * @param headers - Raw headers object from user script
 * @returns Sanitized headers object with safe headers only
 */
export function sanitizeHeaders(
  headers: unknown,
): Record<string, string> {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof headers !== "object" || headers === null) {
    return defaultHeaders;
  }

  const entries = Object.entries(headers)
    .filter(([k, v]) => typeof k === "string" && typeof v === "string")
    .filter(([k]) => SAFE_HEADER_NAME_PATTERN.test(k))
    .filter(([k]) => !BLOCKED_HEADERS.includes(k.toLowerCase() as typeof BLOCKED_HEADERS[number]))
    .map(([k, v]) => [String(k), String(v).replace(/[\r\n]/g, "")]);

  return entries.length === 0 ? defaultHeaders : Object.fromEntries(entries);
}

/**
 * Validates and clamps HTTP status code to valid range.
 *
 * @param status - Status code to validate
 * @returns Clamped status code (100-599), or 200 if invalid
 */
export function sanitizeStatusCode(status: unknown): number {
  if (typeof status !== "number" || !Number.isInteger(status)) {
    return 200;
  }
  return Math.min(Math.max(status, STATUS_CODE_MIN), STATUS_CODE_MAX);
}

/**
 * Checks if a header name is blocked for security reasons.
 *
 * @param headerName - Header name to check (case-insensitive)
 * @returns true if header is blocked, false otherwise
 */
export function isHeaderBlocked(headerName: string): boolean {
  return BLOCKED_HEADERS.includes(headerName.toLowerCase() as typeof BLOCKED_HEADERS[number]);
}

/**
 * Checks if a header name contains only safe characters.
 *
 * @param headerName - Header name to check
 * @returns true if header name is safe, false otherwise
 */
export function isHeaderNameSafe(headerName: string): boolean {
  return SAFE_HEADER_NAME_PATTERN.test(headerName);
}
