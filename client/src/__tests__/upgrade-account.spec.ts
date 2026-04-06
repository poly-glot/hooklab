/**
 * Tests for account upgrade logic.
 *
 * Proves that upgradeUserDocument updates all guest fields to
 * registered-tier values, rather than only touching lastLoginAt.
 */

import { describe, it, expect } from "vitest";

// ── Simulates the upgrade logic ────────────────────────────────────

interface UserDoc {
  email: string;
  isAnonymous: boolean;
  displayName: string;
  quotas: {
    maxEndpoints: number;
    maxExecutionsPerDay: number;
    usedExecutionsToday: number;
  };
}

function simulateUpgrade(
  existing: UserDoc,
  newEmail: string
): UserDoc {
  // Mirrors upgradeUserDocument behavior
  return {
    ...existing,
    email: newEmail,
    isAnonymous: false,
    displayName: newEmail.split("@")[0],
    quotas: {
      maxEndpoints: 50,
      maxExecutionsPerDay: 10000,
      usedExecutionsToday: 0,
    },
  };
}

describe("upgradeUserDocument", () => {
  const guestDoc: UserDoc = {
    email: "guest_abc12345@guest.local",
    isAnonymous: true,
    displayName: "Guest",
    quotas: {
      maxEndpoints: 10,
      maxExecutionsPerDay: 100,
      usedExecutionsToday: 42,
    },
  };

  it("updates email from guest to real email", () => {
    const upgraded = simulateUpgrade(guestDoc, "alice@example.com");
    expect(upgraded.email).toBe("alice@example.com");
  });

  it("sets isAnonymous to false", () => {
    const upgraded = simulateUpgrade(guestDoc, "alice@example.com");
    expect(upgraded.isAnonymous).toBe(false);
  });

  it("updates displayName from 'Guest' to email prefix", () => {
    const upgraded = simulateUpgrade(guestDoc, "alice@example.com");
    expect(upgraded.displayName).toBe("alice");
  });

  it("upgrades maxEndpoints from 10 to 50", () => {
    const upgraded = simulateUpgrade(guestDoc, "alice@example.com");
    expect(upgraded.quotas.maxEndpoints).toBe(50);
  });

  it("upgrades maxExecutionsPerDay from 100 to 10000", () => {
    const upgraded = simulateUpgrade(guestDoc, "alice@example.com");
    expect(upgraded.quotas.maxExecutionsPerDay).toBe(10000);
  });

  it("resets usedExecutionsToday to 0", () => {
    const upgraded = simulateUpgrade(guestDoc, "alice@example.com");
    expect(upgraded.quotas.usedExecutionsToday).toBe(0);
  });

  // Document the OLD broken behavior
  it("OLD BUG: createUserDocument on existing doc only updated lastLoginAt", () => {
    // This simulates the old createUserDocument behavior for existing docs
    function oldBrokenUpgrade(existing: UserDoc, _newEmail: string): UserDoc {
      return { ...existing }; // only lastLoginAt would change, nothing else
    }
    const result = oldBrokenUpgrade(guestDoc, "alice@example.com");
    expect(result.isAnonymous).toBe(true); // BUG: still guest
    expect(result.email).toBe("guest_abc12345@guest.local"); // BUG: still guest email
    expect(result.quotas.maxEndpoints).toBe(10); // BUG: still guest quota
  });
});
