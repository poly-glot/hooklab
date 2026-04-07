/**
 * Ownership verification helpers — pure functions.
 */

/**
 * Checks whether an execution record belongs to a given endpoint and user.
 * Used to prevent IDOR on single-execution delete.
 */
export function isExecutionOwned(
  // deno-lint-ignore no-explicit-any
  execution: Record<string, any> | null,
  endpointId: string,
  userId: string,
): boolean {
  if (!execution) return false;
  return execution.endpointId === endpointId && execution.userId === userId;
}
