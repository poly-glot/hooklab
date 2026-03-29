import { describe, it, expect } from "vitest";
import { getWebhookUrl } from "@/lib/url";

describe("getWebhookUrl", () => {
  it("returns correct URL format with endpointId", () => {
    const result = getWebhookUrl("abc123");
    expect(result).toBe(`${window.location.origin}/w/abc123`);
  });

  it("includes the origin", () => {
    const result = getWebhookUrl("test-id");
    expect(result).toContain(window.location.origin);
  });

  it("uses /w/ path prefix", () => {
    const result = getWebhookUrl("ep-456");
    expect(result).toMatch(/\/w\/ep-456$/);
  });
});
