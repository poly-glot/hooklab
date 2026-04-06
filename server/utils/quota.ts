/**
 * Endpoint quota checking — pure function, no dependencies on config.ts.
 */

/**
 * Checks whether a user is allowed to create another endpoint.
 *
 * @param endpointCount - Current endpoint count from the user doc
 * @param maxEndpoints - Maximum allowed from the user doc's quotas
 * @param isAnonymous - Whether this is a guest user
 * @returns Whether creation is allowed, the resolved max, and current count
 */
export function checkEndpointQuota(
  endpointCount: number | undefined,
  maxEndpoints: number | undefined,
  isAnonymous: boolean,
): { allowed: boolean; maxEndpoints: number; current: number } {
  const current = endpointCount ?? 0;
  const max = maxEndpoints ?? (isAnonymous ? 10 : 50);
  return { allowed: current < max, maxEndpoints: max, current };
}
