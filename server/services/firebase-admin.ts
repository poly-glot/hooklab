/**
 * Firebase Admin Firestore client for the Deno API server.
 *
 * Uses REST API with proper authentication:
 * - Emulator: "Bearer owner" token (bypasses rules)
 * - Production (Cloud Run): GCP metadata server access token
 *
 * This gives the webhook/backend service ADMIN-level access to Firestore,
 * bypassing client security rules — operations here are trusted server-side.
 */

import {
  DEFAULT_BODY,
  DEFAULT_CONTENT_TYPE,
  DEFAULT_SCRIPT,
  FIRESTORE_DB,
  DEFAULT_STATUS_CODE,
  FIRESTORE_EMULATOR_HOST,
  GCP_METADATA_TOKEN_URL,
  K_SERVICE,
  PROJECT_ID,
  TOKEN_CACHE_BUFFER,
} from "../config.ts";
import type {
  FirestoreEndpoint,
  FirestoreExecution,
  FirestoreUser,
} from "../types.ts";
import {
  FsTimestamp,
  fieldsToObject,
  fsNow,
  objectToFields,
  toFirestoreValue,
} from "../utils/firestore-values.ts";

// Re-export for consumers that expect these from firebase-admin
export { FsTimestamp, fsNow };

// ── Access token cache ──────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Gets a GCP access token for Firestore API requests.
 *
 * In emulator mode, returns "owner" to bypass security rules.
 * In production, fetches from GCP metadata server and caches the token.
 */
