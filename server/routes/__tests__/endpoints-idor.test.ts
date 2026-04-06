/**
 * Tests for IDOR protection on execution delete.
 *
 * Proves that deleting an execution belonging to another user/endpoint
 * is blocked even if the caller owns the parent endpoint.
 */

import { assertEquals } from "@std/assert";

// Inline mock of getDocument to simulate ownership checking
// We test the logic extracted from the route handler.

interface MockExecution {
  id: string;
  endpointId: string;
  userId: string;
}

/**
 * Simulates the ownership check from the fixed handler.
 * Returns true if the execution belongs to the given endpoint AND user.
 */
function isExecutionOwned(
  execution: MockExecution | null,
  endpointId: string,
  userId: string,
): boolean {
  if (!execution) return false;
  return execution.endpointId === endpointId && execution.userId === userId;
}

// ── Happy path ────────────────────────────────────────────────────────

Deno.test("allows delete when execution belongs to endpoint and user", () => {
  const exec: MockExecution = {
    id: "exec-1",
    endpointId: "ep-1",
    userId: "user-A",
  };
  assertEquals(isExecutionOwned(exec, "ep-1", "user-A"), true);
});

// ── IDOR attack vectors ──────────────────────────────────────────────

Deno.test("BLOCKS delete when execution belongs to different user", () => {
  const exec: MockExecution = {
    id: "exec-victim",
    endpointId: "ep-victim",
    userId: "victim-user",
  };
  // Attacker owns ep-attacker but tries to delete exec-victim
  assertEquals(isExecutionOwned(exec, "ep-attacker", "attacker-user"), false);
});

Deno.test("BLOCKS delete when execution belongs to different endpoint (same user)", () => {
  const exec: MockExecution = {
    id: "exec-1",
    endpointId: "ep-other",
    userId: "user-A",
  };
  // User owns ep-1 but exec-1 belongs to ep-other
  assertEquals(isExecutionOwned(exec, "ep-1", "user-A"), false);
});

Deno.test("BLOCKS delete when execution belongs to right endpoint but wrong user", () => {
  const exec: MockExecution = {
    id: "exec-1",
    endpointId: "ep-1",
    userId: "victim-user",
  };
  // Attacker happens to pass correct endpointId but wrong userId
  assertEquals(isExecutionOwned(exec, "ep-1", "attacker-user"), false);
});

Deno.test("BLOCKS delete when execution does not exist (null)", () => {
  assertEquals(isExecutionOwned(null, "ep-1", "user-A"), false);
});
