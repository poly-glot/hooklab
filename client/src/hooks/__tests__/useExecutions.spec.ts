import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockOnExecutionsSnapshot = vi.fn();
const mockClearExecutions = vi.fn();
const mockDeleteExecution = vi.fn();

vi.mock("@/lib/firestore", () => ({
  onExecutionsSnapshot: (...args: unknown[]) => mockOnExecutionsSnapshot(...args),
  clearExecutions: (...args: unknown[]) => mockClearExecutions(...args),
  deleteExecution: (...args: unknown[]) => mockDeleteExecution(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useExecutions } from "@/hooks/useExecutions";
import type { RequestLog } from "@/lib/api";

function makeRequest(id: string): RequestLog {
  return {
    id,
    endpointId: "ep-1",
    method: "POST",
    url: "https://example.com",
    headers: {},
    query: {},
    body: "",
    ip: "127.0.0.1",
    responseStatus: 200,
    responseBody: "OK",
    timestamp: new Date().toISOString(),
  };
}

describe("useExecutions", () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe = vi.fn();
    mockOnExecutionsSnapshot.mockImplementation((_id: string, callback: (execs: RequestLog[]) => void) => {
      callback([makeRequest("r1"), makeRequest("r2")]);
      return mockUnsubscribe;
    });
    mockClearExecutions.mockResolvedValue(undefined);
    mockDeleteExecution.mockResolvedValue(undefined);
  });

  it("subscribes on mount when autoRefresh is true", () => {
    renderHook(() => useExecutions("ep-1", true));
    expect(mockOnExecutionsSnapshot).toHaveBeenCalledWith("ep-1", expect.any(Function));
  });

  it("does not subscribe when autoRefresh is false", () => {
    renderHook(() => useExecutions("ep-1", false));
    expect(mockOnExecutionsSnapshot).not.toHaveBeenCalled();
  });

  it("unsubscribes on cleanup", () => {
    const { unmount } = renderHook(() => useExecutions("ep-1", true));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("clearAll calls clearExecutions and resets state", async () => {
    const { result } = renderHook(() => useExecutions("ep-1", true));

    await waitFor(() => {
      expect(result.current.requests.length).toBe(2);
    });

    await act(async () => {
      await result.current.clearAll();
    });

    expect(mockClearExecutions).toHaveBeenCalledWith("ep-1");
    expect(result.current.requests).toEqual([]);
    expect(result.current.selectedRequest).toBeNull();
  });

  it("deleteOne removes request from list", async () => {
    const { result } = renderHook(() => useExecutions("ep-1", true));

    await waitFor(() => {
      expect(result.current.requests.length).toBe(2);
    });

    await act(async () => {
      await result.current.deleteOne("r1");
    });

    expect(mockDeleteExecution).toHaveBeenCalledWith("ep-1", "r1");
    expect(result.current.requests).toHaveLength(1);
    expect(result.current.requests[0].id).toBe("r2");
  });

  it("pagination returns correct slice", () => {
    // Provide more than 20 items
    const manyRequests = Array.from({ length: 25 }, (_, i) => makeRequest(`r${i}`));
    mockOnExecutionsSnapshot.mockImplementation((_id: string, callback: (execs: RequestLog[]) => void) => {
      callback(manyRequests);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useExecutions("ep-1", true));

    expect(result.current.paginatedRequests).toHaveLength(20);
    expect(result.current.totalPages).toBe(2);
  });

  it("auto-selects first request when none selected", () => {
    const { result } = renderHook(() => useExecutions("ep-1", true));

    expect(result.current.selectedRequest).toEqual(makeRequest("r1"));
  });
});
