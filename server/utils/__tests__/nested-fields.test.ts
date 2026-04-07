/**
 * Tests for dot-path field building used by updateDocument.
 *
 * Imports the real buildNestedFields from firebase-admin.ts.
 */

import { assertEquals } from "@std/assert";
import { buildNestedFields } from "../../services/firebase-admin.ts";

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

Deno.test("two dot-paths sharing a root deep-merge instead of clobber", () => {
  const result = buildNestedFields({
    "quotas.maxEndpoints": 50,
    "quotas.usedExecutionsToday": 0,
  });
  // Both nested keys must survive — the old code would lose maxEndpoints
  assertEquals(result.quotas, {
    mapValue: {
      fields: {
        maxEndpoints: { integerValue: "50" },
        usedExecutionsToday: { integerValue: "0" },
      },
    },
  });
});

Deno.test("three dot-paths sharing two levels deep-merge correctly", () => {
  const result = buildNestedFields({
    "a.b.x": 1,
    "a.b.y": 2,
    "a.c": 3,
  });
  assertEquals(result.a, {
    mapValue: {
      fields: {
        b: {
          mapValue: {
            fields: {
              x: { integerValue: "1" },
              y: { integerValue: "2" },
            },
          },
        },
        c: { integerValue: "3" },
      },
    },
  });
});

Deno.test("updateMask field paths preserve dot notation", () => {
  const data = { "quotas.usedExecutionsToday": 0, seeded: true };
  const fieldPaths = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`);
  assertEquals(fieldPaths.includes("updateMask.fieldPaths=quotas.usedExecutionsToday"), true);
  assertEquals(fieldPaths.includes("updateMask.fieldPaths=seeded"), true);
});

Deno.test("original clobber scenario: plain 'quotas' key replaces entire map", () => {
  // Documents the OLD broken behavior to show why dot-path is needed.
  const data = { quotas: { usedExecutionsToday: 0 } };
  const fieldPaths = Object.keys(data);
  assertEquals(fieldPaths, ["quotas"], "plain key = full replace");

  const fixedData = { "quotas.usedExecutionsToday": 0 };
  const fixedPaths = Object.keys(fixedData);
  assertEquals(fixedPaths, ["quotas.usedExecutionsToday"], "dot-path = targeted update");
});
