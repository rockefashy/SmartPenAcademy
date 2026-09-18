import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../supabaseDb.ts';
import { ROLES } from '../../src/types.ts';
import {
  AuthRequest,
  authenticateJwt,
  requireCoachOrAdmin,
  verifyStudentAccess,
  canAccessStudent
} from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { ValidationError, AuthorizationError, NotFoundError } from '../errors.ts';
import { progressTrackerSchema } from '../schemas.ts';

export const progressTrackersRouter = Router();

const trackerStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const trackerIdParamSchema = z.object({
  id: z.string().min(1, 'Progress tracker ID parameter is required')
});

// GET /api/progress-trackers/student/:id
progressTrackersRouter.get('/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = trackerStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const trackers = await db.getProgressTrackersByStudent(paramsParsed.data.id);
  return res.json(trackers);
}));

// POST /api/progress-trackers
progressTrackersRouter.post('/', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = progressTrackerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid progress tracker data.');
  }
  const tracker = parsed.data;
  const saved = await db.saveProgressTracker(tracker as any);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: tracker.studentId,
    action: 'progress_tracker_save',
    summary: `${req.user?.firstName || req.user?.username} recorded progress metric evaluation for student ${tracker.studentId} (${tracker.evaluationDate})`,
    arguments: { studentId: tracker.studentId, evaluationDate: tracker.evaluationDate, overallScore: tracker.overallScore },
    result: { trackerId: saved.id, studentId: tracker.studentId }
  });

  return res.json(saved);
}));

// DELETE /api/progress-trackers/:id
progressTrackersRouter.delete('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = trackerIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid progress tracker ID.');
  }
  const { id } = paramsParsed.data;
  const tracker = await db.findProgressTrackerById(id);
  if (!tracker) {
    throw new NotFoundError('Progress tracker record not found.');
  }
  if (!await canAccessStudent(req.user, tracker.studentId)) {
    throw new AuthorizationError('Access denied: You can only delete progress trackers for students assigned to you.');
  }

  await db.deleteProgressTracker(id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: tracker.studentId,
    action: 'progress_tracker_delete',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} removed progress evaluation tracker record #${id}`,
    arguments: { trackerId: id, studentId: tracker.studentId },
    result: { success: true }
  });

  return res.json({ success: true });
}));
