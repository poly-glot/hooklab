import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockGetEndpoints = vi.fn();
const mockCreateEndpoint = vi.fn();
const mockUpdateEndpointFn = vi.fn();
const mockDeleteEndpointFn = vi.fn();

vi.mock("@/lib/firestore", () => ({
  getEndpoints: (...args: unknown[]) => mockGetEndpoints(...args),
  createEndpoint: (...args: unknown[]) => mockCreateEndpoint(...args),
  updateEndpoint: (...args: unknown[]) => mockUpdateEndpointFn(...args),
  deleteEndpoint: (...args: unknown[]) => mockDeleteEndpointFn(...args),
}));

vi.mock("@/lib/url", () => ({
  getWebhookUrl: (id: string) => `http://localhost/w/${id}`,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useEndpoints } from "@/hooks/useEndpoints";
import type { Endpoint } from "@/lib/api";

function makeEndpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id: "ep-1",
    userId: "u1",
    name: "My Endpoint",
    script: "",
    defaultStatusCode: 200,
    defaultContentType: "application/json",
    defaultBody: '{"ok":true}',
    isActive: true,
    totalExecutions: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("useEndpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEndpoints.mockResolvedValue([
      makeEndpoint({ id: "ep-1", name: "Alpha", isActive: true }),
      makeEndpoint({ id: "ep-2", name: "Beta", isActive: false }),
      makeEndpoint({ id: "ep-3", name: "Gamma", isActive: true }),
    ]);
    mockDeleteEndpointFn.mockResolvedValue(undefined);
  });

  it("fetches endpoints on mount", async () => {
    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetEndpoints).toHaveBeenCalledWith("u1");
    expect(result.current.endpoints).toHaveLength(3);
  });

  it("createEndpoint adds to list", async () => {
    const newEp = makeEndpoint({ id: "ep-new", name: "New" });
    mockCreateEndpoint.mockResolvedValue(newEp);

    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.createEndpoint("New");
    });

    expect(mockCreateEndpoint).toHaveBeenCalledWith("u1", "New");
    expect(result.current.endpoints).toHaveLength(4);
    // New endpoint should be first (prepended)
    expect(result.current.endpoints[0].id).toBe("ep-new");
  });

  it("deleteEndpoint removes from list", async () => {
    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteEndpoint("ep-2");
    });

    expect(mockDeleteEndpointFn).toHaveBeenCalledWith("ep-2");
    expect(result.current.endpoints).toHaveLength(2);
    expect(result.current.endpoints.find((e) => e.id === "ep-2")).toBeUndefined();
  });

  it("toggleActive flips isActive", async () => {
    const updated = makeEndpoint({ id: "ep-1", isActive: false });
    mockUpdateEndpointFn.mockResolvedValue(updated);

    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleActive("ep-1");
    });

    // ep-1 was isActive: true, so it should call with isActive: false
    expect(mockUpdateEndpointFn).toHaveBeenCalledWith("ep-1", { isActive: false });
    expect(result.current.endpoints.find((e) => e.id === "ep-1")?.isActive).toBe(false);
  });

  it("filter 'active' returns only active endpoints", async () => {
    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setFilter("active");
    });

    expect(result.current.filteredEndpoints.every((e) => e.isActive !== false)).toBe(true);
    expect(result.current.filteredEndpoints).toHaveLength(2);
  });

  it("filter 'closed' returns only inactive endpoints", async () => {
    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setFilter("closed");
    });

    expect(result.current.filteredEndpoints.every((e) => e.isActive === false)).toBe(true);
    expect(result.current.filteredEndpoints).toHaveLength(1);
  });

  it("search filters by name case-insensitively", async () => {
    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setSearchQuery("alpha");
    });

    expect(result.current.filteredEndpoints).toHaveLength(1);
    expect(result.current.filteredEndpoints[0].name).toBe("Alpha");
  });

  it("counts returns correct all, active, closed", async () => {
    const { result } = renderHook(() => useEndpoints("u1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.counts).toEqual({
      all: 3,
      active: 2,
      closed: 1,
    });
  });
});
