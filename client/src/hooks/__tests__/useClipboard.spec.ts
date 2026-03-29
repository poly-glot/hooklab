import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockToastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: vi.fn(),
  },
}));

import { useClipboard } from "@/hooks/useClipboard";

describe("useClipboard", () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copy writes to clipboard", () => {
    const { result } = renderHook(() => useClipboard());

    act(() => {
      result.current.copy("hello");
    });

    expect(mockWriteText).toHaveBeenCalledWith("hello");
  });

  it("copied becomes true then resets after delay", () => {
    const { result } = renderHook(() => useClipboard(1000));

    expect(result.current.copied).toBe(false);

    act(() => {
      result.current.copy("test");
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(false);
  });

  it("shows toast on success", () => {
    const { result } = renderHook(() => useClipboard());

    act(() => {
      result.current.copy("data");
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Webhook URL copied");
  });
});
