/**
 * Validation utilities for request data.
 *
 * Centralizes all input validation logic for endpoint CRUD operations.
 * Sanitization functions (headers, status codes) live in sanitizers.ts.
 */

import {
  MAX_BODY_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SCRIPT_LENGTH,
} from "../config.ts";
import type {
  CreateEndpointRequest,
  UpdateEndpointRequest,
  ValidationError,
  ValidationResult,
} from "../types.ts";

// Re-export sanitizers for existing consumers
export {
  isHeaderBlocked,
  isHeaderNameSafe,
  sanitizeHeaders,
  sanitizeStatusCode,
} from "./sanitizers.ts";

/**
 * Validates endpoint creation request data.
 *
 * @param body - Request body to validate
 * @returns Validation result with errors if any
 */
export function validateCreateEndpoint(
  body: unknown,
): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return {
      valid: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const data = body as CreateEndpointRequest;
  const errors: ValidationError[] = [];

  // Validate name
  if (!data.name || typeof data.name !== "string") {
    errors.push({ field: "name", message: "Endpoint name is required" });
  } else if (data.name.trim().length === 0) {
    errors.push({ field: "name", message: "Endpoint name cannot be empty" });
  } else if (data.name.trim().length > MAX_NAME_LENGTH) {
    errors.push({
      field: "name",
      message: `Endpoint name must be at most ${MAX_NAME_LENGTH} characters`,
    });
  }

  // Validate script (optional)
  if (data.script !== undefined) {
    if (typeof data.script !== "string") {
      errors.push({ field: "script", message: "Script must be a string" });
    } else {
      const scriptBytes = new TextEncoder().encode(data.script).length;
      if (scriptBytes > MAX_SCRIPT_LENGTH) {
        errors.push({
          field: "script",
          message: `Script must be at most ${MAX_SCRIPT_LENGTH} bytes`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Validates endpoint update request data.
 *
 * @param body - Request body to validate
 * @returns Validation result with errors if any
 */
export function validateUpdateEndpoint(
  body: unknown,
): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return {
      valid: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const data = body as UpdateEndpointRequest;
  const errors: ValidationError[] = [];

  validateOptionalString(errors, "name", data.name, MAX_NAME_LENGTH, "Name");
  validateOptionalScript(errors, data.script);
  validateOptionalStatusCode(errors, data.defaultStatusCode);
  validateOptionalString(errors, "defaultContentType", data.defaultContentType, undefined, "Content type");
  validateOptionalString(errors, "defaultBody", data.defaultBody, MAX_BODY_LENGTH, "Default body");

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

// ── Internal helpers ──────────────────────────────────────────────────

function validateOptionalString(
  errors: ValidationError[],
  field: string,
  value: unknown,
  maxLength: number | undefined,
  label: string,
): void {
  if (value === undefined) return;
  if (typeof value !== "string") {
    errors.push({ field, message: `${label} must be a string` });
    return;
  }
  if (field === "name" || field === "defaultBody") {
    const len = field === "name" ? value.trim().length : value.length;
    if (field === "name" && len === 0) {
      errors.push({ field, message: `${label} cannot be empty` });
    } else if (maxLength && len > maxLength) {
      errors.push({ field, message: `${label} must be at most ${maxLength} characters` });
    }
  }
}

function validateOptionalScript(
  errors: ValidationError[],
  script: unknown,
): void {
  if (script === undefined) return;
  if (typeof script !== "string") {
    errors.push({ field: "script", message: "Script must be a string" });
    return;
  }
  const scriptBytes = new TextEncoder().encode(script).length;
  if (scriptBytes > MAX_SCRIPT_LENGTH) {
    errors.push({
      field: "script",
      message: `Script must be at most ${MAX_SCRIPT_LENGTH} bytes`,
    });
  }
}

function validateOptionalStatusCode(
  errors: ValidationError[],
  statusCode: unknown,
): void {
  if (statusCode === undefined) return;
  if (typeof statusCode !== "number") {
    errors.push({ field: "defaultStatusCode", message: "Status code must be a number" });
    return;
  }
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    errors.push({
      field: "defaultStatusCode",
      message: "Status code must be between 100 and 599",
    });
  }
}
