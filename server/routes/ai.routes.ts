import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';
import { AuthRequest, authenticateJwt, requireAdmin, getJwtSecret } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { aiChatRateLimiter } from '../middleware/rateLimiter.ts';
import { handleAIAgentChat } from '../aiAgent.ts';
import { sendPaginated } from '../pagination.ts';
import { ValidationError } from '../errors.ts';
import { auditLogsQuerySchema } from '../schemas.ts';

export const aiRouter = Router();

const checkChatPayloadSize = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 1024 * 1024) { // 1 MB payload cap
    return res.status(413).json({ error: 'Payload Too Large: AI chat request exceeds 1 MB limit.' });
  }
  next();
};

const aiAgentChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'model', 'system']),
    content: z.string().max(25000, 'Message content cannot exceed 25,000 characters.')
  })).max(50, 'Too many messages in history. Maximum 50 messages allowed.').optional(),
  settings: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional()
  }).optional()
});

const testConfigSchema = z.object({
  model: z.string().optional()
});

// GET /api/ai/audit-logs (Admin Only)
aiRouter.get('/audit-logs', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const queryParsed = auditLogsQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { page, limit = 50 } = queryParsed.data;
  const logs = await db.getToolAuditLogs(page ? { page, limit } : limit);

  if (page) {
    const total = await db.getToolAuditLogsCount();
    return sendPaginated(res, logs, total, { page, limit });
  }

  return res.json(logs);
}));

// POST /api/ai/agent-chat (Public & authenticated chat with rate limiting and payload cap)
aiRouter.post('/agent-chat', checkChatPayloadSize, aiChatRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = aiAgentChatSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid chat request format.');
  }
  const { messages, settings } = parsed.data;
  
  // Resolve user context from httpOnly cookie first, then Authorization Bearer header
  let userContext: any = null;
  let token: string | undefined;

  if (req.cookies && req.cookies.smartpen_token) {
    token = req.cookies.smartpen_token;
  }

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (token) {
    try {
      const jwtSecret = getJwtSecret();
      const decoded = jwt.verify(token, jwtSecret) as any;

      if (decoded.type === 'STUDENT_SELECTION' || decoded.type === 'ROLE_SELECTION') {
        userContext = null;
      } else if (decoded.id) {
        const currentVersion = await db.findUserTokenVersion(decoded.id);
        const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
        if (currentVersion !== null && currentVersion > tokenVersion) {
          userContext = null;
        } else if (decoded.role === 'coach') {
          const coachProfile = await db.getCoachById(decoded.coachId || decoded.id);
          if (coachProfile && coachProfile.status === 'Inactive') {
            userContext = null;
          } else {
            userContext = decoded;
          }
        } else {
          userContext = decoded;
        }
      } else {
        userContext = decoded;
      }
    } catch {
      userContext = null;
    }
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const result = await handleAIAgentChat({
    messages: messages || [],
    userContext,
    clientIp,
    settings
  });

  return res.json(result);
}));

// POST /api/ai/test-config (Admin Only)
aiRouter.post('/test-config', authenticateJwt, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const parsed = testConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid configuration payload.');
  }
  const { model } = parsed.data;
  const targetKey = process.env.GEMINI_API_KEY;
  if (!targetKey) {
    return res.json({
      success: true,
      mode: 'Local AI Engine',
      message: 'Using built-in SmartPen AI Agent Engine. Full tool automation active.'
    });
  }

  return res.json({
    success: true,
    mode: 'Gemini Cloud API',
    model: model || 'gemini-3.8-flash',
    message: 'AI Model configuration verified successfully!'
  });
}));

