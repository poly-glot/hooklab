/**
 * Auth routes — simplified.
 *
 * Authentication is handled entirely by Firebase Auth on the client.
 * The server only verifies Firebase ID tokens — no register/login endpoints.
 * This eliminates the custom password hashing, in-memory user store,
 * and custom JWT token creation.
 */

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.ts";
import {
  batchWrite,
  getUser,
  getDocument,
  updateDocument,
} from "../services/firebase-admin.ts";
import { fsNow } from "../utils/firestore-values.ts";
import { DEFAULT_SCRIPT } from "../config.ts";
import type { ContextVariables } from "../types.ts";

const auth = new Hono<{ Variables: ContextVariables }>();

// GET /api/auth/me — return the authenticated user's profile from Firestore
auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const user = await getUser(userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isAnonymous: user.isAnonymous,
      createdAt: user.createdAt,
    },
  });
});

// POST /api/auth/seed — seed demo data for guest users
auth.post("/seed", authMiddleware, async (c) => {
  const userId = c.get("userId");

  // Check if already seeded
  const userDoc = await getDocument("users", userId);
  if (userDoc?.seeded) {
    return c.json({ success: true, message: "Already seeded" });
  }

  const sampleEndpoints = [
    { name: "Payment Webhooks", requestCount: 8 },
    { name: "Order Notifications", requestCount: 6 },
    { name: "User Signups", requestCount: 5 },
    { name: "Stripe Events", requestCount: 7 },
    { name: "GitHub Push Events", requestCount: 4 },
    { name: "Slack Alerts", requestCount: 3 },
  ];

  const writes: Array<{ collection: string; docId: string; data: Record<string, unknown> }> = [];
  const now = fsNow();
  const methods = ["POST", "GET", "PUT", "DELETE", "PATCH"];

  for (const sample of sampleEndpoints) {
    const endpointId = crypto.randomUUID();

    writes.push({
      collection: "endpoints",
      docId: endpointId,
      data: {
        name: sample.name,
        userId,
        script: DEFAULT_SCRIPT,
        isActive: true,
        defaultStatusCode: 200,
        defaultContentType: "application/json",
        defaultBody: '{"ok": true}',
        totalExecutions: sample.requestCount,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Seed sample executions
    for (let i = 0; i < Math.min(sample.requestCount, 3); i++) {
      writes.push({
        collection: "executions",
        docId: crypto.randomUUID(),
        data: {
          endpointId,
          userId,
          method: methods[i % methods.length],
          url: `/w/${endpointId}`,
          headers: { "content-type": "application/json", host: "localhost" },
          query: {},
          body: JSON.stringify({ test: true, index: i }),
          ip: "127.0.0.1",
          responseStatus: 200,
          responseBody: '{"ok": true}',
          status: "success",
          duration: Math.floor(Math.random() * 100) + 10,
          timestamp: now,
        },
      });
    }
  }

  await batchWrite(writes);

  // Mark user as seeded — use a partial update so we don't overwrite
  // existing fields (createdAt, quotas, etc.) or add stray fields that
  // would break the Firestore users rules' onlyAllowedFields() check.
  await updateDocument("users", userId, {
    seeded: true,
    endpointCount: sampleEndpoints.length,
  });

  return c.json({ success: true, message: "Demo data created" });
});

export default auth;
