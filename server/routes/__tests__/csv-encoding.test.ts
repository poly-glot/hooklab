/**
 * Tests for CSV cell encoding — imports the real encodeCsvCell function.
 */

import { assertEquals } from "@std/assert";
import { encodeCsvCell } from "../../utils/csv.ts";

Deno.test("plain string passes through unquoted", () => {
  assertEquals(encodeCsvCell("hello"), "hello");
});

Deno.test("empty string passes through", () => {
  assertEquals(encodeCsvCell(""), "");
});

Deno.test("null becomes empty string", () => {
  assertEquals(encodeCsvCell(null), "");
});

Deno.test("value with comma is quoted", () => {
  assertEquals(encodeCsvCell("a,b"), '"a,b"');
});

Deno.test("value with double-quote is quoted and escaped", () => {
  assertEquals(encodeCsvCell('say "hi"'), '"say ""hi"""');
});

Deno.test("value with LF newline is quoted", () => {
  assertEquals(encodeCsvCell("line1\nline2"), '"line1\nline2"');
});

Deno.test("value with CR is quoted", () => {
  assertEquals(encodeCsvCell("line1\rline2"), '"line1\rline2"');
});

Deno.test("value with CRLF is quoted", () => {
  assertEquals(encodeCsvCell("line1\r\nline2"), '"line1\r\nline2"');
});

Deno.test("JSON body with newlines is properly quoted", () => {
  const body = '{\n  "ok": true\n}';
  const result = encodeCsvCell(body);
  assertEquals(result.startsWith('"'), true, "should be quoted");
  assertEquals(result.endsWith('"'), true, "should be quoted");
});

Deno.test("number passes through", () => {
  assertEquals(encodeCsvCell(200), "200");
});
