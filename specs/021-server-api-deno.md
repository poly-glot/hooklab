# 021 - Deno API Server

## Feature Name
Deno API Server (Hono Framework)

## Description
A Deno-based HTTP server built with the Hono framework that provides REST API endpoints for authentication, endpoint management, webhook receiving, and script execution. Serves as the backend API deployed to Cloud Run, using an in-memory data store (development) or Firestore (production via Cloud Functions).

## User Stories
- As the system, I want a lightweight API server, so that webhook requests are processed with low latency.
- As the system, I want a health check endpoint, so that Cloud Run can monitor service availability.
- As the system, I want CORS configured, so that the client SPA can make API requests from a different origin.

## Components Involved
- `server/main.ts` -- Application entry point, middleware, route mounting
- `server/routes/auth.ts` -- Authentication routes
- `server/routes/endpoints.ts` -- Endpoint CRUD routes
- `server/routes/webhooks.ts` -- Webhook receiver route
- `server/middleware/auth.ts` -- JWT auth middleware
- `server/services/store.ts` -- In-memory data store
- `server/services/script-runner.ts` -- Sandboxed script execution
- `server/workers/sandbox.worker.ts` -- Worker sandbox

## Server Architecture
```
Hono App
  |-- Middleware: logger, CORS (/api/*)
  |-- GET /api/health -> Health check
  |-- /api/auth/* -> auth routes (register, login, me)
  |-- /api/endpoints/* -> endpoint routes (CRUD, request logs, stats)
  |-- /w/* -> webhook routes (public, no auth)
  |-- 404 handler (JSON for API/webhook, text for others)
  |-- Global error handler
```

## Middleware
### Logger
- Hono built-in logger for request/response logging

### CORS
- Origins: `http://localhost:5173`, `http://localhost:3000`
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Content-Type, Authorization
- Credentials: true

### Auth Middleware
- Applied to `/api/endpoints/*` routes
- Extracts Bearer token from Authorization header
- Verifies HMAC-SHA256 JWT signature
- Sets `userId` and `userEmail` on Hono context
- JWT secret from `JWT_SECRET` env var (default: "hooklab-dev-secret-change-in-production")
- Token expiry: 7 days

## In-Memory Store
- Users: `Map<string, User>` + email index `Map<string, string>`
- Endpoints: `Map<string, Endpoint>`
- Request logs: `Map<string, RequestLog[]>` (per endpoint, max 100)
- Stats aggregation: totals + recent 10 requests across all endpoints

## API Routes Summary
See individual specs for detailed route documentation:
- Auth: [001](001-authentication.md)
- Endpoints: [002](002-webhook-endpoint-management.md)
- Webhooks: [006](006-webhook-receiver.md)

### Additional Routes
- `GET /api/health` -> `{ status: "ok", timestamp: ISO }` (no auth)
- `GET /api/endpoints/_stats` -> Dashboard statistics (auth required)
- `GET /api/endpoints/:id/requests` -> Request logs for endpoint (auth required)
- `DELETE /api/endpoints/:id/requests` -> Clear request logs (auth required)

## Business Rules
- The server binds to `0.0.0.0:{PORT}` (PORT env var, default 3000)
- In-memory store means all data is lost on server restart
- API routes return JSON errors; non-API 404s return plain text
- Global error handler logs to console and returns 500 JSON

## Dependencies
- Deno runtime
- Hono framework
- `@std/encoding/base64url` (Deno stdlib for JWT encoding)

## Current Status
**Implemented** -- Fully functional Deno server. Used in development and deployed to Cloud Run for production webhook receiving. In production, the client uses Firestore directly for data operations, with the Deno server primarily handling webhook reception and script execution.

## Technical Notes
- The Hono framework was chosen for its minimal footprint and Deno compatibility.
- The CORS configuration only allows localhost origins -- this needs to be updated for production deployment (or handled by Cloud Run/Firebase Hosting proxy).
- The JWT implementation is a custom HMAC-SHA256 solution using Web Crypto API, not a standard JWT library. The comment explicitly notes this is not production-ready.
- The server uses Deno's native `Deno.serve()` for HTTP serving.
- The `store.seed()` method creates 12 endpoints with diverse sample request data for demo purposes.
