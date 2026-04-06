/**
 * Internal routes for Cloud Scheduler jobs.
 *
 * Protected by OIDC token verification — only callable by
 * Cloud Scheduler with the correct service account.
 */

import { Hono } from "hono";
import {
  deleteByQuery,
  getDocument,
  runQuery,
  updateDocument,
  createDocument,
} from "../services/firebase-admin.ts";
import { fsNow, FsTimestamp } from "../utils/firestore-values.ts";
import {
  GOOGLE_CERTS_URL,
  INTERNAL_OIDC_AUDIENCE,
  INTERNAL_SCHEDULER_EMAIL,
  K_SERVICE,
  KEY_CACHE_DEFAULT_TTL,
} from "../config.ts";
import { decodeBase64Url } from "@std/encoding/base64url";

const internal = new Hono();

// ── OIDC token verification ──────────────────────────────────────────

interface OidcPayload {
  iss: string;
  aud: string;
  email?: string;
  exp: number;
  iat: number;
}

const oidcKeyCache: { keys: Map<string, CryptoKey>; expiresAt: number } = {
  keys: new Map(),
  expiresAt: 0,
};

async function getGooglePublicKeys(): Promise<Map<string, CryptoKey>> {
  if (oidcKeyCache.keys.size > 0 && Date.now() < oidcKeyCache.expiresAt) {
    return oidcKeyCache.keys;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Google public keys: ${res.status}`);

  const cacheControl = res.headers.get("Cache-Control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : KEY_CACHE_DEFAULT_TTL;

  const certs: Record<string, string> = await res.json();
  const keys = new Map<string, CryptoKey>();

  const { importPublicKey } = await import("../utils/x509.ts");

  for (const [kid, pem] of Object.entries(certs)) {
    keys.set(kid, await importPublicKey(pem));
  }

  oidcKeyCache.keys = keys;
  oidcKeyCache.expiresAt = Date.now() + maxAge;
  return keys;
}

function decodeJwtSegment(segment: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

/**
 * Verifies a Google OIDC token for internal routes.
 * Checks: RS256 signature, exp, aud, email.
 */
export async function verifyOidcToken(token: string): Promise<OidcPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodeJwtSegment(headerB64) as { alg: string; kid?: string };

    if (header.alg !== "RS256" || !header.kid) return null;

    const keys = await getGooglePublicKeys();
    const publicKey = keys.get(header.kid);
    if (!publicKey) return null;

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = decodeBase64Url(signatureB64);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, data);
    if (!valid) return null;

    const payload = decodeJwtSegment(payloadB64) as OidcPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp <= now) return null;
    if (INTERNAL_OIDC_AUDIENCE && payload.aud !== INTERNAL_OIDC_AUDIENCE) return null;
    if (INTERNAL_SCHEDULER_EMAIL && payload.email !== INTERNAL_SCHEDULER_EMAIL) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Auth middleware ───────────────────────────────────────────────────

/**
 * Auth guard for internal endpoints.
 *
 * In production (Cloud Run): Verifies the OIDC token signature, audience
 * and service-account email. Does NOT trust Cloud Run's built-in check
 * because the service is public (--allow-unauthenticated for webhooks).
 *
 * In development: Allow all requests so we can test locally.
 */
internal.use("*", async (c, next) => {
  if (K_SERVICE) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyOidcToken(token);
    if (!payload) {
      return c.json({ error: "Unauthorized — invalid OIDC token" }, 401);
    }
  }
  await next();
});

// POST /api/internal/cleanup — daily cleanup of old executions + quota reset
internal.post("/cleanup", async (c) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffIso = cutoffDate.toISOString();

  console.log(`[Cleanup] Deleting executions older than ${cutoffIso}`);

  const totalDeleted = await deleteByQuery("executions", [
    { field: "timestamp", op: "LESS_THAN", value: new FsTimestamp(cutoffIso) },
  ]);

  // Reset daily quotas for all users
  const users = await runQuery("users", [], undefined, "ASCENDING", 1000);
  await Promise.all(
    users.map((user) =>
      updateDocument("users", user.id, {
        "quotas.usedExecutionsToday": 0,
      }),
    ),
  );

  console.log(
    `[Cleanup] Done: ${totalDeleted} old executions deleted, ${users.length} user quotas reset`,
  );

  return c.json({ deleted: totalDeleted, quotasReset: users.length });
});

// POST /api/internal/aggregate — hourly analytics aggregation
internal.post("/aggregate", async (c) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10).replace(/-/g, "");

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const executions = await runQuery(
    "executions",
    [{ field: "timestamp", op: "GREATER_THAN_OR_EQUAL", value: new FsTimestamp(startOfDay.toISOString()) }],
    undefined,
    "DESCENDING",
    10000,
  );

  let successCount = 0;
  let failedCount = 0;
  let totalDuration = 0;
  const endpointStats: Record<string, { count: number; avgDuration: number }> = {};

  for (const exec of executions) {
    if (exec.status === "success") successCount++;
    else failedCount++;

    totalDuration += (exec.duration as number) ?? 0;

    const epId = exec.endpointId as string;
    if (!endpointStats[epId]) {
      endpointStats[epId] = { count: 0, avgDuration: 0 };
    }
    endpointStats[epId].count++;
    endpointStats[epId].avgDuration += (exec.duration as number) ?? 0;
  }

  // Finalize averages
  for (const stat of Object.values(endpointStats)) {
    stat.avgDuration =
      stat.count > 0 ? Math.round(stat.avgDuration / stat.count) : 0;
  }

  // Check if analytics doc exists, then create or update
  const existing = await getDocument("analytics", todayStr);
  if (existing) {
    await updateDocument("analytics", todayStr, {
      date: todayStr,
      totalExecutions: executions.length,
      successfulExecutions: successCount,
      failedExecutions: failedCount,
      averageExecutionTime:
        executions.length > 0
          ? Math.round(totalDuration / executions.length)
          : 0,
      endpointStats,
      updatedAt: fsNow(),
    });
  } else {
    await createDocument("analytics", {
      date: todayStr,
      totalExecutions: executions.length,
      successfulExecutions: successCount,
      failedExecutions: failedCount,
      averageExecutionTime:
        executions.length > 0
          ? Math.round(totalDuration / executions.length)
          : 0,
      endpointStats,
      updatedAt: fsNow(),
    }, todayStr);
  }

  console.log(
    `[Analytics] Aggregated for ${todayStr}: ${executions.length} executions`,
  );

  return c.json({
    date: todayStr,
    totalExecutions: executions.length,
    successfulExecutions: successCount,
    failedExecutions: failedCount,
  });
});

export default internal;
