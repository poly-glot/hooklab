# 010 - Firebase Integration

## Feature Name
Firebase Platform Integration

## Description
End-to-end integration with Firebase services including Authentication, Firestore (database), Cloud Functions, and Hosting. The Firebase configuration supports both production deployment and local emulator development, with a unified initialization module that switches between modes based on environment variables.

## User Stories
- As a developer, I want to develop locally with Firebase emulators, so that I do not need a live Firebase project during development.
- As the system, I want a unified Firebase initialization, so that all services connect to the correct environment automatically.
- As the system, I want Firestore security rules, so that data access is controlled at the database level.

## Components Involved
- `client/src/lib/firebase-init.ts` -- Firebase app initialization with emulator/production switching
- `client/src/lib/firestore.ts` -- Firestore CRUD operations and real-time listeners
- `firebase.json` -- Firebase project configuration (Hosting, Functions, Firestore, Emulators)
- `firestore.rules` -- Firestore security rules
- `firestore.indexes.json` -- Firestore index definitions
- `.firebaserc` -- Firebase project aliases
- `client/.env.development` -- Development environment variables
- `client/.env.production` -- Production environment variables

## Firebase Services Used

### 1. Firebase Authentication
- Google OAuth provider
- Anonymous (guest) sign-in
- Email/password authentication
- Account linking (guest to permanent)

### 2. Cloud Firestore
- Collections: `users`, `endpoints`, `executions`, `analytics`
- Real-time listeners (`onSnapshot`) for endpoints and executions
- Server timestamps for audit fields
- Batch writes for seeding and cleanup

### 3. Cloud Functions (2nd gen)
- Region: europe-west1
- Callable functions: seedGuestData, recordExecution, clearExecutions
- Firestore triggers: onEndpointCreated, onEndpointDeleted
- Scheduled functions: cleanupOldExecutions (daily), aggregateAnalytics (hourly)

### 4. Firebase Hosting
- Serves the React SPA from `client/dist`
- URL rewrites: `/api/**` and `/w/**` -> Cloud Run service
- SPA fallback: `**` -> `/index.html`
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy

## Configuration

### Emulator Mode
Activated by: `VITE_FIREBASE_USE_EMULATORS=true`
```javascript
{
  apiKey: "demo-key",
  projectId: "demo-webhook",
  authDomain: "localhost"
}
```
Emulator ports:
- Auth: 9099
- Firestore: 8080
- Functions: 5001
- Hosting: 5002
- Emulator UI: 4000

### Production Mode
Uses environment variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Firestore Security Rules

### Default
- All access denied by default

### Users (`/users/{userId}`)
- Read: Owner only
- Create: Owner, must include email/createdAt/isAnonymous, createdAt must be timestamp
- Update: Owner, createdAt immutable

### Endpoints (`/endpoints/{endpointId}`)
- Read: Authenticated + owner (checks `resource.data.userId`)
- Create: Authenticated + owner, name required (max 100 chars), guest limited to 3 endpoints
- Update: Owner, userId and createdAt immutable
- Delete: Owner

### Executions (`/executions/{executionId}`)
- Read: Authenticated + owner (checks `resource.data.userId`)
- Create/Update/Delete: Denied (backend-only writes via Cloud Functions)

### Analytics (`/analytics/{date}`)
- Read: Any authenticated user
- Write: Denied (backend-only writes)

## Business Rules
- Emulator mode uses a "demo-webhook" project ID, which requires no real Firebase project
- All emulators bind to `0.0.0.0` for container accessibility
- Cloud Functions region is consistently `europe-west1` across client and server
- Firebase Hosting is configured with `singleProjectMode: true` for emulators
- Security headers are applied to all hosted files

## Dependencies
- Firebase project (production) or Firebase CLI emulators (development)
- GCP project with required APIs enabled (see [012 - Infrastructure](012-infrastructure-terraform.md))

## Current Status
**Implemented** -- Full Firebase integration with emulator support. Firestore rules are comprehensive with row-level security. Real-time listeners are available but not currently used by the dashboard (uses one-time reads instead).

## Technical Notes
- The `firebase.json` hosting rewrites route `/api/**` and `/w/**` to a Cloud Run service named `hooklab-api` in `us-central1`. This means the Deno API server runs as a Cloud Run service in production.
- Functions are deployed from the `functions/` directory using the Firebase Functions 2nd generation SDK.
- The Firestore rules use helper functions (`isAuthenticated`, `isOwner`, `isAnonymous`, `hasValidString`) for readability.
- The anonymous user endpoint limit (3) is enforced by checking `endpointCount` on the user document in the Firestore rules create condition.
- Real-time listeners (`onEndpointsSnapshot`, `onExecutionsSnapshot`) are implemented in `firestore.ts` but the dashboard currently uses `getEndpoints` (one-time read) instead.
