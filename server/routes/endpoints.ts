/**
 * Endpoint CRUD routes — backed by Firestore (admin access).
 *
 * All operations go through Firebase Admin Firestore client.
 * No in-memory store. Auth via Firebase ID token verification.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import {
  createEndpoint,
  deleteByQuery,
  deleteDocument,
  deleteEndpointDoc,
  getDocument,
  getEndpoint,
  getEndpointsByUser,
  getExecutionsByEndpoint,
  updateDocument,
  updateEndpointFields,
} from "../services/firebase-admin.ts";
import type {
  ContextVariables,
  CreateEndpointRequest,
  FirestoreEndpoint,
  FirestoreExecution,
  UpdateEndpointRequest,
} from "../types.ts";
import {
  validateCreateEndpoint,
  validateUpdateEndpoint,
} from "../utils/validators.ts";

const endpoints = new Hono<{ Variables: ContextVariables }>();

// All routes require Firebase Auth
endpoints.use("*", authMiddleware);

// ── Helpers ─────────────────────────────────────────────────────────

/** Fetches an endpoint and verifies the caller owns it. */
async function getOwnedEndpoint(
  c: Context,
  userId: string,
): Promise<FirestoreEndpoint | null> {
  const id = c.req.param("id");
  if (!id) return null;
  const endpoint = await getEndpoint(id);
  if (!endpoint || endpoint.userId !== userId) return null;
  return endpoint;
}

/** Read current endpointCount, add delta, write back. */
async function incrementEndpointCount(userId: string, delta: number): Promise<void> {
  const doc = await getDocument("users", userId);
  const current = (doc?.endpointCount as number) ?? 0;
  await updateDocument("users", userId, {
    endpointCount: Math.max(0, current + delta),
  });
}

const UPDATABLE_FIELDS = [
  "name", "script", "defaultStatusCode", "defaultContentType", "defaultBody",
] as const;

// ── Routes ──────────────────────────────────────────────────────────

// GET /api/endpoints — list all endpoints for the authenticated user
endpoints.get("/", async (c) => {
  const userId = c.get("userId");
  const items = await getEndpointsByUser(userId);
  return c.json({ endpoints: items });
});

// POST /api/endpoints — create a new endpoint
endpoints.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<CreateEndpointRequest>();

  const validation = validateCreateEndpoint(body);
  if (!validation.valid) {
    return c.json({ error: validation.errors?.[0]?.message || "Invalid input" }, 400);
  }

  const endpoint = await createEndpoint(userId, body.name.trim(), body.script);

  // Increment user's endpoint counter (fire-and-forget)
  incrementEndpointCount(userId, 1).catch((err) =>
    console.error("[Endpoints] Failed to increment endpointCount:", err),
  );

  return c.json({ endpoint }, 201);
});

// GET /api/endpoints/:id — get endpoint details (ownership enforced)
endpoints.get("/:id", async (c) => {
  const endpoint = await getOwnedEndpoint(c, c.get("userId"));
  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404);
  return c.json({ endpoint });
});

// PUT /api/endpoints/:id — update endpoint (ownership enforced)
endpoints.put("/:id", async (c) => {
  const endpoint = await getOwnedEndpoint(c, c.get("userId"));
  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404);

  const body = await c.req.json<UpdateEndpointRequest>();

  const validation = validateUpdateEndpoint(body);
  if (!validation.valid) {
    return c.json({ error: validation.errors?.[0]?.message || "Invalid input" }, 400);
  }

  const updates = Object.fromEntries(
    UPDATABLE_FIELDS
      .filter((k) => body[k] !== undefined)
      .map((k) => [k, k === "name" ? (body[k] as string).trim() : body[k]]),
  );

  const updated = await updateEndpointFields(endpoint.id, updates);
  return c.json({ endpoint: updated });
});

// DELETE /api/endpoints/:id — delete endpoint (ownership enforced)
endpoints.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const endpoint = await getOwnedEndpoint(c, userId);
  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404);

  await deleteEndpointDoc(endpoint.id);

  // Decrement counter and clean up executions (fire-and-forget)
  Promise.all([
    incrementEndpointCount(userId, -1),
    deleteByQuery("executions", [{ field: "endpointId", op: "EQUAL", value: endpoint.id }]),
  ]).catch((err) =>
    console.error("[Endpoints] Post-delete cleanup failed:", err),
  );

  return c.json({ ok: true });
});

// GET /api/endpoints/:id/requests — get execution logs (ownership enforced)
endpoints.get("/:id/requests", async (c) => {
  const endpoint = await getOwnedEndpoint(c, c.get("userId"));
  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404);

  const executions = await getExecutionsByEndpoint(endpoint.id);
  return c.json({ requests: executions });
});

// DELETE /api/endpoints/:id/requests/:requestId — delete a single execution log
// NOTE: Must be registered before the bulk delete route so Hono matches the more specific path first.
endpoints.delete("/:id/requests/:requestId", async (c) => {
  const userId = c.get("userId");
  const endpoint = await getOwnedEndpoint(c, userId);
  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404);

  const requestId = c.req.param("requestId");

  // Verify the execution belongs to this endpoint AND this user
  // to prevent IDOR — without this, any authenticated user could
  // delete any execution log by ID.
  const execution = await getDocument("executions", requestId);
  if (
    !execution ||
    execution.endpointId !== endpoint.id ||
    execution.userId !== userId
  ) {
    return c.json({ error: "Execution not found" }, 404);
  }

  await deleteDocument("executions", requestId);
  return c.json({ ok: true });
});

// DELETE /api/endpoints/:id/requests — clear execution logs (ownership enforced)
endpoints.delete("/:id/requests", async (c) => {
  const endpoint = await getOwnedEndpoint(c, c.get("userId"));
  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404);

  const executions = await getExecutionsByEndpoint(endpoint.id, 500);
  await Promise.all(executions.map((e) => deleteDocument("executions", e.id)));
  return c.json({ ok: true });
});

// GET /api/endpoints/_stats — dashboard statistics
endpoints.get("/_stats", async (c) => {
  const userId = c.get("userId");
  const userEndpoints = await getEndpointsByUser(userId);

  const totalRequests = userEndpoints.reduce((sum, ep) => sum + ep.totalExecutions, 0);

  const logsPerEndpoint = await Promise.all(
    userEndpoints.map((ep) => getExecutionsByEndpoint(ep.id, 5)),
  );

  const recentRequests: FirestoreExecution[] = logsPerEndpoint
    .flat()
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
    .slice(0, 10);

  return c.json({ totalEndpoints: userEndpoints.length, totalRequests, recentRequests });
});

export default endpoints;
