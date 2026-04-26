/**
 * Reports API routes — BigQuery + Gemini intelligent reporting.
 *
 * POST /api/reports/query          — Execute a natural language report query
 * GET  /api/reports/quota          — Check remaining query budget
 * GET  /api/reports/history        — List past report queries
 * GET  /api/reports/schema/:eid    — Discover body schema for an endpoint
 */

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import { encodeCsvCell } from "../utils/csv.ts";
import {
  DURATION_DAYS,
  REPORT_MAX_BYTES_PER_QUERY,
  REPORT_RATE_LIMIT_MS,
} from "../config.ts";
import type {
  ContextVariables,
  ReportDuration,
  ReportFormat,
  ReportQueryRequest,
  ReportQueryResponse,
} from "../types.ts";
import { dryRunQuery, executeQuery } from "../services/bigquery.ts";
import { generateSQL, generateSummary } from "../services/gemini.ts";
import { BigQueryError, LLMError } from "../services/errors.ts";
import {
  checkQuota,
  getQuotaStatus,
  recordQueryUsage,
} from "../services/report-quota.ts";
import { assembleSQL } from "../utils/sql-assembler.ts";
import type { ChartOutput, TableOutput } from "../types.ts";
import {
  createDocument,
  getEndpoint,
  runQuery,
} from "../services/firebase-admin.ts";

const reports = new Hono<{ Variables: ContextVariables }>();

// All routes require Firebase Auth
reports.use("*", authMiddleware);

// ── Per-user rate limit for the expensive /query route ─────────────
// In-memory map: userId → ms timestamp of last accepted /query request.
// Quotas are the daily ceiling; this is the per-second floor that stops
// a malicious client from burning a day's quota in one parallel burst.
const lastQueryAt = new Map<string, number>();

reports.use("/query", async (c, next) => {
  const userId = c.get("userId");
  const now = Date.now();
  const last = lastQueryAt.get(userId);
  if (last && now - last < REPORT_RATE_LIMIT_MS) {
    const retryAfter = Math.ceil((REPORT_RATE_LIMIT_MS - (now - last)) / 1000);
    return c.json(
      { error: "Too many requests — please slow down", retryAfter },
      429,
    );
  }
  lastQueryAt.set(userId, now);
  // Opportunistic GC: prune entries older than the rate-limit window —
  // those entries can no longer cause a 429, so they're safe to drop.
  // Snapshotting the keys avoids any subtle iter-while-mutating reading.
  // Note: this is per-instance. A multi-instance Cloud Run deploy
  // weakens the floor by a factor of N; if you need a global floor,
  // store lastQueryAt in Firestore alongside the daily quota doc.
  if (lastQueryAt.size > 10_000) {
    for (const k of [...lastQueryAt.keys()]) {
      const t = lastQueryAt.get(k);
      if (t !== undefined && now - t > REPORT_RATE_LIMIT_MS) {
        lastQueryAt.delete(k);
      }
    }
  }
  await next();
});

// ── Validation helpers ─────────────────────────────────────────────

const VALID_DURATIONS: ReportDuration[] = ["7d", "30d", "90d", "180d"];
const VALID_FORMATS: ReportFormat[] = [
  "table",
  "csv",
  "json",
  "markdown",
  "chart",
  "summary",
];

