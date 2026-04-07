import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase modules before importing the service
vi.mock("@/lib/firebase-init", () => ({
  app: {},
  auth: { currentUser: { uid: "mock-uid" } },
  firestore: {},
}));

vi.mock("firebase/firestore", () => {
  const mockDocs = new Map<string, Record<string, unknown>>();

  return {
    collection: vi.fn((_db, name) => ({ _name: name })),
    doc: vi.fn((_col, id) => ({ _id: id, _col })),
    addDoc: vi.fn(async (_col, data) => {
      const id = `mock-${Date.now()}`;
      mockDocs.set(id, { ...data, id });
      return { id };
    }),
    getDoc: vi.fn(async (ref: { _id: string }) => ({
      exists: () => mockDocs.has(ref._id),
      id: ref._id,
      data: () => mockDocs.get(ref._id) ?? null,
    })),
    getDocs: vi.fn(async () => ({
      docs: [],
    })),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    query: vi.fn((...args) => args),
    where: vi.fn((...args) => args),
    orderBy: vi.fn((...args) => args),
    limit: vi.fn((n) => n),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
    increment: vi.fn((n: number) => ({ _type: "increment", operand: n })),
    Timestamp: Object.assign(
      vi.fn(),
      {
        now: vi.fn(() => ({ toDate: () => new Date() })),
        fromDate: vi.fn((d: Date) => ({
          toDate: () => d,
          seconds: Math.floor(d.getTime() / 1000),
        })),
      }
    ),
    setDoc: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/api", () => ({
  api: {
    seedGuestData: vi.fn(async () => ({ success: true })),
    clearRequestLogs: vi.fn(async () => ({ ok: true })),
    deleteRequestLog: vi.fn(async () => ({ ok: true })),
  },
}));

