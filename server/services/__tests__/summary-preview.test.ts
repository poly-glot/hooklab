/**
 * Tests for buildSummaryPreview — guards the prompt-cost + data-leak fix
 * for generateSummary().
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { buildSummaryPreview } from "../gemini.ts";
import {
  REPORT_SUMMARY_CELL_MAX_CHARS,
  REPORT_SUMMARY_DROP_COLUMNS,
  REPORT_SUMMARY_PREVIEW_MAX_CHARS,
} from "../../config.ts";

const COLS = [
  { name: "id", type: "STRING" },
  { name: "method", type: "STRING" },
  { name: "request_body", type: "STRING" },
  { name: "response_body", type: "STRING" },
];

Deno.test("drops raw-payload columns from preview", () => {
  const rows = [{
    id: "1",
    method: "POST",
    request_body: "secret",
    response_body: "secret2",
  }];
  const { preview, previewColumns } = buildSummaryPreview(rows, COLS);
  for (const drop of REPORT_SUMMARY_DROP_COLUMNS) {
    assertEquals(
      preview.includes(drop),
      false,
      `column ${drop} must not appear in preview`,
    );
    assertEquals(
      previewColumns.some((c) => c.name === drop),
      false,
    );
  }
  assertStringIncludes(preview, "POST");
  assertStringIncludes(preview, "id");
});

Deno.test("truncates oversized cells", () => {
  const big = "x".repeat(REPORT_SUMMARY_CELL_MAX_CHARS * 4);
  const rows = [{ id: "1", method: big, request_body: "", response_body: "" }];
  const { preview } = buildSummaryPreview(rows, COLS);
  // The big string should not appear in full
  assertEquals(
    preview.includes(big),
    false,
    "uncapped cell leaked into preview",
  );
  // The truncation marker should appear
  assertStringIncludes(preview, "…");
});

Deno.test("hard-caps total preview size", () => {
  const big = "y".repeat(REPORT_SUMMARY_CELL_MAX_CHARS - 1);
  const rows = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    method: big,
    request_body: "",
    response_body: "",
  }));
  const { preview } = buildSummaryPreview(rows, COLS);
  assertEquals(
    preview.length <= REPORT_SUMMARY_PREVIEW_MAX_CHARS + 32,
    true,
    `preview ${preview.length} exceeded cap ${REPORT_SUMMARY_PREVIEW_MAX_CHARS}`,
  );
});

Deno.test("previewRowCount caps at 20 even for huge result sets", () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({
    id: String(i),
    method: "GET",
    request_body: "",
    response_body: "",
  }));
  const { rowCount } = buildSummaryPreview(rows, COLS);
  assertEquals(rowCount <= 20, true, `expected ≤20, got ${rowCount}`);
});
