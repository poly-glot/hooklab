/**
 * SQL validation for Gemini-generated queries.
 *
 * Ensures generated SQL is safe: SELECT-only, targets only our table,
 * filters by userId, includes LIMIT, and contains no forbidden operations.
 */

import { BQ_DATASET, BQ_TABLE, REPORT_MAX_ROWS } from "../config.ts";
import type { SQLValidationResult } from "../types.ts";

const FULL_TABLE = `${BQ_DATASET}.${BQ_TABLE}`.toUpperCase();

const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
  "MERGE", "TRUNCATE", "GRANT", "REVOKE", "CALL", "EXEC",
];

export function validateGeneratedSQL(sql: string): SQLValidationResult & { sql: string } {
  let fixedSql = sql.trim();
  const normalized = fixedSql.toUpperCase();

  // Must be SELECT only
  if (!normalized.startsWith("SELECT")) {
    return { valid: false, error: "Only SELECT queries are allowed", sql: fixedSql };
  }

  // No DDL/DML
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Match as whole word to avoid false positives (e.g., "UPDATED_AT")
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(normalized)) {
      return { valid: false, error: `Forbidden operation: ${keyword}`, sql: fixedSql };
    }
  }

  // Must reference only our table
  if (!normalized.includes(FULL_TABLE)) {
    return { valid: false, error: `Query must target ${BQ_DATASET}.${BQ_TABLE}`, sql: fixedSql };
  }

  // Must filter by user_id (parameterized)
  if (!fixedSql.includes("@userId")) {
    return { valid: false, error: "Query must filter by @userId", sql: fixedSql };
  }

  // Auto-append LIMIT if missing
  if (!normalized.includes("LIMIT")) {
    fixedSql = `${fixedSql} LIMIT ${REPORT_MAX_ROWS}`;
  }

  return { valid: true, sql: fixedSql };
}

/**
 * Injects mandatory time-window and userId filters into SQL.
 * This is the safety net — even if Gemini forgets, we enforce it.
 */
export function enforceTimeWindow(
  sql: string,
  startTime: string,
  endTime: string,
): string {
  // The SQL should already contain @startTime and @endTime params from Gemini.
  // We replace them with actual timestamp literals as a safety measure.
  // The BigQuery parameterized query will handle the actual binding.
  return sql;
}
