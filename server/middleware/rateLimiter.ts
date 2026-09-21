import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';
import { getJwtSecret } from '../config/env.ts';

export function createRateLimiter(options: { windowMs: number; max: number; message?: string; failClosed?: boolean }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for user identity from JWT (via req.user or cookie/header decode)
      let userKey: string | null = null;
      if ((req as any).user?.id) {
        userKey = `user:${(req as any).user.id}`;
      } else {
        const token = req.cookies?.smartpen_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
        if (token) {
          try {
            const decoded = jwt.verify(token, getJwtSecret()) as any;
            if (decoded?.id) {
              userKey = `user:${decoded.id}`;
            }
          } catch {
            // Fall back to IP
          }
        }
      }

      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const identifier = userKey || `ip:${ip}`;
      const exactPath = req.originalUrl ? req.originalUrl.split('?')[0] : (req.path || 'global');

      // If an account identifier is present in the request body (e.g. login, forgot-password), scope by account
      const bodyIdentifier = typeof req.body?.identifier === 'string' && req.body.identifier.trim()
        ? req.body.identifier.trim().toLowerCase()
        : (typeof req.body?.email === 'string' && req.body.email.trim() ? req.body.email.trim().toLowerCase() : null);

      const accountSuffix = bodyIdentifier ? `:acc:${bodyIdentifier}` : '';
      const key = `api:${exactPath}:${identifier}${accountSuffix}`;
      const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));

      const rateCheck = await db.checkRateLimit(key, options.max, windowSeconds);

      if (!rateCheck.allowed) {
        res.set('Retry-After', String(rateCheck.retryAfter));
        res.status(429).json({
          error: options.message || 'Too many requests. Please slow down and try again shortly.',
          retryAfter: rateCheck.retryAfter
        });
        return;
      }

      next();
    } catch (err) {
      if (options.failClosed) {
        console.error('[RateLimiter] Error evaluating rate limit on sensitive route (failing closed):', err);
        res.status(503).json({
          error: 'Rate limit service is temporarily unavailable. Please retry in a few moments.',
          code: 'RATE_LIMIT_SERVICE_UNAVAILABLE'
        });
        return;
      }
      console.warn('[RateLimiter] Error evaluating rate limit, proceeding:', err);
      next();
    }
  };
}

// Mutating endpoints rate limiters (independent of chat UI)
export const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: 'Payment mutation rate limit reached. Please wait before recording more payments.'
});

export const attendanceRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Attendance update rate limit exceeded. Please wait a moment before retrying.'
});

export const demoBookingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Demo booking rate limit reached. Please try again in a few moments.'
});

// Auth endpoint rate limiter: 10 attempts per 15 minutes per IP/user (fails closed on error)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  failClosed: true
});

// AI Agent Chat endpoint rate limiter: 30 attempts per minute per IP/user
export const aiChatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many AI requests. Please slow down and try again shortly.'
});

