# Hooklab E2E Test Plan

## Current Coverage Audit

### Existing tests (11 UI specs + 6 integration specs)

| Area | File | Coverage |
|------|------|----------|
| Landing page | `landing.spec.ts` | Full |
| Auth page / Guest login | `auth.spec.ts` | Partial (guest OK, email link = "coming soon") |
| Dashboard layout + CRUD | `dashboard.spec.ts` | Full |
| Endpoint detail layout | `endpoint-detail.spec.ts` | Full |
| Endpoint disable/enable | `endpoint-disable.spec.ts` | Full |
| Endpoint edit panel | `endpoint-edit.spec.ts` | Full |
| Live toggle | `endpoint-toggle-live.spec.ts` | Full |
| Script save + execute | `script-save-and-actions.spec.ts` | Full |
| Sidebar requests | `sidebar-requests.spec.ts` | Full |
| Request deletion | `request-actions.spec.ts` | Full |
| Responsive | `responsive.spec.ts` | Full |
| API auth (legacy) | `integration/api-auth.spec.ts` | Legacy register/login path |
| Endpoint CRUD (API) | `integration/endpoint-crud.spec.ts` | Legacy register path |
| Full webhook flow (API) | `integration/full-webhook-flow.spec.ts` | Legacy register path |
| Scripting (API) | `integration/scripting.spec.ts` | Legacy register path |
| Webhook receiver (API) | `integration/webhook-receiver.spec.ts` | Legacy register path |
| Webhook via proxy | `integration/webhook-via-proxy.spec.ts` | Legacy register path |

### Missing coverage

| Area | Priority | Notes |
|------|----------|-------|
| Email link auth flow | HIGH | UI is wired, zero E2E tests |
| Guest account upgrade | HIGH | `upgradeUserDocument` was recently fixed, never E2E tested |
| Guest quota enforcement | HIGH | 10-endpoint limit, error UX on breach |
| Seeded demo data verification | MEDIUM | 6 endpoints + executions after guest login |
| Filter pill counts (All/Active/Closed) | MEDIUM | Numbers must update on create/delete/disable |
| Disabled endpoint rejects webhooks | MEDIUM | Should return 404 |
| Reports page | MEDIUM | Chat UI, query, formats, duration restrictions |
| Session persistence on reload | LOW | `browserSessionPersistence` behavior |
| Logout flow | LOW | Sign out, redirect to /auth |
| Route guards | LOW | Protected routes redirect unauthenticated users |

---

## Gotchas: Emulator vs Staging

### Critical issues to address before writing tests

#### 1. Firestore cleanup targets wrong database (BUG)

`emulator-helpers.ts:141` clears `(default)` database, but the app uses the named `hooklab` database (`firebase-init.ts:38`).

**Fix required:**
```diff
- `http://${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
+ `http://${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/hooklab/documents`
```

#### 2. Vite port mismatch

`vite.config.ts` configures port `5173`. `playwright.config.ts` defaults to `http://localhost:5174`. The webServer block starts Vite which binds to 5173, but Playwright connects to 5174 — tests will fail unless Vite's port was already taken and it auto-incremented.

**Fix required:** Align `playwright.config.ts` BASE_URL to `http://localhost:5173`, or explicitly set `--port 5174` in the webServer command.

#### 3. Emulator vs staging behavioral differences

| Concern | Emulator | Staging | Test impact |
|---------|----------|---------|-------------|
| Auth tokens | `alg: "none"`, unsigned | Real RS256 JWT | Integration tests using legacy `registerUser` won't work on staging |
| Google OAuth | Cannot test (popup) | Cannot test (headless) | Skip in both environments; test only to the redirect boundary |
| Email link delivery | OOB codes available via emulator REST API | Real email via Resend | Emulator: extract link from API. Staging: cannot automate without mailbox |
| BigQuery / Gemini | `FIRESTORE_EMULATOR_HOST` triggers local fallback | Real BQ + Gemini | Reports tests need emulator-only tag |
| Seed data timing | Server `/api/auth/seed` is synchronous | Same | `loginAsGuest` calls seed fire-and-forget. Must wait for endpoint cards, not assume instant |
| Rate limiting | In-memory, resets on restart | Same | Parallel tests on same endpoint ID can hit 429. Use unique endpoints per test |
| Session persistence | `browserSessionPersistence` — lost on new context | Same | Each `test()` gets fresh context, must re-login |

