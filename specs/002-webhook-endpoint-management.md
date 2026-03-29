# 002 - Webhook Endpoint Management (CRUD)

## Feature Name
Webhook Endpoint Management

## Description
Full lifecycle management of webhook endpoints including creation, listing, updating, and deletion. Each endpoint receives a unique URL that can accept incoming HTTP requests of any method. Endpoints are user-scoped and support custom scripts, default response configurations, and activity tracking.

## User Stories
- As a user, I want to create a new webhook endpoint, so that I can receive and inspect incoming HTTP requests.
- As a user, I want to list all my endpoints, so that I can see an overview of my webhook receivers.
- As a user, I want to update an endpoint's name and configuration, so that I can keep my setup organized.
- As a user, I want to delete an endpoint, so that I can remove endpoints I no longer need.
- As a user, I want each endpoint to have a unique URL, so that I can point different integrations at different endpoints.

## Components Involved
- `client/src/pages/dashboard/DashboardPage.tsx` -- Endpoint list, create dialog, delete dialog
- `client/src/components/webhook/WebhookCard.tsx` -- Endpoint card with name, URL, status, stats, options menu
- `client/src/lib/firestore.ts` -- getEndpoints, getEndpoint, createEndpoint, updateEndpoint, deleteEndpoint
- `client/src/lib/api.ts` -- ApiClient methods (legacy Deno server interface)
- `server/routes/endpoints.ts` -- REST API for CRUD operations (legacy Deno server)
- `server/services/store.ts` -- In-memory store with endpoint operations
- `functions/src/index.ts` -- onEndpointCreated, onEndpointDeleted triggers
- `firestore.rules` -- Access control for endpoints collection

## Data Model

### Firestore `endpoints/{endpointId}` Document
```typescript
{
  name: string,                 // User-defined name (max 100 chars)
  userId: string,               // Owner's Firebase UID
  script: string,               // JavaScript to execute on incoming requests
  isActive: boolean,            // Endpoint active status
  defaultStatusCode: number,    // Default HTTP response status (200)
  defaultContentType: string,   // Default response content type ("application/json")
  defaultBody: string,          // Default response body ('{"ok": true}')
  totalExecutions: number,      // Counter maintained by Cloud Functions
  createdAt: Timestamp,         // Server timestamp, immutable
  updatedAt: Timestamp          // Updated on each modification
}
```

### Client-side Endpoint Type
```typescript
interface Endpoint {
  id: string;
  userId: string;
  name: string;
  script: string;
  defaultStatusCode: number;
  defaultContentType: string;
  defaultBody: string;
  createdAt: string;   // ISO string
}
```

## API Endpoints

### Firestore Direct (current implementation)
- `getEndpoints(userId)` -- Query endpoints where `userId == uid`, ordered by `createdAt desc`
- `getEndpoint(endpointId)` -- Direct document read
- `createEndpoint(userId, name)` -- Add new document with default script
- `updateEndpoint(endpointId, data)` -- Partial update of name, script, default response fields
- `deleteEndpoint(endpointId)` -- Delete document

### Legacy Deno Server API
- `GET /api/endpoints` -- List user's endpoints (auth required)
- `POST /api/endpoints` -- Create endpoint (name required, script optional)
- `GET /api/endpoints/:id` -- Get endpoint details (ownership verified)
- `PUT /api/endpoints/:id` -- Update endpoint fields
- `DELETE /api/endpoints/:id` -- Delete endpoint and associated request logs

## UI Flow
1. Dashboard shows "ADD NEW" button in the action bar
2. Clicking opens a dialog asking for an endpoint name
3. Enter key or "Create Endpoint" button submits; optimistic update prepends new endpoint to list
4. Each endpoint card shows: name, webhook URL (`{origin}/w/{id}`), creation date, status, stats, and an options menu
5. Options dropdown contains "Delete" action
6. Delete opens a confirmation dialog warning about permanent deletion of endpoint and all associated requests
7. Empty state shows a message with a "ADD NEW" button

## Business Rules
- Endpoint name is required and trimmed of whitespace
- Endpoint name maximum length is 100 characters (enforced in Firestore rules)
- Guest users are limited to 3 endpoints (enforced in Firestore rules via endpointCount check)
- Endpoint ownership cannot be transferred (userId is immutable after creation, enforced in Firestore rules)
- createdAt is immutable (enforced in Firestore rules)
- Deleting an endpoint cascades to delete all associated executions (Cloud Function trigger)
- New endpoints get a default script template with request object documentation
- Each endpoint's webhook URL follows the pattern: `{origin}/w/{endpointId}`
- Request logs are capped at 100 per endpoint (in-memory store limit)

## Dependencies
- [001 - Authentication](001-authentication.md) -- User must be authenticated to manage endpoints
- Firestore database
- Cloud Functions (for counter maintenance and cascade deletes)

## Current Status
**Implemented** -- Full CRUD is functional via Firestore. The client creates/reads/updates/deletes endpoints directly through Firestore SDK. Cloud Function triggers maintain the endpoint count on user documents and handle cascade deletes of executions.

## Technical Notes
- The webhook URL displayed in the UI uses `window.location.origin` so it adapts to the current deployment environment (localhost, staging, production).
- All endpoints are treated as "active" in the current implementation -- there is no explicit activation/deactivation toggle, though the UI has filter pills for "Active" and "Closed" status.
- The `totalExecutions` counter is maintained atomically by the `recordExecution` Cloud Function using `FieldValue.increment`.
- The `onEndpointDeleted` trigger performs batch deletes of executions in chunks of 500 to stay within Firestore batch limits.
- The legacy Deno server uses an in-memory `Map<string, Endpoint>` store, meaning data is lost on server restart.
