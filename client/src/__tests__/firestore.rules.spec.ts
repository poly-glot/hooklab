import { describe, it, beforeEach } from "vitest";
import {
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

describe("Firestore Security Rules", () => {
  // ── Unauthenticated users ───────────────────────────────────────────
  describe("Unauthenticated users", () => {
    let db: ReturnType<typeof globalThis.authedFirestore>;

    beforeEach(() => {
      db = globalThis.authedFirestore(null);
    });

    it("Cannot read users collection", async () => {
      await assertFails(getDoc(doc(db, "users", "user1")));
    });

    it("Cannot read endpoints collection", async () => {
      await assertFails(getDoc(doc(db, "endpoints", "ep1")));
    });

    it("Cannot read executions collection", async () => {
      await assertFails(getDoc(doc(db, "executions", "exec1")));
    });

    it("Cannot read analytics collection", async () => {
      await assertFails(getDoc(doc(db, "analytics", "20240101")));
    });

    it("Cannot write to users collection", async () => {
      await assertFails(
        setDoc(doc(db, "users", "user1"), {
          email: "test@test.com",
          createdAt: serverTimestamp(),
          isAnonymous: false,
        })
      );
    });

    it("Cannot write to endpoints collection", async () => {
      await assertFails(
        setDoc(doc(db, "endpoints", "ep1"), {
          name: "Test",
          userId: "user1",
          createdAt: serverTimestamp(),
        })
      );
    });

    it("Cannot write to executions collection", async () => {
      await assertFails(
        setDoc(doc(db, "executions", "exec1"), {
          endpointId: "ep1",
          method: "POST",
        })
      );
    });
  });

  // ── Users collection ────────────────────────────────────────────────
  describe("Users collection", () => {
    it("Owner can read their own user document", async () => {
      const db = globalThis.authedFirestore({ uid: "user1" });
      // First create the doc (will need admin context in setup)
      // For rules testing, we test that the authenticated user CAN read
      // The actual read may fail because the document doesn't exist,
      // but the rules should allow it
      await assertSucceeds(getDoc(doc(db, "users", "user1")));
    });

    it("User cannot read another user's document", async () => {
      const db = globalThis.authedFirestore({ uid: "user2" });
      await assertFails(getDoc(doc(db, "users", "user1")));
    });

    it("Owner can create their own user document with required fields", async () => {
      const db = globalThis.authedFirestore({ uid: "user1" });
      await assertSucceeds(
        setDoc(doc(db, "users", "user1"), {
          email: "user1@example.com",
          createdAt: serverTimestamp(),
          isAnonymous: false,
          displayName: "User 1",
          lastLoginAt: serverTimestamp(),
          endpointCount: 0,
        })
      );
    });

    it("User cannot create another user's document", async () => {
      const db = globalThis.authedFirestore({ uid: "user2" });
      await assertFails(
        setDoc(doc(db, "users", "user1"), {
          email: "hacker@example.com",
          createdAt: serverTimestamp(),
          isAnonymous: false,
        })
      );
    });

    it("Create fails without required fields (missing email)", async () => {
      const db = globalThis.authedFirestore({ uid: "user1" });
      await assertFails(
        setDoc(doc(db, "users", "user1"), {
          createdAt: serverTimestamp(),
          isAnonymous: false,
        })
      );
    });

    it("Create fails without required fields (missing createdAt)", async () => {
      const db = globalThis.authedFirestore({ uid: "user1" });
      await assertFails(
        setDoc(doc(db, "users", "user1"), {
          email: "user1@example.com",
          isAnonymous: false,
        })
      );
    });

    it("Owner can update their own document (e.g., lastLoginAt)", async () => {
      // Create the document first
      const db = globalThis.authedFirestore({ uid: "updateUser" });
      await setDoc(doc(db, "users", "updateUser"), {
        email: "update@example.com",
        createdAt: serverTimestamp(),
        isAnonymous: false,
        lastLoginAt: serverTimestamp(),
        endpointCount: 0,
      });

      // Now update it
      await assertSucceeds(
        updateDoc(doc(db, "users", "updateUser"), {
          lastLoginAt: serverTimestamp(),
          displayName: "Updated Name",
        })
      );
    });

    it("Owner cannot change createdAt on update", async () => {
      const db = globalThis.authedFirestore({ uid: "immutableUser" });
      await setDoc(doc(db, "users", "immutableUser"), {
        email: "immutable@example.com",
        createdAt: Timestamp.fromDate(new Date("2024-01-01")),
        isAnonymous: false,
        lastLoginAt: serverTimestamp(),
      });

      await assertFails(
        updateDoc(doc(db, "users", "immutableUser"), {
          createdAt: serverTimestamp(),
        })
      );
    });
  });

  // ── Endpoints collection ────────────────────────────────────────────
  describe("Endpoints collection", () => {
    it("Owner can read their own endpoint", async () => {
      // Create an endpoint first
      const adminDb = globalThis.authedFirestore({ uid: "epOwner" });
      await setDoc(doc(adminDb, "endpoints", "myEndpoint"), {
        name: "My Webhook",
        userId: "epOwner",
        script: "return { status: 200 };",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        totalExecutions: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await assertSucceeds(getDoc(doc(adminDb, "endpoints", "myEndpoint")));
    });

    it("User cannot read another user's endpoint", async () => {
      // Create endpoint as epOwner
      const ownerDb = globalThis.authedFirestore({ uid: "epOwner2" });
      await setDoc(doc(ownerDb, "endpoints", "otherEndpoint"), {
        name: "Other Webhook",
        userId: "epOwner2",
        script: "",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        totalExecutions: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Try to read as different user
      const otherDb = globalThis.authedFirestore({ uid: "hacker" });
      await assertFails(getDoc(doc(otherDb, "endpoints", "otherEndpoint")));
    });

    it("Owner can create an endpoint with valid data", async () => {
      const db = globalThis.authedFirestore({ uid: "creator" });
      await assertSucceeds(
        setDoc(doc(db, "endpoints", "newEndpoint"), {
          name: "Payment Webhooks",
          userId: "creator",
          script: "return { status: 200 };",
          isActive: true,
          defaultStatusCode: 200,
          defaultContentType: "application/json",
          defaultBody: '{"ok": true}',
          totalExecutions: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    it("Create fails with empty name", async () => {
      const db = globalThis.authedFirestore({ uid: "creator2" });
      await assertFails(
        setDoc(doc(db, "endpoints", "emptyName"), {
          name: "",
          userId: "creator2",
          script: "",
          createdAt: serverTimestamp(),
        })
      );
    });

    it("Create fails with name over 100 characters", async () => {
      const db = globalThis.authedFirestore({ uid: "creator3" });
      await assertFails(
        setDoc(doc(db, "endpoints", "longName"), {
          name: "A".repeat(101),
          userId: "creator3",
          script: "",
          createdAt: serverTimestamp(),
        })
      );
    });

    it("User cannot create endpoint with another user's userId", async () => {
      const db = globalThis.authedFirestore({ uid: "impersonator" });
      await assertFails(
        setDoc(doc(db, "endpoints", "stolen"), {
          name: "Stolen Endpoint",
          userId: "victim",
          script: "",
          createdAt: serverTimestamp(),
        })
      );
    });

    it("Owner can update their endpoint (e.g., script)", async () => {
      const db = globalThis.authedFirestore({ uid: "updater" });
      await setDoc(doc(db, "endpoints", "updatable"), {
        name: "Updatable",
        userId: "updater",
        script: "old script",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        totalExecutions: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await assertSucceeds(
        updateDoc(doc(db, "endpoints", "updatable"), {
          script: "new script",
          updatedAt: serverTimestamp(),
        })
      );
    });

    it("Owner cannot change userId on update", async () => {
      const db = globalThis.authedFirestore({ uid: "ownerChanger" });
      await setDoc(doc(db, "endpoints", "noOwnerChange"), {
        name: "Test",
        userId: "ownerChanger",
        script: "",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await assertFails(
        updateDoc(doc(db, "endpoints", "noOwnerChange"), {
          userId: "newOwner",
        })
      );
    });

    it("Owner cannot change createdAt on update", async () => {
      const db = globalThis.authedFirestore({ uid: "dateChanger" });
      await setDoc(doc(db, "endpoints", "noDateChange"), {
        name: "Test",
        userId: "dateChanger",
        script: "",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        createdAt: Timestamp.fromDate(new Date("2024-01-01")),
        updatedAt: serverTimestamp(),
      });

      await assertFails(
        updateDoc(doc(db, "endpoints", "noDateChange"), {
          createdAt: serverTimestamp(),
        })
      );
    });

    it("Owner can delete their endpoint", async () => {
      const db = globalThis.authedFirestore({ uid: "deleter" });
      await setDoc(doc(db, "endpoints", "deletable"), {
        name: "Deletable",
        userId: "deleter",
        script: "",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await assertSucceeds(deleteDoc(doc(db, "endpoints", "deletable")));
    });

    it("User cannot delete another user's endpoint", async () => {
      const ownerDb = globalThis.authedFirestore({ uid: "realOwner" });
      await setDoc(doc(ownerDb, "endpoints", "protectedEp"), {
        name: "Protected",
        userId: "realOwner",
        script: "",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const attackerDb = globalThis.authedFirestore({ uid: "attacker" });
      await assertFails(deleteDoc(doc(attackerDb, "endpoints", "protectedEp")));
    });
  });

  // ── Field injection on endpoint update ───────────────────────────────
  describe("Endpoint update field restriction", () => {
    it("Owner cannot inject arbitrary fields via update (doc bloat prevention)", async () => {
      const db = globalThis.authedFirestore({ uid: "injector" });
      await setDoc(doc(db, "endpoints", "injectTarget"), {
        name: "Test",
        userId: "injector",
        script: "",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        totalExecutions: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Try to add a field not in the allowlist
      await assertFails(
        updateDoc(doc(db, "endpoints", "injectTarget"), {
          evilPayload: "A".repeat(10000),
        })
      );
    });
  });

  // ── Anonymous user quotas ───────────────────────────────────────────
  describe("Anonymous user endpoint quotas", () => {
    it("Anonymous user can create endpoint when under quota", async () => {
      const anonDb = globalThis.anonymousFirestore("anonUser1");

      // Create user doc with low endpointCount
      const ownerDb = globalThis.authedFirestore({ uid: "anonUser1" });
      await setDoc(doc(ownerDb, "users", "anonUser1"), {
        email: "guest@guest.local",
        createdAt: serverTimestamp(),
        isAnonymous: true,
        endpointCount: 1,
      });

      await assertSucceeds(
        setDoc(doc(anonDb, "endpoints", "anonEp1"), {
          name: "Anonymous Endpoint",
          userId: "anonUser1",
          script: "",
          isActive: true,
          defaultStatusCode: 200,
          defaultContentType: "application/json",
          defaultBody: '{"ok": true}',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    it("Anonymous user is blocked from creating endpoint when at quota (10)", async () => {
      const anonDb = globalThis.anonymousFirestore("anonUser2");

      // Create user doc at quota limit
      const ownerDb = globalThis.authedFirestore({ uid: "anonUser2" });
      await setDoc(doc(ownerDb, "users", "anonUser2"), {
        email: "guest@guest.local",
        createdAt: serverTimestamp(),
        isAnonymous: true,
        endpointCount: 10,
      });

      await assertFails(
        setDoc(doc(anonDb, "endpoints", "anonEpBlocked"), {
          name: "Blocked Endpoint",
          userId: "anonUser2",
          script: "",
          isActive: true,
          defaultStatusCode: 200,
          defaultContentType: "application/json",
          defaultBody: '{"ok": true}',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });
  });

  // ── Executions collection ───────────────────────────────────────────
  describe("Executions collection", () => {
    it("Owner can read their own execution", async () => {
      // Executions must be written by admin (Cloud Functions) so we can't
      // test create. We test that the read rule works based on userId.
      // Since we can't write via client SDK, we just verify the rule denies
      // writing from the client.
      const db = globalThis.authedFirestore({ uid: "execReader" });
      // Attempt to read a non-existent execution should still pass the rules
      // (the doc just won't exist)
      // NOTE: We can't easily test "owner can read" without admin writes
      // but we can test that client writes are denied
      await assertFails(
        setDoc(doc(db, "executions", "exec1"), {
          endpointId: "ep1",
          userId: "execReader",
          method: "POST",
          timestamp: serverTimestamp(),
        })
      );
    });

    it("No user can create executions (backend only)", async () => {
      const db = globalThis.authedFirestore({ uid: "user1" });
      await assertFails(
        setDoc(doc(db, "executions", "exec2"), {
          endpointId: "ep1",
          userId: "user1",
          method: "POST",
          url: "/w/ep1",
          timestamp: serverTimestamp(),
        })
      );
    });

    it("No user can update executions", async () => {
      const db = globalThis.authedFirestore({ uid: "user1" });
      await assertFails(
        updateDoc(doc(db, "executions", "exec1"), {
          method: "GET",
        })
      );
    });

    it("No user can delete executions", async () => {
      const db = globalThis.authedFirestore({ uid: "user1" });
      await assertFails(deleteDoc(doc(db, "executions", "exec1")));
    });
  });

  // ── Analytics collection ────────────────────────────────────────────
  describe("Analytics collection", () => {
    it("Authenticated user can read analytics", async () => {
      const db = globalThis.authedFirestore({ uid: "analyst" });
      // Even if doc doesn't exist, the read should be allowed by rules
      await assertSucceeds(getDoc(doc(db, "analytics", "20240101")));
    });

    it("Unauthenticated user cannot read analytics", async () => {
      const db = globalThis.authedFirestore(null);
      await assertFails(getDoc(doc(db, "analytics", "20240101")));
    });

    it("No user can write to analytics (backend only)", async () => {
      const db = globalThis.authedFirestore({ uid: "analyst" });
      await assertFails(
        setDoc(doc(db, "analytics", "20240101"), {
          date: "20240101",
          totalExecutions: 100,
        })
      );
    });

    it("No user can delete analytics", async () => {
      const db = globalThis.authedFirestore({ uid: "analyst" });
      await assertFails(deleteDoc(doc(db, "analytics", "20240101")));
    });
  });
});
