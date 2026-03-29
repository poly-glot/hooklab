/**
 * Webhook receiver — public endpoint, no auth required.
 *
 * Always reads endpoints from Firestore and writes executions to Firestore.
 * No in-memory fallback. The backend has admin-level Firestore access.
 */

import { Hono } from "hono";
import {
  MAX_REQUESTS_PER_MINUTE,
  MAX_WEBHOOK_BODY_SIZE,
  RATE_LIMIT_WINDOW,
} from "../config.ts";
import {
  getEndpoint,
  writeExecution,
} from "../services/firebase-admin.ts";
import { runScript } from "../services/script-runner.ts";
import type { RateLimitEntry } from "../types.ts";

const webhooks = new Hono();

/** HTTP status codes that must not include a response body. */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

// Simple rate limiter per endpoint
const endpointRateLimits = new Map<string, RateLimitEntry>();

/**
 * Checks and consumes one rate-limit token for an endpoint.
 *
 * Uses a fixed-window counter with in-memory storage.
 * Returns true if the request is allowed, false if rate limit exceeded.
 */
function consumeRateLimit(endpointId: string): boolean {
  const now = Date.now();
  const entry = endpointRateLimits.get(endpointId);

  if (!entry || now > entry.resetAt) {
    endpointRateLimits.set(endpointId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  entry.count++;
  return entry.count <= MAX_REQUESTS_PER_MINUTE;
}

// Catch-all handler for incoming webhooks: ANY /w/:endpointId
webhooks.all("/:endpointId", async (c) => {
  const endpointId = c.req.param("endpointId");
  const startTime = Date.now();

  const endpoint = await getEndpoint(endpointId);

  if (!endpoint) {
    return c.json({ error: "Webhook endpoint not found" }, 404);
  }

  if (endpoint.isActive === false) {
    return c.json({ error: "Endpoint is disabled" }, 404);
  }

  if (!consumeRateLimit(endpointId)) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  // Collect request data
  const method = c.req.method;
  const url = c.req.url;
  const headers = Object.fromEntries(c.req.raw.headers);
  const query = Object.fromEntries(new URL(url).searchParams);

  let body = "";
  try {
    body = await c.req.text();
    if (body.length > MAX_WEBHOOK_BODY_SIZE) {
      return c.json({ error: "Request body too large" }, 413);
    }
  } catch {
    // No body
  }

  const ip = c.req.header("x-forwarded-for") ?? "unknown";

  // Execute user script if available
  let responseStatus = endpoint.defaultStatusCode;
  let responseHeaders: Record<string, string> = {
    "Content-Type": endpoint.defaultContentType,
  };
  let responseBody = endpoint.defaultBody;

  if (endpoint.script?.trim()) {
    const result = await runScript(endpoint.script, {
      method,
      headers,
      query,
      body,
      url,
    });

    if (result.success && result.response) {
      responseStatus = result.response.status;
      responseHeaders = result.response.headers;
      responseBody = result.response.body;
    } else if (!result.success) {
      console.error(
        `[ScriptError] endpoint=${endpointId}: ${result.error}`,
      );
      responseBody = JSON.stringify({ error: "Script execution failed" });
      responseStatus = 500;
      responseHeaders = { "Content-Type": "application/json" };
    }
  }

  const duration = Date.now() - startTime;

  // Write execution to Firestore (fire-and-forget)
  writeExecution({
    endpointId,
    userId: endpoint.userId,
    method,
    url,
    headers,
    query,
    body,
    ip,
    responseStatus,
    responseBody,
    duration,
  }).catch((err) => {
    console.error("[Webhook] Failed to write execution:", err);
  });

  return new Response(
    NULL_BODY_STATUSES.has(responseStatus) ? null : responseBody,
    { status: responseStatus, headers: responseHeaders },
  );
});

export default webhooks;
