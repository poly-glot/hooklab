/**
 * Shared type definitions for the Hooklab API server.
 *
 * All interfaces and types used across multiple modules are defined here
 * to ensure consistency and avoid duplication.
 */

// ── Firebase & Firestore Types ─────────────────────────────────────

/** Firebase ID token payload structure */
export interface FirebaseTokenPayload {
  /** Firebase user ID (UID) */
  sub: string;
  /** User email address */
  email?: string;
  /** Whether email has been verified */
  email_verified?: boolean;
  /** User display name */
  name?: string;
  /** Token issuer (https://securetoken.google.com/{project-id}) */
  iss: string;
  /** Token audience (project-id) */
  aud: string;
  /** Token expiration time (Unix timestamp) */
  exp: number;
  /** Token issued at time (Unix timestamp) */
  iat: number;
  /** Authentication time (Unix timestamp) */
  auth_time: number;
  /** Firebase-specific claims */
  firebase: {
    /** Sign-in provider (e.g., "password", "google.com", "anonymous") */
    sign_in_provider: string;
    /** User identities map */
    identities: Record<string, string[]>;
  };
}

/** Firestore endpoint document structure */
export interface FirestoreEndpoint {
  /** Endpoint document ID (also used in webhook URL) */
  id: string;
  /** Owner user ID */
  userId: string;
  /** Endpoint display name */
  name: string;
  /** User-defined JavaScript code */
  script: string;
  /** Default HTTP status code when script doesn't execute */
  defaultStatusCode: number;
  /** Default Content-Type header */
  defaultContentType: string;
  /** Default response body */
  defaultBody: string;
  /** Whether the endpoint is active (accepts webhooks) */
  isActive: boolean;
  /** Total number of webhook executions */
  totalExecutions: number;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/** Firestore user document structure */
export interface FirestoreUser {
  /** User document ID (Firebase UID) */
  id: string;
  /** User email address */
  email: string;
  /** Whether user is anonymous */
  isAnonymous: boolean;
  /** User display name */
  displayName: string;
  /** Number of endpoints owned by user */
  endpointCount: number;
  /** ISO timestamp of account creation */
  createdAt: string;
}

/** Firestore execution log document structure */
export interface FirestoreExecution {
  /** Execution document ID */
  id: string;
  /** Associated endpoint ID */
  endpointId: string;
  /** Owner user ID */
  userId: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Full request URL */
  url: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Query parameters */
  query: Record<string, string>;
  /** Request body */
  body: string;
  /** Client IP address */
  ip: string;
  /** Response HTTP status code */
  responseStatus: number;
  /** Response body */
  responseBody: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** ISO timestamp of execution */
  timestamp: string;
  /** Execution status (success or error) */
  status: "success" | "error";
}

// ── Script Execution Types ─────────────────────────────────────────

/** Incoming webhook request data passed to user scripts */
export interface ScriptRequest {
  /** HTTP method */
  method: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Query parameters */
  query: Record<string, string>;
  /** Request body as string */
  body: string;
  /** Full request URL */
  url: string;
}

/** Expected structure of user script response */
export interface ScriptResponse {
  /** HTTP status code (100-599) */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Response body (string or serializable) */
  body?: string;
}

/** Result from script execution */
export interface ScriptResult {
  /** Whether script executed successfully */
  success: boolean;
  /** Script response (if successful) */
  response?: {
    /** HTTP status code */
    status: number;
    /** Response headers */
    headers: Record<string, string>;
    /** Response body */
    body: string;
  };
  /** Error message (if failed) */
  error?: string;
}

/** Message sent to sandbox worker */
export interface WorkerMessage {
  /** User script code */
  script: string;
  /** Request data to pass to script */
  request: ScriptRequest;
}

// ── Rate Limiting Types ────────────────────────────────────────────

/** Rate limit entry for a single endpoint */
export interface RateLimitEntry {
  /** Number of requests in current window */
  count: number;
  /** Unix timestamp when window resets */
  resetAt: number;
}

// ── Validation Types ───────────────────────────────────────────────

/** Validation error details */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
}

/** Result of validation operation */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors (if any) */
  errors?: ValidationError[];
}

// ── API Request/Response Types ─────────────────────────────────────

/** Request body for creating a new endpoint */
export interface CreateEndpointRequest {
  /** Endpoint name */
  name: string;
  /** Optional initial script code */
  script?: string;
}

/** Request body for updating an endpoint */
export interface UpdateEndpointRequest {
  /** Updated endpoint name */
  name?: string;
  /** Updated script code */
  script?: string;
  /** Updated default status code */
  defaultStatusCode?: number;
  /** Updated default content type */
  defaultContentType?: string;
  /** Updated default body */
  defaultBody?: string;
}

/** Response for endpoint list */
export interface EndpointListResponse {
  /** Array of endpoints */
  endpoints: FirestoreEndpoint[];
}

