/**
 * Sandboxed Worker for executing user-defined webhook scripts.
 *
 * SECURITY MODEL:
 * - Deno worker isolation (separate V8 isolate)
 * - ZERO permissions (no net, fs, env, run, ffi, sys, hrtime)
 * - Timeout enforcement (5 seconds)
 * - No access to parent scope or Deno APIs
 *
 * The Deno permission model is the PRIMARY security boundary.
 * Even if user code accesses Function/eval/globalThis, dangerous APIs
 * (Deno, fetch, etc.) are undefined because permissions are not granted.
 *
 * This worker receives:
 *   { script: string, request: { method, headers, query, body, url } }
 *
 * And posts back:
 *   { success: true, response: { status, headers, body } }
 *   or { success: false, error: string }
 */

// Hardcoded constants to avoid importing config.ts, which reads env vars
// that are blocked by the worker's sandbox permissions (env: false).
const MAX_RESPONSE_BODY_SIZE = 1_048_576;
const MAX_SCRIPT_LENGTH = 65_536;
const SCRIPT_WORKER_TIMEOUT = 5_000;

import {
  sanitizeHeaders,
  sanitizeStatusCode,
} from "./sandbox-utils.ts";
import type {
  ScriptRequest,
  ScriptResponse,
  WorkerMessage,
} from "../types.ts";

// Globals that we shadow to make intent clear (defense in depth)
// Note: The real security comes from Deno permissions, not this list
const BLOCKED_GLOBALS = [
  "Deno",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Worker",
  "SharedWorker",
  "importScripts",
  "globalThis",
  "self",
  "postMessage",
  "close",
  "addEventListener",
  "removeEventListener",
] as const;

self.onmessage = async (event: MessageEvent) => {
  const { script, request } = event.data as WorkerMessage;

  try {
    // ── Step 1: Size Validation ─────────────────────────────────────
    if (typeof script !== "string") {
      self.postMessage({
        success: false,
        error: "Script must be a string",
      });
      return;
    }

    // Validate byte size (not character count) to prevent Unicode DoS
    const scriptBytes = new TextEncoder().encode(script).length;
    if (scriptBytes > MAX_SCRIPT_LENGTH) {
      self.postMessage({
        success: false,
        error: `Script too large (${scriptBytes} bytes, max ${MAX_SCRIPT_LENGTH} bytes)`,
      });
      return;
    }

    // ── Step 2: Basic Syntax Validation ─────────────────────────────
    // Block obvious dangerous patterns as defense-in-depth
    // (Real security comes from Deno permissions, not this)
    const dangerousPatterns = [
      /\bimport\s*\(/,           // dynamic import() - won't work anyway
      /\bimport\s+/,             // static import - won't work anyway
      /\brequire\s*\(/,          // require() - not available in Deno
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(script)) {
        self.postMessage({
          success: false,
          error: `Script contains blocked pattern: ${pattern.source}`,
        });
        return;
      }
    }

    // ── Step 3: Execute in Isolated Scope ───────────────────────────
    // Build the argument names and shadow values for blocked globals
    // This is defense-in-depth; real security is Deno permissions
    const shadowArgs = BLOCKED_GLOBALS.join(", ");
    const shadowValues = BLOCKED_GLOBALS.map(() => "undefined");

    // Wrap the user script in an async function that:
    // 1. Enforces strict mode
    // 2. Receives only a frozen request object
    // 3. Shadows dangerous globals (though Deno permissions block them anyway)
    const wrappedScript = `
      return (async function(request, ${shadowArgs}) {
        'use strict';
        ${script}
      })(request, ${shadowValues.join(", ")});
    `;

    // Execute with timeout
    // Note: Using Function constructor here, but it's safe because:
    // - Deno worker has ZERO permissions (no Deno, fetch, fs, etc.)
    // - Worker is isolated from parent scope
    // - Timeout enforcement prevents infinite loops
    const handler = new Function("request", wrappedScript);
    const result: ScriptResponse = await Promise.race([
      handler(Object.freeze({ ...request })),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Script execution timed out (${SCRIPT_WORKER_TIMEOUT / 1000}s)`
              )
            ),
          SCRIPT_WORKER_TIMEOUT
        )
      ),
    ]);

    // ── Step 4: Response Validation and Sanitization ────────────────
    const rawBody = typeof result?.body === "string"
      ? result.body
      : JSON.stringify(result ?? { ok: true });

    // Enforce response body size limit (byte-based)
    const bodyBytes = new TextEncoder().encode(rawBody).length;
    if (bodyBytes > MAX_RESPONSE_BODY_SIZE) {
      self.postMessage({
        success: false,
        error: `Response body too large (${bodyBytes} bytes, max ${MAX_RESPONSE_BODY_SIZE} bytes)`,
      });
      return;
    }

    // Sanitize headers and status code
    const response = {
      status: sanitizeStatusCode(result?.status),
      headers: sanitizeHeaders(result?.headers),
      body: rawBody,
    };

    self.postMessage({ success: true, response });
  } catch (error: unknown) {
    // Sanitize error message to avoid leaking internal details
    const message = error instanceof Error
      ? error.message.slice(0, 500)
      : "Unknown script error";
    self.postMessage({
      success: false,
      error: message,
    });
  }
};
