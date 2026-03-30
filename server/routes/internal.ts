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
import { K_SERVICE } from "../config.ts";

const internal = new Hono();

/**
 * Lightweight auth guard for internal endpoints.
 *
 * In production (Cloud Run), Cloud Scheduler sends an OIDC token which
 * Cloud Run verifies automatically — so if the request reaches the
 * container, it's already authenticated. We just block external access
 * by checking that we're running on Cloud Run (K_SERVICE is set).
 *
 * In development, allow all requests so we can test locally.
 */
internal.use("*", async (c, next) => {
  if (K_SERVICE) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // Cloud Run validates the OIDC token before it reaches us.
    // If we're here, the token is valid.
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
        quotas: { usedExecutionsToday: 0 },
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
