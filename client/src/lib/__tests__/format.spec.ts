import { describe, it, expect } from "vitest";
import {
  formatTime,
  formatTimeSidebar,
  formatDateFull,
  prettyJson,
  highlightJson,
  getStatusColorClass,
  generateCurlCommand,
  generateFetchCommand,
} from "@/lib/format";
import type { RequestLog } from "@/lib/api";

describe("formatTime", () => {
  it("formats valid ISO string to HH:MM:SS", () => {
    const result = formatTime("2025-06-15T14:30:45Z");
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("returns raw string for invalid input", () => {
    expect(formatTime("not-a-date")).toBe("not-a-date");
  });
});

describe("formatTimeSidebar", () => {
  it("formats today's date to HH:MM", () => {
    const now = new Date();
    const result = formatTimeSidebar(now.toISOString());
    expect(result).toMatch(/\d{2}:\d{2}/);
    // Should NOT contain a comma or "Yesterday"
    expect(result).not.toContain(",");
    expect(result).not.toBe("Yesterday");
  });

  it("returns 'Yesterday' for a date 1 day ago", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatTimeSidebar(yesterday.toISOString());
    expect(result).toBe("Yesterday");
  });

  it("returns 'Yesterday' for a date several days ago", () => {
    const older = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatTimeSidebar(older.toISOString());
    // The implementation returns "Yesterday" for any diffDays >= 1
    expect(result).toBe("Yesterday");
  });

  it("returns raw string for invalid input", () => {
    expect(formatTimeSidebar("bad")).toBe("bad");
  });
});

describe("formatDateFull", () => {
  it("formats valid ISO string to readable date", () => {
    const result = formatDateFull("2025-01-15T10:30:00Z");
    // Should contain month, day, year
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  it("returns raw string for invalid input", () => {
    expect(formatDateFull("nope")).toBe("nope");
  });
});

describe("prettyJson", () => {
  it("formats valid JSON", () => {
    const result = prettyJson('{"a":1}');
    expect(result).toBe('{\n  "a": 1\n}');
  });

  it("returns raw string for invalid JSON", () => {
    expect(prettyJson("not json")).toBe("not json");
  });
});

describe("highlightJson", () => {
  it("wraps keys in json-pretty__key spans", () => {
    const result = highlightJson('{"name":"test"}');
    expect(result).toContain('<span class="json-pretty__key">"name"</span>');
  });

  it("wraps string values in json-pretty__string spans", () => {
    const result = highlightJson('{"name":"test"}');
    expect(result).toContain('<span class="json-pretty__string">"test"</span>');
  });

  it("wraps numbers in json-pretty__number spans", () => {
    const result = highlightJson('{"count":42}');
    expect(result).toContain('<span class="json-pretty__number">42</span>');
  });

  it("wraps booleans in json-pretty__boolean spans", () => {
    const result = highlightJson('{"ok":true}');
    expect(result).toContain('<span class="json-pretty__boolean">true</span>');
  });

  it("wraps null in json-pretty__null spans", () => {
    const result = highlightJson('{"val":null}');
    expect(result).toContain('<span class="json-pretty__null">null</span>');
  });

  it("returns raw string for invalid JSON", () => {
    const result = highlightJson("not json");
    expect(result).toBe("not json");
  });
});

describe("getStatusColorClass", () => {
  const styles: Record<string, string> = {
    statusBadgeSuccess: "success",
    statusBadgeWarning: "warning",
    statusBadgeError: "error",
  };

  it("returns success class for 2xx", () => {
    expect(getStatusColorClass(200, styles)).toBe("success");
    expect(getStatusColorClass(204, styles)).toBe("success");
  });

  it("returns warning class for 4xx", () => {
    expect(getStatusColorClass(400, styles)).toBe("warning");
    expect(getStatusColorClass(404, styles)).toBe("warning");
  });

  it("returns error class for 5xx", () => {
    expect(getStatusColorClass(500, styles)).toBe("error");
    expect(getStatusColorClass(503, styles)).toBe("error");
  });

  it("returns empty string for other status codes", () => {
    expect(getStatusColorClass(301, styles)).toBe("");
    expect(getStatusColorClass(100, styles)).toBe("");
  });
});

function makeRequest(overrides: Partial<RequestLog> = {}): RequestLog {
  return {
    id: "r1",
    endpointId: "ep1",
    method: "POST",
    url: "https://example.com/api",
    headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
    query: {},
    body: '{"key":"value"}',
    ip: "127.0.0.1",
    responseStatus: 200,
    responseBody: "OK",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("generateCurlCommand", () => {
  it("includes method and URL", () => {
    const result = generateCurlCommand(makeRequest());
    expect(result).toContain("curl -X POST");
    expect(result).toContain("https://example.com/api");
  });

  it("includes headers", () => {
    const result = generateCurlCommand(makeRequest());
    expect(result).toContain("-H 'Content-Type: application/json'");
    expect(result).toContain("-H 'Authorization: Bearer tok'");
  });

  it("includes body", () => {
    const result = generateCurlCommand(makeRequest());
    expect(result).toContain('-d \'{"key":"value"}\'');
  });

  it("omits body flag when body is empty", () => {
    const result = generateCurlCommand(makeRequest({ body: "" }));
    expect(result).not.toContain("-d");
  });
});

describe("generateFetchCommand", () => {
  it("includes method in options", () => {
    const result = generateFetchCommand(makeRequest());
    expect(result).toContain('"method": "POST"');
  });

  it("includes URL", () => {
    const result = generateFetchCommand(makeRequest());
    expect(result).toContain("fetch('https://example.com/api'");
  });

  it("includes headers when present", () => {
    const result = generateFetchCommand(makeRequest());
    expect(result).toContain('"Content-Type": "application/json"');
  });

  it("includes body when present", () => {
    const result = generateFetchCommand(makeRequest());
    expect(result).toContain('"body"');
  });

  it("omits body when empty", () => {
    const result = generateFetchCommand(makeRequest({ body: "" }));
    expect(result).not.toContain('"body"');
  });
});