#### 4. Emulator-only test guard pattern

Tests depending on emulator APIs must skip gracefully on staging:
```ts
test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'Requires Firebase emulators');
```

---

## New Test Specs

### 1. `guest-seed-data.spec.ts` — Guest Login + Demo Data

Verifies core guest onboarding: seed data populates, dashboard renders all 6 demo endpoints.

```
SUITE: Guest Seed Data

  TEST: guest login seeds 6 demo endpoints
    1. loginAsGuest(page)
    2. Wait for dashboard to load
    3. Assert 6 endpoint cards visible:
       Payment Webhooks, Order Notifications, User Signups,
       Stripe Events, GitHub Push Events, Slack Alerts
    4. Assert each card shows "Active" status
    GOTCHA: Seed is fire-and-forget in AuthContext.
    Poll for 6 cards with up to 15s timeout.

  TEST: seeded endpoints have execution logs
    1. loginAsGuest(page)
    2. Click first endpoint card (e.g. "Payment Webhooks")
    3. Navigate to detail page
    4. Assert sidebar request list has >= 1 item
    GOTCHA: Seeded executions use server timestamps.
    Check for request-list items, not specific times.

  TEST: seed is idempotent — refresh does not duplicate data
    1. loginAsGuest(page)
    2. Wait for 6 endpoints
    3. page.reload()
    4. Wait for dashboard
    5. Assert still exactly 6 endpoint cards (not 12)
```

### 2. `email-link-auth.spec.ts` — Email Link Login (Emulator Only)

Email link auth is wired in AuthPage but has zero E2E coverage.

```
SUITE: Email Link Auth
  SKIP: !process.env.FIRESTORE_EMULATOR_HOST

  TEST: clicking "Continue with Email Link" shows email input form
    1. Navigate to /auth
    2. Click "Continue with Email Link" button
    3. Assert email input visible (placeholder: "Enter your email")
    4. Assert "Send Link" button visible

  TEST: submitting email sends link and shows cooldown
    1. Show email input
    2. Fill email "test@example.com"
    3. Click "Send Link"
    4. Assert cooldown text visible (e.g. "Wait 60s")
    5. Assert "Link sent to test@example.com" message visible

  TEST: extracting OOB code from emulator completes sign-in
    1. Submit email "e2e-link-{timestamp}@test.com"
    2. GET http://localhost:9099/emulator/v1/projects/demo-webhook/oobCodes
    3. Filter response for matching email, extract oobLink
    4. Navigate to the oobLink URL
    5. Assert redirect to /dashboard
    6. Assert dashboard loads with authenticated state
    GOTCHA: OOB endpoint returns ALL codes — filter by email.
    Link contains full URL with apiKey and oobCode params.
    Vite app handles the link at /auth route.

  TEST: rate limit prevents rapid re-sends
    1. Submit email
    2. Assert "Send Link" button is disabled while cooldown > 0
    3. Assert button text shows countdown number
```

### 3. `account-upgrade.spec.ts` — Guest to Registered Upgrade

`upgradeAccount` / `upgradeUserDocument` was recently fixed but never E2E tested.

```
SUITE: Account Upgrade
  SKIP: !process.env.FIRESTORE_EMULATOR_HOST

  TEST: guest user sees upgrade prompt in UI
    1. loginAsGuest(page)
    2. Look for upgrade CTA (sidebar, banner, or profile menu)
    3. Assert it's visible for anonymous users
    BLOCKER: If no upgrade UI exists yet, this test documents the gap.

  TEST: (API-level) upgraded user doc has registered quotas
    1. Sign in anonymously via Firebase Auth emulator REST API
    2. Get the anonymous user's Firebase ID token
    3. Link an email/password credential via REST API
    4. Read user doc from Firestore emulator REST API
    5. Assert isAnonymous === false
    6. Assert quotas.maxEndpoints === 50
    7. Assert quotas.maxExecutionsPerDay === 10000
    GOTCHA: Firebase Auth emulator REST API for linking:
    POST identitytoolkit.googleapis.com/v1/accounts:update
```

### 4. `guest-quota.spec.ts` — Guest Endpoint Limits

Quota enforcement was the original bug in this branch. Must prove E2E.

