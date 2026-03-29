# 014 - Containerization (Docker)

## Feature Name
Docker Containerization for the API Server

## Description
Dockerfile for building the Deno-based API server as a container image deployable to Cloud Run. Uses a multi-step approach with dependency caching, minimal permissions, and the official Deno Alpine image.

## Components Involved
- `Dockerfile` -- Container build definition
- `server/main.ts` -- Application entry point
- `server/deno.json` -- Deno configuration (referenced for dependency caching)

## Dockerfile Specification

### Base Image
`denoland/deno:alpine-2.1.4`

### Build Steps
1. Set working directory to `/app`
2. Copy dependency manifests (`deno.json`, `deno.lock`, `server/deno.json`) for cache-friendly layers
3. Pre-cache dependencies: `deno install --entrypoint server/main.ts`
4. Copy full server source: `server/` directory
5. Set `PORT=8080` (Cloud Run default)
6. Expose port 8080
7. Switch to `deno` user (non-root)
8. Run with flags: `--allow-net`, `--allow-env`, `--allow-read`, `--unstable-worker-options`

### Runtime Permissions
| Permission | Flag | Purpose |
|-----------|------|---------|
| Network | `--allow-net` | HTTP server, CORS |
| Environment | `--allow-env` | PORT, JWT_SECRET |
| File read | `--allow-read` | Worker module loading |
| Unstable workers | `--unstable-worker-options` | Per-worker permission sandboxing |

## Business Rules
- The container runs as the `deno` user, not root
- Cloud Run injects the PORT environment variable (defaults to 8080)
- Dependency caching layer is separated from source code for faster rebuilds
- The `|| true` on `deno install` prevents build failure if lock file is missing

## Dependencies
- Deno 2.1.4 (Alpine variant)
- Cloud Run or any container runtime

## Current Status
**Implemented** -- Dockerfile is ready for building and pushing to Artifact Registry.

## Technical Notes
- The Alpine variant is used for a smaller image size.
- `--unstable-worker-options` is required for the sandboxed script execution feature, as it allows setting Deno-specific permissions on individual workers.
- `--allow-read` is needed because Deno workers load their module from the filesystem (`../workers/sandbox.worker.ts`).
- The dependency caching step (`deno install --entrypoint`) resolves and caches all imports before the full source copy, leveraging Docker's layer caching for faster rebuilds when only source code changes.
