# 017 - Guest Experience and Demo Data Seeding

## Feature Name
Guest User Experience with Demo Data

## Description
A frictionless onboarding flow for guest users that creates an anonymous Firebase account, seeds the account with realistic demo webhook endpoints and request logs, and provides a fully functional preview of the platform without requiring registration.

## User Stories
- As a first-time visitor, I want to try the platform without creating an account, so that I can evaluate it before committing.
- As a guest user, I want to see realistic demo data, so that I understand how the platform works with real webhooks.
- As a guest user, I want to be able to create new endpoints and receive webhooks, so that I can test the actual functionality.

## Components Involved
- `client/src/pages/auth/AuthPage.tsx` -- "Continue as Guest" button
- `client/src/context/AuthContext.tsx` -- `loginAsGuest()` method, `seedGuestData()` call
- `client/src/lib/firestore.ts` -- `seedGuestData()` Firebase callable wrapper
- `functions/src/index.ts` -- `seedGuestData` Cloud Function
- `server/services/store.ts` -- `seed()` method (legacy Deno server)

## Demo Data Created

### Endpoints (Cloud Function version - 6 endpoints)
| Name | Sample Executions |
|------|-------------------|
| Payment Webhooks | 3 |
| Order Notifications | 3 |
| User Signups | 3 |
| Stripe Events | 3 |
| GitHub Push Events | 3 |
| Slack Alerts | 3 |

### Endpoints (Legacy Deno server - 12 endpoints)
| Name | Request Count |
|------|--------------|
| Payment Webhooks | 8 |
| Order Notifications | 6 |
| User Signups | 5 |
| Stripe Events | 7 |
| GitHub Push Events | 4 |
| Slack Alerts | 3 |
| Inventory Sync | 6 |
| Email Delivery Status | 5 |
| Shipping Updates | 4 |
| Analytics Pipeline | 3 |
| CRM Contact Sync | 2 |
| CI/CD Deploy Hook | 5 |

### Sample Request Types
The legacy server includes diverse sample requests:
- Stripe payment webhook (payment_intent.succeeded)
- GitHub push event (refs/heads/main)
- Health check GET request
- Shopify order creation
- CRM contact sync (PUT)
- Resource deletion (DELETE)
- Shipping update (PATCH)
- Twilio SMS (form-urlencoded)

## Guest Seeding Flow
1. User clicks "Continue as Guest" on AuthPage
2. `loginAsGuest()` calls `signInAnonymously(auth)` (Firebase Auth)
3. `onAuthStateChanged` fires, creates user document with `isAnonymous: true`
4. `seedGuestData()` calls the Cloud Function
5. Cloud Function checks `seeded` flag -- if already seeded, returns early
6. Creates endpoints and sample executions in a batch write
7. Sets `seeded: true` and `endpointCount` on user document
8. User is redirected to `/dashboard` with pre-populated data

## Business Rules
- Seeding is idempotent: the `seeded` flag prevents duplicate data
- Guest users get quotas: 3 max endpoints, 100 max daily executions
- Guest account can be upgraded to a permanent account without losing data
- If seeding fails, the error is logged but the user is still redirected to the dashboard (graceful degradation)
- The legacy Deno server seeds data synchronously during registration for `@guest.local` emails
- Each seeded endpoint gets the default script template

## Dependencies
- [001 - Authentication](001-authentication.md) -- Anonymous sign-in
- [008 - Cloud Functions](008-cloud-functions.md) -- seedGuestData callable

## Current Status
**Implemented** -- Both Cloud Function and legacy Deno server seeding are implemented. The client uses the Cloud Function path.

## Technical Notes
- The Cloud Function version creates fewer endpoints (6 vs 12) and fewer sample executions (max 3 per endpoint vs variable) compared to the legacy Deno server version, likely for faster seeding.
- Sample execution methods cycle through POST, GET, PUT, DELETE, PATCH to demonstrate method diversity.
- The legacy server's seed data includes realistic request payloads (Stripe, GitHub, Shopify, Twilio) with appropriate headers, making the demo data look authentic.
- Execution timestamps in the legacy server are spread across recent hours with random jitter for realistic-looking activity.
- The `seedGuestData` Cloud Function uses `enforceAppCheck: !isEmulator` to skip App Check in development.
