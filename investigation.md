# Guest Login Investigation

## Symptom
Clicking "Continue as Guest" on https://hooklab.junaid.guru/auth does not redirect to the dashboard.

## Root Cause: Two issues

### 1. App Check enforcement on Cloud Functions
`seedGuestData` had `enforceAppCheck: true` in production, but App Check isn't configured. This caused the CORS preflight to fail, blocking the guest data seeding call.

```
Access to fetch at 'https://europe-west1-firebase-cloud-491613.cloudfunctions.net/seedGuestData'
from origin 'https://hooklab.junaid.guru' has been blocked by CORS policy
```

**Fix:** Kept `enforceAppCheck: !isEmulator` on all callable functions. Configured App Check on the client with reCAPTCHA Enterprise provider. See manual steps below for completing the setup in GCP/Firebase console.

### 2. Wrong Firestore database
Terraform created a named database `hooklab`, but client SDK, server, and Cloud Functions all targeted `(default)`.

Firestore listener URLs confirmed the issue:
```
databases/(default)/documents  <-- wrong
databases/hooklab/documents    <-- correct
```

**Fix across all layers:**
- **Client** (`client/src/lib/firebase-init.ts`): `initializeFirestore(app, {}, "hooklab")` in production
- **Server** (`server/config.ts` + `server/services/firebase-admin.ts`): New `FIRESTORE_DB` env var, defaults to `(default)` for emulators
- **Functions** (`functions/src/index.ts`): `getFirestore("hooklab")`
- **Terraform** (`terraform/apps/hooklab.tf`): Added `FIRESTORE_DB = "hooklab"` to Cloud Run env vars

## Deploy steps
1. `terraform apply` (firebase-cloud project -- for the new env var)
2. `firebase deploy --only functions --project firebase-cloud-491613`
3. Push to trigger CD (rebuilds client + server)
