/**
 * Re-exports sanitization utilities for the sandbox worker.
 *
 * The sandbox worker cannot import config.ts (env vars blocked),
 * but sanitizers.ts has no such dependency — safe to re-export.
 */

export { sanitizeHeaders, sanitizeStatusCode } from "../utils/sanitizers.ts";
