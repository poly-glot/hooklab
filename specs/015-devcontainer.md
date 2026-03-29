# 015 - Development Container

## Feature Name
Dev Container Configuration

## Description
A Docker Compose-based development container configuration for VS Code / GitHub Codespaces providing a fully configured development environment with Deno, Node.js, Firebase CLI, GCloud SDK, Docker-in-Docker, and all necessary VS Code extensions and shell aliases.

## Components Involved
- `.devcontainer/devcontainer.json` -- Dev container specification
- `.devcontainer/docker-compose.yml` -- Docker Compose services
- `.devcontainer/Dockerfile` -- Dev container image (referenced by compose)
- `.devcontainer/post-create.sh` -- One-time setup script

## Container Features
- **Common Utils**: Zsh with Oh My Zsh as default shell
- **Docker-outside-of-Docker**: Access to host Docker socket
- **Git**: Git configuration
- **Claude Code**: Anthropic Claude Code CLI
- **GitHub CLI**: `gh` command
- **Google Cloud CLI**: `gcloud` command
- **Java 21** (Temurin): For Firebase emulators

## Port Forwarding
| Port | Service | Auto-forward |
|------|---------|-------------|
| 3000 | API Server | notify |
| 5173 | Vite Dev Server | openBrowser |
| 4000 | Firebase Emulator UI | notify |
| 5001 | Firebase Functions | silent |
| 8080 | Firestore Emulator | silent |
| 9099 | Firebase Auth | silent |
| 9199 | Firebase Storage | silent |

## Docker Compose Configuration
- Single service `app` with all ports mapped
- Volume mounts:
  - Project source (cached)
  - Host npm cache (`~/.npm`)
  - Deno cache (named volume)
  - Claude Code config (`~/.claude`)
  - Docker socket
- Network: `hooklab-network` (bridge)
- Keeps container alive with `sleep infinity`

## Post-Create Setup (`post-create.sh`)
1. Fix permissions on cache directories
2. Symlink Claude Code config
3. Configure npm (disable update-notifier, fund, audit)
4. Configure git (safe directory, default branch, aliases)
5. Add shell aliases: `claude`, `dev-client`, `dev-server`, `fb-emulators`, `install-all`, `dc`, `dcup`, `dcdown`
6. Install dependencies in parallel (root, client, functions)

## VS Code Extensions
- `denoland.vscode-deno` -- Deno language server
- `bradlc.vscode-tailwindcss` -- Tailwind CSS IntelliSense
- `esbenp.prettier-vscode` -- Prettier formatter
- `dbaeumer.vscode-eslint` -- ESLint
- `ms-azuretools.vscode-docker` -- Docker tools
- `toba.vsfire` -- Firestore rules syntax

## VS Code Settings
- Deno enabled for `./server` paths only
- Prettier as default formatter (except TypeScript files in server use Deno formatter)
- Format on save enabled

## Mounts
- GCloud credentials from host (`~/.config/gcloud`) mounted read-only

## Environment
- `FIREBASE_EMULATOR_HOST=0.0.0.0`

## Business Rules
- The container runs as `vscode` user
- Dependencies are installed in parallel for speed
- npm is configured to skip audit/fund/update-notifier for faster installs
- Claude Code alias includes `--dangerously-skip-permissions`

## Dependencies
- Docker and Docker Compose on host
- VS Code with Dev Containers extension (or GitHub Codespaces)

## Current Status
**Implemented** -- Fully configured for local development with all services.

## Technical Notes
- Java 21 is included solely for running Firebase emulators (which require a JVM).
- The Deno cache uses a named Docker volume rather than a host mount for better cross-platform compatibility.
- GCloud credentials are mounted read-only to prevent the container from modifying host credentials.
- The `sleep infinity` command in compose keeps the container running for VS Code to attach.
- Parallel npm installs in post-create.sh use background processes (`&`) with `wait` for synchronization.
