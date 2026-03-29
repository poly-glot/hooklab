# 011 - Sandboxed Script Execution

## Feature Name
Sandboxed Script Execution Engine

## Description
A secure execution environment for user-defined JavaScript scripts using Deno Workers with zero permissions. Scripts are analyzed for dangerous patterns, wrapped in a strict-mode IIFE with blocked globals, executed with dual timeout layers, and have their output validated and sanitized before being returned as HTTP responses.

## User Stories
- As a platform operator, I want user scripts to run in a sandbox with no file, network, or system access, so that the platform is secure.
- As a platform operator, I want scripts to have execution time limits, so that one user's script cannot monopolize server resources.
- As a platform operator, I want response output to be sanitized, so that scripts cannot perform header injection or set dangerous cookies.
- As a developer, I want meaningful error messages when my script fails, so that I can debug issues.

## Components Involved
- `server/services/script-runner.ts` -- Worker lifecycle management, outer 10s timeout
- `server/workers/sandbox.worker.ts` -- Script analysis, wrapping, execution, output validation

## Architecture

### Two-Layer Timeout
1. **Inner timeout** (5 seconds): `Promise.race` inside the worker between script execution and a setTimeout rejection
2. **Outer timeout** (10 seconds): In script-runner.ts, a setTimeout that forcibly terminates the worker

### Execution Pipeline
```
User Script -> Pattern Analysis -> Wrapping in IIFE -> new Function() ->
Promise.race (5s timeout) -> Response Validation -> Header Sanitization ->
Response Size Check -> postMessage back to runner
```

## Security Measures

### Deno Worker Permissions (all denied)
```typescript
{
  net: false, read: false, write: false, env: false,
  run: false, ffi: false, sys: false, hrtime: false
}
```

### Source Code Analysis (blocked patterns)
| Pattern | Reason |
|---------|--------|
| `\bDeno\b` | Deno runtime access |
| `\bimport\s*\(` | Dynamic import |
| `\bimport\s+` | Static import |
| `\brequire\s*\(` | Node.js require |
| `\bprocess\b` | Node process global |
| `\b__proto__\b` | Prototype pollution |
| `\bconstructor\s*\[` | Constructor access |
| `\bgetPrototypeOf\b` | Prototype chain walking |

### Global Shadowing
These identifiers are passed as `undefined` parameters to the IIFE:
`Deno`, `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `SharedWorker`, `importScripts`, `eval`, `Function`, `globalThis`, `self`, `postMessage`, `close`, `addEventListener`, `removeEventListener`

### Output Sanitization
- **Status code**: Clamped to integer in range [100, 599]
- **Response body**: Max 1 MB (1,048,576 bytes)
- **Script size**: Max 64 KB (65,536 bytes)
- **Header names**: Must match `/^[a-zA-Z0-9\-]+$/`
- **Header values**: CRLF characters stripped (prevents header injection)
- **Blocked headers**: `Set-Cookie`, `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`
- **Error messages**: Truncated to 500 characters

## Data Model
See [003 - Script Editor](003-script-editor.md) for ScriptRequest and ScriptResponse interfaces.

## Business Rules
- Scripts execute in strict mode (`"use strict"`)
- The request object is frozen (`Object.freeze`) before passing to the script
- If the script returns no body, `JSON.stringify(result)` is used as fallback
- If headers returned by the script are invalid (non-object, non-string values), the default `Content-Type: application/json` is used
- Worker errors (crash, OOM) are caught and returned as `{ success: false, error }`
- The worker is always terminated after execution (success, failure, or timeout)

## Dependencies
- Deno runtime with Worker support
- `--unstable-worker-options` flag for Deno permission sandboxing

## Current Status
**Implemented** -- Fully functional with dual timeout layers, comprehensive pattern blocking, and output sanitization.

## Technical Notes
- The Dockerfile runs Deno with `--unstable-worker-options` to enable per-worker permission configuration.
- `new Function("request", wrappedScript)` is used for dynamic code evaluation. This is intentional and the only way to execute user scripts without `eval`.
- The worker is created fresh for each script execution (no pooling), which has a cold-start cost but provides maximum isolation.
- The `@ts-ignore` comment on the worker creation options acknowledges that `deno.permissions` is a Deno-specific extension not in the standard Worker API types.
- There is a subtle security consideration: while `Function` is in the blocked globals list (shadowed as undefined inside the script), the `new Function()` is used in the wrapper itself before the user script runs. This is safe because the wrapper is controlled code.
