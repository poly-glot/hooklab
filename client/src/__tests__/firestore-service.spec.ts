import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase modules before importing the service
vi.mock("@/lib/firebase-init", () => ({
  app: {},
  auth: {},
  firestore: {},
  functions: {},
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
    Timestamp: {
      now: vi.fn(() => ({ toDate: () => new Date() })),
      fromDate: vi.fn((d: Date) => ({
        toDate: () => d,
        seconds: Math.floor(d.getTime() / 1000),
      })),
    },
    setDoc: vi.fn(async () => {}),
  };
});

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => vi.fn(async () => ({ data: {} }))),
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
    it("createUserDocument calls setDoc with correct data", async () => {
      const { setDoc } = await import("firebase/firestore");
      const { createUserDocument } = await import("@/lib/firestore");

      await createUserDocument("user123", "test@example.com", false);
      expect(setDoc).toHaveBeenCalled();
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

    it("deleteEndpoint calls deleteDoc", async () => {
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

    it("clearExecutions calls httpsCallable", async () => {
      const { httpsCallable } = await import("firebase/functions");
      const { clearExecutions } = await import("@/lib/firestore");

      await clearExecutions("ep123");
      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "clearExecutions"
      );
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
    it("seedGuestData calls httpsCallable", async () => {
      const { httpsCallable } = await import("firebase/functions");
      const { seedGuestData } = await import("@/lib/firestore");

      await seedGuestData();
      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "seedGuestData"
      );
    });
  });
});
