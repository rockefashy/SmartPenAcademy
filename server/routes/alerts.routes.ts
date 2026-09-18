import { Router, Request, Response } from 'express';
import { db } from '../supabaseDb.ts';
import { AuthRequest, authenticateJwt, requireAdmin } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { NotFoundError } from '../errors.ts';

export const alertsRouter = Router();

// GET /api/alerts
alertsRouter.get('/', authenticateJwt, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const alerts = await db.getAlerts();
  return res.json(alerts);
}));

// PATCH /api/alerts/:id/read
alertsRouter.patch('/:id/read', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const alert = await db.markAlertAsRead(req.params.id);
  if (!alert) {
    throw new NotFoundError('Alert not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'alert_mark_read',
    summary: `Administrator marked alert #${req.params.id} as read`,
    arguments: { alertId: req.params.id }
  });

  return res.json(alert);
}));

// POST /api/alerts/mark-all-read
alertsRouter.post('/mark-all-read', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  await db.markAllAlertsAsRead();

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'alert_mark_all_read',
    summary: 'Administrator cleared/marked all pending alerts as read',
    arguments: {}
  });

  return res.json({ success: true });
}));

// DELETE /api/alerts/:id
alertsRouter.delete('/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  await db.deleteAlert(req.params.id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'alert_delete',
    summary: `Administrator dismissed/deleted alert #${req.params.id}`,
    arguments: { alertId: req.params.id }
  });

  return res.json({ success: true });
}));
