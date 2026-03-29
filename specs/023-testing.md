# 023 - Testing Infrastructure

## Feature Name
Testing Infrastructure

## Description
Testing setup spanning Cloud Functions unit tests (Vitest + firebase-functions-test), client-side testing configuration (Vitest + jsdom), and E2E testing pipeline (Playwright in CI). Provides coverage reporting and test isolation for Firebase-dependent tests.

## User Stories
- As a developer, I want automated tests for Cloud Functions, so that backend logic is verified before deployment.
- As a developer, I want E2E tests in CI, so that user flows are validated on every pull request.
- As a developer, I want test coverage reports, so that I can identify untested code paths.

## Components Involved
- `functions/src/index.test.ts` -- Cloud Functions unit tests
- `client/vitest.setup.ts` -- Client test setup
- `client/vite.config.ts` -- Vitest configuration
- `client/src/test-globals.d.ts` -- Test type declarations
- `client/src/__tests__/` -- Client test files
- `.github/workflows/ci.yml` -- E2E test job (Playwright)

## Cloud Functions Tests

### Framework
- Vitest test runner
- `firebase-functions-test` in offline mode (no live Firebase project needed)

### Test Coverage
| Function | Tests | Scenarios |
|----------|-------|-----------|
| `seedGuestData` | 3 | Unauthenticated rejection, successful seeding, idempotency |
| `recordExecution` | 4 | Unauthenticated, missing endpointId, wrong owner, valid recording |
| `clearExecutions` | 4 | Unauthenticated, missing endpointId, wrong owner, successful clearing + verification |

### Test Patterns
- Each test suite uses `beforeEach` to set up user and endpoint documents in Firestore
- Tests verify both return values and side effects (document state in Firestore)
- Tests use `firebase-functions-test`'s `test.wrap()` to invoke callable functions

## Client Test Configuration (Vitest)

### Settings
- Environment: jsdom
- Globals: true (no explicit `import { describe, it }` needed)
- File patterns: `*.spec.ts`, `*.spec.tsx`, `*.test.ts`, `*.test.tsx`, `__tests__/*.ts`, `__tests__/*.tsx`
- Coverage: v8 provider, HTML + Clover reporters
- Parallelism: Disabled (`fileParallelism: false`)
- Pool: forks with `singleFork: true` (for Firebase app isolation)

### Rationale for Serial Execution
Firebase SDK initializes a singleton app. Parallel tests would create multiple Firebase apps causing conflicts. Single-fork mode ensures sequential, isolated execution.

## E2E Tests (CI)

### Framework
- Playwright with Chromium

### CI Flow
1. Build client and upload artifact
2. Install Playwright browsers
3. Start Deno server in background
4. Run Playwright tests
5. Upload test report on failure

## Business Rules
- All Cloud Function callable tests verify authentication requirements
- All Cloud Function callable tests verify ownership/authorization
- Idempotency is tested (seedGuestData should not re-seed)
- Side effects are verified (execution counts, document existence)

## Dependencies
- Vitest
- firebase-functions-test
- Playwright (CI only)
- Firebase Admin SDK (for test setup)

## Current Status
**Implemented** -- Cloud Functions have 11 unit tests. Client test infrastructure is configured. E2E pipeline is defined in CI but requires Playwright test files to be written.

## Technical Notes
- The `firebase-functions-test` library wraps Cloud Functions to simulate callable invocations without a running Firebase emulator.
- Test cleanup uses `afterAll` to call `test.cleanup()` and delete the Firebase app to prevent test pollution.
- The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments on wrapped functions acknowledge that `firebase-functions-test` v2 callable wrappers have complex generic types.
- The Vitest setup file (`vitest.setup.ts`) exists but was not examined -- it likely configures Firebase mocks or test utilities.
