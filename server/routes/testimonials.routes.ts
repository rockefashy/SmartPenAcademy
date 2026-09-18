import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../supabaseDb.ts';
import { AuthRequest, authenticateJwt, requireAdmin } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { saveBase64Image } from '../helpers/fileHelper.ts';
import { ValidationError, AuthorizationError, NotFoundError } from '../errors.ts';
import { createTestimonialSchema, patchTestimonialSchema } from '../schemas.ts';

export const testimonialsRouter = Router();

const testimonialsDir = path.join(process.cwd(), 'public', 'testimonials');
if (!fs.existsSync(testimonialsDir)) {
  fs.mkdirSync(testimonialsDir, { recursive: true });
}

// GET /api/testimonials (Public)
testimonialsRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { studentId, status } = req.query;
  const testimonials = await db.getTestimonials(studentId as string, status as string);
  return res.json(testimonials);
}));

// GET /api/testimonials/student/:id (Public)
testimonialsRouter.get('/student/:id', asyncHandler(async (req: Request, res: Response) => {
  const testimonials = await db.getTestimonials(req.params.id);
  return res.json(testimonials);
}));

// POST /api/testimonials (Admin or Student/Parent)
testimonialsRouter.post('/', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || !['admin', 'student'].includes(req.user.role)) {
    throw new AuthorizationError('Access denied: Testimonials can only be submitted by admin, parent, or student.');
  }
  const parsed = createTestimonialSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid testimonial payload');
  }
  const { 
    studentId, 
    studentName, 
    parentName, 
    grade, 
    schoolName, 
    relationship, 
    rating, 
    title, 
    review, 
    beforeAfterTag, 
    image, 
    mediaConsent 
  } = parsed.data;

  const finalImagePath = saveBase64Image(image, testimonialsDir, `testimony_${studentId}`);

  const saved = await db.saveTestimonial({
    studentId,
    studentName,
    parentName,
    grade,
    schoolName,
    relationship,
    rating,
    title,
    review,
    beforeAfterTag,
    image: finalImagePath,
    mediaConsent,
    status: 'Featured'
  });

  recordAudit({
    actorId: req.user?.id || studentId,
    actorUsername: req.user?.username || req.user?.firstName || parentName || 'User',
    actorRole: req.user?.role || 'student',
    actorStudentId: studentId,
    action: 'testimonial_create',
    summary: `New parent review submitted by ${parentName || 'Parent'} for student ${studentName} (Rating: ${rating}★)`,
    arguments: { studentId, studentName, parentName, rating, title },
    result: { testimonialId: saved.id, rating: saved.rating }
  });

  return res.status(201).json(saved);
}));

// PATCH /api/testimonials/:id (Admin only)
testimonialsRouter.patch('/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = patchTestimonialSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid testimonial update payload');
  }
  const updated = await db.updateTestimonial(req.params.id, parsed.data);
  if (!updated) {
    throw new NotFoundError('Testimonial not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'testimonial_update',
    summary: `Administrator updated testimonial #${req.params.id} (Status: ${updated.status})`,
    arguments: { testimonialId: req.params.id, updates: req.body },
    result: { testimonialId: req.params.id, status: updated.status }
  });

  return res.json(updated);
}));

// DELETE /api/testimonials/:id (Admin only)
testimonialsRouter.delete('/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  await db.deleteTestimonial(req.params.id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'testimonial_delete',
    summary: `Administrator deleted testimonial record #${req.params.id}`,
    arguments: { testimonialId: req.params.id },
    result: { success: true }
  });

  return res.json({ success: true });
}));
