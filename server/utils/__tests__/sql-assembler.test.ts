/**
 * Tests for the fragment-based SQL assembler.
 *
 * Goal: prove that NO LLM-supplied fragment can omit/weaken the safety
 * scaffold. Bypasses that worked against the substring validator must
 * either (a) be rejected outright or (b) be rendered harmless by the
 * `AND (...)` wrapping of where_extra.
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { assembleSQL } from "../sql-assembler.ts";

// ── Happy-path ────────────────────────────────────────────────────────

Deno.test("assembles minimal SELECT", () => {
  const r = assembleSQL({
    select_columns: "COUNT(*) as total, status",
    explanation: "...",
    suggestedFormat: "table",
    group_by: "status",
    order_by: "total DESC",
    limit: 50,
  });
  assertEquals(r.ok, true);
  assertStringIncludes(
    r.sql!,
    "SELECT COUNT(*) as total, status FROM hooklab.executions",
  );
  assertStringIncludes(
    r.sql!,
    "WHERE user_id = @userId AND execution_timestamp >= @startTime AND execution_timestamp < @endTime",
  );
  assertStringIncludes(r.sql!, "GROUP BY status");
  assertStringIncludes(r.sql!, "ORDER BY total DESC");
  assertStringIncludes(r.sql!, "LIMIT 50");
});

Deno.test("scaffolded predicates always present", () => {
  const r = assembleSQL({
    select_columns: "id",
    explanation: "...",
    suggestedFormat: "table",
  });
  assertEquals(r.ok, true);
  // user_id and time-window must appear unconditionally
  assertStringIncludes(r.sql!, "user_id = @userId");
  assertStringIncludes(r.sql!, "execution_timestamp >= @startTime");
  assertStringIncludes(r.sql!, "execution_timestamp < @endTime");
});

// ── Predicate-strength: where_extra cannot weaken scaffold ────────────

Deno.test("where_extra `1=1 OR x` is wrapped — cannot weaken user_id", () => {
  const r = assembleSQL({
    select_columns: "id",
    where_extra: "1=1 OR status = 'error'",
    explanation: "...",
    suggestedFormat: "table",
  });
  assertEquals(r.ok, true);
  // Critical: the AND ( ) wrapping. Even with OR inside, the user_id
  // predicate is still ANDed at the top level.
  assertStringIncludes(
    r.sql!,
    "AND execution_timestamp < @endTime AND (1=1 OR status = 'error')",
  );
});

// ── Reject: forbidden tokens in fragments ─────────────────────────────

const REJECT_CASES: {
  name: string;
  field: keyof import("../../types.ts").GeminiSQLFragments;
  value: string;
}[] = [
  {
    name: "select_columns: SELECT * literal",
    field: "select_columns",
    value: "*",
  },
  {
    name: "select_columns: contains semicolon",
    field: "select_columns",
    value: "id; DROP TABLE x",
  },
  {
    name: "select_columns: contains FROM (smuggle)",
    field: "select_columns",
    value: "id FROM secrets",
  },
  {
    name: "select_columns: contains UNION",
    field: "select_columns",
    value: "id UNION SELECT 1",
  },
  {
    name: "select_columns: contains JOIN",
    field: "select_columns",
    value: "id JOIN secrets s",
  },
  {
    name: "select_columns: cross-table reference",
    field: "select_columns",
    value: "(SELECT id FROM hooklab.secrets)",
  },
  {
    name: "where_extra: contains WHERE",
    field: "where_extra",
    value: "WHERE user_id = 'x'",
  },
  {
    name: "where_extra: contains LIMIT",
    field: "where_extra",
    value: "1=1 LIMIT 99999",
  },
  {
    name: "where_extra: contains comment",
    field: "where_extra",
    value: "1=1 -- bypass",
  },
  {
    name: "where_extra: contains block comment",
    field: "where_extra",
    value: "1=1 /* bypass */",
  },
  {
    name: "where_extra: @userId smuggle",
    field: "where_extra",
    value: "user_id != @userId",
  },
  {
    name: "group_by: contains FROM",
    field: "group_by",
    value: "(SELECT method FROM hooklab.secrets)",
  },
  {
    name: "order_by: contains UNION",
    field: "order_by",
    value: "1 UNION SELECT 1",
  },
];

for (const { name, field, value } of REJECT_CASES) {
  Deno.test(`REJECT fragment: ${name}`, () => {
    const fragments = {
      select_columns: "id",
      explanation: "...",
      suggestedFormat: "table" as const,
      [field]: value,
    };
    const r = assembleSQL(fragments);
    assertEquals(r.ok, false, `expected reject, got SQL: ${r.sql}`);
    assertEquals(
      r.errors!.some((e) => e.field === field),
      true,
      `expected error on field ${field}, got: ${JSON.stringify(r.errors)}`,
    );
  });
}

// ── LIMIT clamping ────────────────────────────────────────────────────

Deno.test("LIMIT clamps to REPORT_MAX_ROWS", () => {
  const r = assembleSQL({
    select_columns: "id",
    limit: 999_999_999,
    explanation: "...",
    suggestedFormat: "table",
  });
  assertEquals(r.ok, true);
  assertStringIncludes(r.sql!, "LIMIT 1000");
});

Deno.test("LIMIT defaults to REPORT_MAX_ROWS when missing", () => {
  const r = assembleSQL({
    select_columns: "id",
    explanation: "...",
    suggestedFormat: "table",
  });
  assertEquals(r.ok, true);
  assertStringIncludes(r.sql!, "LIMIT 1000");
});

Deno.test("LIMIT 0 / negative coerced to ≥ 1", () => {
  const r = assembleSQL({
    select_columns: "id",
    limit: 0,
    explanation: "...",
    suggestedFormat: "table",
  });
  assertEquals(r.ok, true);
  assertStringIncludes(r.sql!, "LIMIT 1");
});

// ── select_columns required ───────────────────────────────────────────

Deno.test("REJECT: empty select_columns", () => {
  const r = assembleSQL({
    select_columns: "",
    explanation: "...",
    suggestedFormat: "table",
  });
  assertEquals(r.ok, false);
});

// ── Fragment length cap ───────────────────────────────────────────────

Deno.test("REJECT: oversized fragment", () => {
  const r = assembleSQL({
    select_columns: "x".repeat(2000),
    explanation: "...",
    suggestedFormat: "table",
  });
  assertEquals(r.ok, false);
});
