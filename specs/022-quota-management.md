# 022 - Quota and Rate Limiting

## Feature Name
User Quota Management

## Description
A tiered quota system that limits resource usage based on user type (guest vs. registered). Quotas control the maximum number of endpoints and daily webhook executions. Enforcement happens at both the Firestore rules level (endpoints) and Cloud Functions level (executions). Daily quotas are automatically reset by a scheduled cleanup function.

## User Stories
- As a platform operator, I want to limit guest user resources, so that the free tier is not abused.
- As a registered user, I want higher quotas than guests, so that I can use the platform for real work.
- As a user, I want clear feedback when I hit a quota limit, so that I know to upgrade or wait.

## Components Involved
- `client/src/lib/firestore.ts` -- User document creation with quota initialization
- `functions/src/index.ts` -- `recordExecution` (quota check), `cleanupOldExecutions` (daily reset)
- `firestore.rules` -- Endpoint creation limit for anonymous users

## Quota Tiers

| Resource | Guest (Anonymous) | Registered |
|----------|-------------------|------------|
| Max endpoints | 3 | 50 |
| Max executions/day | 100 | 10,000 |

## Enforcement Points

### Endpoint Limit (Firestore Rules)
```
allow create: if ... &&
  (!isAnonymous() ||
   !exists(userDoc) ||
   get(userDoc).data.get('endpointCount', 0) < 3);
```
- Only enforced for anonymous users
- Checks `endpointCount` on the user document
- `endpointCount` is maintained by Cloud Function triggers (onEndpointCreated, onEndpointDeleted)

### Execution Limit (Cloud Function)
```typescript
const maxDaily = isAnon ? 100 : 10000;
const usedToday = userData?.quotas?.usedExecutionsToday ?? 0;
if (usedToday >= maxDaily) {
  throw new HttpsError("resource-exhausted", "Daily execution quota exceeded");
}
```
- Checked in `recordExecution` before recording
- Counter incremented atomically in a transaction
- Throws `resource-exhausted` error when exceeded

### Daily Reset (Scheduled Function)
- `cleanupOldExecutions` runs every 24 hours
- Resets `quotas.usedExecutionsToday` to 0 for all users

## Data Model
```typescript
// User document quotas field
quotas: {
  maxEndpoints: number,           // 3 or 50
  maxExecutionsPerDay: number,    // 100 or 10000
  usedExecutionsToday: number     // Incremented per execution, reset daily
}
```

## Business Rules
- Quota limits are set at user creation time based on `isAnonymous` flag
- Upgrading from guest to registered should update quota limits (not currently automated)
- Daily reset timing depends on the cleanup schedule (every 24 hours, Europe/London timezone)
- Quota enforcement is server-side only -- no client-side pre-check
- The `endpointCount` counter uses `FieldValue.increment` for atomic updates

## Dependencies
- [001 - Authentication](001-authentication.md) -- User type determination
- [008 - Cloud Functions](008-cloud-functions.md) -- Enforcement and reset logic

## Current Status
**Implemented** -- Endpoint limits are enforced via Firestore rules. Execution limits are enforced in the `recordExecution` Cloud Function. Daily reset is handled by the scheduled cleanup function.

## Technical Notes
- The `maxEndpoints` and `maxExecutionsPerDay` fields in the quota object are informational -- the actual limits are hardcoded in the enforcement logic (Firestore rules check for `< 3`, Cloud Function checks `isAnon ? 100 : 10000`).
- There is no UI feedback when an endpoint creation is denied by quota -- the Firestore write will fail with a permission denied error, which surfaces as a generic error toast.
- When a guest upgrades their account, the quota fields in the user document should be updated to the registered tier limits, but this is not currently automated in the `upgradeAccount` flow.
- The daily reset does not run at a fixed time (midnight) -- it runs on a 24-hour schedule from when the function was last triggered.
