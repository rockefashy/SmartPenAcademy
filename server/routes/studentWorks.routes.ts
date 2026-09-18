import { Router, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { db } from '../supabaseDb.ts';
import {
  AuthRequest,
  authenticateJwt,
  requireCoachOrAdmin,
  verifyStudentAccess,
  canAccessStudent
} from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { saveBase64Image } from '../helpers/fileHelper.ts';
import { ValidationError, AuthorizationError, NotFoundError } from '../errors.ts';
import { studentWorkUploadSchema, bulkDeleteWorksSchema } from '../schemas.ts';

export const studentWorksRouter = Router();

const studentWorksDir = path.join(process.cwd(), 'public', 'student_works');
if (!fs.existsSync(studentWorksDir)) {
  fs.mkdirSync(studentWorksDir, { recursive: true });
}

const studentWorkStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const studentWorkIdParamSchema = z.object({
  id: z.string().min(1, 'Student work ID parameter is required')
});

// GET /api/student-works/student/:id
studentWorksRouter.get('/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = studentWorkStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const works = await db.getStudentWorks(paramsParsed.data.id);
  return res.json(works);
}));

// POST /api/student-works/upload
studentWorksRouter.post('/upload', authenticateJwt, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = studentWorkUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid student work upload data.');
  }
  const { studentId, imageData, captureDate, comments, category } = parsed.data;

  const finalImagePath = saveBase64Image(imageData, studentWorksDir, `work_${studentId}`) || imageData;

  const effectiveDate = captureDate || new Date().toISOString().split('T')[0];
  const effectiveCategory = category || 'Practice Sheet';
  const effectiveTitle = (comments && comments.trim().length > 0) ? comments.trim() : `${effectiveCategory} - ${effectiveDate}`;

  const saved = await db.saveStudentWork({
    studentId,
    imageData: finalImagePath,
    captureDate: effectiveDate,
    comments: effectiveTitle,
    category: effectiveCategory
  });

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'student_work_upload',
    summary: `${req.user?.firstName || req.user?.username} uploaded handwriting sample (${category || 'Practice Sheet'}) for student ${studentId}`,
    arguments: { studentId, category: category || 'Practice Sheet', captureDate: captureDate || 'today', comments },
    result: { workId: saved.id, imagePath: finalImagePath }
  });

  return res.json(saved);
}));

// DELETE /api/student-works/:id
studentWorksRouter.delete('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = studentWorkIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student work ID parameter.');
  }
  const { id } = paramsParsed.data;
  const work = await db.findStudentWorkById(id);
  if (!work) {
    throw new NotFoundError('Student work not found.');
  }
  if (!await canAccessStudent(req.user, work.studentId)) {
    throw new AuthorizationError('Access denied: Only the assigned coach or administrator can delete this work sample.');
  }

  if (work.imageData && work.imageData.startsWith('/student_works/')) {
    try {
      const baseName = path.basename(work.imageData);
      const diskPath = path.join(studentWorksDir, baseName);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (fileErr) {
      console.warn('[StudentWorks] Warning unlinking file:', fileErr);
    }
  }

  await db.deleteStudentWork(id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: work.studentId,
    action: 'student_work_delete',
    summary: `Removed handwriting sample #${id} for student ${work.studentId}`,
    arguments: { workId: id, studentId: work.studentId },
    result: { success: true }
  });

  return res.json({ success: true, message: 'Student work deleted successfully.' });
}));

// POST /api/student-works/bulk-delete
studentWorksRouter.post('/bulk-delete', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = bulkDeleteWorksSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid bulk delete request.');
  }
  const { ids } = parsed.data;

  let deletedCount = 0;
  for (const id of ids) {
    try {
      const work = await db.findStudentWorkById(id);
      if (work && await canAccessStudent(req.user, work.studentId)) {
        if (work.imageData && work.imageData.startsWith('/student_works/')) {
          try {
            const baseName = path.basename(work.imageData);
            const diskPath = path.join(studentWorksDir, baseName);
            if (fs.existsSync(diskPath)) {
              fs.unlinkSync(diskPath);
            }
          } catch (e) {}
        }
        await db.deleteStudentWork(id);
        deletedCount++;
      }
    } catch (itemErr) {
      console.warn(`Failed to delete student work ${id}:`, itemErr);
    }
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'student_works_bulk_delete',
    summary: `${req.user?.firstName || req.user?.username} bulk deleted ${deletedCount} work samples`,
    arguments: { requestedCount: ids.length, deletedCount },
    result: { success: true, count: deletedCount }
  });

  return res.json({ success: true, count: deletedCount });
}));
