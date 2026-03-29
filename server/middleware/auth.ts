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
import { decodeBase64Url } from "@std/encoding/base64url";
import {
  AUTH_EMULATOR_HOST,
  GOOGLE_CERTS_URL,
  KEY_CACHE_DEFAULT_TTL,
  PROJECT_ID,
  TOKEN_EXPIRY_LEEWAY,
} from "../config.ts";
import type { FirebaseTokenPayload } from "../types.ts";
import { importPublicKey } from "../utils/x509.ts";

// ── Public key cache ────────────────────────────────────────────────

const keyCache: { keys: Map<string, CryptoKey>; expiresAt: number } = {
  keys: new Map(),
  expiresAt: 0,
};

/**
 * Fetches and caches Google's public keys for Firebase token verification.
 *
 * Keys are cached based on the Cache-Control header from Google's endpoint.
 * Defaults to 1-hour TTL if Cache-Control is not present.
 *
 * @returns Map of key ID (kid) to CryptoKey
 * @throws Error if fetching public keys fails
 */
async function getPublicKeys(): Promise<Map<string, CryptoKey>> {
  if (keyCache.keys.size > 0 && Date.now() < keyCache.expiresAt) {
    return keyCache.keys;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public keys: ${res.status}`);
  }

  // Parse Cache-Control for expiry
  const cacheControl = res.headers.get("Cache-Control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch
    ? parseInt(maxAgeMatch[1], 10) * 1000
    : KEY_CACHE_DEFAULT_TTL;

  const certs: Record<string, string> = await res.json();
  const keys = new Map<string, CryptoKey>();

  for (const [kid, pem] of Object.entries(certs)) {
    keys.set(kid, await importPublicKey(pem));
  }

  keyCache.keys = keys;
  keyCache.expiresAt = Date.now() + maxAge;
  return keys;
}

// ── Token verification ──────────────────────────────────────────────

/** Decode a base64url JWT segment into a parsed JSON object. */
function decodeJwtSegment(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

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
 * - RS256 algorithm and kid header
 * - Cryptographic signature against Google's public keys
 * - exp, iat, auth_time, iss, aud, sub claims
 */
async function verifyProductionToken(
  headerB64: string,
  payloadB64: string,
  signatureB64: string,
): Promise<FirebaseTokenPayload | null> {
  const header = decodeJwtSegment(headerB64) as { alg: string; kid?: string };

  if (header.alg !== "RS256") {
    console.debug("[auth] token rejected: unexpected alg", header.alg);
    return null;
  }

  const kid = header.kid;
  if (!kid) {
    console.debug("[auth] token rejected: missing kid");
    return null;
  }

  const keys = await getPublicKeys();
  const publicKey = keys.get(kid);
  if (!publicKey) {
    console.debug("[auth] token rejected: unknown kid", kid);
    return null;
  }

  // Verify signature
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = decodeBase64Url(signatureB64);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    data,
  );
  if (!valid) {
    console.debug("[auth] token rejected: invalid signature");
    return null;
  }

  // Decode and validate claims
  const payload = decodeJwtSegment(payloadB64) as FirebaseTokenPayload;
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

    const [headerB64, payloadB64, signatureB64] = parts;

    if (AUTH_EMULATOR_HOST) {
      return verifyEmulatorToken(payloadB64);
    }

    return await verifyProductionToken(headerB64, payloadB64, signatureB64);
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
