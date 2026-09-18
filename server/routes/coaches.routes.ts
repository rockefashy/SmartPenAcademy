import { Router, Response } from 'express';
import { db } from '../supabaseDb.ts';
import { ROLES } from '../../src/types.ts';
import { AuthRequest, authenticateJwt, requireAdmin } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { ValidationError, NotFoundError } from '../errors.ts';
import { createCoachSchema, updateCoachSchema } from '../schemas.ts';

export const coachesRouter = Router();

// Authenticated Coaches Directory:
// - Administrators receive full coach operational profiles.
// - Non-admin application roles (e.g. students) strictly receive explicitly selected public fields.
coachesRouter.get('/', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  const coaches = await db.getAllCoaches();

  if (req.user?.role === ROLES.ADMIN) {
    return res.json(coaches);
  }

  // Sanitize output for non-admin roles: strip private phone, address, notes, emergency contacts
  const sanitizedCoaches = coaches
    .filter(c => c.status === 'Active')
    .map(c => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      designation: c.designation,
      specializations: c.specializations,
      educationalQualification: c.educationalQualification,
      status: c.status
    }));

  return res.json(sanitizedCoaches);
}));

coachesRouter.post('/', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createCoachSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid coach registration data');
  }
  const data = parsed.data;
  const coach = await db.createCoach({
    firstName: data.firstName.trim(),
    lastName: data.lastName?.trim() || '',
    email: data.email.toLowerCase().trim(),
    phoneNumber: data.phoneNumber.trim(),
    address: data.address?.trim(),
    dateOfJoining: data.dateOfJoining || new Date().toISOString().split('T')[0],
    status: data.status,
    dateOfLeaving: data.dateOfLeaving || undefined,
    educationalQualification: data.educationalQualification?.trim(),
    designation: data.designation?.trim() || 'Associate Tutor',
    specializations: data.specializations,
    emergencyContactName: data.emergencyContactName?.trim(),
    emergencyContactPhone: data.emergencyContactPhone?.trim(),
    notes: data.notes?.trim(),
    password: data.password.trim()
  });

  recordAudit({
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'coach_create',
    summary: `Administrator ${`${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim()} onboarded new Coach: ${coach.firstName} (${coach.email})`,
    arguments: { firstName: coach.firstName, email: coach.email, phoneNumber: coach.phoneNumber, designation: coach.designation },
    result: { coachId: coach.id, email: coach.email }
  });

  return res.status(201).json(coach);
}));

coachesRouter.put('/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = updateCoachSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid coach update data');
  }
  const coachId = req.params.id;
  const updatedCoach = await db.updateCoach(coachId, parsed.data);
  if (!updatedCoach) {
    throw new NotFoundError('Coach not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'coach_update',
    summary: `Administrator ${req.user?.firstName || req.user?.username} updated Coach profile: ${updatedCoach.firstName} (${coachId})`,
    arguments: { coachId, updates: req.body },
    result: { coachId, firstName: updatedCoach.firstName }
  });

  return res.json(updatedCoach);
}));

coachesRouter.delete('/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const coachId = req.params.id;
  await db.deleteCoach(coachId); // Soft deactivation: No physical delete

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'coach_deactivate',
    summary: `Administrator ${req.user?.firstName || req.user?.username} deactivated Coach (soft delete): ${coachId}`,
    arguments: { coachId },
    result: { success: true, softDelete: true }
  });

  return res.json({ success: true, message: 'Coach has been deactivated. Historical records have been preserved.' });
}));
