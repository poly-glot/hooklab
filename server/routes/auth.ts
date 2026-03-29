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
import { getUser } from "../services/firebase-admin.ts";
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

export default auth;
