# 006 - Webhook Receiver

## Feature Name
Webhook Receiver (Incoming Request Handler)

## Description
A public HTTP endpoint that accepts incoming webhook requests on any HTTP method, captures the full request data (method, URL, headers, query parameters, body, IP), optionally executes a user-defined script to generate the response, logs the execution, and returns the response. This is the core functionality that makes the platform a webhook testing tool.

## User Stories
- As an external service, I want to send HTTP requests to a unique URL, so that the webhook platform captures them for the user.
- As a developer, I want my webhook endpoint to accept any HTTP method, so that I can test POST, GET, PUT, DELETE, PATCH, etc.
- As a developer, I want my custom script to process the request and generate a response, so that I can simulate real API behavior.
- As a developer, I want the request to be logged even if my script fails, so that I can debug script errors.

## Components Involved
- `server/routes/webhooks.ts` -- Catch-all route handler for `ANY /w/:endpointId`
- `server/services/script-runner.ts` -- Spawns sandboxed worker for script execution
- `server/workers/sandbox.worker.ts` -- Executes user script in isolation
- `server/services/store.ts` -- Logs request to in-memory store
- `functions/src/index.ts` -- `recordExecution` callable (Firebase mode)
- `firebase.json` -- Rewrites `/w/**` to Cloud Run service

## Data Model

### Request Capture
```typescript
{
  endpointId: string,
  method: string,              // HTTP method
  url: string,                 // Full request URL
  headers: Record<string, string>,
  query: Record<string, string>,
  body: string,                // Raw body text
  ip: string,                  // From x-forwarded-for header or "unknown"
  responseStatus: number,      // Status code returned
  responseBody: string,        // Response body returned
  timestamp: string            // ISO timestamp
}
```

## API Endpoints
- `ANY /w/:endpointId` -- Public endpoint, no authentication required. Accepts all HTTP methods.

## Request Processing Flow
1. Extract `endpointId` from URL path
2. Look up endpoint in store; return 404 if not found
3. Collect request data: method, URL, headers, query params, body, IP
4. Check if endpoint has a non-empty script:
   - **If script exists**: Execute via `runScript()` in sandboxed worker
     - On success: Use script's returned status, headers, body
     - On failure: Return 500 with error details in JSON
   - **If no script**: Use endpoint's default response (status, content-type, body)
5. Log the request with response data to the store
6. Return the response to the caller

## Business Rules
- Webhook endpoints are public -- no authentication is required to send requests
- All HTTP methods are accepted (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, etc.)
- IP address is extracted from `x-forwarded-for` header (for proxied environments) or defaults to "unknown"
- Request body read failure is silently handled (empty string used)
- Script execution timeout is 10 seconds (outer limit)
- If the endpoint does not exist, a 404 JSON error is returned
- Request logs are stored even when script execution fails
- The response is constructed from raw `Response` object to allow custom headers

## Dependencies
- [002 - Webhook Endpoint Management](002-webhook-endpoint-management.md) -- Endpoint must exist
- [003 - Script Editor](003-script-editor.md) -- Script execution pipeline

## Current Status
**Implemented** -- Fully functional on the Deno server. In Firebase deployment mode, `/w/**` requests are routed to the Cloud Run service via Firebase Hosting rewrites.

## Technical Notes
- The route uses `webhooks.all("/:endpointId", ...)` which is Hono's catch-all method handler.
- Headers are collected by iterating `c.req.raw.headers.forEach()` since Hono's header helpers normalize them.
- Query parameters are parsed from the URL using `new URL(url).searchParams`.
- The response is returned as a raw `Response` object rather than using Hono's response helpers, allowing full control over status, headers, and body.
- In production Firebase mode, the client's Vite proxy (`/w -> localhost:3000`) handles local development; Firebase Hosting rewrites handle production routing to Cloud Run.
- The in-memory store caps request logs at 100 per endpoint, dropping the oldest when exceeded.