```
SUITE: Guest Endpoint Quota

  TEST: guest can create endpoints up to the limit
    1. loginAsGuest(page) — gets 6 seeded endpoints
    2. Create 4 more via UI (total = 10, the limit)
    3. Assert all 10 endpoint cards visible

  TEST: guest is blocked at endpoint limit with error
    1. loginAsGuest(page) — 6 seeded
    2. Create 4 more via UI (total = 10)
    3. Click "ADD NEW", fill name, click "Create Endpoint"
    4. Assert error toast visible containing "limit" or "quota"
    5. Assert endpoint count remains 10
    GOTCHA: Two creation paths exist — client SDK (addDoc) and
    server API (POST /api/endpoints). UI uses client SDK path
    which is blocked by Firestore rules.

  TEST: deleting an endpoint frees quota for new creation
    1. Login as guest, create to limit (10)
    2. Delete one endpoint via dropdown -> Delete -> Confirm
    3. Wait briefly (endpointCount decrement is fire-and-forget)
    4. Create a new endpoint
    5. Assert creation succeeds
    GOTCHA: endpointCount decrement is async. May need
    a short retry loop before the next create succeeds.
```

### 5. `endpoint-counts.spec.ts` — Filter Pill Counts

Dashboard shows All (N) / Active (N) / Closed (N) counts. No test verifies accuracy.

```
SUITE: Endpoint Filter Counts

  TEST: counts update after creating endpoints
    1. loginAsGuest(page)
    2. Parse initial count from "All" pill text
    3. Create 2 endpoints
    4. Assert "All" count increased by 2
    5. Assert "Active" count increased by 2
    6. Assert "Closed" count unchanged

  TEST: disabling endpoint updates Active/Closed counts
    1. Login, create endpoint "Count Test"
    2. Disable it via dropdown
    3. Assert "Active" decreased by 1
    4. Assert "Closed" increased by 1
    5. Assert "All" unchanged

  TEST: deleting endpoint decreases All count
    1. Login, create endpoint
    2. Delete it
    3. Assert "All" decreased by 1
```

### 6. `disabled-endpoint-webhook.spec.ts` — Inactive Endpoint Rejection

Spec 006 says disabled endpoints return 404. Toggle test exists but doesn't verify rejection.

```
SUITE: Disabled Endpoint Webhook Rejection

  TEST: webhook to disabled endpoint returns 404
    1. loginAsGuest(page)
    2. Create endpoint, navigate to detail
    3. Get endpointId from URL
    4. sendWebhook(endpointId) -> assert status 200 (working)
    5. Toggle Live -> Off via UI
    6. sendWebhook(endpointId) -> assert status 404
    7. Assert response body contains "Endpoint is disabled"
    8. Toggle Off -> Live
    9. sendWebhook(endpointId) -> assert status 200 (restored)
```

### 7. `live-realtime.spec.ts` — Live/Auto-Refresh Updates

Existing `sidebar-requests.spec.ts` tests request appearance but not the Live toggle's polling behavior.

```
SUITE: Live Auto-Refresh

  TEST: Live ON — new webhooks appear without page interaction
    1. loginAsGuest, create endpoint, navigate to detail
    2. Assert Live toggle shows "Live" (ON by default)
    3. Get endpointId
    4. sendWebhook(endpointId) x2 from test (not from page)
    5. Assert request list count reaches 2 within 10s
    6. sendWebhook(endpointId) x1
    7. Assert count reaches 3 within 5s (3s polling interval)

  TEST: Live OFF — webhooks do NOT appear automatically
    1. Create endpoint, navigate to detail
    2. Click Live toggle -> Off
    3. sendWebhook(endpointId) x2
    4. Wait 5 seconds
    5. Assert request list still shows 0 (or previous count)
    6. Click Live toggle -> On
    7. Assert requests appear within 5s
    GOTCHA: Polling interval is 3s. After toggling ON,
    allow up to 5s for the first poll cycle.
```

### 8. `reports.spec.ts` — Reports Page (Emulator Only)

Reports page has zero E2E coverage. In emulator mode, BigQuery is replaced by Firestore fallback and Gemini returns canned responses.

