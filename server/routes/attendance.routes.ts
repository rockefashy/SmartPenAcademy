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
import { attendanceRateLimiter } from '../middleware/rateLimiter.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { sendPaginated } from '../pagination.ts';
import { recordAudit } from '../helpers/audit.ts';
import { getCoachAssignedStudents, getCoachAssignedStudentIds } from '../helpers/coachHelper.ts';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError
} from '../errors.ts';
import { attendanceBatchSchema } from '../schemas.ts';

export const attendanceRouter = Router();

const attendanceMonthParamsSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'yearMonth parameter must be in YYYY-MM format (e.g. 2026-09)')
});

const attendancePaginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional()
});

const attendanceStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const deleteAttendanceParamSchema = z.object({
  id: z.string().min(1, 'Attendance ID parameter is required')
});

const deleteAttendanceByDateParamsSchema = z.object({
  studentId: z.string().min(1, 'Student ID parameter is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date parameter must be in YYYY-MM-DD format')
});

// GET /api/attendance/month/:yearMonth
attendanceRouter.get('/month/:yearMonth', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = attendanceMonthParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid yearMonth parameter.');
  }
  const queryParsed = attendancePaginationQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { yearMonth } = paramsParsed.data;
  const { page, limit } = queryParsed.data;

  let targetStudentIds: string[] | undefined = undefined;

  // Database-level isolation for coach role:
  if (req.user?.role === ROLES.COACH) {
    targetStudentIds = await getCoachAssignedStudentIds(req.user);

    // If coach has no assigned students, short-circuit immediately without querying attendance
    if (targetStudentIds.length === 0) {
      if (page && limit) {
        return res.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 1 }
        });
      }
      return res.json([]);
    }
  }

  const queryOptions = {
    ...(page && limit ? { page, limit } : {}),
    ...(targetStudentIds ? { studentIds: targetStudentIds } : {})
  };

  const records = await db.getAttendanceByMonth(yearMonth, queryOptions);

  if (page && limit) {
    const total = await db.getAttendanceCountByMonth(yearMonth, targetStudentIds);
    return sendPaginated(res, records, total, { page, limit });
  }

  return res.json(records);
}));

// GET /api/attendance/student/:id
attendanceRouter.get('/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = attendanceStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const queryParsed = attendancePaginationQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { id } = paramsParsed.data;
  const { page, limit } = queryParsed.data;
  const paginationOptions = (page && limit) ? { page, limit } : undefined;

  const records = await db.getAttendanceByStudent(id, paginationOptions);

  if (page && limit) {
    const total = await db.getAttendanceCountByStudent(id);
    return sendPaginated(res, records, total, { page, limit });
  }

  return res.json(records);
}));

// POST /api/attendance/batch
attendanceRouter.post('/batch', authenticateJwt, requireCoachOrAdmin, attendanceRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = attendanceBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid attendance batch records.');
  }
  const { records } = parsed.data;

  // If coach, verify that coach only marks attendance for assigned students
  if (req.user?.role === ROLES.COACH) {
    const coachStudents = await getCoachAssignedStudents(req.user);
    const coachStudentIds = new Set(coachStudents.map(s => s.id));
    const unauthorized = records.filter(r => !coachStudentIds.has(r.studentId));
    if (unauthorized.length > 0) {
      throw new AuthorizationError('Coaches can only update attendance for their assigned students.');
    }

    const inactiveIds = new Set(coachStudents.filter(s => s.status === 'Inactive').map(s => s.id));
    const containsInactive = records.some(r => inactiveIds.has(r.studentId));
    if (containsInactive) {
      throw new ValidationError('Cannot mark attendance for inactive students (read-only archive).');
    }
  }

  // Normalize notes -> coachNotes if coachNotes not specified; preserve markedBy as-is (null in DB if unset)
  const normalizedRecords = records.map(r => ({
    ...r,
    coachNotes: r.coachNotes || r.notes || undefined,
    markedBy: r.markedBy || undefined
  }));

  const savedRecords = await db.saveAttendanceBatch(normalizedRecords as any);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'attendance_batch_save',
    summary: `${req.user?.firstName || req.user?.username} (${req.user?.role}) saved/updated ${records.length} attendance records`,
    arguments: { recordCount: records.length, sampleRecord: records[0] },
    result: { count: records.length, success: true }
  });

  return res.json({ success: true, count: records.length, records: savedRecords });
}));

// DELETE /api/attendance/:id
attendanceRouter.delete('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = deleteAttendanceParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid attendance record ID.');
  }
  const { id } = parsed.data;
  const attendance = await db.findAttendanceById(id);
  if (!attendance) {
    throw new NotFoundError('Attendance record not found.');
  }
  if (!await canAccessStudent(req.user, attendance.studentId)) {
    throw new AuthorizationError('Access denied: You can only delete attendance records for students assigned to you.');
  }

  await db.deleteAttendance(id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: attendance.studentId,
    action: 'attendance_delete',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} deleted attendance record #${id}`,
    arguments: { attendanceId: id, studentId: attendance.studentId },
    result: { success: true }
  });

  return res.json({ success: true });
}));

// DELETE /api/attendance/:studentId/:date
attendanceRouter.delete('/:studentId/:date', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = deleteAttendanceByDateParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid studentId or date parameter.');
  }
  const { studentId, date } = parsed.data;

  await db.deleteAttendanceByDate(studentId, date);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'attendance_delete',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} deleted attendance record for student ${studentId} on date ${date}`,
    arguments: { studentId, date },
    result: { success: true }
  });

  return res.json({ success: true });
}));
