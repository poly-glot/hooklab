# 013 - CI/CD Pipelines

## Feature Name
Continuous Integration and Continuous Deployment (GitHub Actions)

## Description
Two GitHub Actions workflows providing a complete CI/CD pipeline: a CI workflow for linting, type-checking, building, and E2E testing on pull requests and pushes; and a CD workflow for building, pushing, and deploying to staging and production environments with smoke tests.

## Components Involved
- `.github/workflows/ci.yml` -- CI pipeline
- `.github/workflows/cd.yml` -- CD pipeline

## CI Workflow (`ci.yml`)

### Trigger
- Pull requests to main/master
- Pushes to main/master

### Jobs

#### 1. Lint & Typecheck
- Checks out code
- Sets up Deno 2.x and Node 22
- Installs client dependencies (`npm ci`)
- Runs TypeScript typecheck on client (`npx tsc -b --noEmit`)
- Runs Deno typecheck on server (`deno check server/main.ts`)

#### 2. Build Client (depends on lint)
- Installs client dependencies
- Builds production bundle (`npm run build`)
- Uploads `client/dist/` as artifact (7-day retention)

#### 3. Build Server Image (depends on lint)
- Sets up Docker Buildx
- Builds Docker image (validate only, no push)
- Uses GitHub Actions cache for Docker layers

#### 4. E2E Tests (depends on build-client)
- Sets up Deno and Node
- Installs client dependencies and Playwright (chromium)
- Starts Deno server in background
- Runs Playwright E2E tests
- Uploads test report on failure

### Concurrency
- Group: `ci-{ref}`, cancel-in-progress: true

## CD Workflow (`cd.yml`)

### Trigger
- Push to main/master
- Manual dispatch with environment choice (staging/production)

### Jobs

#### 1. CI Gate
- Runs the full CI workflow as a prerequisite

#### 2. Build & Push Server Image (depends on CI)
- Authenticates to GCP via Workload Identity Federation (keyless)
- Configures Docker for Artifact Registry
- Builds and pushes Docker image with SHA-based tag + `latest` tag
- Uses GHA cache for Docker layers

#### 3. Deploy to Staging (depends on CI + image build)
- Deploys Cloud Run with `--tag staging --no-traffic` (no live traffic)
- Smoke tests the staging Cloud Run endpoint
- Downloads client artifact
- Deploys client to Firebase Hosting preview channel (staging, 7-day expiry)

#### 4. Deploy to Production (depends on staging, main branch only)
- Deploys Cloud Run to live traffic
- Deploys client to Firebase Hosting (live)
- Creates a version tag (`v{version}-{sha7}`) on the repository

#### 5. Smoke Test (depends on production)
- Health-checks Cloud Run API (`/api/health`)
- Health-checks Firebase Hosting

### Concurrency
- Group: `cd-{ref}`, cancel-in-progress: false

## Environment Variables / Secrets

### GitHub Secrets (from Terraform outputs)
- `WIF_PROVIDER` -- Workload Identity Provider
- `GCP_SA_EMAIL` -- CI/CD service account email

### GitHub Variables
- `GCP_PROJECT_ID` -- GCP project ID
- `GCP_REGION` -- GCP region (default: us-central1)
- `CLOUD_RUN_SERVICE` -- Cloud Run service name (default: hooklab-api)
- `AR_REPO` -- Artifact Registry repo (default: hooklab)
- `FIREBASE_SITE_ID` -- Firebase Hosting site ID
- `CUSTOM_DOMAIN` -- Optional custom domain
- `CLOUD_RUN_URL` -- Cloud Run service URL (for smoke tests)

## Business Rules
- CI runs on every PR and push to main branches
- CD only deploys after full CI passes
- Production deployment only occurs on main/master branch pushes
- Staging deployments use Cloud Run traffic tags (zero live traffic)
- Firebase Hosting preview channels expire after 7 days
- Docker images are tagged with short SHA and `latest`
- Release tags follow the pattern `v{package.json.version}-{sha7}`

## Dependencies
- [012 - Infrastructure](012-infrastructure-terraform.md) -- GCP resources must be provisioned
- GitHub Actions runners (ubuntu-latest)
- Deno 2.x, Node 22

## Current Status
**Implemented** -- Both CI and CD workflows are fully defined. Requires GCP infrastructure and GitHub secrets to be configured for execution.

## Technical Notes
- The CD workflow uses `google-github-actions/auth@v2` with Workload Identity Federation, eliminating the need for stored service account keys.
- Docker Buildx is used with GHA cache (`type=gha`) for layer caching across builds.
- The staging Cloud Run deployment uses `--no-traffic` so it receives no live requests until promoted.
- The smoke test gracefully handles missing `CLOUD_RUN_URL` by skipping the API check.
- The release tagging uses `actions/github-script@v7` to create git tags via the GitHub API.
- E2E tests use Playwright with Chromium only (not Firefox/WebKit) for speed.