```
SUITE: Reports Page
  SKIP: !process.env.FIRESTORE_EMULATOR_HOST

  TEST: reports page loads with chat UI
    1. loginAsGuest(page)
    2. Navigate to /dashboard/reports
    3. Assert chat input visible
    4. Assert suggestion chips visible
    5. Assert duration selector visible (default: "7 days")
    6. Assert format selector visible

  TEST: submitting a query returns results
    1. Navigate to reports
    2. Type "How many webhooks did I get?" in chat input
    3. Press Enter or click send
    4. Assert loading indicator appears
    5. Assert response message appears with data
    GOTCHA: Emulator mode returns Firestore query results
    formatted as if from BigQuery. Data comes from seeded executions.

  TEST: guest is restricted to 7-day duration
    1. Login as guest, navigate to reports
    2. Select "30 days" duration
    3. Submit a query
    4. Assert error message: "Anonymous users are limited to 7-day queries"

  TEST: clicking suggestion chip fills the input
    1. Navigate to reports
    2. Click first suggestion chip
    3. Assert chat input contains the suggestion text
```

### 9. `session-and-guards.spec.ts` — Session + Route Guards

No test verifies session persistence or protected route redirects.

```
SUITE: Session and Route Guards

  TEST: protected route redirects to /auth when unauthenticated
    1. page.goto('/dashboard')
    2. Assert URL becomes /auth

  TEST: /auth redirects to /dashboard when authenticated
    1. loginAsGuest(page)
    2. page.goto('/auth')
    3. Assert URL becomes /dashboard

  TEST: session survives page reload
    1. loginAsGuest(page)
    2. page.reload()
    3. Assert URL is /dashboard (not /auth)
    4. Assert endpoint list visible
    GOTCHA: browserSessionPersistence keeps auth within
    the browser session. reload() preserves it.
    A new browser context will NOT have auth.

  TEST: logout redirects and clears session
    1. loginAsGuest(page)
    2. Open profile/user dropdown
    3. Click "Log out" / "Sign Out"
    4. Assert URL is / or /auth
    5. page.goto('/dashboard')
    6. Assert redirected back to /auth
```

---

## New Page Object Required

### `e2e/pages/reports.page.ts`

```ts
class ReportsPage {
  chatInput: Locator;
  sendButton: Locator;
  suggestionChips: Locator;
  durationSelector: Locator;
  formatSelector: Locator;
  messageList: Locator;
  loadingIndicator: Locator;
  downloadButton: Locator;
  conversationList: Locator;
  newConversationButton: Locator;

  goto(): navigates to /dashboard/reports
  expectLoaded(): asserts chat UI visible
  sendQuery(text: string): types and submits
  selectDuration(label: string): picks duration
  selectFormat(label: string): picks format
  clickSuggestion(index: number): clicks chip
  expectResponse(): waits for response message
  expectError(text: string): asserts error in chat
}
```

---

## Infrastructure Fixes Required

### 1. Fix Firestore emulator cleanup URL

File: `e2e/fixtures/emulator-helpers.ts:141`

```diff
- `http://${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
+ `http://${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/hooklab/documents`
```

### 2. Fix Vite port in Playwright config

File: `playwright.config.ts:3`

```diff
- const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
+ const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
```

Also update the webServer command to be explicit:
```diff
- command: 'npx vite --host --mode development',
+ command: 'npx vite --host --port 5173 --mode development',
```

### 3. Add staging project to Playwright config

```ts
{
  name: 'staging',
  testIgnore: [/integration\//, /email-link/, /account-upgrade/],
  use: {
    baseURL: process.env.STAGING_URL,
  },
}
```

### 4. Forward port 5174 in devcontainer (if keeping that port)

If the port mismatch was intentional (5174 to avoid conflicts), add it to `devcontainer.json` and `docker-compose.yml`.

---

## Execution Priority

| Phase | Specs | Rationale |
|-------|-------|-----------|
| **Phase 1** | `guest-seed-data`, `guest-quota`, `disabled-endpoint-webhook` | Validates the fixes shipped in this branch |
| **Phase 2** | `email-link-auth`, `endpoint-counts`, `session-and-guards` | Core auth + UI correctness |
| **Phase 3** | `live-realtime`, `reports` | Feature completeness |
| **Phase 4** | `account-upgrade` | May require UI work if no upgrade CTA exists |

---

## DevContainer Requirements

The devcontainer must have Playwright and its browser binaries pre-installed for E2E test execution. Required additions:

- `@playwright/test` npm package (already in `client/package.json` devDeps)
- Playwright system dependencies (browser libs for Chromium)
- `npx playwright install --with-deps chromium` in post-create
- Port 5173 forwarded (Vite) — already present
- Firebase emulators running — manual step (documented)
- Deno API server running — manual step (documented)
