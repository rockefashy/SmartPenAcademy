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

export const reportsRouter = Router();

const reportStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const reportIdParamSchema = z.object({
  id: z.string().min(1, 'Report ID parameter is required')
});

const reportGenerateSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  reportDate: z.string().min(1, 'reportDate is required'),
  overallRating: z.string().optional(),
  strengths: z.string().optional(),
  areasOfImprovement: z.string().optional(),
  remarks: z.string().optional(),
  savedToFolder: z.string().optional()
}).passthrough();

const reportEmailSchema = z.object({
  studentEmail: z.string().email().optional(),
  parentEmail: z.string().email().optional()
});

// GET /api/reports/student/:id
reportsRouter.get('/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = reportStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const reports = await db.getProgressReports(paramsParsed.data.id);
  return res.json(reports);
}));

// POST /api/reports/generate
reportsRouter.post('/generate', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = reportGenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid progress report data.');
  }
  const report = parsed.data;

  const saved = await db.saveProgressReport({
    ...report,
    savedToFolder: '/progress_reports/'
  } as any);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: report.studentId,
    action: 'progress_report_generate',
    summary: `${req.user?.firstName || req.user?.username} generated Progress Milestone Report for student ${report.studentId}`,
    arguments: { studentId: report.studentId, reportDate: report.reportDate, remarks: report.remarks },
    result: { reportId: saved.id, studentId: report.studentId }
  });

  return res.json(saved);
}));

// DELETE /api/reports/:id
reportsRouter.delete('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = reportIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid report ID parameter.');
  }
  const { id } = paramsParsed.data;
  const report = await db.findProgressReportById(id);
  if (!report) {
    throw new NotFoundError('Progress report not found.');
  }

  if (!await canAccessStudent(req.user, report.studentId)) {
    throw new AuthorizationError('Access denied: Only the assigned coach or administrator can delete this progress report.');
  }

  await db.deleteProgressReport(id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: report.studentId,
    action: 'progress_report_delete',
    summary: `${req.user?.firstName || req.user?.username} removed progress report #${id} for student ${report.studentId}`,
    arguments: { reportId: id, studentId: report.studentId },
    result: { success: true }
  });

  return res.json({ success: true, message: 'Progress report deleted successfully.' });
}));

// POST /api/reports/:id/email
reportsRouter.post('/:id/email', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = reportIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid report ID parameter.');
  }
  const bodyParsed = reportEmailSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new ValidationError(bodyParsed.error.issues[0]?.message || 'Invalid email dispatch parameters.');
  }
  const { id } = paramsParsed.data;
  const report = await db.findProgressReportById(id);
  if (!report) {
    throw new NotFoundError('Progress report not found.');
  }
  if (!await canAccessStudent(req.user, report.studentId)) {
    throw new AuthorizationError('Access denied: Only the assigned coach or administrator can email this progress report.');
  }

  const { studentEmail, parentEmail } = bodyParsed.data;
  const adminEmail = await db.getAdminEmail();
  const recipientTarget = parentEmail || studentEmail || 'student/parent';

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: report.studentId,
    action: 'progress_report_email',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} emailed Progress Report #${id} to parent (${recipientTarget})`,
    arguments: { reportId: id, studentId: report.studentId, parentEmail, studentEmail },
    result: { success: true }
  });

  return res.json({ success: true, message: `Report email dispatched to ${recipientTarget}` });
}));
