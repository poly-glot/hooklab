/**
 * Email auth routes — passwordless sign-in via email link.
 *
 * Public endpoint (no auth middleware). Generates a Firebase email sign-in
 * link server-side and sends it via Resend so we control the email template.
 */

import { Hono } from "hono";
import {
  APP_DOMAIN,
  FROM_EMAIL,
  PROJECT_ID,
  RATE_LIMIT_WINDOW,
  RESEND_API_KEY,
} from "../config.ts";
import { getAccessToken } from "../services/firebase-admin.ts";
import { buildSignInEmail } from "../templates/sign-in-email.ts";
import type { ContextVariables, RateLimitEntry } from "../types.ts";

const emailAuth = new Hono<{ Variables: ContextVariables }>();

// ── Rate limiting (1 request per email per 60s) ───────────────────

const emailRateLimits = new Map<string, RateLimitEntry>();

/**
 * Checks whether a sign-in link request is allowed for the given email.
 *
 * Returns the number of seconds to wait if rate-limited, or 0 if allowed.
 */
function checkRateLimit(email: string): number {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = emailRateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    emailRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return 0;
  }

  // Already sent within the window — return seconds remaining
  return Math.ceil((entry.resetAt - now) / 1000);
}

// ── Email validation ──────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_RE.test(email);
}

// ── POST /send-link ───────────────────────────────────────────────

emailAuth.post("/send-link", async (c) => {
  // Parse body
  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid email address" }, 400);
  }

  const { email } = body;

  if (!isValidEmail(email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  // Rate limit
  const retryAfter = checkRateLimit(email);
  if (retryAfter > 0) {
    return c.json(
      { error: "Please wait before requesting another link", retryAfter },
      429,
    );
  }

  try {
    // ── Generate Firebase email sign-in link (Admin REST API) ────
    const continueUrl = `https://${APP_DOMAIN}/auth`;
    const accessToken = await getAccessToken();

    const oobRes = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "EMAIL_SIGNIN",
          email,
          continueUrl,
          canHandleCodeInApp: true,
          returnOobLink: true,
          targetProjectId: PROJECT_ID,
        }),
      },
    );

    if (!oobRes.ok) {
      const err = await oobRes.text();
      console.error("[EmailAuth] Failed to generate sign-in link:", err);
      return c.json({ error: "Failed to send sign-in link" }, 500);
    }

    const oobData = await oobRes.json();
    const signInLink: string = oobData.oobLink;

    if (!signInLink) {
      console.error("[EmailAuth] No oobLink in response:", oobData);
      return c.json({ error: "Failed to send sign-in link" }, 500);
    }

    // ── Send email via Resend ───────────────────────────────────
    const html = buildSignInEmail(signInLink, email);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "Sign in to Hooklab",
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("[EmailAuth] Resend API error:", err);
      return c.json({ error: "Failed to send sign-in link" }, 500);
    }

    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[EmailAuth] Unexpected error:", err);
    return c.json({ error: "Failed to send sign-in link" }, 500);
  }
});

export default emailAuth;
