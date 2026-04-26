/**
 * Query quota tracking for the reporting system.
 *
 * Tracks per-user daily usage in Firestore to enforce cost limits.
 * Uses a date-keyed document per user for easy daily reset.
 */

import { REPORT_QUOTAS } from "../config.ts";
import type { QuotaStatus } from "../types.ts";
import { getDocument, incrementFields } from "./firebase-admin.ts";

function todayKey(): string {
  return new Date().toISOString().split("T")[0]; // "2026-03-28"
}

function quotaDocId(userId: string): string {
  return `${userId}_${todayKey()}`;
}

interface QuotaDoc {
  userId: string;
  date: string;
  queriesUsed: number;
  bytesUsed: number;
}

async function getQuotaDoc(userId: string): Promise<QuotaDoc> {
  const docId = quotaDocId(userId);
  const doc = await getDocument("report_quotas", docId);
  if (doc && doc.date === todayKey()) {
    return {
      userId: doc.userId as string,
      date: doc.date as string,
      queriesUsed: (doc.queriesUsed as number) || 0,
      bytesUsed: (doc.bytesUsed as number) || 0,
    };
  }
  return { userId, date: todayKey(), queriesUsed: 0, bytesUsed: 0 };
}

/** Gets current quota status for a user */
export async function getQuotaStatus(
  userId: string,
  isAnonymous: boolean,
): Promise<QuotaStatus> {
  const doc = await getQuotaDoc(userId);
  const tier = isAnonymous ? "guest" : "registered";
  const limits = REPORT_QUOTAS[tier];
  return {
    queriesUsed: doc.queriesUsed,
    queriesLimit: limits.maxQueriesPerDay,
    bytesUsed: doc.bytesUsed,
    bytesLimit: limits.maxBytesPerDay,
  };
}

/** Checks if a user can run another query (returns error string or null) */
export async function checkQuota(
  userId: string,
  isAnonymous: boolean,
  estimatedBytes: number,
): Promise<string | null> {
  const status = await getQuotaStatus(userId, isAnonymous);

  if (status.queriesUsed >= status.queriesLimit) {
    return `Daily query limit reached (${status.queriesLimit}). Try again tomorrow.`;
  }

  if (status.bytesUsed + estimatedBytes > status.bytesLimit) {
    const remaining = Math.max(0, status.bytesLimit - status.bytesUsed);
    const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
    return `Daily data scan budget remaining: ${remainingMB} MB. This query would exceed it.`;
  }

  return null;
}

/**
 * Atomically records a completed query against the user's quota.
 *
 * Uses Firestore field transforms (commit API) so concurrent requests
 * never lose increments. The doc is upserted on first write of the day:
 * `userId` and `date` are set via the updateMask, while `queriesUsed`
 * and `bytesUsed` are atomic INCREMENT transforms in the same write.
 */
export async function recordQueryUsage(
  userId: string,
  bytesProcessed: number,
): Promise<void> {
  await incrementFields(
    "report_quotas",
    quotaDocId(userId),
    { userId, date: todayKey() },
    { queriesUsed: 1, bytesUsed: bytesProcessed },
  );
}