/** Response for single endpoint */
export interface EndpointResponse {
  /** Endpoint data */
  endpoint: FirestoreEndpoint;
}

/** Response for execution logs list */
export interface ExecutionListResponse {
  /** Array of execution logs */
  requests: FirestoreExecution[];
}

/** Response for dashboard statistics */
export interface DashboardStatsResponse {
  /** Total number of endpoints */
  totalEndpoints: number;
  /** Total number of webhook requests */
  totalRequests: number;
  /** Recent execution logs */
  recentRequests: FirestoreExecution[];
}

/** Response for user profile */
export interface UserProfileResponse {
  /** User data */
  user: {
    /** User ID */
    id: string;
    /** Email address */
    email: string;
    /** Display name */
    displayName: string;
    /** Whether user is anonymous */
    isAnonymous: boolean;
    /** Account creation timestamp */
    createdAt: string;
  };
}

/** Standard error response */
export interface ErrorResponse {
  /** Error message */
  error: string;
}

/** Standard success response */
export interface SuccessResponse {
  /** Success indicator */
  ok: boolean;
}

// ── Reports & BigQuery Types ──────────────────────────────────────

/** Allowed time-window durations for report queries */
export type ReportDuration = "7d" | "30d" | "90d" | "180d";

/** Allowed output formats for report results */
export type ReportFormat =
  | "table"
  | "csv"
  | "json"
  | "markdown"
  | "chart"
  | "summary";

/** Request body for POST /api/reports/query */
export interface ReportQueryRequest {
  /** Natural language question */
  question: string;
  /** Time window — controls BigQuery cost */
  duration: ReportDuration;
  /** Desired output format */
  format: ReportFormat;
  /** Optional: scope to specific endpoint(s) */
  endpointIds?: string[];
}

/** Column metadata in table output */
export interface TableColumn {
  name: string;
  type: string;
}

/** Table-format output */
export interface TableOutput {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

/** Chart-format output */
export interface ChartOutput {
  type: "bar" | "line" | "pie" | "scatter";
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  xAxis?: string;
  yAxis?: string;
}

/** Query metadata included in every report response */
export interface ReportMeta {
  query: string;
  explanation: string;
  bytesProcessed: number;
  rowCount: number;
  executionTime: number;
  timeWindow: { start: string; end: string };
}

/** Quota status returned alongside results */
export interface QuotaStatus {
  queriesUsed: number;
  queriesLimit: number;
  bytesUsed: number;
  bytesLimit: number;
}

/** Full report response from POST /api/reports/query */
export interface ReportQueryResponse {
  id: string;
  meta: ReportMeta;
  data: TableOutput | ChartOutput | string;
  format: ReportFormat;
  quota: QuotaStatus;
}

/** A saved report history entry */
export interface ReportHistoryEntry {
  id: string;
  question: string;
  format: ReportFormat;
  duration: ReportDuration;
  createdAt: string;
  meta: ReportMeta;
}

/**
 * Gemini's structured response — SQL fragments, NOT a complete SQL string.
 *
 * The backend assembles the final SQL with hard-coded scaffolding so the
 * LLM cannot omit/weaken the user_id and time-window predicates, swap the
 * FROM table, exceed LIMIT, or inject a second statement.
 *
 *   SELECT {select_columns}
 *   FROM hooklab.executions
 *   WHERE user_id = @userId
 *     AND execution_timestamp >= @startTime
 *     AND execution_timestamp < @endTime
 *     AND ({where_extra | "TRUE"})
 *   {group_by}
 *   {order_by}
 *   LIMIT min({limit}, REPORT_MAX_ROWS)
 */
export interface GeminiSQLFragments {
  /** Column expressions only — no `*`, no FROM/JOIN, no `;`. */
  select_columns: string;
  /** Optional extra WHERE predicate; wrapped in parens, ANDed with the
   *  scaffolded user_id + time-window filters. Cannot weaken them. */
  where_extra?: string;
  /** Optional GROUP BY body, e.g. "method" or "DATE(execution_timestamp)". */
  group_by?: string;
  /** Optional ORDER BY body, e.g. "cnt DESC". */
  order_by?: string;
  /** Requested row limit; backend clamps to REPORT_MAX_ROWS. */
  limit?: number;
  explanation: string;
  suggestedFormat: ReportFormat;
  chartConfig?: {
    type: "bar" | "line" | "pie" | "scatter";
    xAxis: string;
    yAxis: string;
  };
}

/** Discovered schema for an endpoint's body payloads */
export interface EndpointSchemaInfo {
  endpointId: string;
  discoveredAt: string;
  sampleSize: number;
  topLevelKeys: string[];
}

// ── Hono Context Extension ─────────────────────────────────────────

/** Custom context variables set by middleware */
export interface ContextVariables {
  /** Authenticated user ID (set by authMiddleware) */
  userId: string;
  /** User email (set by authMiddleware) */
  userEmail: string;
  /** Whether user is anonymous (set by authMiddleware) */
  isAnonymous: boolean;
}
