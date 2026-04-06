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
} from "../config.ts";
import type {
  ContextVariables,
  ReportDuration,
  ReportFormat,
  ReportQueryRequest,
  ReportQueryResponse,
} from "../types.ts";
import { dryRunQuery, executeQuery, isBigQueryAvailable } from "../services/bigquery.ts";
import { generateSQL, generateSummary } from "../services/gemini.ts";
import {
  checkQuota,
  getQuotaStatus,
  recordQueryUsage,
} from "../services/report-quota.ts";
import { validateGeneratedSQL } from "../utils/sql-validator.ts";
import {
  createDocument,
  getEndpoint,
  runQuery,
} from "../services/firebase-admin.ts";

const reports = new Hono<{ Variables: ContextVariables }>();

// All routes require Firebase Auth
reports.use("*", authMiddleware);

// ── Validation helpers ─────────────────────────────────────────────

const VALID_DURATIONS: ReportDuration[] = ["7d", "30d", "90d", "180d"];
const VALID_FORMATS: ReportFormat[] = ["table", "csv", "json", "markdown", "chart", "summary"];

function computeTimeWindow(duration: ReportDuration): { start: string; end: string } {
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
    .replace(/re_[A-Za-z0-9_-]+/g, "***")                                // Resend keys
    .replace(/AIzaSy[A-Za-z0-9_-]+/g, "***")                             // Firebase API keys
    .replace(/ya29\.[A-Za-z0-9_.-]+/g, "***")                            // GCP access tokens
    .replace(/Bearer [^\s]+/g, "Bearer ***")                              // Auth headers
    .replace(/[?&]key=[^\s&]+/g, "?key=***")                             // URL API keys
    .replace(/projects\/[A-Za-z0-9_-]+/g, "projects/***")                // Project IDs
    .replace(/file:\/\/[^\s]+/g, "***")                                   // File paths
    .replace(/\b[\w.-]+@[\w.-]+\.iam\.gserviceaccount\.com\b/g, "***")   // SA emails
    .replace(/metadata\.google\.internal[^\s]*/g, "***")                  // Metadata server
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
  if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
    return c.json({ error: "Question is required" }, 400);
  }
  if (body.question.length > 1000) {
    return c.json({ error: "Question too long (max 1000 characters)" }, 400);
  }
  if (!VALID_DURATIONS.includes(body.duration)) {
    return c.json({ error: `Invalid duration. Must be one of: ${VALID_DURATIONS.join(", ")}` }, 400);
  }
  if (!VALID_FORMATS.includes(body.format)) {
    return c.json({ error: `Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}` }, 400);
  }

  // Restrict extended durations for anonymous users
  if (isAnonymous && body.duration !== "7d") {
    return c.json({ error: "Anonymous users are limited to 7-day queries. Sign up for longer windows." }, 403);
  }

  try {
    const timeWindow = computeTimeWindow(body.duration);

    // 1. Generate SQL from question using Gemini
    const geminiResult = await generateSQL(
      body.question,
      body.format,
      timeWindow.start,
      timeWindow.end,
    );

    // 2. Handle "can't answer" refusals from Gemini
    if (!geminiResult.sql || geminiResult.sql.trim() === "") {
      return c.json({
        error: geminiResult.explanation || "This question can't be answered with the available data.",
      }, 422);
    }

    // 3. Validate generated SQL (may auto-fix missing LIMIT)
    const validation = validateGeneratedSQL(geminiResult.sql);
    if (!validation.valid) {
      console.error("[Reports] SQL validation failed:", validation.error, geminiResult.sql);
      return c.json({
        error: "Generated query failed safety validation. Please rephrase your question.",
        detail: validation.error,
      }, 422);
    }
    geminiResult.sql = validation.sql;

    // Inject time window params — Gemini's SQL uses @startTime/@endTime but returns empty params
    const queryParams = {
      ...geminiResult.params,
      startTime: timeWindow.start,
      endTime: timeWindow.end,
    };

    // 3. Dry run to estimate cost
    const dryRun = await dryRunQuery(geminiResult.sql, queryParams, userId);

    // 4. Check per-query byte limit
    if (dryRun.totalBytesProcessed > REPORT_MAX_BYTES_PER_QUERY) {
      const estimatedMB = (dryRun.totalBytesProcessed / (1024 * 1024)).toFixed(1);
      return c.json({
        error: `Query would scan ${estimatedMB} MB, exceeding the 500 MB per-query limit. Try a shorter time window.`,
      }, 422);
    }

    // 5. Check user quota
    const quotaError = await checkQuota(userId, isAnonymous, dryRun.totalBytesProcessed);
    if (quotaError) {
      return c.json({ error: quotaError }, 429);
    }

    // 6. Execute query
    const queryResult = await executeQuery(geminiResult.sql, queryParams, userId);

    // 7. Record usage
    await recordQueryUsage(userId, queryResult.totalBytesProcessed);

    // 8. Format output
    const format = body.format === "chart" && geminiResult.chartConfig
      ? "chart"
      : body.format;

    // deno-lint-ignore no-explicit-any
    let data: any;
    if (format === "summary") {
      data = await generateSummary(body.question, queryResult.rows, queryResult.columns);
    } else if (format === "csv") {
      const header = queryResult.columns.map((col) => col.name).join(",");
      const rows = queryResult.rows.map((row) =>
        queryResult.columns.map((col) => encodeCsvCell(row[col.name])).join(",")
      );
      data = [header, ...rows].join("\n");
    } else if (format === "json") {
      data = JSON.stringify(queryResult.rows, null, 2);
    } else if (format === "chart" && geminiResult.chartConfig) {
      // Build chart output from query results
      const xCol = geminiResult.chartConfig.xAxis;
      const yCol = geminiResult.chartConfig.yAxis;
      data = {
        type: geminiResult.chartConfig.type,
        labels: queryResult.rows.map((r) => String(r[xCol] ?? "")),
        datasets: [{
          label: yCol,
          data: queryResult.rows.map((r) => Number(r[yCol]) || 0),
        }],
        xAxis: xCol,
        yAxis: yCol,
      };
    } else {
      // table / markdown
      data = {
        columns: queryResult.columns,
        rows: queryResult.rows,
      };
    }

    // 9. Save to history
    const reportId = crypto.randomUUID();
    const meta = {
      query: geminiResult.sql,
      explanation: geminiResult.explanation,
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

    if (message.includes("Gemini")) {
      return c.json({ error: "AI failed to generate a query. Try rephrasing your question.", detail }, 502);
    }
    if (message.includes("BigQuery")) {
      return c.json({ error: "Query execution failed. Try a simpler question or shorter time window.", detail }, 502);
    }
    return c.json({ error: "Something went wrong. Please try again.", detail }, 500);
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
