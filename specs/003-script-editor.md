# 003 - Script Editor / Scriptable Webhooks

## Feature Name
Script Editor for Programmable Webhook Responses

## Description
An in-browser code editor that allows users to write JavaScript scripts executed on every incoming webhook request. Scripts receive a request object and return a custom response object (status, headers, body). Scripts are executed in a sandboxed Deno Worker with zero permissions for security. The editor includes line numbers, tab support, save/reset/test actions, a collapsible API reference, and example script loading.

## User Stories
- As a developer, I want to write custom JavaScript that executes on incoming webhook requests, so that I can transform, validate, or route webhooks dynamically.
- As a developer, I want to test my script from the editor, so that I can verify behavior before receiving real requests.
- As a developer, I want to see example scripts, so that I can learn the API and get started quickly.
- As a developer, I want an API reference panel, so that I know exactly what the request object contains and what the response format requires.
- As a developer, I want visual feedback on save state, so that I know whether my changes are persisted.

## Components Involved
- `client/src/pages/dashboard/ScriptEditor.tsx` -- Full editor UI component
- `client/src/lib/firestore.ts` -- `updateEndpoint` for persisting scripts
- `server/services/script-runner.ts` -- Worker spawner with timeout management
- `server/workers/sandbox.worker.ts` -- Sandboxed execution environment
- `server/routes/webhooks.ts` -- Invokes script-runner when processing incoming webhooks

## Data Model

### Script Input (Request Object)
```typescript
interface ScriptRequest {
  method: string;         // HTTP method ("GET", "POST", etc.)
  headers: Record<string, string>;  // Request headers
  query: Record<string, string>;    // URL query parameters
  body: string;           // Raw request body
  url: string;            // Full request URL
}
```

### Script Output (Response Object)
```typescript
interface ScriptResponse {
  status: number;         // HTTP status code (100-599)
  headers: Record<string, string>;  // Response headers
  body: string;           // Response body
}
```

## API Endpoints
- `PUT /api/endpoints/:id` (legacy) or `updateEndpoint(id, { script })` (Firestore) -- Persist script changes
- `ANY /w/:endpointId` -- Webhook receiver that executes the script

## UI Flow
1. ScriptEditor component receives an endpoint and an onUpdate callback
2. Editor displays a dark-themed code area with line numbers and a monospace font (JetBrains Mono/Fira Code)
3. Status badge shows "Saved" (green) or "Unsaved" (orange)
4. Toolbar buttons:
   - **Reset**: Restores the default script template
   - **Test**: Sends a POST request to the webhook URL with test payload and displays the result
   - **Save**: Persists the script via `updateEndpoint`
5. Test results panel appears below the editor showing status code and formatted response body
6. Collapsible "Script API Reference" section documents the request object, response format, and tips
7. Example scripts section with "Load Example" buttons:
   - Echo Request Body
   - Conditional Response by Method
   - Parse JSON and Transform
8. Tab key inserts 2 spaces (prevented from navigating focus)

## Business Rules
- Script size is limited to 64 KB
- Script execution has a 5-second timeout (sandbox worker) with a 10-second outer timeout (script-runner)
- Response body is limited to 1 MB
- HTTP status code is clamped to 100-599
- Blocked dangerous patterns in scripts: `Deno`, `import()`, `import` statements, `require()`, `process`, `__proto__`, `constructor[`, `getPrototypeOf`
- Blocked global access: `Deno`, `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `SharedWorker`, `importScripts`, `eval`, `Function`, `globalThis`, `self`, `postMessage`, `close`, `addEventListener`, `removeEventListener`
- Blocked response headers: `Set-Cookie`, `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`
- Header names must match `/^[a-zA-Z0-9\-]+$/`; CRLF characters stripped from header values
- Request object is passed as a frozen object to prevent mutation
- Scripts run in strict mode (`"use strict"`)
- If script execution fails, the webhook returns a 500 with error details
- If no script is defined (empty/whitespace), the default response configuration is used

## Dependencies
- [002 - Webhook Endpoint Management](002-webhook-endpoint-management.md) -- Endpoint must exist to edit its script
- Deno Worker API (for sandboxed execution on the server)

## Current Status
**Implemented** -- The client-side editor is fully functional with save, reset, test, API reference, and example loading. Server-side sandboxed execution is implemented in the Deno server. The ScriptEditor component is imported in EndpointDetail but the current EndpointDetail page does not render it in its main view (it focuses on request inspection).

## Technical Notes
- The sandbox uses a Deno Worker with `deno.permissions` set to deny all: `net: false, read: false, write: false, env: false, run: false, ffi: false, sys: false, hrtime: false`.
- The script is wrapped in an async IIFE with dangerous globals shadowed as `undefined` parameters.
- `new Function()` is used to create the handler, which is a necessary use of dynamic code evaluation.
- The Test button sends a real HTTP request to the webhook URL, so the script must be saved first to test the latest version server-side (though the test sends to whatever is deployed).
- Error messages from script execution are truncated to 500 characters to prevent information leakage.
- The editor uses a plain `<textarea>` rather than a full code editor library (e.g., Monaco/CodeMirror), which means no syntax highlighting in the actual editing surface.
