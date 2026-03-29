# 001 - Authentication

## Feature Name
User Authentication (Firebase Auth)

## Description
Multi-method authentication system supporting Google OAuth, anonymous (guest) sign-in, and planned Apple/Email Link methods. Handles user session lifecycle including registration, login, logout, and guest-to-permanent account upgrade. Built on Firebase Authentication with Firestore-backed user profiles.

## User Stories
- As a visitor, I want to sign in with my Google account, so that I can access my webhook endpoints securely.
- As a visitor, I want to try the platform as a guest without creating an account, so that I can evaluate the product quickly.
- As a guest user, I want to upgrade my account to a permanent email/password account, so that I retain my endpoints and data.
- As an authenticated user, I want to log out, so that my session is terminated securely.
- As a returning user, I want my session to persist, so that I do not need to re-authenticate on every visit.

## Components Involved
- `client/src/context/AuthContext.tsx` -- AuthProvider, useAuth hook, all auth methods
- `client/src/pages/auth/AuthPage.tsx` -- Login/register UI with Google, Apple (coming soon), Email Link (coming soon), and Guest options
- `client/src/lib/firebase-init.ts` -- Firebase app/auth initialization, emulator connection
- `client/src/lib/firestore.ts` -- createUserDocument, getUserDocument, updateLastLogin
- `client/src/App.tsx` -- ProtectedRoute, PublicRoute wrappers
- `server/routes/auth.ts` -- Server-side auth routes (legacy Deno server, not used in Firebase mode)
- `server/middleware/auth.ts` -- JWT-based auth middleware (legacy Deno server)
- `firestore.rules` -- Firestore security rules for users collection

## Data Model

### Firebase Auth User (managed by Firebase)
- `uid`: string (Firebase-assigned)
- `email`: string | null
- `isAnonymous`: boolean
- `providerData`: array of linked auth providers

### Firestore `users/{uid}` Document
```typescript
{
  email: string,                // User email or "guest_{uid_prefix}@guest.local"
  isAnonymous: boolean,         // Whether user signed in anonymously
  displayName: string,          // "Guest" for anonymous, email prefix for others
  createdAt: Timestamp,         // Server timestamp
  lastLoginAt: Timestamp,       // Updated on each sign-in
  endpointCount: number,        // Maintained by Cloud Function triggers
  seeded: boolean,              // True after guest demo data has been seeded
  quotas: {
    maxEndpoints: number,       // 3 for anonymous, 50 for registered
    maxExecutionsPerDay: number, // 100 for anonymous, 10000 for registered
    usedExecutionsToday: number  // Reset daily by scheduled function
  }
}
```

## API Endpoints

### Firebase Client SDK (current implementation)
Authentication is handled entirely client-side via Firebase Auth SDK:
- `signInWithPopup(auth, GoogleAuthProvider)` -- Google OAuth
- `signInAnonymously(auth)` -- Guest login
- `createUserWithEmailAndPassword(auth, email, password)` -- Email registration
- `signInWithEmailAndPassword(auth, email, password)` -- Email login
- `linkWithCredential(auth.currentUser, credential)` -- Guest account upgrade
- `signOut(auth)` -- Logout

### Legacy Deno Server API (server/routes/auth.ts)
- `POST /api/auth/register` -- Register with email/password, returns JWT
- `POST /api/auth/login` -- Login with email/password, returns JWT
- `GET /api/auth/me` -- Get current user (requires Bearer token)

## UI Flow
1. Unauthenticated user visits any protected route -> redirected to `/auth`
2. Auth page displays modal over a blurred faux-dashboard background
3. User chooses: Google (functional), Apple (coming soon toast), Email Link (coming soon toast), or Guest
4. On Google sign-in: Firebase popup flow -> `onAuthStateChanged` fires -> user doc created/updated -> redirect to `/dashboard`
5. On Guest sign-in: `signInAnonymously` -> demo data seeded via Cloud Function -> redirect to `/dashboard`
6. Authenticated user visits `/auth` -> auto-redirected to `/dashboard` (PublicRoute guard)
7. Session persists across page reloads via Firebase Auth persistence

## Business Rules
- Guest users are limited to 3 endpoints (enforced in Firestore rules)
- Guest users are limited to 100 executions per day (enforced in Cloud Functions)
- Registered users get 50 endpoints and 10,000 daily executions
- Guest accounts can be upgraded to permanent accounts via `linkWithCredential`
- The `createdAt` field on user documents is immutable (enforced in Firestore rules)
- Password must be at least 6 characters (server-side registration)
- Duplicate email registration is rejected (server-side)
- Apple and Email Link sign-in are stubbed as "coming soon"

## Dependencies
- Firebase Authentication service
- Firestore (for user profile storage)
- Cloud Functions (for seeding guest data)

## Current Status
**Implemented** -- Google OAuth and anonymous/guest login are fully functional. Email/password is implemented on the legacy Deno server but the client currently uses Firebase Auth directly. Apple and Email Link sign-in show "coming soon" toasts.

## Technical Notes
- The codebase has two parallel auth systems: Firebase Auth (current, used by the client) and a custom JWT system (legacy Deno server). The Firebase path is the active one.
- The legacy server auth uses SHA-256 password hashing with a static salt ("hooklab-salt") -- this is explicitly marked as not production-ready.
- JWT tokens on the legacy server expire after 7 days.
- Firebase emulator support is built in: when `VITE_FIREBASE_USE_EMULATORS=true`, the client connects to local emulators using a `demo-webhook` project ID.
- The `onAuthStateChanged` listener in AuthContext handles the full lifecycle: first-time user doc creation, returning user login timestamp update, and logout cleanup.
- Guest data seeding is idempotent -- the Cloud Function checks a `seeded` flag before creating demo data.
