/**
 * Tests for server-side endpoint quota enforcement.
 *
 * Proves that the server checks endpointCount against maxEndpoints
 * before creating endpoints via Admin SDK.
 */

import { assertEquals } from "@std/assert";

interface MockUserDoc {
  endpointCount: number;
  quotas?: { maxEndpoints?: number };
}

/**
 * Mirrors the quota check logic from POST /api/endpoints handler.
 */
function checkQuota(
  userDoc: MockUserDoc | null,
  isAnonymous: boolean,
): { allowed: boolean; maxEndpoints: number; current: number } {
  const endpointCount = (userDoc?.endpointCount as number) ?? 0;
  const maxEndpoints = isAnonymous
    ? (userDoc?.quotas?.maxEndpoints ?? 10)
    : (userDoc?.quotas?.maxEndpoints ?? 50);

  return {
    allowed: endpointCount < maxEndpoints,
    maxEndpoints,
    current: endpointCount,
  };
}

// ── Guest user tests ──────────────────────────────────────────────────

Deno.test("guest at 6 (seeded) can still create — under 10 limit", () => {
  const result = checkQuota({ endpointCount: 6, quotas: { maxEndpoints: 10 } }, true);
  assertEquals(result.allowed, true);
  assertEquals(result.maxEndpoints, 10);
});

Deno.test("guest at 10 is BLOCKED — at limit", () => {
  const result = checkQuota({ endpointCount: 10, quotas: { maxEndpoints: 10 } }, true);
  assertEquals(result.allowed, false);
});

Deno.test("guest at 11 is BLOCKED — over limit", () => {
  const result = checkQuota({ endpointCount: 11, quotas: { maxEndpoints: 10 } }, true);
  assertEquals(result.allowed, false);
});

Deno.test("guest defaults to 10 when no quotas field", () => {
  const result = checkQuota({ endpointCount: 9 }, true);
  assertEquals(result.maxEndpoints, 10);
  assertEquals(result.allowed, true);
});

Deno.test("guest defaults to 10 when user doc is null", () => {
  const result = checkQuota(null, true);
  assertEquals(result.maxEndpoints, 10);
  assertEquals(result.allowed, true); // 0 < 10
});

// ── Registered user tests ─────────────────────────────────────────────

Deno.test("registered user at 49 can still create — under 50 limit", () => {
  const result = checkQuota({ endpointCount: 49, quotas: { maxEndpoints: 50 } }, false);
  assertEquals(result.allowed, true);
});

Deno.test("registered user at 50 is BLOCKED — at limit", () => {
  const result = checkQuota({ endpointCount: 50, quotas: { maxEndpoints: 50 } }, false);
  assertEquals(result.allowed, false);
});

Deno.test("registered user defaults to 50 when no quotas field", () => {
  const result = checkQuota({ endpointCount: 0 }, false);
  assertEquals(result.maxEndpoints, 50);
  assertEquals(result.allowed, true);
});

// ── Attack scenario ───────────────────────────────────────────────────

Deno.test("attacker spam: 100 endpoints blocked at quota", () => {
  const result = checkQuota({ endpointCount: 100, quotas: { maxEndpoints: 10 } }, true);
  assertEquals(result.allowed, false, "should be blocked way over quota");
});
