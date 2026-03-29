/**
 * Gemini AI service for natural language → SQL generation.
 *
 * In production: Calls Vertex AI Gemini API to generate BigQuery SQL.
 * In local dev:  Returns a canned response so the chat UI is functional
 *                without Vertex AI credentials.
 */

import {
  BQ_DATASET,
  BQ_TABLE,
  FIRESTORE_EMULATOR_HOST,
  GEMINI_MODEL,
  PROJECT_ID,
  REPORT_MAX_ROWS,
  VERTEX_AI_LOCATION,
  GCP_METADATA_TOKEN_URL,
  TOKEN_CACHE_BUFFER,
} from "../config.ts";
import type { GeminiSQLResponse, ReportFormat } from "../types.ts";

// ── Access token ───────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
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

// ── System prompt ──────────────────────────────────────────────────

const TABLE_NAME = `${BQ_DATASET}.${BQ_TABLE}`;

const SYSTEM_PROMPT = `You are a BigQuery SQL expert for Hooklab, a webhook testing platform.

## Table Schema
Table: ${TABLE_NAME}
Columns:
- id (STRING): Unique execution ID
- endpoint_id (STRING): Webhook endpoint identifier
- user_id (STRING): Owner user ID — ALWAYS filter by this
- method (STRING): HTTP method (GET, POST, PUT, DELETE, PATCH)
- url (STRING): Full request URL
- status (STRING): "success" or "error"
- response_status (INT64): HTTP response status code (200, 404, 500, etc.)
- duration_ms (FLOAT64): Execution time in milliseconds
- ip (STRING): Client IP address
- execution_timestamp (TIMESTAMP): When the webhook was received
- request_body (STRING): Raw JSON string — use JSON_EXTRACT to query fields
- response_body (STRING): Raw JSON string — use JSON_EXTRACT to query fields
- request_headers (STRING): JSON object of headers — use JSON_EXTRACT
- query_params (STRING): JSON object of query parameters

## MANDATORY RULES
1. ALWAYS include: WHERE user_id = @userId
2. ALWAYS include: AND execution_timestamp >= @startTime AND execution_timestamp < @endTime
3. NEVER use SELECT * — always select specific columns
4. Use LIMIT to cap result rows (max ${REPORT_MAX_ROWS})
5. For request_body/response_body, use JSON_EXTRACT_SCALAR for leaf values, JSON_EXTRACT for nested objects
6. The body fields contain ARBITRARY JSON — the user's webhooks can have any shape.

## OUTPUT FORMAT
Return ONLY a valid JSON object with no markdown fencing:
{
  "sql": "SELECT ...",
  "explanation": "This query does...",
  "params": {},
  "suggestedFormat": "table",
  "chartConfig": null
}

suggestedFormat must be one of: table, csv, json, chart, summary, markdown
If suggestedFormat is "chart", include chartConfig with type (bar|line|pie|scatter), xAxis, and yAxis.`;

// ── SQL generation ─────────────────────────────────────────────────

/**
 * Generates BigQuery SQL from a natural language question using Gemini.
 */
export async function generateSQL(
  question: string,
  format: ReportFormat,
  startTime: string,
  endTime: string,
  schemaHints?: string,
): Promise<GeminiSQLResponse> {
  if (FIRESTORE_EMULATOR_HOST) {
    return generateLocalFallback(question, format, startTime, endTime);
  }

  const token = await getAccessToken();
  const url = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  let userPrompt = `User question: "${question}"
Requested format: ${format}
Time window: ${startTime} to ${endTime}`;

  if (schemaHints) {
    userPrompt += `\n\nKnown body fields for the user's endpoints:\n${schemaHints}`;
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const result = await res.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  const parsed = JSON.parse(text) as GeminiSQLResponse;
  return parsed;
}

/**
 * Uses Gemini to generate a natural language summary of query results.
 */
export async function generateSummary(
  question: string,
  rows: Record<string, unknown>[],
  columns: { name: string; type: string }[],
): Promise<string> {
  if (FIRESTORE_EMULATOR_HOST) {
    return `Based on your data: Found ${rows.length} results for "${question}". ` +
      `The data includes columns: ${columns.map((c) => c.name).join(", ")}.`;
  }

  const token = await getAccessToken();
  const url = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const dataPreview = JSON.stringify(rows.slice(0, 20), null, 2);

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `The user asked: "${question}"

Here are the query results (${rows.length} rows, columns: ${columns.map((c) => `${c.name} (${c.type})`).join(", ")}):

${dataPreview}

Write a concise, insightful natural language summary of these results. Focus on key patterns, notable values, and actionable insights. Keep it to 2-4 sentences.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return `Query returned ${rows.length} rows across ${columns.length} columns.`;
  }

  const result = await res.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || `Found ${rows.length} results.`;
}

// ── Local dev fallback ─────────────────────────────────────────────

function generateLocalFallback(
  question: string,
  format: ReportFormat,
  startTime: string,
  endTime: string,
): GeminiSQLResponse {
  const q = question.toLowerCase();

  // Pattern-match common questions to give a reasonable local experience
  if (q.includes("count") || q.includes("how many")) {
    return {
      sql: `SELECT COUNT(*) as total, status FROM ${TABLE_NAME} WHERE user_id = @userId AND execution_timestamp >= @startTime AND execution_timestamp < @endTime GROUP BY status LIMIT ${REPORT_MAX_ROWS}`,
      explanation: "Counts total executions grouped by status (success/error).",
      params: {},
      suggestedFormat: format,
    };
  }

  if (q.includes("slow") || q.includes("latency") || q.includes("duration")) {
    return {
      sql: `SELECT id, method, url, duration_ms, response_status, execution_timestamp FROM ${TABLE_NAME} WHERE user_id = @userId AND execution_timestamp >= @startTime AND execution_timestamp < @endTime ORDER BY duration_ms DESC LIMIT 20`,
      explanation: "Shows the slowest webhook executions ordered by duration.",
      params: {},
      suggestedFormat: format,
    };
  }

  if (q.includes("error") || q.includes("fail")) {
    return {
      sql: `SELECT id, method, url, response_status, duration_ms, execution_timestamp FROM ${TABLE_NAME} WHERE user_id = @userId AND execution_timestamp >= @startTime AND execution_timestamp < @endTime AND status = 'error' ORDER BY execution_timestamp DESC LIMIT ${REPORT_MAX_ROWS}`,
      explanation: "Lists all failed webhook executions in the time window.",
      params: {},
      suggestedFormat: format,
    };
  }

  if (q.includes("chart") || q.includes("trend") || q.includes("over time")) {
    return {
      sql: `SELECT DATE(execution_timestamp) as day, COUNT(*) as total, COUNTIF(status = 'error') as errors FROM ${TABLE_NAME} WHERE user_id = @userId AND execution_timestamp >= @startTime AND execution_timestamp < @endTime GROUP BY day ORDER BY day LIMIT ${REPORT_MAX_ROWS}`,
      explanation: "Shows daily webhook volume and error counts over time.",
      params: {},
      suggestedFormat: "chart",
      chartConfig: { type: "line", xAxis: "day", yAxis: "total" },
    };
  }

  // Default: recent executions overview
  return {
    sql: `SELECT id, method, url, status, response_status, duration_ms, execution_timestamp FROM ${TABLE_NAME} WHERE user_id = @userId AND execution_timestamp >= @startTime AND execution_timestamp < @endTime ORDER BY execution_timestamp DESC LIMIT 50`,
    explanation: `Shows recent webhook executions for your question: "${question}".`,
    params: {},
    suggestedFormat: format,
  };
}
