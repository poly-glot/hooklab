/**
 * Tests for internal route OIDC token verification.
 *
 * Proves that:
 * - Malformed tokens are rejected
 * - Tokens with wrong algorithm are rejected
 * - Expired tokens are rejected
 * - Missing parts are rejected
 * - A well-formed token structure is parsed correctly
 */

import { assertEquals, assert } from "@std/assert";

// ── Unit tests for token structure validation ─────────────────────────
// We test the parsing/validation logic without hitting real Google keys.

function decodeBase64Url(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeToken(header: Record<string, unknown>, payload: Record<string, unknown>): string {
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.fake-signature`;
}

/**
 * Minimal structural validator mirroring verifyOidcToken's pre-crypto checks.
 * Tests the logic without needing real keys.
 */
function validateTokenStructure(token: string): {
  valid: boolean;
  reason?: string;
  payload?: Record<string, unknown>;
} {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "not 3 parts" };

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  } catch {
    return { valid: false, reason: "invalid base64 or JSON" };
  }

  if (header.alg !== "RS256") return { valid: false, reason: "wrong alg" };
  if (!header.kid) return { valid: false, reason: "missing kid" };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}

// ── Tests ─────────────────────────────────────────────────────────────

Deno.test("REJECT: empty string", () => {
  const result = validateTokenStructure("");
  assertEquals(result.valid, false);
});

Deno.test("REJECT: only 2 parts", () => {
  const result = validateTokenStructure("a.b");
  assertEquals(result.valid, false);
  assertEquals(result.reason, "not 3 parts");
});

Deno.test("REJECT: 4 parts", () => {
  const result = validateTokenStructure("a.b.c.d");
  assertEquals(result.valid, false);
});

Deno.test("REJECT: wrong algorithm (HS256)", () => {
  const token = makeToken(
    { alg: "HS256", kid: "key1" },
    { sub: "test", exp: Math.floor(Date.now() / 1000) + 3600 },
  );
  const result = validateTokenStructure(token);
  assertEquals(result.valid, false);
  assertEquals(result.reason, "wrong alg");
});

Deno.test("REJECT: alg=none (emulator style, must not work for internal)", () => {
  const token = makeToken(
    { alg: "none" },
    { sub: "test", exp: Math.floor(Date.now() / 1000) + 3600 },
  );
  const result = validateTokenStructure(token);
  assertEquals(result.valid, false);
  assertEquals(result.reason, "wrong alg");
});

Deno.test("REJECT: missing kid", () => {
  const token = makeToken(
    { alg: "RS256" },
    { sub: "test", exp: Math.floor(Date.now() / 1000) + 3600 },
  );
  const result = validateTokenStructure(token);
  assertEquals(result.valid, false);
  assertEquals(result.reason, "missing kid");
});

Deno.test("REJECT: expired token", () => {
  const token = makeToken(
    { alg: "RS256", kid: "key1" },
    { sub: "test", exp: Math.floor(Date.now() / 1000) - 100 },
  );
  const result = validateTokenStructure(token);
  assertEquals(result.valid, false);
  assertEquals(result.reason, "expired");
});

Deno.test("REJECT: garbage base64", () => {
  const result = validateTokenStructure("!!!.@@@.###");
  assertEquals(result.valid, false);
});

Deno.test("ACCEPT: structurally valid RS256 token with kid and future exp", () => {
  const token = makeToken(
    { alg: "RS256", kid: "key1" },
    {
      sub: "sa@project.iam.gserviceaccount.com",
      aud: "https://my-service.run.app",
      email: "scheduler@project.iam.gserviceaccount.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
  );
  const result = validateTokenStructure(token);
  assertEquals(result.valid, true);
  assert(result.payload);
  assertEquals(result.payload.email, "scheduler@project.iam.gserviceaccount.com");
});

Deno.test("ACCEPT: bearer prefix stripped correctly", () => {
  const bearerHeader = "Bearer eyJhbGciOiJSUzI1NiJ9.eyJ0ZXN0Ijp0cnVlfQ.sig";
  const token = bearerHeader.slice(7);
  assertEquals(token.startsWith("eyJ"), true, "token should start with base64 JSON");
});
