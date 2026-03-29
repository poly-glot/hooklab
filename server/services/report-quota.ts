/**
 * Query quota tracking for the reporting system.
 *
 * Tracks per-user daily usage in Firestore to enforce cost limits.
 * Uses a date-keyed document per user for easy daily reset.
 */

import { REPORT_QUOTAS } from "../config.ts";
import type { QuotaStatus } from "../types.ts";
import { getDocument, createDocument, updateDocument } from "./firebase-admin.ts";

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

/** Records a completed query against the user's quota */
export async function recordQueryUsage(
  userId: string,
  bytesProcessed: number,
): Promise<void> {
  const docId = quotaDocId(userId);
  const existing = await getDocument("report_quotas", docId);

  if (existing && existing.date === todayKey()) {
    await updateDocument("report_quotas", docId, {
      queriesUsed: ((existing.queriesUsed as number) || 0) + 1,
      bytesUsed: ((existing.bytesUsed as number) || 0) + bytesProcessed,
    });
  } else {
    await createDocument("report_quotas", {
      userId,
      date: todayKey(),
      queriesUsed: 1,
      bytesUsed: bytesProcessed,
    }, docId);
  }
}
