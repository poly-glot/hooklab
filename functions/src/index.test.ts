import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApp, deleteApp } from "firebase-admin/app";
import functionsTest from "firebase-functions-test";

// Initialize firebase-functions-test in offline mode
const test = functionsTest();

// Use `any` for wrapped callable functions to avoid complex generic type issues
// with firebase-functions-test v2 callable wrappers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let seedGuestData: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recordExecution: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clearExecutions: any;

describe("Firebase Cloud Functions", () => {
  beforeAll(async () => {
    // Import functions after test env is initialized
    const fns = await import("./index.js");
    seedGuestData = test.wrap(fns.seedGuestData);
    recordExecution = test.wrap(fns.recordExecution);
    clearExecutions = test.wrap(fns.clearExecutions);
  });

  afterAll(async () => {
    test.cleanup();
    try {
      const app = getApp();
      await deleteApp(app);
    } catch {
      // App may not exist, ignore
    }
  });

  // ── seedGuestData ─────────────────────────────────────────────────
  describe("seedGuestData", () => {
    it("Should throw when user is not authenticated", async () => {
      await expect(
        seedGuestData({ auth: null, data: {} })
      ).rejects.toThrow();
    });

    it("Should create demo endpoints for authenticated user", async () => {
      const result = await seedGuestData({
        auth: { uid: "guest-test-user" },
        data: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("Should not re-seed for already-seeded user", async () => {
      // First call already seeded; second call should return "Already seeded"
      const result = await seedGuestData({
        auth: { uid: "guest-test-user" },
        data: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: "Already seeded",
        })
      );
    });
  });

  // ── recordExecution ───────────────────────────────────────────────
  describe("recordExecution", () => {
    const testUserId = "exec-test-user";
    const testEndpointId = "exec-test-endpoint";

    beforeEach(async () => {
      const firestore = getFirestore();

      // Set up a user document
      await firestore.collection("users").doc(testUserId).set({
        email: "test@example.com",
        isAnonymous: false,
        endpointCount: 1,
        quotas: {
          maxExecutionsPerDay: 10000,
          usedExecutionsToday: 0,
        },
        createdAt: Timestamp.now(),
      });

      // Set up an endpoint
      await firestore.collection("endpoints").doc(testEndpointId).set({
        name: "Test Endpoint",
        userId: testUserId,
        script: "return { status: 200 };",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        totalExecutions: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });

    it("Should throw when user is not authenticated", async () => {
      await expect(
        recordExecution({
          auth: null,
          data: { endpointId: testEndpointId, execution: {} },
        })
      ).rejects.toThrow();
    });

    it("Should throw when endpointId is missing", async () => {
      await expect(
        recordExecution({
          auth: { uid: testUserId },
          data: { execution: {} },
        })
      ).rejects.toThrow();
    });

    it("Should throw when endpoint does not belong to user", async () => {
      await expect(
        recordExecution({
          auth: { uid: "wrong-user" },
          data: {
            endpointId: testEndpointId,
            execution: { method: "POST", url: "/w/test" },
          },
        })
      ).rejects.toThrow();
    });

    it("Should record execution for valid request", async () => {
      const result = await recordExecution({
        auth: { uid: testUserId },
        data: {
          endpointId: testEndpointId,
          execution: {
            method: "POST",
            url: `/w/${testEndpointId}`,
            headers: { "content-type": "application/json" },
            body: '{"test": true}',
            responseStatus: 200,
            responseBody: '{"ok": true}',
          },
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          executionId: expect.any(String),
        })
      );
    });
  });

  // ── clearExecutions ───────────────────────────────────────────────
  describe("clearExecutions", () => {
    const testUserId = "clear-test-user";
    const testEndpointId = "clear-test-endpoint";

    beforeEach(async () => {
      const firestore = getFirestore();

      // Set up user
      await firestore.collection("users").doc(testUserId).set({
        email: "clear@example.com",
        isAnonymous: false,
        endpointCount: 1,
        createdAt: Timestamp.now(),
      });

      // Set up endpoint
      await firestore.collection("endpoints").doc(testEndpointId).set({
        name: "Clear Test",
        userId: testUserId,
        script: "",
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        totalExecutions: 3,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Add some executions
      for (let i = 0; i < 3; i++) {
        await firestore.collection("executions").add({
          endpointId: testEndpointId,
          userId: testUserId,
          method: "POST",
          url: `/w/${testEndpointId}`,
          timestamp: Timestamp.now(),
        });
      }
    });

    it("Should throw when user is not authenticated", async () => {
      await expect(
        clearExecutions({
          auth: null,
          data: { endpointId: testEndpointId },
        })
      ).rejects.toThrow();
    });

    it("Should throw when endpointId is missing", async () => {
      await expect(
        clearExecutions({
          auth: { uid: testUserId },
          data: {},
        })
      ).rejects.toThrow();
    });

    it("Should throw when endpoint does not belong to user", async () => {
      await expect(
        clearExecutions({
          auth: { uid: "wrong-user" },
          data: { endpointId: testEndpointId },
        })
      ).rejects.toThrow();
    });

    it("Should clear all executions for the endpoint", async () => {
      const result = await clearExecutions({
        auth: { uid: testUserId },
        data: { endpointId: testEndpointId },
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          deleted: 3,
        })
      );

      // Verify executions are deleted
      const firestore = getFirestore();
      const remaining = await firestore
        .collection("executions")
        .where("endpointId", "==", testEndpointId)
        .get();
      expect(remaining.size).toBe(0);

      // Verify totalExecutions is reset
      const endpointSnap = await firestore
        .collection("endpoints")
        .doc(testEndpointId)
        .get();
      expect(endpointSnap.data()?.totalExecutions).toBe(0);
    });
  });
});
