/**
 * Tests for Firestore REST API value marshalling.
 *
 * Verifies round-trip conversion between JS values and Firestore typed format.
 * Table-driven: each case is [label, jsValue, firestoreValue].
 */

import { assertEquals } from "@std/assert";
import {
  extractValue,
  fieldsToObject,
  FsTimestamp,
  fsNow,
  objectToFields,
  toFirestoreValue,
} from "../firestore-values.ts";

// ── toFirestoreValue ────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
const toFirestoreCases: [string, any, any][] = [
  // Primitives
  ["string", "hello", { stringValue: "hello" }],
  ["empty string", "", { stringValue: "" }],
  ["integer", 42, { integerValue: "42" }],
  ["zero", 0, { integerValue: "0" }],
  ["negative integer", -5, { integerValue: "-5" }],
  ["float", 3.14, { doubleValue: 3.14 }],
  ["negative float", -2.5, { doubleValue: -2.5 }],
  ["boolean true", true, { booleanValue: true }],
  ["boolean false", false, { booleanValue: false }],
  ["null", null, { nullValue: null }],
  ["undefined", undefined, { nullValue: null }],

  // FsTimestamp
  [
    "FsTimestamp",
    new FsTimestamp("2024-01-01T00:00:00.000Z"),
    { timestampValue: "2024-01-01T00:00:00.000Z" },
  ],

  // Arrays
  [
    "empty array",
    [],
    { arrayValue: { values: [] } },
  ],
  [
    "string array",
    ["a", "b"],
    {
      arrayValue: {
        values: [{ stringValue: "a" }, { stringValue: "b" }],
      },
    },
  ],
  [
    "mixed array",
    ["text", 1, true],
    {
      arrayValue: {
        values: [
          { stringValue: "text" },
          { integerValue: "1" },
          { booleanValue: true },
        ],
      },
    },
  ],

  // Objects (maps)
  [
    "simple object",
    { name: "test", count: 5 },
    {
      mapValue: {
        fields: {
          name: { stringValue: "test" },
          count: { integerValue: "5" },
        },
      },
    },
  ],
  [
    "nested object",
    { outer: { inner: "deep" } },
    {
      mapValue: {
        fields: {
          outer: {
            mapValue: {
              fields: {
                inner: { stringValue: "deep" },
              },
            },
          },
        },
      },
    },
  ],
];

for (const [label, input, expected] of toFirestoreCases) {
  Deno.test(`toFirestoreValue: ${label}`, () => {
    assertEquals(toFirestoreValue(input), expected);
  });
}

// ── extractValue ────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
const extractCases: [string, any, any][] = [
  // Primitives
  ["stringValue", { stringValue: "hello" }, "hello"],
  ["integerValue", { integerValue: "42" }, 42],
  ["integerValue zero", { integerValue: "0" }, 0],
  ["doubleValue", { doubleValue: 3.14 }, 3.14],
  ["booleanValue true", { booleanValue: true }, true],
  ["booleanValue false", { booleanValue: false }, false],
  ["timestampValue", { timestampValue: "2024-01-01T00:00:00Z" }, "2024-01-01T00:00:00Z"],
  ["nullValue", { nullValue: null }, null],

  // Falsy / missing
  ["undefined field", undefined, undefined],
  ["null field", null, undefined],
  ["empty object", {}, undefined],

  // Map
  [
    "mapValue",
    {
      mapValue: {
        fields: {
          key: { stringValue: "val" },
        },
      },
    },
    { key: "val" },
  ],
  [
    "mapValue with empty fields",
    { mapValue: {} },
    {},
  ],

  // Array
  [
    "arrayValue",
    {
      arrayValue: {
        values: [{ stringValue: "a" }, { integerValue: "1" }],
      },
    },
    ["a", 1],
  ],
  [
    "arrayValue empty",
    { arrayValue: {} },
    [],
  ],
];

for (const [label, input, expected] of extractCases) {
  Deno.test(`extractValue: ${label}`, () => {
    assertEquals(extractValue(input), expected);
  });
}

// ── Round-trip: objectToFields → fieldsToObject ─────────────────────

// deno-lint-ignore no-explicit-any
const roundTripCases: [string, Record<string, any>][] = [
  [
    "simple flat object",
    { name: "test", count: 42, active: true },
  ],
  [
    "object with null",
    { value: null },
  ],
  [
    "object with nested map",
    { meta: { version: 1, label: "beta" } },
  ],
  [
    "object with array",
    { tags: ["a", "b", "c"] },
  ],
  [
    "empty object",
    {},
  ],
  [
    "mixed types",
    { s: "str", n: 10, f: 1.5, b: false, nil: null },
  ],
];

for (const [label, original] of roundTripCases) {
  Deno.test(`round-trip: ${label}`, () => {
    const fields = objectToFields(original);
    const restored = fieldsToObject(fields);
    assertEquals(restored, original);
  });
}

// ── fsNow ───────────────────────────────────────────────────────────

Deno.test("fsNow returns FsTimestamp with valid ISO string", () => {
  const ts = fsNow();
  assertEquals(ts instanceof FsTimestamp, true);
  // Should parse as valid date
  const parsed = Date.parse(ts.iso);
  assertEquals(isNaN(parsed), false);
  // Should be close to now (within 1 second)
  const drift = Math.abs(Date.now() - parsed);
  assertEquals(drift < 1000, true);
});

Deno.test("FsTimestamp serializes as timestampValue", () => {
  const ts = new FsTimestamp("2024-06-15T12:00:00.000Z");
  assertEquals(toFirestoreValue(ts), {
    timestampValue: "2024-06-15T12:00:00.000Z",
  });
});
