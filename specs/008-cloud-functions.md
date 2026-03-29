# 008 - Firebase Cloud Functions

## Feature Name
Firebase Cloud Functions (Backend Logic)

## Description
A suite of Firebase Cloud Functions (2nd generation, deployed to europe-west1) providing server-side business logic including guest data seeding, webhook execution recording with quota enforcement, execution log clearing, endpoint counter maintenance via Firestore triggers, daily cleanup of old executions, and hourly analytics aggregation.

## User Stories
- As a guest user, I want demo data pre-populated when I sign in, so that I can explore the platform immediately.
- As the system, I want to record webhook executions atomically with quota enforcement, so that usage limits are respected.
- As a user, I want to clear all request logs for an endpoint, so that I can start fresh.
- As the system, I want endpoint counts on user documents to stay accurate, so that quota checks work correctly.
- As the system, I want old execution logs cleaned up automatically, so that storage costs are managed.
- As the system, I want aggregated analytics computed hourly, so that usage dashboards have data.

## Components Involved
- `functions/src/index.ts` -- All Cloud Function definitions
- `functions/src/index.test.ts` -- Unit tests for callable functions

## Functions

### 1. `seedGuestData` (onCall)
- **Trigger**: Client-side call via `httpsCallable(functions, "seedGuestData")`
- **Auth**: Required (checks `request.auth.uid`)
- **Idempotency**: Checks `seeded` flag on user document; returns early if already seeded
- **Behavior**: Creates 6 sample endpoints with 1-3 sample execution logs each via batch write. Marks user as `seeded` and sets `endpointCount`.
- **App Check**: Enforced in production, skipped in emulator mode

### 2. `recordExecution` (onCall)
- **Trigger**: Called by the server/Cloud Run when a webhook is received
- **Auth**: Required
- **Behavior**:
  1. Verifies endpoint ownership
  2. Checks daily execution quota (100 for anonymous, 10000 for registered)
  3. Records execution document in a transaction
  4. Increments endpoint's `totalExecutions` and `lastExecutedAt`
  5. Increments user's `quotas.usedExecutionsToday`
- **Error handling**: Throws `resource-exhausted` when quota exceeded, `permission-denied` for wrong owner

### 3. `clearExecutions` (onCall)
- **Trigger**: Client-side call when "DELETE ALL" is clicked
- **Auth**: Required
- **Behavior**: Verifies endpoint ownership, then batch-deletes all execution documents for the endpoint in chunks of 500. Resets `totalExecutions` counter to 0.

### 4. `onEndpointCreated` (Firestore trigger)
- **Trigger**: `endpoints/{endpointId}` document created
- **Behavior**: Increments the user's `endpointCount` by 1

### 5. `onEndpointDeleted` (Firestore trigger)
- **Trigger**: `endpoints/{endpointId}` document deleted
- **Behavior**: Decrements the user's `endpointCount` by 1, then batch-deletes all associated execution documents in chunks of 500

### 6. `cleanupOldExecutions` (Scheduled)
- **Schedule**: Every 24 hours (Europe/London timezone)
- **Behavior**: Deletes all execution documents older than 30 days in batches of 500. Resets `quotas.usedExecutionsToday` to 0 for all users.

### 7. `aggregateAnalytics` (Scheduled)
- **Schedule**: Every 1 hour (Europe/London timezone)
- **Behavior**: Queries all executions from today, computes:
  - Total executions, success/fail counts
  - Average execution duration
  - Per-endpoint stats (count, average duration)
  - Writes/merges to `analytics/{YYYYMMDD}` document

## Data Model

### Firestore `executions/{executionId}`
```typescript
{
  endpointId: string,
  userId: string,
  method: string,
  url: string,
  headers: Record<string, string>,
  query: Record<string, string>,
  body: string,
  ip: string,
  responseStatus: number,
  responseBody: string,
  status: "success" | "error",
  duration: number,           // Execution time in ms
  timestamp: Timestamp
}
```

### Firestore `analytics/{YYYYMMDD}`
```typescript
{
  date: string,                // "YYYYMMDD"
  totalExecutions: number,
  successfulExecutions: number,
  failedExecutions: number,
  averageExecutionTime: number,
  endpointStats: Record<string, { count: number, avgDuration: number }>,
  updatedAt: Timestamp
}
```

## API Endpoints
All callable functions are invoked via Firebase `httpsCallable`:
- `seedGuestData({})` -- No arguments needed
- `recordExecution({ endpointId, execution })` -- Execution data object
- `clearExecutions({ endpointId })` -- Endpoint ID to clear

## Business Rules
- All callable functions require authentication
- App Check is enforced in production but bypassed in emulator mode
- Batch deletes are limited to 500 documents per batch (Firestore limit)
- Execution logs older than 30 days are automatically purged
- Daily quotas reset at the cleanup schedule (every 24 hours)
- Guest seeding creates 6 named endpoints: Payment Webhooks, Order Notifications, User Signups, Stripe Events, GitHub Push Events, Slack Alerts

## Dependencies
- Firebase Admin SDK
- Firestore database
- [001 - Authentication](001-authentication.md) -- For user identity
- [002 - Webhook Endpoint Management](002-webhook-endpoint-management.md) -- For endpoint data

## Current Status
**Implemented** -- All 7 functions are defined and have unit tests for the 3 callable functions. Scheduled functions and Firestore triggers are implemented but require deployment to verify.

## Technical Notes
- All functions are configured with `region: "europe-west1"`.
- The client SDK is configured to use `getFunctions(app, "europe-west1")` to match.
- `FieldValue.increment()` is used for atomic counter updates in transactions.
- The `uuid` package (v4) is used for generating execution IDs.
- Batch writes are used extensively for both seeding and cleanup to stay within Firestore transaction limits.
- Tests use `firebase-functions-test` in offline mode with vitest.
