# 020 - API Client and Data Layer

## Feature Name
API Client and Data Abstraction Layer

## Description
Two parallel data access layers: a REST API client class for the legacy Deno server, and a Firestore direct-access module for the Firebase-based architecture. Both provide type-safe interfaces for user, endpoint, and request log operations. The client currently uses the Firestore path exclusively.

## User Stories
- As a developer, I want a typed API client, so that data operations are type-safe and centralized.
- As the system, I want data access to be abstracted, so that the underlying storage can be swapped without changing page components.

## Components Involved
- `client/src/lib/api.ts` -- REST API client class (legacy, not actively used by pages)
- `client/src/lib/firestore.ts` -- Firestore CRUD operations and real-time listeners (active)

## TypeScript Interfaces (shared)
```typescript
interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface Endpoint {
  id: string;
  userId: string;
  name: string;
  script: string;
  defaultStatusCode: number;
  defaultContentType: string;
  defaultBody: string;
  createdAt: string;
}

interface RequestLog {
  id: string;
  endpointId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  ip: string;
  responseStatus: number;
  responseBody: string;
  timestamp: string;
}

interface Stats {
  totalEndpoints: number;
  totalRequests: number;
  recentRequests: RequestLog[];
}
```

## REST API Client (`api.ts`)

### Authentication
- Token stored in `localStorage`
- `setToken(token)` / `getToken()`
- All requests include `Authorization: Bearer {token}` header

### Methods
| Method | Path | HTTP |
|--------|------|------|
| `login(email, password)` | `/api/auth/login` | POST |
| `register(email, password)` | `/api/auth/register` | POST |
| `getMe()` | `/api/auth/me` | GET |
| `getEndpoints()` | `/api/endpoints` | GET |
| `createEndpoint(name)` | `/api/endpoints` | POST |
| `getEndpoint(id)` | `/api/endpoints/:id` | GET |
| `updateEndpoint(id, data)` | `/api/endpoints/:id` | PUT |
| `deleteEndpoint(id)` | `/api/endpoints/:id` | DELETE |
| `getRequestLogs(endpointId)` | `/api/endpoints/:id/requests` | GET |
| `clearRequestLogs(endpointId)` | `/api/endpoints/:id/requests` | DELETE |
| `getStats()` | `/api/endpoints/_stats` | GET |

## Firestore Module (`firestore.ts`)

### User Operations
- `createUserDocument(uid, email, isAnonymous)` -- Creates/merges user doc with quotas
- `getUserDocument(uid)` -- Returns User or null
- `updateLastLogin(uid)` -- Updates lastLoginAt timestamp

### Endpoint Operations
- `getEndpoints(userId)` -- Query by userId, ordered by createdAt desc
- `getEndpoint(endpointId)` -- Direct document read
- `createEndpoint(userId, name)` -- Creates with default script and settings
- `updateEndpoint(endpointId, data)` -- Partial update
- `deleteEndpoint(endpointId)` -- Direct delete

### Execution Operations
- `getExecutions(endpointId)` -- Query by endpointId, limited to 100, ordered by timestamp desc
- `clearExecutions(endpointId)` -- Cloud Function callable

### Real-Time Listeners
- `onEndpointsSnapshot(userId, callback)` -- Returns Unsubscribe
- `onExecutionsSnapshot(endpointId, callback)` -- Returns Unsubscribe

### Helpers
- `toTimestampString(ts)` -- Converts Firestore Timestamp to ISO string
- `docToEndpoint(id, data)` -- DocumentData to Endpoint type
- `docToRequestLog(id, data)` -- DocumentData to RequestLog type
- `seedGuestData()` -- Cloud Function callable wrapper

## Business Rules
- All Firestore timestamps are converted to ISO strings for consistent client-side handling
- The REST API client normalizes errors: non-ok responses are parsed for error messages
- Default values are used for missing document fields (e.g., empty string for name, 200 for defaultStatusCode)
- The REST API client is exported as a singleton instance (`export const api = new ApiClient()`)

## Dependencies
- Firebase SDK (firestore, functions)
- [010 - Firebase Integration](010-firebase-integration.md) -- Firebase initialization

## Current Status
**Implemented** -- Both data layers are fully coded. The Firestore module is the active data layer used by all page components. The REST API client is available but not imported by any page component.

## Technical Notes
- The Firestore module uses `serverTimestamp()` for all time-related fields, ensuring consistent server-side timestamps.
- `clearExecutions` goes through a Cloud Function rather than direct Firestore deletes because client-side execution deletion is denied by Firestore rules.
- The `toTimestampString` helper handles both Firestore `Timestamp` instances and raw `{seconds}` objects for compatibility with different Firestore SDK behaviors.
- The REST API client uses the Vite proxy (`/api -> localhost:3000`) during development.
