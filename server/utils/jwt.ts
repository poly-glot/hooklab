/**
 * Shared RS256 JWT verification for Google-signed tokens.
 *
 * Used by both:
 * - Firebase Auth ID token verification (middleware/auth.ts)
 * - Cloud Scheduler OIDC token verification (routes/internal.ts)
 *
 * Single key cache — avoids duplicate fetches and stale-cache divergence.
 */

import { decodeBase64Url } from "@std/encoding/base64url";
import {
  GOOGLE_CERTS_URL,
  KEY_CACHE_DEFAULT_TTL,
} from "../config.ts";
import { importPublicKey } from "./x509.ts";

// ── Public key cache (shared across all callers) ───────────────────

const keyCache: { keys: Map<string, CryptoKey>; expiresAt: number } = {
  keys: new Map(),
  expiresAt: 0,
};

/**
 * Fetches and caches Google's public keys for JWT verification.
 *
 * Keys are cached based on the Cache-Control header from Google's endpoint.
 * Defaults to 1-hour TTL if Cache-Control is not present.
 */
export async function getGooglePublicKeys(): Promise<Map<string, CryptoKey>> {
  if (keyCache.keys.size > 0 && Date.now() < keyCache.expiresAt) {
    return keyCache.keys;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public keys: ${res.status}`);
  }

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

/** Decode a base64url JWT segment into a parsed JSON object. */
export function decodeJwtSegment(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

/**
 * Verifies an RS256 JWT signature against Google's public keys.
 *
 * Returns the decoded payload on success, null on failure.
 * Does NOT validate claims — that is the caller's responsibility
 * (Firebase tokens and OIDC tokens have different claim requirements).
 */
export async function verifyRS256Signature(
  token: string,
): Promise<{ header: Record<string, unknown>; payload: Record<string, unknown> } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  const header = decodeJwtSegment(headerB64) as Record<string, unknown>;

  if (header.alg !== "RS256") return null;
  if (!header.kid || typeof header.kid !== "string") return null;

  const keys = await getGooglePublicKeys();
  const publicKey = keys.get(header.kid as string);
  if (!publicKey) return null;

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = decodeBase64Url(signatureB64);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    data,
  );
  if (!valid) return null;

  const payload = decodeJwtSegment(payloadB64) as Record<string, unknown>;
  return { header, payload };
}
