# 005 - Endpoint Detail / Request Inspection

## Feature Name
Endpoint Detail View with Request Inspection

## Description
A detailed view for a single webhook endpoint showing all captured HTTP requests in a sidebar, with a tabbed content area to inspect each request's headers, body, query parameters, and response. Supports auto-refresh polling, URL copying, request log clearing, and mobile-responsive sidebar navigation.

## User Stories
- As a developer, I want to see all requests received by an endpoint, so that I can debug webhook integrations.
- As a developer, I want to inspect request headers, body, query parameters, and response separately, so that I can isolate specific aspects of the request.
- As a developer, I want to copy the webhook URL, so that I can easily paste it into integrations.
- As a developer, I want auto-refresh mode, so that new requests appear automatically without manual refresh.
- As a developer, I want to clear all request logs, so that I can start with a clean slate.
- As a developer, I want to add notes to requests, so that I can annotate interesting payloads.

## Components Involved
- `client/src/pages/dashboard/EndpointDetail.tsx` -- Main detail page with sidebar, tabs, request inspection
- `client/src/components/webhook/RequestListItem.tsx` -- Individual request entry in the sidebar
- `client/src/components/webhook/MethodBadge.tsx` -- HTTP method badge with color coding
- `client/src/components/webhook/AppHeader.tsx` -- Application header
- `client/src/components/webhook/AppFooter.tsx` -- Application footer
- `client/src/lib/firestore.ts` -- getEndpoint, getExecutions, clearExecutions

## Data Model

### RequestLog (Execution)
```typescript
interface RequestLog {
  id: string;
  endpointId: string;
  method: string;          // HTTP method
  url: string;             // Full request URL
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;            // Raw request body
  ip: string;              // Client IP
  responseStatus: number;  // HTTP status returned
  responseBody: string;    // Response body returned
  timestamp: string;       // ISO timestamp
}
```

## UI Flow
1. User navigates to `/dashboard/endpoint/:id`
2. Endpoint and request logs are loaded in parallel
3. **Action Bar** (top):
   - Mobile sidebar toggle (hamburger icon)
   - "Back to listing" button
   - URL toolbar pill showing webhook URL with Edit button, URL text, and Copy button
   - Auto-refresh toggle button ("Auto ON"/"Auto OFF")
   - "OPTIONS" refresh button
4. **Left Sidebar** (320px wide):
   - Scrollable list of requests, each showing: HTTP method badge, request label, relative time
   - First request auto-selected on load
   - "DELETE ALL" button at bottom (red, disabled when no requests)
   - Empty state: "No requests yet. Send a request to your webhook URL."
5. **Content Area** (right panel):
   - Tab bar: Header | Body | Query | Response
   - **Header tab**: Key-value rows for Host, Method, Date, Size, Time, ID, plus all request headers; "+ Add Note" link
   - **Body tab**: Pretty-printed JSON or raw text
   - **Query tab**: Key-value rows for query parameters
   - **Response tab**: Status code row plus pretty-printed response body
   - Empty state when no request selected: "Select a request from the sidebar to view details."
6. **Mobile behavior**: Sidebar slides in as an overlay with close-on-backdrop-click
7. **Delete All**: Confirmation dialog, calls `clearExecutions` Cloud Function
8. **Auto-refresh**: Polls `fetchRequests` every 3 seconds when enabled

## Business Rules
- Request logs are limited to 100 per endpoint (Firestore query limit)
- Auto-refresh interval is 3 seconds
- JSON bodies are pretty-printed with 2-space indentation
- Request time formatting: today's requests show HH:MM, older requests show "Yesterday"
- Full date format for header tab: "Mon DD, YYYY HH:MM"
- Body size is calculated as `new Blob([body]).size` bytes
- Copy URL uses `navigator.clipboard.writeText`
- Clearing requests is irreversible (confirmation dialog warns of permanent deletion)
- The clearExecutions function is a Cloud Function callable that verifies endpoint ownership before deleting

## Dependencies
- [002 - Webhook Endpoint Management](002-webhook-endpoint-management.md) -- Endpoint must exist
- [008 - Cloud Functions](008-cloud-functions.md) -- clearExecutions callable
- [001 - Authentication](001-authentication.md) -- Protected route

## Current Status
**Implemented** -- Fully functional request inspection with all four tabs, auto-refresh, URL copy, and delete all. The "Edit" button in the URL toolbar and "+ Add Note" link are present in the UI but not wired to functionality.

## Technical Notes
- MethodBadge uses color coding: GET/PUT = blue (#447ef3), POST = grey (#d9d9d9), DELETE = red (#ac1b11), PATCH = dark grey (#686868). Inactive badges all use grey.
- The sidebar width is fixed at 320px on desktop; on mobile it becomes a fixed-position overlay.
- The `clearExecutions` call goes through Firebase Cloud Functions (`httpsCallable`), not direct Firestore operations, because execution documents cannot be deleted by clients (Firestore rules deny client-side deletes on executions).
- Pretty-printing JSON uses a try/catch around `JSON.parse` + `JSON.stringify` so non-JSON bodies display as-is.
- The component uses multiple `useCallback` and `useEffect` hooks for data fetching, which could benefit from a state management solution or React Query for deduplication.
