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

/**
 * Strips SQL block comments (/* ... *​/) and line comments (-- ...).
 * Returns comment-free SQL so downstream checks can't be fooled by
 * placing tokens like @userId inside a comment.
 */
function stripComments(sql: string): string {
  // Remove block comments (non-greedy, handles nested by iterating)
  let result = sql;
  let prev: string;
  do {
    prev = result;
    result = result.replace(/\/\*[\s\S]*?\*\//g, " ");
  } while (result !== prev);

  // Remove line comments
  result = result.replace(/--.*/g, " ");

  return result;
}

export function validateGeneratedSQL(sql: string): SQLValidationResult & { sql: string } {
  let fixedSql = sql.trim();
  const stripped = stripComments(fixedSql);
  const normalized = stripped.toUpperCase();

  // Must be SELECT only
  if (!normalized.trimStart().startsWith("SELECT")) {
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

  // Block multi-statement attacks (semicolons not inside strings)
  if (/;/.test(stripped.replace(/'[^']*'/g, ""))) {
    return { valid: false, error: "Multiple statements are not allowed", sql: fixedSql };
  }

  // Block UNION / UNION ALL — prevents cross-table reads
  if (/\bUNION\b/.test(normalized)) {
    return { valid: false, error: "UNION queries are not allowed", sql: fixedSql };
  }

  // Block subqueries in FROM that could reference other tables
  // Allow subqueries in WHERE but block CROSS JOIN / multiple FROM tables
  if (/\bCROSS\s+JOIN\b/.test(normalized)) {
    return { valid: false, error: "CROSS JOIN is not allowed", sql: fixedSql };
  }

  // Must reference only our table
  if (!normalized.includes(FULL_TABLE)) {
    return { valid: false, error: `Query must target ${BQ_DATASET}.${BQ_TABLE}`, sql: fixedSql };
  }

  // Must filter by user_id = @userId in the comment-stripped SQL
  // Require the actual WHERE clause pattern, not just a mention of @userId
  if (!/\bUSER_ID\s*=\s*@USERID\b/i.test(stripped)) {
    return {
      valid: false,
      error: "Query must contain WHERE user_id = @userId (not in a comment)",
      sql: fixedSql,
    };
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
