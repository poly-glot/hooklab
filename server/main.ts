/**
 * Main entry point for the Hooklab API server.
 *
 * Sets up Hono application with middleware, routes, and error handling.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  ALLOWED_ORIGINS,
  CORS_HEADERS,
  CORS_MAX_AGE,
  CORS_METHODS,
  PORT,
  SECURITY_HEADERS,
} from "./config.ts";
import auth from "./routes/auth.ts";
import endpoints from "./routes/endpoints.ts";
import reports from "./routes/reports.ts";
import webhooks from "./routes/webhooks.ts";

const app = new Hono();

// Middleware
app.use("*", logger());

// Security headers for all responses
app.use("*", async (c, next) => {
  await next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    c.header(key, value);
  }
});

// CORS configuration
app.use(
  "/api/*",
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: [...CORS_METHODS],
    allowHeaders: [...CORS_HEADERS],
    credentials: true,
    maxAge: CORS_MAX_AGE,
  })
);

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.route("/api/auth", auth);
app.route("/api/endpoints", endpoints);
app.route("/api/reports", reports);

// Webhook receiver (public, no auth required)
app.route("/w", webhooks);

// 404 fallback for API
app.notFound((c) => {
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/w/")) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.text("Not found", 404);
});

// Global error handler — never leak stack traces or internal details
app.onError((err, c) => {
  console.error(`[Error] ${err.message}`, err.stack);
  return c.json({ error: "Internal server error" }, 500);
});

console.log(`Hooklab API server running on http://0.0.0.0:${PORT}`);

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, app.fetch);
