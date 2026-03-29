/**
 * BigQuery service for report queries.
 *
 * In production (Cloud Run): Executes queries against BigQuery via REST API.
 * In local dev (emulator):   Falls back to Firestore queries so developers
 *                             can work without a BigQuery instance.
 */

import {
  BQ_DATASET,
  BQ_TABLE,
  FIRESTORE_EMULATOR_HOST,
  GCP_METADATA_TOKEN_URL,
  PROJECT_ID,
  REPORT_MAX_ROWS,
  TOKEN_CACHE_BUFFER,
} from "../config.ts";
import type { TableColumn, TableOutput } from "../types.ts";
import { runQuery } from "./firebase-admin.ts";

// ── Access token (shared with firebase-admin pattern) ──────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (FIRESTORE_EMULATOR_HOST) return "owner";
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_CACHE_BUFFER) {
    return cachedToken.token;
  }
  const res = await fetch(GCP_METADATA_TOKEN_URL, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!res.ok) throw new Error(`Failed to get access token: ${res.status}`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

// ── BigQuery REST helpers ──────────────────────────────────────────

function bqJobsUrl(): string {
  return `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/jobs`;
}

function bqQueryUrl(): string {
  return `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/queries`;
}

export interface DryRunResult {
  totalBytesProcessed: number;
}

export interface QueryResult {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  totalBytesProcessed: number;
  executionTimeMs: number;
}

/**
 * Runs a BigQuery dry run to estimate bytes that would be scanned.
 */
export async function dryRunQuery(
  sql: string,
  params: Record<string, string>,
  userId: string,
): Promise<DryRunResult> {
  if (FIRESTORE_EMULATOR_HOST) {
    // In local dev, return a small estimate
    return { totalBytesProcessed: 1024 };
  }

  const token = await getAccessToken();
  const body = {
    configuration: {
      query: {
        query: sql,
        useLegacySql: false,
        dryRun: true,
        parameterMode: "NAMED",
        queryParameters: buildQueryParams({ ...params, userId }),
      },
    },
  };

  const res = await fetch(bqJobsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BigQuery dry run failed: ${err}`);
  }

  const result = await res.json();
  return {
    totalBytesProcessed: parseInt(
      result.statistics?.totalBytesProcessed || "0",
      10,
    ),
  };
}

/**
 * Executes a BigQuery query and returns typed results.
 */
export async function executeQuery(
  sql: string,
  params: Record<string, string>,
  userId: string,
): Promise<QueryResult> {
  if (FIRESTORE_EMULATOR_HOST) {
    return executeLocalFallback(sql, userId);
  }

  const token = await getAccessToken();
  const start = Date.now();

  const body = {
    query: sql,
    useLegacySql: false,
    parameterMode: "NAMED",
    maxResults: REPORT_MAX_ROWS,
    queryParameters: buildQueryParams({ ...params, userId }),
  };

  const res = await fetch(bqQueryUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BigQuery query failed: ${err}`);
  }

  const result = await res.json();
  const executionTimeMs = Date.now() - start;

  const columns: TableColumn[] = (result.schema?.fields || []).map(
    // deno-lint-ignore no-explicit-any
    (f: any) => ({
      name: f.name,
      type: f.type,
    }),
  );

  // deno-lint-ignore no-explicit-any
  const rows: Record<string, unknown>[] = (result.rows || []).map((row: any) => {
    const obj: Record<string, unknown> = {};
    // deno-lint-ignore no-explicit-any
    row.f.forEach((cell: any, i: number) => {
      obj[columns[i].name] = cell.v;
    });
    return obj;
  });

  return {
    columns,
    rows,
    totalBytesProcessed: parseInt(
      result.totalBytesProcessed || "0",
      10,
    ),
    executionTimeMs,
  };
}

// ── Local dev fallback (queries Firestore executions) ──────────────

/**
 * In local dev, we can't hit BigQuery. Instead, query the Firestore
 * executions collection directly and shape the results like BigQuery would.
 * This gives developers a working chat experience without cloud deps.
 */
async function executeLocalFallback(
  _sql: string,
  userId: string,
): Promise<QueryResult> {
  const start = Date.now();

  // Query all executions for this user from Firestore (limited)
  const results = await runQuery(
    "executions",
    [{ field: "userId", op: "EQUAL", value: userId }],
    "timestamp",
    "DESCENDING",
    100,
  );

  const columns: TableColumn[] = [
    { name: "id", type: "STRING" },
    { name: "endpoint_id", type: "STRING" },
    { name: "method", type: "STRING" },
    { name: "url", type: "STRING" },
    { name: "status", type: "STRING" },
    { name: "response_status", type: "INT64" },
    { name: "duration_ms", type: "FLOAT64" },
    { name: "execution_timestamp", type: "TIMESTAMP" },
    { name: "ip", type: "STRING" },
  ];

  const rows = results.map((doc) => ({
    id: doc.id,
    endpoint_id: doc.endpointId || "",
    method: doc.method || "",
    url: doc.url || "",
    status: doc.status || "success",
    response_status: doc.responseStatus ?? 200,
    duration_ms: doc.duration ?? 0,
    execution_timestamp: doc.timestamp || new Date().toISOString(),
    ip: doc.ip || "",
  }));

  return {
    columns,
    rows,
    totalBytesProcessed: 1024,
    executionTimeMs: Date.now() - start,
  };
}

// ── Parameter builder ──────────────────────────────────────────────

function buildQueryParams(
  params: Record<string, string>,
  // deno-lint-ignore no-explicit-any
): any[] {
  return Object.entries(params).map(([name, value]) => ({
    name,
    parameterType: { type: "STRING" },
    parameterValue: { value },
  }));
}

/** Returns the fully qualified BigQuery table name */
export function getFullTableName(): string {
  return `${BQ_DATASET}.${BQ_TABLE}`;
}

/** Whether BigQuery is available (not in emulator mode) */
export function isBigQueryAvailable(): boolean {
  return !FIRESTORE_EMULATOR_HOST;
}
