/**
 * Script Runner Service
 *
 * Executes user scripts inside a sandboxed Deno Worker with restricted permissions.
 * Provides isolation, timeout enforcement, and resource limits.
 */

import {
  MAX_REQUEST_BODY_SIZE,
  MAX_SCRIPT_LENGTH,
  SCRIPT_GLOBAL_TIMEOUT,
} from "../config.ts";
import type { ScriptRequest, ScriptResult } from "../types.ts";

/**
 * Executes a user script in a sandboxed worker.
 *
 * Creates an isolated Deno Worker with no permissions, runs the script with
 * the provided request data, and enforces global timeout. The worker is
 * terminated after execution completes or times out.
 *
 * @param script - User JavaScript code to execute
 * @param request - Request data to pass to the script
 * @returns Script execution result with response or error
 */
export async function runScript(
  script: string,
  request: ScriptRequest
): Promise<ScriptResult> {
  // Pre-validate inputs before spawning a worker
  if (!script || typeof script !== "string") {
    return { success: false, error: "Script is empty or invalid" };
  }
  const scriptBytes = new TextEncoder().encode(script).length;
  if (scriptBytes > MAX_SCRIPT_LENGTH) {
    return {
      success: false,
      error: `Script too large (${scriptBytes} bytes, max ${MAX_SCRIPT_LENGTH})`,
    };
  }
  // Truncate request body if excessively large to prevent memory abuse
  if (request.body && request.body.length > MAX_REQUEST_BODY_SIZE) {
    request = {
      ...request,
      body: request.body.slice(0, MAX_REQUEST_BODY_SIZE),
    };
  }

  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let resolved = false;

    const safeResolve = (result: ScriptResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (worker) {
        try { worker.terminate(); } catch { /* ignore */ }
        worker = null;
      }
      resolve(result);
    };

    // Global timeout: kill worker after configured timeout
    const timeout = setTimeout(() => {
      safeResolve({
        success: false,
        error: `Script execution timed out (${SCRIPT_GLOBAL_TIMEOUT / 1000}s limit)`,
      });
    }, SCRIPT_GLOBAL_TIMEOUT);

    try {
      worker = new Worker(
        new URL("../workers/sandbox.worker.ts", import.meta.url).href,
        {
          type: "module",
          // @ts-ignore: Deno-specific worker options for sandboxing
          deno: {
            permissions: {
              net: false,
              read: false,
              write: false,
              env: false,
              run: false,
              ffi: false,
              sys: false,
            },
          },
        },
      );

      worker.onmessage = (event: MessageEvent<ScriptResult>) => {
        safeResolve(event.data);
      };

      worker.onerror = (event: ErrorEvent) => {
        event.preventDefault();
        safeResolve({
          success: false,
          error: "Script execution error", // Don't leak internal worker error details
        });
      };

      // Send the script and request data to the worker
      worker.postMessage({ script, request });
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : "Failed to start sandbox worker";
      safeResolve({ success: false, error: message });
    }
  });
}
