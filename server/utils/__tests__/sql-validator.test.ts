/**
 * Tests for SQL validator — proving bypass resistance.
 *
 * Each test targets a specific attack vector identified in the adversarial review.
 */

import { assertEquals } from "@std/assert";
import { validateGeneratedSQL } from "../sql-validator.ts";

// Patch config values that the validator reads at import time
// (BQ_DATASET=hooklab, BQ_TABLE=executions from config defaults)

// ── Valid queries ─────────────────────────────────────────────────────

Deno.test("valid: basic SELECT with proper filters", () => {
  const sql = `SELECT COUNT(*) as total FROM hooklab.executions WHERE user_id = @userId AND execution_timestamp >= @startTime LIMIT 100`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, true);
});

Deno.test("valid: auto-appends LIMIT when missing", () => {
  const sql = `SELECT method FROM hooklab.executions WHERE user_id = @userId`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, true);
  assertEquals(result.sql.includes("LIMIT"), true, "should have LIMIT appended");
});

// ── @userId in comment bypass ─────────────────────────────────────────

Deno.test("REJECT: @userId placed inside block comment", () => {
  const sql = `SELECT * FROM hooklab.executions WHERE 1=1 /* user_id = @userId */ LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false, "@userId in block comment must be rejected");
});

Deno.test("REJECT: @userId placed inside line comment", () => {
  const sql = `SELECT * FROM hooklab.executions WHERE 1=1 LIMIT 10 -- user_id = @userId`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false, "@userId in line comment must be rejected");
});

Deno.test("REJECT: OR 1=1 with @userId in a dead branch", () => {
  const sql = `SELECT * FROM hooklab.executions WHERE user_id = 'x' OR 1=1 LIMIT 100 -- user_id = @userId`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false, "@userId in line comment must be rejected");
});

// ── UNION bypass ──────────────────────────────────────────────────────

Deno.test("REJECT: UNION SELECT to exfiltrate from another table", () => {
  const sql = `SELECT id FROM hooklab.executions WHERE user_id = @userId UNION SELECT secret FROM hooklab.keys LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false, "UNION must be blocked");
  assertEquals(result.error!.includes("UNION"), true);
});

Deno.test("REJECT: UNION ALL variant", () => {
  const sql = `SELECT id FROM hooklab.executions WHERE user_id = @userId UNION ALL SELECT id FROM hooklab.executions WHERE user_id = 'victim' LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false);
});

// ── Multi-statement bypass ────────────────────────────────────────────

Deno.test("REJECT: semicolon multi-statement", () => {
  const sql = `SELECT id FROM hooklab.executions WHERE user_id = @userId; DROP TABLE hooklab.executions`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false, "semicolons must be blocked");
});

// ── CROSS JOIN bypass ─────────────────────────────────────────────────

Deno.test("REJECT: CROSS JOIN", () => {
  const sql = `SELECT * FROM hooklab.executions CROSS JOIN hooklab.secrets WHERE user_id = @userId LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false, "CROSS JOIN must be blocked");
});

// ── Missing user_id filter ────────────────────────────────────────────

Deno.test("REJECT: no user_id = @userId filter at all", () => {
  const sql = `SELECT * FROM hooklab.executions WHERE method = 'POST' LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false);
});

Deno.test("REJECT: @userId mentioned but not in user_id = @userId pattern", () => {
  // e.g. @userId in a string literal
  const sql = `SELECT * FROM hooklab.executions WHERE method = '@userId' LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false);
});

// ── Nested comment edge case ──────────────────────────────────────────

Deno.test("REJECT: nested block comments hiding the real filter", () => {
  const sql = `SELECT * FROM hooklab.executions WHERE /* outer /* user_id = @userId */ still in comment */ 1=1 LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false);
});

// ── Forbidden keywords ────────────────────────────────────────────────

Deno.test("REJECT: DROP in comment-stripped SQL", () => {
  const sql = `SELECT id FROM hooklab.executions WHERE user_id = @userId LIMIT 10; DROP TABLE hooklab.executions`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, false);
});

Deno.test("ALLOW: column named with keyword substring (UPDATED_AT)", () => {
  // "UPDATED_AT" should NOT trigger "UPDATE" keyword check because \b doesn't match inside word
  const sql = `SELECT id FROM hooklab.executions WHERE user_id = @userId ORDER BY execution_timestamp LIMIT 10`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, true);
});

// ── Real-world valid aggregation ──────────────────────────────────────

Deno.test("valid: GROUP BY with aggregation", () => {
  const sql = `SELECT method, COUNT(*) as cnt FROM hooklab.executions WHERE user_id = @userId AND execution_timestamp >= @startTime AND execution_timestamp < @endTime GROUP BY method ORDER BY cnt DESC LIMIT 50`;
  const result = validateGeneratedSQL(sql);
  assertEquals(result.valid, true);
});
