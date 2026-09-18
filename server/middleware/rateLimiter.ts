import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';

const getJwtSecret = (): string => process.env.JWT_SECRET || '';

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
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
      const routePath = req.baseUrl || req.path || 'global';
      const key = `api:${routePath}:${identifier}`;
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

// Auth endpoint rate limiter: 10 attempts per 15 minutes per IP/user
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});
