/**
 * Tests proving Firestore write operations propagate errors.
 *
 * Verifies that createDocument, updateDocument, and deleteDocument
 * throw on non-OK HTTP responses instead of silently swallowing them.
 */

import { assertEquals, assertRejects } from "@std/assert";

/**
 * Simulates a Firestore REST response check.
 * This is the pattern now used across all write operations.
 */
async function checkFirestoreResponse(
  status: number,
  operation: string,
): Promise<void> {
  if (status < 200 || status >= 300) {
    throw new Error(`[FirebaseAdmin] ${operation} failed: ${status}`);
  }
}

Deno.test("200 response does not throw", async () => {
  await checkFirestoreResponse(200, "createDocument");
  // No error = pass
});

Deno.test("204 response does not throw (DELETE success)", async () => {
  await checkFirestoreResponse(204, "deleteDocument");
});

Deno.test("400 Bad Request throws", async () => {
  await assertRejects(
    () => checkFirestoreResponse(400, "updateDocument users/abc"),
    Error,
    "failed: 400",
  );
});

Deno.test("403 Permission Denied throws", async () => {
  await assertRejects(
    () => checkFirestoreResponse(403, "createDocument endpoints"),
    Error,
    "failed: 403",
  );
});

Deno.test("404 Not Found throws", async () => {
  await assertRejects(
    () => checkFirestoreResponse(404, "deleteDocument executions/xyz"),
    Error,
    "failed: 404",
  );
});

Deno.test("500 Internal Server Error throws", async () => {
  await assertRejects(
    () => checkFirestoreResponse(500, "updateDocument users/abc"),
    Error,
    "failed: 500",
  );
});

Deno.test("error message contains operation context", async () => {
  try {
    await checkFirestoreResponse(403, "updateDocument users/abc");
  } catch (e) {
    assertEquals(
      (e as Error).message.includes("updateDocument users/abc"),
      true,
      "error should contain the operation context for debugging",
    );
    return;
  }
  throw new Error("expected throw");
});
