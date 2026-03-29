/**
 * Tests for endpoint validation utilities.
 *
 * Table-driven tests for validateCreateEndpoint and validateUpdateEndpoint.
 * Each case is [label, input, expectedValid, expectedField?].
 */

import { assertEquals } from "@std/assert";
import {
  validateCreateEndpoint,
  validateUpdateEndpoint,
} from "../validators.ts";

// ── validateCreateEndpoint ──────────────────────────────────────────

const createCases: [string, unknown, boolean, string?][] = [
  // [label, input, expectedValid, expectedErrorField?]

  // Valid cases
  ["valid name only", { name: "My Endpoint" }, true],
  ["valid with script", { name: "EP", script: "return {status:200};" }, true],
  ["name at max length (100 chars)", { name: "a".repeat(100) }, true],
  ["name with whitespace gets trimmed", { name: "  padded  " }, true],

  // Invalid body shapes
  ["null body", null, false, "body"],
  ["undefined body", undefined, false, "body"],
  ["string body", "not an object", false, "body"],
  ["number body", 42, false, "body"],
  ["array body (treated as object, fails name)", [], false, "name"],

  // Invalid name
  ["missing name", {}, false, "name"],
  ["null name", { name: null }, false, "name"],
  ["numeric name", { name: 123 }, false, "name"],
  ["empty name", { name: "" }, false, "name"],
  ["whitespace-only name", { name: "   " }, false, "name"],
  ["name too long (101 chars)", { name: "a".repeat(101) }, false, "name"],

  // Invalid script
  ["non-string script", { name: "EP", script: 123 }, false, "script"],
  ["script too large (>65536 bytes)", { name: "EP", script: "x".repeat(65537) }, false, "script"],

  // Script edge cases
  ["script exactly at limit", { name: "EP", script: "x".repeat(65536) }, true],
  ["undefined script is ok", { name: "EP", script: undefined }, true],
  [
    "multi-byte script over limit by bytes not chars",
    { name: "EP", script: "\u{1F600}".repeat(16385) },
    false,
    "script",
  ],
];

for (const [label, input, expectedValid, expectedField] of createCases) {
  Deno.test(`validateCreateEndpoint: ${label}`, () => {
    const result = validateCreateEndpoint(input);
    assertEquals(result.valid, expectedValid, `expected valid=${expectedValid}`);
    if (!expectedValid && expectedField) {
      assertEquals(
        result.errors?.[0]?.field,
        expectedField,
        `expected error on field '${expectedField}'`,
      );
    }
    if (expectedValid) {
      assertEquals(result.errors, undefined);
    }
  });
}

// ── validateUpdateEndpoint ──────────────────────────────────────────

const updateCases: [string, unknown, boolean, string?][] = [
  // [label, input, expectedValid, expectedErrorField?]

  // Valid cases
  ["empty object (no updates)", {}, true],
  ["valid name", { name: "Updated" }, true],
  ["valid script", { script: "return {status:200};" }, true],
  ["valid status code (200)", { defaultStatusCode: 200 }, true],
  ["valid status code (100)", { defaultStatusCode: 100 }, true],
  ["valid status code (599)", { defaultStatusCode: 599 }, true],
  ["valid content type", { defaultContentType: "text/plain" }, true],
  ["valid body", { defaultBody: '{"ok":true}' }, true],
  [
    "all fields valid",
    {
      name: "Updated",
      script: "return {};",
      defaultStatusCode: 201,
      defaultContentType: "application/json",
      defaultBody: "{}",
    },
    true,
  ],

  // Invalid body shapes
  ["null body", null, false, "body"],
  ["string body", "nope", false, "body"],

  // Invalid name
  ["non-string name", { name: 123 }, false, "name"],
  ["empty name", { name: "" }, false, "name"],
  ["whitespace-only name", { name: "  " }, false, "name"],
  ["name too long", { name: "a".repeat(101) }, false, "name"],

  // Invalid script
  ["non-string script", { script: true }, false, "script"],
  ["script too large", { script: "x".repeat(65537) }, false, "script"],

  // Invalid status code
  ["string status code", { defaultStatusCode: "200" }, false, "defaultStatusCode"],
  ["float status code", { defaultStatusCode: 200.5 }, false, "defaultStatusCode"],
  ["status code below 100", { defaultStatusCode: 99 }, false, "defaultStatusCode"],
  ["status code above 599", { defaultStatusCode: 600 }, false, "defaultStatusCode"],
  ["NaN status code", { defaultStatusCode: NaN }, false, "defaultStatusCode"],

  // Invalid content type
  ["non-string content type", { defaultContentType: 42 }, false, "defaultContentType"],

  // Invalid default body
  ["non-string default body", { defaultBody: 123 }, false, "defaultBody"],
  ["default body too long", { defaultBody: "x".repeat(10001) }, false, "defaultBody"],
];

for (const [label, input, expectedValid, expectedField] of updateCases) {
  Deno.test(`validateUpdateEndpoint: ${label}`, () => {
    const result = validateUpdateEndpoint(input);
    assertEquals(result.valid, expectedValid, `expected valid=${expectedValid}`);
    if (!expectedValid && expectedField) {
      assertEquals(
        result.errors?.[0]?.field,
        expectedField,
        `expected error on field '${expectedField}'`,
      );
    }
    if (expectedValid) {
      assertEquals(result.errors, undefined);
    }
  });
}
