/**
 * Centralized configuration for the Hooklab API server.
 *
 * All environment variables and constants are defined here
 * to avoid magic numbers and improve maintainability.
 */

// ── Environment Variables ──────────────────────────────────────────

/** Firebase/GCP project identifier */
export const PROJECT_ID =
  Deno.env.get("GCP_PROJECT") ||
  Deno.env.get("GCLOUD_PROJECT") ||
  Deno.env.get("FIREBASE_PROJECT_ID") ||
  "demo-webhook";

/** Firestore database name — always "hooklab" (matches firebase.json and Terraform) */
export const FIRESTORE_DB = Deno.env.get("FIRESTORE_DB") || "hooklab";

/** Firestore emulator host (e.g., "127.0.0.1:8080") */
export const FIRESTORE_EMULATOR_HOST = Deno.env.get("FIRESTORE_EMULATOR_HOST");

/** Firebase Auth emulator host (e.g., "127.0.0.1:9099") */
export const AUTH_EMULATOR_HOST = Deno.env.get("FIREBASE_AUTH_EMULATOR_HOST");

/** Server port */
export const PORT = parseInt(Deno.env.get("PORT") ?? "3000", 10);

/** CORS allowed origins (comma-separated) */
export const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")
  ? Deno.env.get("ALLOWED_ORIGINS")!.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

/** Cloud Run service name (indicates production environment) */
export const K_SERVICE = Deno.env.get("K_SERVICE");

/** Resend API key for sending transactional emails */
export const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

/** Sender email address for transactional emails */
export const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@junaid.guru";

/** Application domain for sign-in continue URLs */
export const APP_DOMAIN = Deno.env.get("APP_DOMAIN") || "hooklab.junaid.guru";

// ── Internal Route Auth ────────────────────────────────────────────

/** Expected audience in OIDC tokens for internal routes (Cloud Scheduler → Cloud Run) */
export const INTERNAL_OIDC_AUDIENCE = Deno.env.get("INTERNAL_OIDC_AUDIENCE") || "";

/** Expected service-account email for Cloud Scheduler OIDC tokens */
export const INTERNAL_SCHEDULER_EMAIL = Deno.env.get("INTERNAL_SCHEDULER_EMAIL") || "";

// ── Size Limits ────────────────────────────────────────────────────

/** Maximum endpoint name length (characters) */
export const MAX_NAME_LENGTH = 100;

/** Maximum script size (bytes) - 64 KB */
export const MAX_SCRIPT_LENGTH = 65_536;

/** Maximum default body length (bytes) */
export const MAX_BODY_LENGTH = 10_000;

/** Maximum default content type length (characters) */
export const MAX_CONTENT_TYPE_LENGTH = 200;

/** Maximum incoming webhook body size (bytes) - 1 MB */
export const MAX_WEBHOOK_BODY_SIZE = 1_048_576;

/** Maximum request body size for sandbox (bytes) - 1 MB */
export const MAX_REQUEST_BODY_SIZE = 1_048_576;

/** Maximum response body size from sandbox (bytes) - 1 MB */
export const MAX_RESPONSE_BODY_SIZE = 1_048_576;

// ── Timeouts & Rate Limits ─────────────────────────────────────────

/** Script execution timeout in worker (milliseconds) - 10 seconds */
export const SCRIPT_GLOBAL_TIMEOUT = 10_000;

/** Script execution timeout inside worker (milliseconds) - 5 seconds */
export const SCRIPT_WORKER_TIMEOUT = 5_000;

/** Rate limit window duration (milliseconds) - 1 minute */
export const RATE_LIMIT_WINDOW = 60_000;

/** Maximum requests per endpoint per minute */
export const MAX_REQUESTS_PER_MINUTE = 100;

/** Access token cache buffer (milliseconds) - 60 seconds */
export const TOKEN_CACHE_BUFFER = 60_000;

/** Public key cache default TTL (milliseconds) - 1 hour */
export const KEY_CACHE_DEFAULT_TTL = 3_600_000;

/** Token expiry leeway for clock skew (seconds) - 5 minutes */
export const TOKEN_EXPIRY_LEEWAY = 300;

// ── HTTP Status Codes ──────────────────────────────────────────────

/** Valid HTTP status code range */
export const STATUS_CODE_MIN = 100;
export const STATUS_CODE_MAX = 599;

// ── External URLs ──────────────────────────────────────────────────

/** Google's public key endpoint for Firebase token verification */
export const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

/** GCP metadata server token endpoint */
export const GCP_METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

// ── Default Values ─────────────────────────────────────────────────

/** Default HTTP status code for new endpoints */
export const DEFAULT_STATUS_CODE = 200;

/** Default content type for new endpoints */
export const DEFAULT_CONTENT_TYPE = "application/json";

/** Default response body for new endpoints */
export const DEFAULT_BODY = '{"ok": true}';

/** Default script template for new endpoints */
export const DEFAULT_SCRIPT = `// Access the incoming request via the 'request' object:
// - request.method (string)
// - request.headers (object)
// - request.query (object)
// - request.body (string)
// - request.url (string)
//
// Return a response object:
return {
  status: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ok: true, timestamp: Date.now() })
};`;

// ── Reports / BigQuery / Gemini ────────────────────────────────────

/** BigQuery dataset ID */
export const BQ_DATASET = Deno.env.get("BQ_DATASET") || "hooklab";

/** BigQuery table ID for the materialized executions table */
export const BQ_TABLE = Deno.env.get("BQ_TABLE") || "executions";

/** Vertex AI / Gemini model for SQL generation (Flash — fast + cheap) */
export const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

/** Vertex AI location (should match your GCP region) */
export const VERTEX_AI_LOCATION = Deno.env.get("VERTEX_AI_LOCATION") || "europe-west2";

/** Maximum rows returned by any report query */
export const REPORT_MAX_ROWS = 1000;

/** Maximum bytes a single query may scan (500 MB) */
export const REPORT_MAX_BYTES_PER_QUERY = 500 * 1024 * 1024;

/** Daily query limits per user tier */
export const REPORT_QUOTAS = {
  guest: { maxQueriesPerDay: 5, maxBytesPerDay: 500 * 1024 * 1024 },
  registered: { maxQueriesPerDay: 50, maxBytesPerDay: 5 * 1024 * 1024 * 1024 },
} as const;

/** Duration tier to days mapping */
export const DURATION_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
};

// ── Validation Patterns ────────────────────────────────────────────

/** Regex pattern for safe HTTP header names */
export const SAFE_HEADER_NAME_PATTERN = /^[a-zA-Z0-9\-]+$/;

/** Blocked HTTP headers that could enable security attacks */
export const BLOCKED_HEADERS = [
  "set-cookie",
  "access-control-allow-origin",
  "access-control-allow-credentials",
] as const;

// ── Security Headers ───────────────────────────────────────────────

/** Security headers to apply to all responses */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cache-Control": "no-store",
} as const;

// ── CORS Configuration ─────────────────────────────────────────────

/** Allowed HTTP methods for CORS */
export const CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"] as const;

/** Allowed HTTP headers for CORS */
export const CORS_HEADERS = ["Content-Type", "Authorization"] as const;

/** CORS max age (seconds) */
export const CORS_MAX_AGE = 3600;
