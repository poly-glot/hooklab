/**
 * Tagged error classes for service-layer failures.
 *
 * The reports route dispatches HTTP status codes by `instanceof` rather
 * than string-sniffing the message, so error wording can change without
 * changing the response code.
 */

export class LLMError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LLMError";
  }
}

export class BigQueryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BigQueryError";
  }
}