export async function getAccessToken(): Promise<string> {
  if (FIRESTORE_EMULATOR_HOST) return "owner";

  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_CACHE_BUFFER) {
    return cachedToken.token;
  }

  const res = await fetch(GCP_METADATA_TOKEN_URL, {
    headers: { "Metadata-Flavor": "Google" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to get access token from metadata server: ${res.status}`,
    );
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

// ── URL builders ────────────────────────────────────────────────────

function getBaseUrl(): string {
  return FIRESTORE_EMULATOR_HOST
    ? `http://${FIRESTORE_EMULATOR_HOST}`
    : "https://firestore.googleapis.com";
}

function docUrl(collection: string, docId: string): string {
  return `${getBaseUrl()}/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB}/documents/${collection}/${docId}`;
}

function collectionUrl(collection: string): string {
  return `${getBaseUrl()}/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB}/documents/${collection}`;
}

function queryUrl(): string {
  return `${getBaseUrl()}/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB}/documents:runQuery`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ── Batch / Commit ─────────────────────────────────────────────────

function commitUrl(): string {
  return `${getBaseUrl()}/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DB}/documents:commit`;
}

function docPath(collection: string, docId: string): string {
  return `projects/${PROJECT_ID}/databases/${FIRESTORE_DB}/documents/${collection}/${docId}`;
}

/**
 * Atomically writes multiple documents using Firestore commit API.
 * Each write is an "update" (upsert) with the full document fields.
 */
export async function batchWrite(
  writes: Array<{ collection: string; docId: string; data: Record<string, unknown> }>,
): Promise<void> {
  const headers = await authHeaders();
  const body = {
    writes: writes.map((w) => ({
      update: {
        name: docPath(w.collection, w.docId),
        fields: objectToFields(w.data),
      },
    })),
  };

  const res = await fetch(commitUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[FirebaseAdmin] batchWrite failed: ${res.status} ${err}`);
  }
}

// ── Document CRUD ───────────────────────────────────────────────────

/**
 * Fetches a single document from Firestore.
 *
 * @returns Document data with id field, or null if not found
 */
export async function getDocument(
  collection: string,
  docId: string,
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any> | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch(docUrl(collection, docId), { headers });
    if (!res.ok) return null;
    const doc = await res.json();
    return { id: docId, ...fieldsToObject(doc.fields || {}) };
  } catch (err) {
    console.error(
      `[FirebaseAdmin] getDocument ${collection}/${docId} failed:`,
      err,
    );
    return null;
  }
}

/**
 * Creates a new document in Firestore.
 *
 * @returns Created document ID
 */
export async function createDocument(
  collection: string,
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>,
  docId?: string,
): Promise<string> {
  const headers = await authHeaders();
  const fields = objectToFields(data);

  if (docId) {
    await fetch(docUrl(collection, docId), {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields }),
    });
    return docId;
  }

  const res = await fetch(collectionUrl(collection), {
    method: "POST",
    headers,
    body: JSON.stringify({ fields }),
  });
  const result = await res.json();
  const name: string = result.name || "";
  return name.split("/").pop() || "";
}

/**
 * Builds a nested Firestore fields object from dot-path keys.
 *
 * E.g. `{ "quotas.usedExecutionsToday": 0 }` becomes:
 * `{ quotas: { mapValue: { fields: { usedExecutionsToday: { integerValue: "0" } } } } }`
 *
 * Plain keys (no dots) are handled normally via objectToFields.
 */
function buildNestedFields(
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>,
  // deno-lint-ignore no-explicit-any
): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const parts = key.split(".");
    if (parts.length === 1) {
      result[key] = toFirestoreValue(value);
    } else {
      // Build nested mapValue structure from inside out
      let current = toFirestoreValue(value);
      for (let i = parts.length - 1; i >= 1; i--) {
        current = { mapValue: { fields: { [parts[i]]: current } } };
      }
      result[parts[0]] = current;
    }
  }

  return result;
}

/**
 * Updates an existing document in Firestore (partial update).
 *
 * Supports dot-path keys for nested field updates without clobbering
 * sibling fields. E.g. `{ "quotas.usedExecutionsToday": 0 }` only
 * updates that one nested field, preserving quotas.maxEndpoints etc.
 */
export async function updateDocument(
  collection: string,
  docId: string,
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>,
): Promise<void> {
  const headers = await authHeaders();
  const hasDotKeys = Object.keys(data).some((k) => k.includes("."));
  const fields = hasDotKeys ? buildNestedFields(data) : objectToFields(data);
  const fieldPaths = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const res = await fetch(`${docUrl(collection, docId)}?${fieldPaths}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[FirebaseAdmin] updateDocument ${collection}/${docId} failed: ${res.status} ${err}`);
  }
}

/**
 * Deletes a document from Firestore.
 */
export async function deleteDocument(
  collection: string,
  docId: string,
): Promise<void> {
  const headers = await authHeaders();
  await fetch(docUrl(collection, docId), { method: "DELETE", headers });
}

/**
 * Runs a structured query against a Firestore collection.
 */
export async function runQuery(
  collection: string,
  // deno-lint-ignore no-explicit-any
  filters: Array<{ field: string; op: string; value: any }>,
  orderByField?: string,
  orderDirection: "ASCENDING" | "DESCENDING" = "DESCENDING",
  limitCount?: number,
  // deno-lint-ignore no-explicit-any
): Promise<Array<{ id: string } & Record<string, any>>> {
  const headers = await authHeaders();

  // deno-lint-ignore no-explicit-any
  const where: any =
    filters.length === 1
      ? {
          fieldFilter: {
            field: { fieldPath: filters[0].field },
            op: filters[0].op,
            value: toFirestoreValue(filters[0].value),
          },
        }
      : {
          compositeFilter: {
            op: "AND",
            filters: filters.map((f) => ({
              fieldFilter: {
                field: { fieldPath: f.field },
                op: f.op,
                value: toFirestoreValue(f.value),
              },
            })),
          },
        };

  // deno-lint-ignore no-explicit-any
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
    where,
  };

  if (orderByField) {
    structuredQuery.orderBy = [
      { field: { fieldPath: orderByField }, direction: orderDirection },
    ];
  }

  if (limitCount) {
    structuredQuery.limit = limitCount;
  }

  const res = await fetch(queryUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({ structuredQuery }),
  });

  const results = await res.json();
  if (!Array.isArray(results)) return [];

  return results
    .filter(
      (r: { document?: { name: string; fields: Record<string, unknown> } }) =>
        r.document,
    )
    .map(
      (r: { document: { name: string; fields: Record<string, unknown> } }) => {
        const id = r.document.name.split("/").pop() || "";
        return { id, ...fieldsToObject(r.document.fields || {}) };
      },
    );
}

// ── Typed document mappers ──────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function toEndpoint(doc: Record<string, any>): FirestoreEndpoint {
  return {
    id: doc.id,
    userId: doc.userId || "",
    name: doc.name || "",
    script: doc.script || "",
    isActive: doc.isActive !== false,
    defaultStatusCode: doc.defaultStatusCode ?? DEFAULT_STATUS_CODE,
    defaultContentType: doc.defaultContentType || DEFAULT_CONTENT_TYPE,
    defaultBody: doc.defaultBody || DEFAULT_BODY,
    totalExecutions: doc.totalExecutions ?? 0,
    createdAt: doc.createdAt || new Date().toISOString(),
    updatedAt: doc.updatedAt || new Date().toISOString(),
  };
}

// deno-lint-ignore no-explicit-any
function toExecution(doc: Record<string, any>): FirestoreExecution {
  return {
    id: doc.id,
    endpointId: doc.endpointId || "",
    userId: doc.userId || "",
    method: doc.method || "",
    url: doc.url || "",
    headers: doc.headers || {},
    query: doc.query || {},
    body: doc.body || "",
    ip: doc.ip || "",
    responseStatus: doc.responseStatus ?? 200,
    responseBody: doc.responseBody || "",
    duration: doc.duration ?? 0,
    timestamp: doc.timestamp || new Date().toISOString(),
    status: doc.status || "success",
  };
}

// ── Endpoint operations ─────────────────────────────────────────────

export async function getEndpoint(
  endpointId: string,
): Promise<FirestoreEndpoint | null> {
  const doc = await getDocument("endpoints", endpointId);
  return doc ? toEndpoint(doc) : null;
}

export async function getEndpointsByUser(
  userId: string,
): Promise<FirestoreEndpoint[]> {
  const results = await runQuery(
    "endpoints",
    [{ field: "userId", op: "EQUAL", value: userId }],
    "createdAt",
    "DESCENDING",
  );
  return results.map(toEndpoint);
}

/**
 * Creates a new endpoint document in Firestore.
 */
export async function createEndpoint(
  userId: string,
  name: string,
  script?: string,
): Promise<FirestoreEndpoint> {
  const now = fsNow();

  const data = {
    name,
    userId,
    script: script ?? DEFAULT_SCRIPT,
    isActive: true,
    defaultStatusCode: DEFAULT_STATUS_CODE,
    defaultContentType: DEFAULT_CONTENT_TYPE,
    defaultBody: DEFAULT_BODY,
    totalExecutions: 0,
    createdAt: now,
    updatedAt: now,
  };

  const id = await createDocument("endpoints", data);

  return {
    id,
    name,
    userId,
    script: script ?? DEFAULT_SCRIPT,
    isActive: true,
    defaultStatusCode: DEFAULT_STATUS_CODE,
    defaultContentType: DEFAULT_CONTENT_TYPE,
    defaultBody: DEFAULT_BODY,
    totalExecutions: 0,
    createdAt: now.iso,
    updatedAt: now.iso,
  };
}

export async function updateEndpointFields(
  endpointId: string,
  // deno-lint-ignore no-explicit-any
  updates: Record<string, any>,
): Promise<FirestoreEndpoint | null> {
  await updateDocument("endpoints", endpointId, {
    ...updates,
    updatedAt: fsNow(),
  });
  return getEndpoint(endpointId);
}

export async function deleteEndpointDoc(endpointId: string): Promise<void> {
  await deleteDocument("endpoints", endpointId);
}

// ── Execution / request log operations ──────────────────────────────

export async function writeExecution(data: {
  endpointId: string;
  userId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  ip: string;
  responseStatus: number;
  responseBody: string;
  duration?: number;
}): Promise<string> {
  return createDocument("executions", {
    ...data,
    timestamp: fsNow(),
    status: data.responseStatus < 400 ? "success" : "error",
    duration: data.duration ?? 0,
  });
}

export async function getExecutionsByEndpoint(
  endpointId: string,
  limitCount = 100,
): Promise<FirestoreExecution[]> {
  const results = await runQuery(
    "executions",
    [{ field: "endpointId", op: "EQUAL", value: endpointId }],
    "timestamp",
    "DESCENDING",
    limitCount,
  );
  return results.map(toExecution);
}

// ── User operations ─────────────────────────────────────────────────

export async function getUser(userId: string): Promise<FirestoreUser | null> {
  const doc = await getDocument("users", userId);
  if (!doc) return null;
  return {
    id: doc.id,
    email: doc.email || "",
    isAnonymous: doc.isAnonymous ?? false,
    displayName: doc.displayName || "",
    endpointCount: doc.endpointCount ?? 0,
    createdAt: doc.createdAt || new Date().toISOString(),
  };
}

// ── Bulk operations ────────────────────────────────────────────────

/**
 * Deletes all documents matching a query, in batches of 500.
 * Returns total count of deleted documents.
 */
export async function deleteByQuery(
  collection: string,
  filters: Array<{ field: string; op: string; value: unknown }>,
): Promise<number> {
  let totalDeleted = 0;
  let results = await runQuery(collection, filters, undefined, "DESCENDING", 500);

  while (results.length > 0) {
    await Promise.all(results.map((doc) => deleteDocument(collection, doc.id)));
    totalDeleted += results.length;
    results = await runQuery(collection, filters, undefined, "DESCENDING", 500);
  }

  return totalDeleted;
}

// ── Availability check ──────────────────────────────────────────────

export function isFirestoreEnabled(): boolean {
  return !!FIRESTORE_EMULATOR_HOST || !!K_SERVICE;
}

export function getProjectId(): string {
  return PROJECT_ID;
}
