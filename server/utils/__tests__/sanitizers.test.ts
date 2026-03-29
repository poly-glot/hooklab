/**
 * Tests for HTTP response sanitization utilities.
 *
 * All tests are table-driven: each case is a row of [label, input, expected].
 */

import { assertEquals } from "@std/assert";
import {
  isHeaderBlocked,
  isHeaderNameSafe,
  sanitizeHeaders,
  sanitizeStatusCode,
} from "../sanitizers.ts";

// ── sanitizeStatusCode ──────────────────────────────────────────────

const statusCodeCases: [string, unknown, number][] = [
  // [label, input, expected]

  // Valid codes — pass through
  ["minimum valid (100)", 100, 100],
  ["standard OK (200)", 200, 200],
  ["redirect (301)", 301, 301],
  ["not found (404)", 404, 404],
  ["server error (500)", 500, 500],
  ["maximum valid (599)", 599, 599],

  // Boundary clamping
  ["below minimum clamps to 100", 50, 100],
  ["above maximum clamps to 599", 700, 599],
  ["zero clamps to 100", 0, 100],
  ["negative clamps to 100", -1, 100],
  ["large number clamps to 599", 9999, 599],

  // Invalid types → default 200
  ["null returns 200", null, 200],
  ["undefined returns 200", undefined, 200],
  ["string returns 200", "200", 200],
  ["boolean returns 200", true, 200],
  ["object returns 200", {}, 200],
  ["array returns 200", [200], 200],
  ["NaN returns 200", NaN, 200],
  ["Infinity returns 200", Infinity, 200],
  ["float returns 200", 200.5, 200],
];

for (const [label, input, expected] of statusCodeCases) {
  Deno.test(`sanitizeStatusCode: ${label}`, () => {
    assertEquals(sanitizeStatusCode(input), expected);
  });
}

// ── sanitizeHeaders ─────────────────────────────────────────────────

const DEFAULT_HEADERS = { "Content-Type": "application/json" };

const headerCases: [string, unknown, Record<string, string>][] = [
  // Non-object inputs → default headers
  ["null returns defaults", null, DEFAULT_HEADERS],
  ["undefined returns defaults", undefined, DEFAULT_HEADERS],
  ["string returns defaults", "header", DEFAULT_HEADERS],
  ["number returns defaults", 42, DEFAULT_HEADERS],
  ["array returns defaults", [], DEFAULT_HEADERS],

  // Empty object → default headers
  ["empty object returns defaults", {}, DEFAULT_HEADERS],

  // Valid headers pass through
  [
    "simple valid header",
    { "X-Custom": "value" },
    { "X-Custom": "value" },
  ],
  [
    "multiple valid headers",
    { "Content-Type": "text/html", "X-Request-Id": "abc123" },
    { "Content-Type": "text/html", "X-Request-Id": "abc123" },
  ],

  // Blocked headers are removed
  [
    "set-cookie is blocked",
    { "Set-Cookie": "session=abc", "X-Ok": "yes" },
    { "X-Ok": "yes" },
  ],
  [
    "access-control-allow-origin is blocked",
    { "Access-Control-Allow-Origin": "*", "X-Ok": "yes" },
    { "X-Ok": "yes" },
  ],
  [
    "access-control-allow-credentials is blocked",
    { "Access-Control-Allow-Credentials": "true", "X-Ok": "yes" },
    { "X-Ok": "yes" },
  ],
  [
    "all blocked headers removed → default headers",
    { "Set-Cookie": "x", "Access-Control-Allow-Origin": "*" },
    DEFAULT_HEADERS,
  ],

  // Unsafe header names are removed
  [
    "header with spaces is removed",
    { "Bad Header": "value", "Good-Header": "ok" },
    { "Good-Header": "ok" },
  ],
  [
    "header with special chars is removed",
    { "X-Header!": "value", "X-Valid": "ok" },
    { "X-Valid": "ok" },
  ],

  // Non-string values are removed
  [
    "numeric value is removed",
    { "X-Num": 123, "X-Str": "ok" },
    { "X-Str": "ok" },
  ],
  [
    "boolean value is removed",
    { "X-Bool": true, "X-Str": "ok" },
    { "X-Str": "ok" },
  ],

  // CRLF injection prevention
  [
    "CRLF in value is stripped",
    { "X-Injected": "value\r\nEvil: header" },
    { "X-Injected": "valueEvil: header" },
  ],
  [
    "newline in value is stripped",
    { "X-Newline": "line1\nline2" },
    { "X-Newline": "line1line2" },
  ],
  [
    "carriage return in value is stripped",
    { "X-CR": "before\rafter" },
    { "X-CR": "beforeafter" },
  ],
];

for (const [label, input, expected] of headerCases) {
  Deno.test(`sanitizeHeaders: ${label}`, () => {
    assertEquals(sanitizeHeaders(input), expected);
  });
}

// ── isHeaderBlocked ─────────────────────────────────────────────────

const blockedCases: [string, string, boolean][] = [
  ["set-cookie lowercase", "set-cookie", true],
  ["Set-Cookie mixed case", "Set-Cookie", true],
  ["SET-COOKIE uppercase", "SET-COOKIE", true],
  ["access-control-allow-origin", "access-control-allow-origin", true],
  ["Access-Control-Allow-Credentials", "Access-Control-Allow-Credentials", true],
  ["content-type is not blocked", "content-type", false],
  ["x-custom is not blocked", "x-custom", false],
  ["authorization is not blocked", "authorization", false],
];

for (const [label, input, expected] of blockedCases) {
  Deno.test(`isHeaderBlocked: ${label}`, () => {
    assertEquals(isHeaderBlocked(input), expected);
  });
}

// ── isHeaderNameSafe ────────────────────────────────────────────────

const safeNameCases: [string, string, boolean][] = [
  ["alphanumeric", "ContentType", true],
  ["with hyphens", "X-Request-Id", true],
  ["single char", "X", true],
  ["numeric", "123", true],
  ["with spaces", "Bad Header", false],
  ["with underscore", "X_Header", false],
  ["with dot", "X.Header", false],
  ["with colon", "X:Header", false],
  ["with newline", "X\nHeader", false],
  ["empty string", "", false],
];

for (const [label, input, expected] of safeNameCases) {
  Deno.test(`isHeaderNameSafe: ${label}`, () => {
    assertEquals(isHeaderNameSafe(input), expected);
  });
}
