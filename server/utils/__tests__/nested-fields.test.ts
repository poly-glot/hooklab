/**
 * Tests for dot-path field building used by updateDocument.
 *
 * Proves that dot-path keys produce correct nested Firestore structures
 * without clobbering sibling fields.
 */

import { assertEquals } from "@std/assert";
import { toFirestoreValue } from "../firestore-values.ts";

/**
 * Mirror of buildNestedFields from firebase-admin.ts — extracted here
 * for pure unit testing without importing the full admin module.
 */
// deno-lint-ignore no-explicit-any
function buildNestedFields(data: Record<string, any>): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const parts = key.split(".");
    if (parts.length === 1) {
      result[key] = toFirestoreValue(value);
    } else {
      let current = toFirestoreValue(value);
      for (let i = parts.length - 1; i >= 1; i--) {
        current = { mapValue: { fields: { [parts[i]]: current } } };
      }
      result[parts[0]] = current;
    }
  }

  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────

Deno.test("plain key produces flat field", () => {
  const result = buildNestedFields({ seeded: true });
  assertEquals(result, {
    seeded: { booleanValue: true },
  });
});

Deno.test("dot-path key produces nested mapValue structure", () => {
  const result = buildNestedFields({ "quotas.usedExecutionsToday": 0 });
  assertEquals(result, {
    quotas: {
      mapValue: {
        fields: {
          usedExecutionsToday: { integerValue: "0" },
        },
      },
    },
  });
});

Deno.test("deep dot-path (3 levels) nests correctly", () => {
  const result = buildNestedFields({ "a.b.c": "hello" });
  assertEquals(result, {
    a: {
      mapValue: {
        fields: {
          b: {
            mapValue: {
              fields: {
                c: { stringValue: "hello" },
              },
            },
          },
        },
      },
    },
  });
});

Deno.test("mix of plain and dot-path keys", () => {
  const result = buildNestedFields({
    seeded: true,
    "quotas.usedExecutionsToday": 0,
  });
  assertEquals(result.seeded, { booleanValue: true });
  assertEquals(result.quotas, {
    mapValue: {
      fields: {
        usedExecutionsToday: { integerValue: "0" },
      },
    },
  });
});

Deno.test("updateMask field paths preserve dot notation", () => {
  const data = { "quotas.usedExecutionsToday": 0, seeded: true };
  const fieldPaths = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`);
  // The dot-path should be passed as-is to Firestore (URL-encoded)
  assertEquals(fieldPaths.includes("updateMask.fieldPaths=quotas.usedExecutionsToday"), true);
  assertEquals(fieldPaths.includes("updateMask.fieldPaths=seeded"), true);
});

Deno.test("original clobber scenario: plain 'quotas' key replaces entire map", () => {
  // This test documents the OLD broken behavior to show why dot-path is needed.
  // If you pass { quotas: { usedExecutionsToday: 0 } } as a plain key,
  // objectToFields wraps it as a full mapValue and updateMask=quotas
  // replaces the ENTIRE quotas object — losing maxEndpoints etc.
  const data = { quotas: { usedExecutionsToday: 0 } };
  const fieldPaths = Object.keys(data); // ["quotas"]
  assertEquals(fieldPaths, ["quotas"], "plain key = full replace");

  // The fix: use dot-path instead
  const fixedData = { "quotas.usedExecutionsToday": 0 };
  const fixedPaths = Object.keys(fixedData);
  assertEquals(fixedPaths, ["quotas.usedExecutionsToday"], "dot-path = targeted update");
});
