/**
 * Firestore REST API value marshalling.
 *
 * Converts between JavaScript values and Firestore's typed value format.
 * Pure functions — no network calls or state.
 */

/**
 * Wrapper to explicitly mark a value as a Firestore timestamp.
 *
 * Use this instead of plain ISO strings for fields that need to be
 * queryable with orderBy() from the client SDK (which uses timestampValue).
 */
export class FsTimestamp {
  constructor(public iso: string) {}
}

/**
 * Creates a FsTimestamp for the current time.
 */
export function fsNow(): FsTimestamp {
  return new FsTimestamp(new Date().toISOString());
}

// deno-lint-ignore no-explicit-any
export function extractValue(field: any): any {
  if (!field) return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("timestampValue" in field) return field.timestampValue;
  if ("nullValue" in field) return null;
  if ("mapValue" in field) {
    // deno-lint-ignore no-explicit-any
    const obj: Record<string, any> = {};
    const fields = field.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = extractValue(v);
    }
    return obj;
  }
  if ("arrayValue" in field) {
    return (field.arrayValue.values || []).map(extractValue);
  }
  return undefined;
}

// deno-lint-ignore no-explicit-any
export function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof FsTimestamp) return { timestampValue: value.iso };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    // deno-lint-ignore no-explicit-any
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// deno-lint-ignore no-explicit-any
export function fieldsToObject(fields: Record<string, any>): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const obj: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = extractValue(v);
  }
  return obj;
}

// deno-lint-ignore no-explicit-any
export function objectToFields(data: Record<string, any>): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}
