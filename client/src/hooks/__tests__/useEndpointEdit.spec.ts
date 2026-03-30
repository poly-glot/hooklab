import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useEndpointEdit } from "@/hooks/useEndpointEdit";
import type { Endpoint } from "@/lib/api";

const mockEndpoint: Endpoint = {
  id: "ep-1",
  userId: "u1",
  name: "Test Endpoint",
  script: "",
  defaultStatusCode: 201,
  defaultContentType: "text/plain",
  defaultBody: "hello",
  isActive: true,
  totalExecutions: 0,
  createdAt: new Date().toISOString(),
};

describe("useEndpointEdit", () => {
  let mockOnSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave = vi.fn().mockResolvedValue(undefined);
  });

  it("startEdit populates fields from endpoint", () => {
    const { result } = renderHook(() => useEndpointEdit(mockEndpoint, mockOnSave));

    act(() => {
      result.current.startEdit();
    });

    expect(result.current.editing).toBe(true);
    expect(result.current.editFields.name).toBe("Test Endpoint");
    expect(result.current.editFields.statusCode).toBe(201);
    expect(result.current.editFields.contentType).toBe("text/plain");
    expect(result.current.editFields.defaultBody).toBe("hello");
  });

  it("cancelEdit sets editing to false", () => {
    const { result } = renderHook(() => useEndpointEdit(mockEndpoint, mockOnSave));

    act(() => {
      result.current.startEdit();
    });
    expect(result.current.editing).toBe(true);

    act(() => {
      result.current.cancelEdit();
    });
    expect(result.current.editing).toBe(false);
  });

  it("saveEdit calls onSave callback with fields", async () => {
    const { result } = renderHook(() => useEndpointEdit(mockEndpoint, mockOnSave));

    act(() => {
      result.current.startEdit();
    });

    await act(async () => {
      await result.current.saveEdit();
    });

    expect(mockOnSave).toHaveBeenCalledWith({
      name: "Test Endpoint",
      defaultStatusCode: 201,
      defaultContentType: "text/plain",
      defaultBody: "hello",
    });
  });

  it("saveEdit sets saving true then false", async () => {
    let resolveSave!: () => void;
    mockOnSave.mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );

    const { result } = renderHook(() => useEndpointEdit(mockEndpoint, mockOnSave));

    act(() => {
      result.current.startEdit();
    });

    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.saveEdit();
    });

    // saving should be true while the promise is pending
    expect(result.current.saving).toBe(true);

    await act(async () => {
      resolveSave();
      await savePromise!;
    });

    expect(result.current.saving).toBe(false);
  });

  it("fields update via setEditField", () => {
    const { result } = renderHook(() => useEndpointEdit(mockEndpoint, mockOnSave));

    act(() => {
      result.current.startEdit();
    });

    act(() => {
      result.current.setEditField("name", "New Name");
    });

    expect(result.current.editFields.name).toBe("New Name");
  });
});
