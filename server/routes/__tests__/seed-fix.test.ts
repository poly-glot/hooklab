/**
 * Focused verification for the seed endpoint fix.
 *
 * Reproduces the old buggy write (user doc with stray `id: null` field) and
 * confirms the new `updateDocument` path produces a clean user doc that
 * satisfies the Firestore users-collection rules' onlyAllowedFields() check.
 *
 * Requires the Firestore emulator running on localhost:8080.
 */

import { assertEquals, assert } from "@std/assert";
import {
  batchWrite,
  getDocument,
  updateDocument,
} from "../../services/firebase-admin.ts";
import { deleteDocument } from "../../services/firebase-admin.ts";

// Ensure emulator mode for this test run.
Deno.env.set("FIRESTORE_EMULATOR_HOST", "localhost:8080");
Deno.env.set("GCP_PROJECT", "demo-webhook");

const ALLOWED_UPDATE_FIELDS = new Set([
  "email",
  "isAnonymous",
  "displayName",
  "lastLoginAt",
  "endpointCount",
  "quotas",
  "seeded",
]);

Deno.test({
  sanitizeResources: false,
  sanitizeOps: false,
  name: "OLD buggy seed produces stray `id` field on users doc",
  fn: async () => {
  const uid = "bug_user_" + crypto.randomUUID();

  // Simulate client createUserDocument beforehand: pre-existing user doc.
  await updateDocument("users", uid, {
    email: "guest@example.com",
    isAnonymous: true,
    endpointCount: 0,
  });

  const pre = await getDocument("users", uid);
  assert(pre);

  // Reproduce OLD buggy behaviour: batchWrite with `id: undefined`.
  await batchWrite([
    {
      collection: "users",
      docId: uid,
      data: {
        seeded: true,
        endpointCount: 6,
        ...(pre || {}),
        id: undefined, // ← bug: becomes nullValue in Firestore
      },
    },
  ]);

  const after = await getDocument("users", uid);
  assert(after);
  // The stray `id` field is present
  assert("id" in after, "expected buggy write to add `id` field");
  // And `id` is NOT in the Firestore update rule's allow-list — any
  // subsequent client updateDoc() would fail onlyAllowedFields()
  const keys = Object.keys(after).filter((k) => k !== "id"); // strip get-id alias
  // Re-fetch doc raw fields to avoid getDocument's synthetic `id` alias
  const raw = await fetch(
    `http://localhost:8080/v1/projects/demo-webhook/databases/hooklab/documents/users/${uid}`,
    { headers: { Authorization: "Bearer owner" } },
  ).then((r) => r.json());
  const rawKeys = Object.keys(raw.fields || {});
  console.log("raw fields after buggy write:", rawKeys);
  assert(
    rawKeys.includes("id"),
    "expected stray `id` field in Firestore after buggy write",
  );

  // The stray `id` field is NOT in the allowed list — client updates blocked
  assert(!ALLOWED_UPDATE_FIELDS.has("id"));

  await deleteDocument("users", uid);
  void keys;
  },
});

Deno.test({
  sanitizeResources: false,
  sanitizeOps: false,
  name: "FIXED seed: updateDocument writes only seeded+endpointCount",
  fn: async () => {
  const uid = "fix_user_" + crypto.randomUUID();

  // Simulate client createUserDocument beforehand.
  await updateDocument("users", uid, {
    email: "guest@example.com",
    isAnonymous: true,
    endpointCount: 0,
  });

  // Reproduce NEW fixed behaviour: partial updateDocument.
  await updateDocument("users", uid, {
    seeded: true,
    endpointCount: 6,
  });

  // Fetch raw Firestore fields.
  const raw = await fetch(
    `http://localhost:8080/v1/projects/demo-webhook/databases/hooklab/documents/users/${uid}`,
    { headers: { Authorization: "Bearer owner" } },
  ).then((r) => r.json());
  const rawKeys = Object.keys(raw.fields || {});
  console.log("raw fields after fixed write:", rawKeys);

  // No stray `id` field
  assert(
    !rawKeys.includes("id"),
    "expected no stray `id` field after fixed write",
  );

  // All fields must be in the allowed update list
  for (const k of rawKeys) {
    assert(
      ALLOWED_UPDATE_FIELDS.has(k),
      `field "${k}" is not in the users update rule allow-list`,
    );
  }

  // seeded + endpointCount are set correctly
  assertEquals(raw.fields.seeded.booleanValue, true);
  assertEquals(Number(raw.fields.endpointCount.integerValue), 6);
  // Pre-existing field preserved (partial update, not replace)
  assertEquals(raw.fields.email.stringValue, "guest@example.com");

  await deleteDocument("users", uid);
  },
});
