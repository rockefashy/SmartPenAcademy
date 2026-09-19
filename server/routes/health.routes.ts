import { Router, Request, Response } from 'express';
import { db } from '../supabaseDb.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

export const healthRouter = Router();

// 1. Liveness Probe (GET /api/health)
healthRouter.get('/health', asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }
  });
}));

// 2. Readiness Probe (GET /api/ready)
healthRouter.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const adminUser = await db.getAdminUser();
  if (!adminUser) {
    res.status(503).json({
      status: 'unready',
      error: 'Database connectivity check failed',
      timestamp: new Date().toISOString()
    });
    return;
  }
  const latencyMs = Date.now() - startTime;
  
  res.status(200).json({
    status: 'ready',
    checks: {
      database: { status: 'connected', latencyMs }
    },
    timestamp: new Date().toISOString()
  });
}));

