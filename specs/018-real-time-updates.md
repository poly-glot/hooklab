# 018 - Real-Time Updates

## Feature Name
Real-Time Data Updates

## Description
Two mechanisms for keeping the UI in sync with server-side changes: Firestore real-time listeners (onSnapshot) for push-based updates, and polling-based auto-refresh on the endpoint detail page. The Firestore listeners are implemented but not currently active; the polling mechanism is the active approach.

## User Stories
- As a developer, I want new webhook requests to appear automatically, so that I can monitor incoming requests without manually refreshing.
- As a developer, I want to toggle auto-refresh on and off, so that I can control when new data loads.

## Components Involved
- `client/src/lib/firestore.ts` -- `onEndpointsSnapshot`, `onExecutionsSnapshot` (Firestore listeners)
- `client/src/pages/dashboard/EndpointDetail.tsx` -- Auto-refresh toggle and polling logic

## Implementation

### Firestore Real-Time Listeners (Available, Not Active)
```typescript
// Endpoints listener
onEndpointsSnapshot(userId, (endpoints) => { ... })
// Returns Unsubscribe function

// Executions listener
onExecutionsSnapshot(endpointId, (executions) => { ... })
// Returns Unsubscribe function
```
- Both use Firestore `onSnapshot` with the same query structure as the one-time reads
- Executions are limited to 100, ordered by timestamp desc
- Returns an unsubscribe function for cleanup

### Polling-Based Auto-Refresh (Active)
- Toggle button in EndpointDetail action bar ("Auto ON" / "Auto OFF")
- When enabled: `setInterval(fetchRequests, 3000)` polls every 3 seconds
- Interval is cleaned up on unmount or when auto-refresh is toggled off
- Visual indicator: green button when on, grey when off

## Business Rules
- Auto-refresh defaults to OFF
- Polling interval is 3 seconds
- Auto-refresh only affects request logs, not endpoint metadata
- The first request is auto-selected when requests load and no request is currently selected
- Polling continues even when the tab is not focused (no visibility API integration)

## Dependencies
- [005 - Endpoint Detail](005-endpoint-detail-request-inspection.md) -- Auto-refresh is part of the detail view
- Firestore (for listener API)

## Current Status
**Partial** -- Polling auto-refresh is fully implemented and active. Firestore real-time listeners are coded and exported but not used by any page component. Switching from polling to Firestore listeners would provide more efficient, push-based updates.

## Technical Notes
- The Firestore listeners (`onEndpointsSnapshot`, `onExecutionsSnapshot`) are fully implemented with proper type conversion (Timestamp to ISO string) and ready to be wired into components.
- Moving to Firestore listeners would eliminate the 3-second polling latency and reduce unnecessary network requests when no new data exists.
- The `useEffect` cleanup for the polling interval correctly clears the interval, preventing memory leaks.
- There is no optimistic update or deduplication logic -- each poll replaces the entire request list.
