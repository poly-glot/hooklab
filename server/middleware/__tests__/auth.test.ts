/**
 * Tests for Firebase ID token verification.
 *
 * Tests the exported verifyFirebaseToken function in emulator mode
 * (FIREBASE_AUTH_EMULATOR_HOST is set in the test environment).
 *
 * Table-driven: each case is [label, token, expectedResult].
 */

import { assertEquals } from "@std/assert";
import { verifyFirebaseToken } from "../auth.ts";

// ── Helpers ─────────────────────────────────────────────────────────

/** Base64url-encode a string (no padding). */
function b64url(str: string): string {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Build a minimal JWT with the given header and payload objects. */
// deno-lint-ignore no-explicit-any
function makeToken(header: Record<string, any>, payload: Record<string, any>): string {
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.fakesig`;
}

const EMULATOR_HEADER = { alg: "none" };
const NOW = Math.floor(Date.now() / 1000);

function validPayload(overrides = {}): Record<string, unknown> {
  return {
    sub: "user123",
    email: "test@example.com",
    iss: "https://securetoken.google.com/demo-webhook",
    aud: "demo-webhook",
    iat: NOW,
    exp: NOW + 3600,
    auth_time: NOW,
    firebase: { sign_in_provider: "password", identities: {} },
    ...overrides,
  };
}

// ── Token structure tests ───────────────────────────────────────────

const structureCases: [string, string, boolean][] = [
  // [label, token, expectPayload]
  ["valid 3-part token", makeToken(EMULATOR_HEADER, validPayload()), true],
  ["empty string", "", false],
  ["single segment", "abc", false],
  ["two segments", "abc.def", false],
  ["four segments", "a.b.c.d", false],
  ["garbage base64", "!!!.@@@.###", false],
];

for (const [label, token, expectPayload] of structureCases) {
  Deno.test(`verifyFirebaseToken structure: ${label}`, async () => {
    const result = await verifyFirebaseToken(token);
    if (expectPayload) {
      assertEquals(result !== null, true, "expected non-null payload");
    } else {
      assertEquals(result, null, "expected null for invalid token");
    }
  });
}

// ── Emulator mode payload validation ────────────────────────────────

const emulatorCases: [string, Record<string, unknown>, boolean][] = [
  // [label, payloadOverrides, expectValid]
  ["valid payload", {}, true],
  ["with anonymous provider", { firebase: { sign_in_provider: "anonymous", identities: {} } }, true],
  ["missing sub", { sub: "" }, false],
  ["sub is undefined", { sub: undefined }, false],
  ["sub is null", { sub: null }, false],
  ["numeric sub (truthy)", { sub: 123 }, true], // emulator only checks truthiness
  ["minimal payload (sub only)", { sub: "uid", email: undefined, firebase: undefined }, true],
];

for (const [label, overrides, expectValid] of emulatorCases) {
  Deno.test(`verifyFirebaseToken emulator: ${label}`, async () => {
    const token = makeToken(EMULATOR_HEADER, validPayload(overrides));
    const result = await verifyFirebaseToken(token);
    if (expectValid) {
      assertEquals(result !== null, true, "expected valid payload");
      assertEquals(result!.sub, validPayload(overrides).sub);
    } else {
      assertEquals(result, null, "expected null for invalid payload");
    }
  });
}

// ── Payload field extraction ────────────────────────────────────────

Deno.test("verifyFirebaseToken emulator: extracts all standard fields", async () => {
  const payload = validPayload({
    email: "user@test.com",
    email_verified: true,
    name: "Test User",
  });
  const token = makeToken(EMULATOR_HEADER, payload);
  const result = await verifyFirebaseToken(token);

  assertEquals(result !== null, true);
  assertEquals(result!.sub, "user123");
  assertEquals(result!.email, "user@test.com");
  assertEquals(result!.email_verified, true);
  assertEquals(result!.name, "Test User");
  assertEquals(result!.iss, "https://securetoken.google.com/demo-webhook");
  assertEquals(result!.aud, "demo-webhook");
  assertEquals(result!.firebase.sign_in_provider, "password");
});