function computeTimeWindow(
  duration: ReportDuration,
): { start: string; end: string } {
  const now = new Date();
  const days = DURATION_DAYS[duration] || 7;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

// ── Error sanitization ────────────────────────────────────────────

/** Extract first line of error and strip secrets/tokens/internal paths. */
function sanitizeErrorForClient(message: string): string {
  const firstLine = message.split("\n")[0];
  return firstLine
    .replace(/re_[A-Za-z0-9_-]+/g, "***") // Resend keys
    .replace(/AIzaSy[A-Za-z0-9_-]+/g, "***") // Firebase API keys
    .replace(/ya29\.[A-Za-z0-9_.-]+/g, "***") // GCP access tokens
    .replace(/Bearer [^\s]+/g, "Bearer ***") // Auth headers
    .replace(/[?&]key=[^\s&]+/g, "?key=***") // URL API keys
    .replace(/projects\/[A-Za-z0-9_-]+/g, "projects/***") // Project IDs
    .replace(/file:\/\/[^\s]+/g, "***") // File paths
    .replace(/\b[\w.-]+@[\w.-]+\.iam\.gserviceaccount\.com\b/g, "***") // SA emails
    .replace(/metadata\.google\.internal[^\s]*/g, "***") // Metadata server
    .slice(0, 500);
}

// ── POST /query — Execute a natural language report ────────────────

reports.post("/query", async (c) => {
  const userId = c.get("userId");
  const isAnonymous = c.get("isAnonymous");

  let body: ReportQueryRequest;
  try {
    body = await c.req.json<ReportQueryRequest>();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  // Validate inputs
  if (
    !body.question || typeof body.question !== "string" ||
    body.question.trim().length === 0
  ) {
    return c.json({ error: "Question is required" }, 400);
  }
  if (body.question.length > 1000) {
    return c.json({ error: "Question too long (max 1000 characters)" }, 400);
  }
  if (!VALID_DURATIONS.includes(body.duration)) {
    return c.json({
      error: `Invalid duration. Must be one of: ${VALID_DURATIONS.join(", ")}`,
    }, 400);
  }
  if (!VALID_FORMATS.includes(body.format)) {
    return c.json({
      error: `Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}`,
    }, 400);
  }

  // Restrict extended durations for anonymous users
  if (isAnonymous && body.duration !== "7d") {
    return c.json({
      error:
        "Anonymous users are limited to 7-day queries. Sign up for longer windows.",
    }, 403);
  }

  try {
    const timeWindow = computeTimeWindow(body.duration);

    // 1. Generate SQL FRAGMENTS via Gemini (NOT a full SQL string).
    const fragments = await generateSQL(
      body.question,
      body.format,
      timeWindow.start,
      timeWindow.end,
    );

    // 2. Handle "can't answer" refusals (signaled by empty select_columns)
    if (!fragments.select_columns || fragments.select_columns.trim() === "") {
      return c.json({
        error: fragments.explanation ||
          "This question can't be answered with the available data.",
      }, 422);
    }

    // 3. Validate fragments + assemble the SQL with the safety scaffold.
    //    The scaffold is hard-coded — user_id, time-window, and LIMIT
    //    can never be omitted or weakened by the LLM.
    const assembled = assembleSQL(fragments);
    if (!assembled.ok) {
      console.error("[Reports] Fragment validation failed:", assembled.errors);
      return c.json({
        error:
          "Generated query failed safety validation. Please rephrase your question.",
        detail: assembled.errors[0]?.reason,
      }, 422);
    }
    const sql = assembled.sql;

    const queryParams = {
      startTime: timeWindow.start,
      endTime: timeWindow.end,
    };

    // 4. Dry run to estimate cost
    const dryRun = await dryRunQuery(sql, queryParams, userId);

    // 4. Check per-query byte limit
    if (dryRun.totalBytesProcessed > REPORT_MAX_BYTES_PER_QUERY) {
      const estimatedMB = (dryRun.totalBytesProcessed / (1024 * 1024)).toFixed(
        1,
      );
      return c.json({
        error:
          `Query would scan ${estimatedMB} MB, exceeding the 500 MB per-query limit. Try a shorter time window.`,
      }, 422);
    }

    // 5. Check user quota
    const quotaError = await checkQuota(
      userId,
      isAnonymous,
      dryRun.totalBytesProcessed,
    );
    if (quotaError) {
      return c.json({ error: quotaError }, 429);
    }

    // 6. Execute query
    const queryResult = await executeQuery(sql, queryParams, userId);

    // 7. Record usage
    await recordQueryUsage(userId, queryResult.totalBytesProcessed);

    // 8. Format output
    const format = body.format === "chart" && fragments.chartConfig
      ? "chart"
      : body.format;

    let data: string | TableOutput | ChartOutput;
    if (format === "summary") {
      data = await generateSummary(
        body.question,
        queryResult.rows,
        queryResult.columns,
      );
    } else if (format === "csv") {
      const header = queryResult.columns.map((col) => col.name).join(",");
      const rows = queryResult.rows.map((row) =>
        queryResult.columns.map((col) => encodeCsvCell(row[col.name])).join(",")
      );
      data = [header, ...rows].join("\n");
    } else if (format === "json") {
      data = JSON.stringify(queryResult.rows, null, 2);
    } else if (format === "chart" && fragments.chartConfig) {
      const xCol = fragments.chartConfig.xAxis;
      const yCol = fragments.chartConfig.yAxis;
      data = {
        type: fragments.chartConfig.type,
        labels: queryResult.rows.map((r) => String(r[xCol] ?? "")),
        datasets: [{
          label: yCol,
          data: queryResult.rows.map((r) => Number(r[yCol]) || 0),
        }],
        xAxis: xCol,
        yAxis: yCol,
      };
    } else {
      data = {
        columns: queryResult.columns,
        rows: queryResult.rows,
      };
    }

    // 9. Save to history
    const reportId = crypto.randomUUID();
    const meta = {
      query: sql,
      explanation: fragments.explanation,
      bytesProcessed: queryResult.totalBytesProcessed,
      rowCount: queryResult.rows.length,
      executionTime: queryResult.executionTimeMs,
      timeWindow,
    };

    // Fire-and-forget history save
    createDocument("report_history", {
      userId,
      question: body.question,
      format,
      duration: body.duration,
      meta,
      createdAt: new Date().toISOString(),
    }, reportId).catch((err) => {
      console.error("[Reports] Failed to save history:", err);
    });

    // 10. Return result
    const quota = await getQuotaStatus(userId, isAnonymous);

    const response: ReportQueryResponse = {
      id: reportId,
      meta,
      data,
      format,
      quota,
    };

    return c.json(response);
  } catch (err) {
    console.error("[Reports] Query error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const detail = sanitizeErrorForClient(message);

    // Dispatch by error class — survives message wording changes and
    // catches the local-LLM path (which doesn't have "Gemini" in its
    // string).
    if (err instanceof LLMError) {
      return c.json({
        error: "AI failed to generate a query. Try rephrasing your question.",
        detail,
      }, 502);
    }
    if (err instanceof BigQueryError) {
      return c.json({
        error:
          "Query execution failed. Try a simpler question or shorter time window.",
        detail,
      }, 502);
    }
    return c.json(
      { error: "Something went wrong. Please try again.", detail },
      500,
    );
  }
});

// ── GET /quota — Check remaining query budget ──────────────────────

reports.get("/quota", async (c) => {
  const userId = c.get("userId");
  const isAnonymous = c.get("isAnonymous");
  const quota = await getQuotaStatus(userId, isAnonymous);
  return c.json(quota);
});

// ── GET /history — List past report queries ────────────────────────

reports.get("/history", async (c) => {
  const userId = c.get("userId");

  try {
    const results = await runQuery(
      "report_history",
      [{ field: "userId", op: "EQUAL", value: userId }],
      "createdAt",
      "DESCENDING",
      20,
    );

    const history = results.map((doc) => ({
      id: doc.id,
      question: doc.question || "",
      format: doc.format || "table",
      duration: doc.duration || "7d",
      createdAt: doc.createdAt || "",
      meta: doc.meta || {},
    }));

    return c.json({ history });
  } catch (err) {
    console.error("[Reports] History fetch error:", err);
    return c.json({ history: [] });
  }
});

// ── GET /schema/:eid — Discover body schema for an endpoint ────────

reports.get("/schema/:eid", async (c) => {
  const userId = c.get("userId");
  const endpointId = c.req.param("eid");

  // Verify ownership
  const endpoint = await getEndpoint(endpointId);
  if (!endpoint || endpoint.userId !== userId) {
    return c.json({ error: "Endpoint not found" }, 404);
  }

  try {
    // In local dev, sample from Firestore executions
    const executions = await runQuery(
      "executions",
      [
        { field: "endpointId", op: "EQUAL", value: endpointId },
        { field: "userId", op: "EQUAL", value: userId },
      ],
      "timestamp",
      "DESCENDING",
      50,
    );

    // Extract top-level keys from request bodies
    const keyFrequency = new Map<string, number>();
    let bodiesWithContent = 0;

    for (const exec of executions) {
      const body = exec.body as string;
      if (!body || body === "") continue;
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed === "object" && parsed !== null) {
          bodiesWithContent++;
          for (const key of Object.keys(parsed)) {
            keyFrequency.set(key, (keyFrequency.get(key) || 0) + 1);
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    const topLevelKeys = Array.from(keyFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([key]) => key);

    return c.json({
      endpointId,
      discoveredAt: new Date().toISOString(),
      sampleSize: executions.length,
      bodiesWithContent,
      topLevelKeys,
    });
  } catch (err) {
    console.error("[Reports] Schema discovery error:", err);
    return c.json({ error: "Failed to discover schema" }, 500);
  }
});

export default reports;