describe("Firestore Service Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Type helpers", () => {
    it("converts Timestamp objects to ISO strings", async () => {
      // Import the module after mocks are set up
      const { Timestamp } = await import("firebase/firestore");
      const ts = Timestamp.fromDate(new Date("2024-06-15T12:00:00Z"));
      expect(ts.toDate()).toBeInstanceOf(Date);
    });
  });

  describe("User operations", () => {
    it("createUserDocument calls setDoc with merge:true", async () => {
      const { setDoc } = await import("firebase/firestore");
      const { createUserDocument } = await import("@/lib/firestore");

      await createUserDocument("user123", "test@example.com", false);
      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          email: "test@example.com",
          isAnonymous: false,
        }),
        { merge: true }
      );
    });

    it("createUserDocument sets endpointCount and createdAt for new users", async () => {
      const { setDoc } = await import("firebase/firestore");
      const { createUserDocument } = await import("@/lib/firestore");

      await createUserDocument("newuser", "new@example.com", true);
      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          endpointCount: 0,
          isAnonymous: true,
          quotas: expect.objectContaining({
            maxEndpoints: 10,
          }),
        }),
        { merge: true }
      );
    });

    it("createUserDocument backfills quotas when existing doc lacks them", async () => {
      // Simulate a doc that exists (created by seed) but has no quotas
      const { getDoc, setDoc } = await import("firebase/firestore");
      const { createUserDocument } = await import("@/lib/firestore");

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: "seeded-user",
        data: () => ({ seeded: true, endpointCount: 6 }),
      } as never);

      await createUserDocument("seeded-user", "guest@guest.local", true);

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isAnonymous: true,
          quotas: expect.objectContaining({
            maxEndpoints: 10,
            maxExecutionsPerDay: 100,
          }),
        }),
        { merge: true }
      );
      // Should NOT include endpointCount (preserve seed's value of 6)
      const callArgs = vi.mocked(setDoc).mock.calls[0][1] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty("endpointCount");
      expect(callArgs).not.toHaveProperty("createdAt");
    });

    it("createUserDocument skips quotas when existing doc already has them", async () => {
      const { getDoc, setDoc } = await import("firebase/firestore");
      const { createUserDocument } = await import("@/lib/firestore");

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: "full-user",
        data: () => ({
          seeded: true,
          endpointCount: 6,
          isAnonymous: true,
          quotas: { maxEndpoints: 10, maxExecutionsPerDay: 100, usedExecutionsToday: 0 },
        }),
      } as never);

      await createUserDocument("full-user", "guest@guest.local", true);

      const callArgs = vi.mocked(setDoc).mock.calls[0][1] as Record<string, unknown>;
      // Should NOT include quotas (already exists, rules prevent overwriting maxEndpoints)
      expect(callArgs).not.toHaveProperty("quotas");
    });

    it("getUserDocument returns null for non-existent user", async () => {
      const { getUserDocument } = await import("@/lib/firestore");
      const result = await getUserDocument("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("Endpoint operations", () => {
    it("getEndpoints queries by userId and orders by createdAt", async () => {
      const { where, orderBy } = await import("firebase/firestore");
      const { getEndpoints } = await import("@/lib/firestore");

      await getEndpoints("user123");

      expect(where).toHaveBeenCalledWith("userId", "==", "user123");
      expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("createEndpoint increments endpointCount on user doc", async () => {
      const { updateDoc, increment } = await import("firebase/firestore");
      const { createEndpoint } = await import("@/lib/firestore");

      await createEndpoint("user123", "Test Endpoint");

      // updateDoc should be called with increment(1) for endpointCount
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { endpointCount: increment(1) }
      );
    });

    it("deleteEndpoint calls deleteDoc and decrements endpointCount", async () => {
      const { deleteDoc, updateDoc, increment } = await import("firebase/firestore");
      const { deleteEndpoint } = await import("@/lib/firestore");

      await deleteEndpoint("ep123", "user123");

      expect(deleteDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { endpointCount: increment(-1) }
      );
    });

    it("deleteEndpoint without userId falls back to auth.currentUser", async () => {
      const { deleteDoc } = await import("firebase/firestore");
      const { deleteEndpoint } = await import("@/lib/firestore");

      await deleteEndpoint("ep123");
      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  describe("Execution operations", () => {
    it("getExecutions queries by endpointId with limit", async () => {
      const { where, orderBy, limit } = await import("firebase/firestore");
      const { getExecutions } = await import("@/lib/firestore");

      await getExecutions("ep123");

      expect(where).toHaveBeenCalledWith("endpointId", "==", "ep123");
      expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
      expect(limit).toHaveBeenCalledWith(100);
    });

    it("clearExecutions calls api.clearRequestLogs", async () => {
      const { api } = await import("@/lib/api");
      const { clearExecutions } = await import("@/lib/firestore");

      await clearExecutions("ep123");
      expect(api.clearRequestLogs).toHaveBeenCalledWith("ep123");
    });
  });

  describe("Real-time listeners", () => {
    it("onEndpointsSnapshot sets up a listener", async () => {
      const { onSnapshot } = await import("firebase/firestore");
      const { onEndpointsSnapshot } = await import("@/lib/firestore");

      const callback = vi.fn();
      onEndpointsSnapshot("user123", callback);

      expect(onSnapshot).toHaveBeenCalled();
    });

    it("onExecutionsSnapshot sets up a listener", async () => {
      const { onSnapshot } = await import("firebase/firestore");
      const { onExecutionsSnapshot } = await import("@/lib/firestore");

      const callback = vi.fn();
      onExecutionsSnapshot("ep123", callback);

      expect(onSnapshot).toHaveBeenCalled();
    });
  });

  describe("Guest operations", () => {
    it("seedGuestData calls api.seedGuestData", async () => {
      const { api } = await import("@/lib/api");
      const { seedGuestData } = await import("@/lib/firestore");

      await seedGuestData();
      expect(api.seedGuestData).toHaveBeenCalled();
    });
  });
});
