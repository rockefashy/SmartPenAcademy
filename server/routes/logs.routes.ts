import { Router, Request, Response } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { Logger, redactSensitiveData } from '../logger.ts';
import { createRateLimiter } from '../middleware/rateLimiter.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

export const logsRouter = Router();

const apiLogger = Logger.get('API');

const clientLogSchema = z.object({
  source: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  stack: z.string().trim().max(5000).optional(),
  timestamp: z.string().trim().max(100).optional(),
  url: z.string().trim().max(1000).optional(),
  userAgent: z.string().trim().max(500).optional(),
});

// Rate limiter: maximum 60 client log events per minute per IP to mitigate log flooding
const clientLogRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Client log rate limit exceeded.'
});

// POST /api/logs/client
logsRouter.post('/client', clientLogRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parseResult = clientLogSchema.safeParse(req.body);
  if (!parseResult.success) {
    // Return 200/400 silently to avoid crashing or loop-triggering client error dispatchers
    return res.status(400).json({ success: false, error: 'Invalid log payload' });
  }

  const { source, message, stack, timestamp, url, userAgent } = parseResult.data;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const effectiveTime = timestamp || new Date().toISOString();

  // 1. Log to server stdout/stderr via domain logger (captured by Render and local terminal)
  apiLogger.error(`[CLIENT] [${source}] ${message}`, {
    url,
    ip: clientIp,
    userAgent,
    stack: stack ? redactSensitiveData(stack) : undefined
  });

  // 2. In local environments, persist to local logs/client-errors.log file
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFilePath = path.join(logsDir, 'client-errors.log');
    const sanitizedMsg = redactSensitiveData(message);
    const sanitizedStack = stack ? redactSensitiveData(stack) : '';
    const logEntry = `[${effectiveTime}] [${clientIp}] [${source}] ${sanitizedMsg}\nURL: ${url || 'N/A'}\nUser-Agent: ${userAgent || 'N/A'}${sanitizedStack ? '\nStack:\n' + sanitizedStack : ''}\n---\n`;
    fs.appendFileSync(logFilePath, logEntry, 'utf8');
  } catch (fsErr) {
    // Non-fatal if filesystem write fails (e.g. read-only container)
    apiLogger.warn('Failed to append client log to local file', { error: String(fsErr) });
  }

  return res.status(200).json({ success: true });
}));
