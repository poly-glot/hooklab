import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockGetEndpoint = vi.fn();
const mockUpdateEndpointFn = vi.fn();

vi.mock("@/lib/firestore", () => ({
  getEndpoint: (...args: unknown[]) => mockGetEndpoint(...args),
  updateEndpoint: (...args: unknown[]) => mockUpdateEndpointFn(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useEndpoint } from "@/hooks/useEndpoint";
import type { Endpoint } from "@/lib/api";

const mockEndpoint: Endpoint = {
  id: "ep-1",
  userId: "u1",
  name: "Test Endpoint",
  script: "",
  defaultStatusCode: 200,
  defaultContentType: "application/json",
  defaultBody: '{"ok":true}',
  isActive: true,
  totalExecutions: 0,
  createdAt: new Date().toISOString(),
};

describe("useEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEndpoint.mockResolvedValue(mockEndpoint);
  });

  it("fetches endpoint on mount and transitions loading true to false", async () => {
    const { result } = renderHook(() => useEndpoint("ep-1"));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.endpoint).toEqual(mockEndpoint);
    expect(mockGetEndpoint).toHaveBeenCalledWith("ep-1");
  });

  it("returns null endpoint when getEndpoint returns null", async () => {
    mockGetEndpoint.mockResolvedValue(null);

    const { result } = renderHook(() => useEndpoint("ep-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.endpoint).toBeNull();
  });

  it("updateEndpoint calls firestore and updates state", async () => {
    const updated = { ...mockEndpoint, name: "Updated" };
    mockUpdateEndpointFn.mockResolvedValue(updated);

    const { result } = renderHook(() => useEndpoint("ep-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let returnValue: Endpoint | undefined;
    await act(async () => {
      returnValue = await result.current.updateEndpoint({ name: "Updated" });
    });

    expect(mockUpdateEndpointFn).toHaveBeenCalledWith("ep-1", { name: "Updated" });
    expect(result.current.endpoint).toEqual(updated);
    expect(returnValue).toEqual(updated);
  });

  it("refetch re-fetches the endpoint", async () => {
    const { result } = renderHook(() => useEndpoint("ep-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetEndpoint).toHaveBeenCalledTimes(1);

    const refreshed = { ...mockEndpoint, name: "Refreshed" };
    mockGetEndpoint.mockResolvedValue(refreshed);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetEndpoint).toHaveBeenCalledTimes(2);
    expect(result.current.endpoint).toEqual(refreshed);
  });

  it("handles getEndpoint error", async () => {
    mockGetEndpoint.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useEndpoint("ep-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load endpoint");
  });
});
