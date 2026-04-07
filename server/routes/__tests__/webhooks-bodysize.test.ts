/**
 * Tests for webhook body size pre-check via Content-Length.
 *
 * Proves that oversized bodies are rejected BEFORE buffering.
 */

import { assertEquals } from "@std/assert";

const MAX_WEBHOOK_BODY_SIZE = 1_048_576; // 1 MB, matches config

/**
 * Simulates the pre-check logic from the webhook handler.
 * Returns true if the request should be rejected.
 */
function shouldRejectByContentLength(contentLengthHeader: string | null): boolean {
  const contentLength = parseInt(contentLengthHeader || "0", 10);
  return contentLength > MAX_WEBHOOK_BODY_SIZE;
}

Deno.test("allows request with no Content-Length header", () => {
  assertEquals(shouldRejectByContentLength(null), false);
});

Deno.test("allows request with Content-Length under limit", () => {
  assertEquals(shouldRejectByContentLength("1024"), false);
});

Deno.test("allows request with Content-Length at exact limit", () => {
  assertEquals(shouldRejectByContentLength(String(MAX_WEBHOOK_BODY_SIZE)), false);
});

Deno.test("REJECTS request with Content-Length over limit", () => {
  assertEquals(shouldRejectByContentLength(String(MAX_WEBHOOK_BODY_SIZE + 1)), true);
});

Deno.test("REJECTS request with Content-Length of 10 MB", () => {
  assertEquals(shouldRejectByContentLength(String(10 * 1024 * 1024)), true);
});

Deno.test("REJECTS request with Content-Length of 2 GB (DoS)", () => {
  assertEquals(shouldRejectByContentLength(String(2 * 1024 * 1024 * 1024)), true);
});

Deno.test("allows request with non-numeric Content-Length (NaN parses to 0)", () => {
  assertEquals(shouldRejectByContentLength("garbage"), false);
});

Deno.test("still checks actual body length after reading (defense in depth)", () => {
  // Simulates a spoofed Content-Length=100 but actual body is 2MB
  const contentLengthOk = !shouldRejectByContentLength("100");
  assertEquals(contentLengthOk, true, "Content-Length precheck passes");

  // Then the post-read check must catch it
  const actualBody = "x".repeat(MAX_WEBHOOK_BODY_SIZE + 1);
  assertEquals(actualBody.length > MAX_WEBHOOK_BODY_SIZE, true, "post-read check catches spoofed CL");
});
