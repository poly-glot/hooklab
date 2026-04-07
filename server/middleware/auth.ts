/**
 * Firebase ID Token verification middleware for the Deno API server.
 *
 * Verifies Firebase Auth ID tokens using Google's public keys (RS256).
 * This replaces the custom HMAC-SHA256 JWT implementation — all auth
 * is now handled by Firebase Auth on the client, and the server only
 * verifies those tokens.
 *
 * Security model:
 * - Tokens are RS256-signed by Google (asymmetric — server never holds signing key)
 * - Public keys are fetched from Google's well-known endpoint and cached
 * - Claims validated: iss, aud, exp, iat, sub, auth_time
 * - No fallback secrets, no dev-mode bypasses in production
 */

import type { Context, Next } from "hono";
import {
  AUTH_EMULATOR_HOST,
  PROJECT_ID,
  TOKEN_EXPIRY_LEEWAY,
} from "../config.ts";
import type { FirebaseTokenPayload } from "../types.ts";
import { decodeJwtSegment, verifyRS256Signature } from "../utils/jwt.ts";

// ── Token verification ──────────────────────────────────────────────

/**
 * Verifies a token issued by the Firebase Auth emulator.
 *
 * Emulator tokens use `alg: "none"` — no signature check is performed.
 * Only the `sub` claim is validated (must be a non-empty string).
 */
function verifyEmulatorToken(
  payloadB64: string,
): FirebaseTokenPayload | null {
  const payload = decodeJwtSegment(payloadB64) as FirebaseTokenPayload;
  if (!payload.sub) {
    console.debug("[auth] emulator token rejected: missing sub claim");
    return null;
  }
  return payload;
}

/**
 * Verifies a production Firebase ID token using RS256 signature verification.
 *
 * Validates:
 * - RS256 algorithm and kid header (via shared verifyRS256Signature)
 * - Cryptographic signature against Google's public keys
 * - exp, iat, auth_time, iss, aud, sub claims
 */
async function verifyProductionToken(
  token: string,
): Promise<FirebaseTokenPayload | null> {
  const result = await verifyRS256Signature(token);
  if (!result) {
    console.debug("[auth] token rejected: invalid RS256 signature or structure");
    return null;
  }

  const payload = result.payload as unknown as FirebaseTokenPayload;
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp <= now) {
    console.debug("[auth] token rejected: expired");
    return null;
  }
  if (payload.iat > now + TOKEN_EXPIRY_LEEWAY) {
    console.debug("[auth] token rejected: iat in future");
    return null;
  }
  if (payload.auth_time > now + TOKEN_EXPIRY_LEEWAY) {
    console.debug("[auth] token rejected: auth_time in future");
    return null;
  }
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    console.debug("[auth] token rejected: bad issuer", payload.iss);
    return null;
  }
  if (payload.aud !== PROJECT_ID) {
    console.debug("[auth] token rejected: bad audience", payload.aud);
    return null;
  }
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) {
    console.debug("[auth] token rejected: invalid sub");
    return null;
  }

  return payload;
}

/**
 * Verifies a Firebase ID token.
 *
 * Delegates to emulator or production verification based on environment.
 *
 * @param idToken - Firebase ID token (JWT) to verify
 * @returns Decoded and verified token payload, or null if invalid
 */
async function verifyFirebaseToken(
  idToken: string,
): Promise<FirebaseTokenPayload | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;

    if (AUTH_EMULATOR_HOST) {
      return verifyEmulatorToken(parts[1]);
    }

    return await verifyProductionToken(idToken);
  } catch (err) {
    console.debug("[auth] token verification error:", err);
    return null;
  }
}

// ── Hono middleware ─────────────────────────────────────────────────

/**
 * Hono middleware to verify Firebase ID tokens and set user context.
 *
 * Extracts the Bearer token from the Authorization header, verifies it
 * using Firebase Auth public keys, and sets userId/userEmail/isAnonymous
 * on the context for downstream handlers.
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized — missing Bearer token" }, 401);
  }

  const idToken = authHeader.slice(7);
  const payload = await verifyFirebaseToken(idToken);
  if (!payload) {
    return c.json({ error: "Unauthorized — invalid or expired token" }, 401);
  }

  c.set("userId", payload.sub);
  c.set("userEmail", payload.email || "");
  c.set("isAnonymous", payload.firebase?.sign_in_provider === "anonymous");
  await next();
}

export { verifyFirebaseToken };
