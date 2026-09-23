import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.ts';
import { getSupabase } from '../db/client.ts';

function hashArgs(args: Record<string, any>): string {
  // Canonicalize keys to ensure consistent hashing
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(args || {}).sort()) {
    if (key !== 'confirmed' && key !== 'confirmationToken') {
      sorted[key] = args[key];
    }
  }
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex').substring(0, 16);
}

/**
 * Generates a server-issued, cryptographically signed, single-use confirmation token
 * bound to a specific user, tool, and argument payload with a 5-minute TTL.
 */
export function generateConfirmationToken(userId: string, toolName: string, args: Record<string, any>): string {
  const secret = getJwtSecret();
  const jti = crypto.randomUUID();
  const argsDigest = hashArgs(args);

  return jwt.sign(
    {
      sub: userId,
      tool: toolName,
      hash: argsDigest,
      type: 'TOOL_CONFIRMATION'
    },
    secret,
    {
      jwtid: jti,
      expiresIn: '5m'
    }
  );
}

/**
 * Validates and atomically consumes a confirmation token.
 * Enforces:
 * 1. Signature validity against JWT_SECRET
 * 2. Expiration within 5 minutes
 * 3. Exact matching of userId, toolName, and args hash
 * 4. Single-use replay prevention via nonce consumption
 */
export async function verifyAndConsumeConfirmationToken(
  token: string | undefined | null,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<{ valid: boolean; error?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'A valid server-issued confirmation token is required to execute this sensitive operation.' };
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;

    if (decoded.type !== 'TOOL_CONFIRMATION') {
      return { valid: false, error: 'Invalid token type for tool confirmation.' };
    }

    if (decoded.tool !== toolName) {
      return { valid: false, error: `Confirmation token was issued for '${decoded.tool}', not '${toolName}'.` };
    }

    if (decoded.sub !== userId) {
      return { valid: false, error: 'Confirmation token was issued to a different user identity.' };
    }

    const expectedDigest = hashArgs(args);
    if (decoded.hash !== expectedDigest) {
      return { valid: false, error: 'Tool arguments have been modified since confirmation was drafted.' };
    }

    // Check single-use nonce via PostgreSQL (stateless horizontal scaling)
    const jti = decoded.jti;
    if (!jti) {
      return { valid: false, error: 'Confirmation token is missing a unique JTI nonce.' };
    }

    const supabase = getSupabase();
    const nonceKey = `nonce:${jti}`;
    const now = new Date();

    const { data: existing, error: selectErr } = await supabase
      .from('rate_limits')
      .select('key, reset_at')
      .eq('key', nonceKey)
      .maybeSingle();

    if (!selectErr && existing) {
      const isExpired = new Date(existing.reset_at) < now;
      if (!isExpired) {
        return { valid: false, error: 'Confirmation token has already been consumed. Please request a new confirmation.' };
      }
    }

    // Mark nonce consumed in database with expiration matching token expiry
    const expIso = new Date((decoded.exp || Math.floor(Date.now() / 1000) + 300) * 1000).toISOString();
    const { error: insertErr } = await supabase
      .from('rate_limits')
      .insert({
        key: nonceKey,
        count: 1,
        reset_at: expIso,
        created_at: now.toISOString()
      });

    if (insertErr) {
      // Primary key conflict indicates concurrent token replay
      if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key') || insertErr.message?.includes('rate_limits_pkey')) {
        return { valid: false, error: 'Confirmation token has already been consumed. Please request a new confirmation.' };
      }
      console.warn(`[ConfirmationToken] Nonce persistence warning: ${insertErr.message}`);
    }

    return { valid: true };
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, error: 'Confirmation token has expired (5 minute TTL). Please request a fresh confirmation.' };
    }
    return { valid: false, error: 'Confirmation token verification failed: ' + (err.message || 'invalid token') };
  }
}
