/**
 * Tests for server-side endpoint quota enforcement.
 *
 * Imports the real checkEndpointQuota function — no logic duplication.
 */

import { assertEquals } from "@std/assert";
import { checkEndpointQuota } from "../../utils/quota.ts";

// ── Guest user tests ──────────────────────────────────────────────────

Deno.test("guest at 6 (seeded) can still create — under 10 limit", () => {
  const result = checkEndpointQuota(6, 10, true);
  assertEquals(result.allowed, true);
  assertEquals(result.maxEndpoints, 10);
});

Deno.test("guest at 10 is BLOCKED — at limit", () => {
  const result = checkEndpointQuota(10, 10, true);
  assertEquals(result.allowed, false);
});

Deno.test("guest at 11 is BLOCKED — over limit", () => {
  const result = checkEndpointQuota(11, 10, true);
  assertEquals(result.allowed, false);
});

Deno.test("guest defaults to 10 when maxEndpoints is undefined", () => {
  const result = checkEndpointQuota(9, undefined, true);
  assertEquals(result.maxEndpoints, 10);
  assertEquals(result.allowed, true);
});

Deno.test("guest defaults to 10 when endpointCount is undefined", () => {
  const result = checkEndpointQuota(undefined, undefined, true);
  assertEquals(result.maxEndpoints, 10);
  assertEquals(result.allowed, true); // 0 < 10
});

// ── Registered user tests ─────────────────────────────────────────────

Deno.test("registered user at 49 can still create — under 50 limit", () => {
  const result = checkEndpointQuota(49, 50, false);
  assertEquals(result.allowed, true);
});

Deno.test("registered user at 50 is BLOCKED — at limit", () => {
  const result = checkEndpointQuota(50, 50, false);
  assertEquals(result.allowed, false);
});

Deno.test("registered user defaults to 50 when no quotas field", () => {
  const result = checkEndpointQuota(0, undefined, false);
  assertEquals(result.maxEndpoints, 50);
  assertEquals(result.allowed, true);
});

// ── Attack scenario ───────────────────────────────────────────────────

Deno.test("attacker spam: 100 endpoints blocked at quota", () => {
  const result = checkEndpointQuota(100, 10, true);
  assertEquals(result.allowed, false, "should be blocked way over quota");
});
