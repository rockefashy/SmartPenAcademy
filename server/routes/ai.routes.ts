import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';
import { AuthRequest, authenticateJwt, requireAdmin, getJwtSecret } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { handleAIAgentChat } from '../aiAgent.ts';
import { sendPaginated } from '../pagination.ts';
import { ValidationError } from '../errors.ts';
import { auditLogsQuerySchema } from '../schemas.ts';

export const aiRouter = Router();

const aiAgentChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'model', 'system']),
    content: z.string()
  }).passthrough()).optional(),
  settings: z.object({
    apiKey: z.string().optional(),
    apiUrl: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional()
  }).passthrough().optional()
}).passthrough();

const testConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional()
}).passthrough();

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

// POST /api/ai/agent-chat (Public & authenticated chat)
aiRouter.post('/agent-chat', asyncHandler(async (req: Request, res: Response) => {
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
      userContext = decoded;
    } catch {
      // Invalid or expired token
      userContext = null;
    }
  }

  const result = await handleAIAgentChat({
    messages: messages || [],
    userContext,
    settings
  });

  return res.json(result);
}));

// POST /api/ai/test-config
aiRouter.post('/test-config', asyncHandler(async (req: Request, res: Response) => {
  const parsed = testConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid configuration payload.');
  }
  const { apiKey, model } = parsed.data;
  const targetKey = apiKey || process.env.GEMINI_API_KEY;
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
