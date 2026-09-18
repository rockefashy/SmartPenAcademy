import { Router, Request, Response } from 'express';
import { db } from '../supabaseDb.ts';
import {
  AuthRequest,
  authenticateJwt,
  requireAdmin,
  requireCoachOrAdmin
} from '../middleware/auth.ts';
import { demoBookingRateLimiter } from '../middleware/rateLimiter.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { sendDemoBookingAlert } from '../email.ts';
import { Logger } from '../logger.ts';
import { ValidationError, NotFoundError } from '../errors.ts';
import { createDemoBookingSchema, patchDemoBookingSchema } from '../schemas.ts';

export const demoBookingsRouter = Router();

// GET /api/demo-bookings (Admin only)
demoBookingsRouter.get('/', authenticateJwt, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const bookings = await db.getDemoBookings();
  return res.json(bookings);
}));

// POST /api/demo-bookings (Public lead generation with rate limiting)
demoBookingsRouter.post('/', demoBookingRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = createDemoBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid demo booking details');
  }
  const { studentName, parentName, age, contactNumber, preferredDate, preferredTimeSlot, modeOfLearning, notes } = parsed.data;

  const result = await db.createDemoBooking({
    studentName,
    parentName,
    age,
    contactNumber,
    preferredDate,
    preferredTimeSlot,
    modeOfLearning,
    notes
  });

  // Real-time Resend Alert to Admin (fire & forget background notice)
  sendDemoBookingAlert({
    studentName,
    parentName: result.booking.parentName,
    age,
    contactNumber,
    preferredDate: result.booking.preferredDate,
    preferredTimeSlot: result.booking.preferredTimeSlot,
    notes
  }).catch(err => {
    Logger.get('API').warn('[Resend Background Notice] Demo booking alert dispatch failed', { error: err.message || err });
  });

  recordAudit({
    actorId: 'anonymous_visitor',
    action: 'demo_booking_create',
    summary: `New Free Demo Class booked for student ${studentName} (Age: ${age}, Contact: ${contactNumber}, Mode: ${result.booking.modeOfLearning}, Date: ${result.booking.preferredDate}, Time: ${result.booking.preferredTimeSlot})`,
    arguments: { studentName, parentName, age, contactNumber, preferredDate, preferredTimeSlot, modeOfLearning: result.booking.modeOfLearning },
    result: { bookingId: result.booking.id, alertId: result.alert.id }
  });

  return res.status(201).json(result.booking);
}));

// PATCH /api/demo-bookings/:id
demoBookingsRouter.patch('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = patchDemoBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid demo booking update');
  }
  const updated = await db.updateDemoBooking(req.params.id, parsed.data);
  if (!updated) {
    throw new NotFoundError('Booking not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'demo_booking_update',
    summary: `Staff updated status for demo booking #${req.params.id} (${updated.studentName})`,
    arguments: { bookingId: req.params.id, updates: req.body },
    result: { bookingId: req.params.id, status: updated.status }
  });

  return res.json(updated);
}));

// DELETE /api/demo-bookings/:id
demoBookingsRouter.delete('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  await db.deleteDemoBooking(req.params.id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'demo_booking_delete',
    summary: `Staff deleted demo booking record #${req.params.id}`,
    arguments: { bookingId: req.params.id },
    result: { success: true }
  });

  return res.json({ success: true });
}));
