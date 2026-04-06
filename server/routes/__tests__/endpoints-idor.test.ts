/**
 * Tests for IDOR protection on execution delete.
 *
 * Imports the real isExecutionOwned function — no logic duplication.
 */

import { assertEquals } from "@std/assert";
import { isExecutionOwned } from "../../utils/ownership.ts";

// ── Happy path ────────────────────────────────────────────────────────

Deno.test("allows delete when execution belongs to endpoint and user", () => {
  const exec = { id: "exec-1", endpointId: "ep-1", userId: "user-A" };
  assertEquals(isExecutionOwned(exec, "ep-1", "user-A"), true);
});

// ── IDOR attack vectors ──────────────────────────────────────────────

Deno.test("BLOCKS delete when execution belongs to different user", () => {
  const exec = { id: "exec-victim", endpointId: "ep-victim", userId: "victim-user" };
  assertEquals(isExecutionOwned(exec, "ep-attacker", "attacker-user"), false);
});

Deno.test("BLOCKS delete when execution belongs to different endpoint (same user)", () => {
  const exec = { id: "exec-1", endpointId: "ep-other", userId: "user-A" };
  assertEquals(isExecutionOwned(exec, "ep-1", "user-A"), false);
});

Deno.test("BLOCKS delete when execution belongs to right endpoint but wrong user", () => {
  const exec = { id: "exec-1", endpointId: "ep-1", userId: "victim-user" };
  assertEquals(isExecutionOwned(exec, "ep-1", "attacker-user"), false);
});

Deno.test("BLOCKS delete when execution does not exist (null)", () => {
  assertEquals(isExecutionOwned(null, "ep-1", "user-A"), false);
});
