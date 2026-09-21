/**
 * server/config/env.ts
 *
 * Centralised runtime environment configuration helpers.
 * All server-side code that needs environment variables should import from here,
 * NOT from middleware or any other layer.
 *
 * Rules:
 * - This module has zero dependencies on middleware, routes, services, or DB layers.
 * - Each helper validates at call-time and throws with a clear, actionable error when
 *   a required variable is missing.
 */

/**
 * Returns the JWT signing secret.
 * Throws at call-time with a clear error if JWT_SECRET is not set,
 * so misconfigured deployments fail fast rather than silently signing with an empty secret.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set. Set it in your .env file or deployment environment.');
  }
  return secret;
};
