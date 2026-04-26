/**
 * SQL fragment validator + assembler.
 *
 * Replaces the substring-validator pattern with a structural one: the LLM
 * never gets to write the full SQL string. It returns small fragments
 * (column list, optional extra-WHERE, GROUP/ORDER BY, LIMIT) and the
 * backend assembles them inside a fixed safety scaffold:
 *
 *   SELECT {select_columns}
 *   FROM hooklab.executions
 *   WHERE user_id = @userId
 *     AND execution_timestamp >= @startTime
 *     AND execution_timestamp < @endTime
 *     AND ({where_extra | "TRUE"})
 *   [GROUP BY {group_by}]
 *   [ORDER BY {order_by}]
 *   LIMIT min({limit}, REPORT_MAX_ROWS)
 *
 * Because the user_id + time-window predicates are ANDed BEFORE the
 * LLM-supplied where_extra, an attacker cannot weaken them — even
 * `where_extra = "1=1 OR x"` becomes `... AND (1=1 OR x)`, which still
 * ANDs the user_id filter.
 */

import { BQ_DATASET, BQ_TABLE, REPORT_MAX_ROWS } from "../config.ts";
import type { GeminiSQLFragments } from "../types.ts";

const TABLE = `${BQ_DATASET}.${BQ_TABLE}`;
const FRAGMENT_MAX_CHARS = 1000;

/** Forbidden tokens in any LLM-supplied fragment. */
const FORBIDDEN_TOKENS: { token: RegExp; reason: string }[] = [
  { token: /;/, reason: "semicolons not allowed" },
  { token: /--/, reason: "SQL line comments not allowed" },
  { token: /\/\*/, reason: "SQL block comments not allowed" },
  { token: /\*\//, reason: "SQL block comments not allowed" },
  { token: /\bUNION\b/i, reason: "UNION not allowed" },
  { token: /\bJOIN\b/i, reason: "JOIN not allowed" },
  {
    token: /\bFROM\b/i,
    reason: "FROM not allowed in fragments — backend writes it",
  },
  {
    token: /\bWHERE\b/i,
    reason: "WHERE not allowed in fragments — backend writes it",
  },
  {
    token: /\bLIMIT\b/i,
    reason: "LIMIT must be supplied as a number, not in a fragment",
  },
  // hooklab.* references would create cross-table reads or duplicate FROMs.
  {
    token: new RegExp(`\\b${BQ_DATASET}\\.`, "i"),
    reason: `${BQ_DATASET}.* references not allowed in fragments`,
  },
  // @userId / @startTime / @endTime are scaffolded by the backend; LLM
  // doesn't need to reference them. Disallowing keeps fragments clean.
  { token: /@user_?id\b/i, reason: "@userId is scaffolded by the backend" },
];

export interface FragmentValidationError {
  field: string;
  reason: string;
  value: string;
}

/** Discriminated union — narrows `result.sql` and `result.errors`
 *  without non-null assertions at the call site. */
export type AssembleResult =
  | { ok: true; sql: string }
  | { ok: false; errors: FragmentValidationError[] };

function checkFragment(
  field: string,
  value: string | undefined,
  extraForbidden: { token: RegExp; reason: string }[] = [],
): FragmentValidationError | null {
  if (value == null) return null;
  const v = String(value);
  if (v.length > FRAGMENT_MAX_CHARS) {
    return {
      field,
      reason: `fragment too long (>${FRAGMENT_MAX_CHARS} chars)`,
      value: v.slice(0, 80),
    };
  }
  for (const { token, reason } of FORBIDDEN_TOKENS) {
    if (token.test(v)) return { field, reason, value: v };
  }
  for (const { token, reason } of extraForbidden) {
    if (token.test(v)) return { field, reason, value: v };
  }
  return null;
}

/**
 * Validates the LLM-supplied fragments and assembles the final SQL.
 * Returns either a safe SQL string or a structured list of validation
 * errors (the route turns these into a 422 with a generic message).
 */
export function assembleSQL(fragments: GeminiSQLFragments): AssembleResult {
  const errors: FragmentValidationError[] = [];

  // select_columns: required, no asterisk
  const selectCols = (fragments.select_columns || "").trim();
  if (!selectCols) {
    errors.push({ field: "select_columns", reason: "required", value: "" });
  } else {
    const e = checkFragment("select_columns", selectCols, [
      { token: /^\s*\*\s*$/, reason: "SELECT * not allowed" },
      { token: /(^|,)\s*\*\s*(,|$)/, reason: "* not allowed in column list" },
    ]);
    if (e) errors.push(e);
  }

  const whereExtra = fragments.where_extra?.trim();
  const e1 = checkFragment("where_extra", whereExtra);
  if (e1) errors.push(e1);

  const groupBy = fragments.group_by?.trim();
  const e2 = checkFragment("group_by", groupBy);
  if (e2) errors.push(e2);

  const orderBy = fragments.order_by?.trim();
  const e3 = checkFragment("order_by", orderBy);
  if (e3) errors.push(e3);

  // limit: clamp to bounds. Coerce via Number() so a numeric-string
  // like "50" is honoured (some small models emit JSON with stringified
  // numbers). Falls back to REPORT_MAX_ROWS for null/undefined/NaN.
  const n = Number(fragments.limit);
  const requested = Number.isFinite(n) ? Math.floor(n) : REPORT_MAX_ROWS;
  const limit = Math.max(1, Math.min(requested, REPORT_MAX_ROWS));

  if (errors.length > 0) return { ok: false, errors };

  // Assemble. Note `AND (...)` wrapping of where_extra — even if the LLM
  // returns `1=1 OR x`, it cannot weaken the scaffolded user_id filter.
  const wherePart = whereExtra ? ` AND (${whereExtra})` : "";
  const groupPart = groupBy ? ` GROUP BY ${groupBy}` : "";
  const orderPart = orderBy ? ` ORDER BY ${orderBy}` : "";

  const sql = `SELECT ${selectCols} ` +
    `FROM ${TABLE} ` +
    `WHERE user_id = @userId ` +
    `AND execution_timestamp >= @startTime ` +
    `AND execution_timestamp < @endTime` +
    wherePart +
    groupPart +
    orderPart +
    ` LIMIT ${limit}`;

  return { ok: true, sql };
}

export const _internal = { TABLE, FRAGMENT_MAX_CHARS, FORBIDDEN_TOKENS };
