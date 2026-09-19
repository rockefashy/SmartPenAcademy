import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../supabaseDb.ts';
import { ROLES } from '../../src/types.ts';
import {
  AuthRequest,
  authenticateJwt,
  requireAdmin,
  requireCoachOrAdmin,
  verifyStudentAccess
} from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { sendPaginated } from '../pagination.ts';
import { recordAudit } from '../helpers/audit.ts';
import { getCoachKeys, getCoachAssignedStudents } from '../helpers/coachHelper.ts';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
} from '../errors.ts';
import { enrollStudentSchema, updateStudentSchema, assignCoachSchema } from '../schemas.ts';
import { sendEnrollmentEmails, sendStudentUpdatedEmails } from '../email.ts';

export const studentsRouter = Router();

const studentQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional()
});

const studentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

// GET /api/students
studentsRouter.get('/', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AuthenticationError('Not authenticated');

  const queryParsed = studentQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { page, limit } = queryParsed.data;
  const paginationOptions = (page && limit) ? { page, limit } : undefined;

  if (req.user?.role === ROLES.ADMIN) {
    const students = await db.getAllStudents(paginationOptions);
    if (page && limit) {
      const total = await db.getStudentsCount();
      return sendPaginated(res, students, total, { page, limit });
    }
    return res.json(students);
  } else if (req.user?.role === ROLES.COACH) {
    const students = await getCoachAssignedStudents(req.user, paginationOptions);
    if (page && limit) {
      const keys = getCoachKeys(req.user);
      const total = keys ? await db.getStudentsCountByCoachId(keys.coachKey, keys.coachAlt) : 0;
      return sendPaginated(res, students, total, { page, limit });
    }
    return res.json(students);
  } else {
    throw new AuthorizationError('Students are not authorized to access the student directory.');
  }
}));

// GET /api/students/:id
studentsRouter.get('/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = studentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const student = await db.getStudentById(paramsParsed.data.id);
  if (!student) {
    throw new NotFoundError('Student profile not found.');
  }
  return res.json(student);
}));

// POST /api/students/enroll
studentsRouter.post('/enroll', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = enrollStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid student enrollment data.');
  }
  const data = parsed.data;
  const firstName = data.firstName.trim();
  const lastName = (data.lastName || '').trim();

  const rawPhone = (data.whatsappMobile || data.phoneNumber || data.phone || '').trim();
  const digitsOnly = rawPhone.replace(/\D/g, '');
  if (!digitsOnly || digitsOnly.length < 10) {
    throw new ValidationError('A valid 10-digit WhatsApp/Mobile number is required.');
  }
  const phoneNumber = rawPhone;

  let inheritedPasswordHash: string | undefined = undefined;
  const isSiblingEnrollment = Boolean(data.isSiblingEnrollment);

  if (isSiblingEnrollment) {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const existingUsers = await db.findUsersByIdentifier(cleanEmail);
    const parentUser = existingUsers.find(u => u.passwordHash);
    if (!parentUser?.passwordHash) {
      throw new ValidationError('Existing family account could not be located to inherit credentials for this sibling.');
    }
    inheritedPasswordHash = parentUser.passwordHash;
    delete (data as any).password;
  } else if (!data.password || data.password.trim().length === 0) {
    throw new ValidationError('Account password is required and must be at least 8 characters long.');
  } else if (data.password.trim().length < 8) {
    throw new ValidationError('Account password must be at least 8 characters long.');
  }

  const isDuplicate = await db.checkStudentDuplicate({
    firstName,
    lastName,
    phoneNumber,
    email: data.email,
    age: data.age
  });
  if (isDuplicate) {
    recordAudit({
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: 'student_enroll_duplicate_blocked',
      summary: `Enrollment blocked: Student ${firstName} is already enrolled.`,
      arguments: { firstName, lastName, phoneNumber, email: data.email, age: data.age },
      status: 'failed'
    });
    throw new ConflictError('Student is already enrolled.');
  }

  const newId = crypto.randomUUID();
  const password = data.password ? data.password.trim() : undefined;

  const newStudent = {
    ...data,
    firstName,
    lastName: lastName || undefined,
    modeOfLearning: data.modeOfLearning || 'In-person',
    parentName: data.parentName.trim(),
    email: data.email.toLowerCase().trim(),
    id: newId,
    password,
    passwordHash: inheritedPasswordHash,
    isSiblingEnrollment: Boolean(isSiblingEnrollment || inheritedPasswordHash),
    siblingOfStudentName: data.siblingOfStudentName,
    age: data.age,
    whatsappMobile: phoneNumber,
    status: data.status || 'Active',
    enrollmentDate: data.enrollmentDate || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const created = await db.createStudent(newStudent);

  await recordAudit({
    actorId: req.user?.id,
    actorRole: req.user?.role,
    action: 'student_enroll',
    summary: `Enrolled new student: ${created.firstName} (Age: ${data.age}, Grade: ${(newStudent as any).gradeClass || 'N/A'}, Parent: ${newStudent.parentName}, Phone: ${phoneNumber})`,
    arguments: {
      studentId: created.id,
      firstName: created.firstName,
      age: data.age,
      gradeClass: (newStudent as any).gradeClass,
      parentName: newStudent.parentName,
      email: newStudent.email,
      whatsappMobile: phoneNumber
    },
    result: { studentId: created.id, email: created.email }
  });

  sendEnrollmentEmails({
    ...newStudent,
    isSiblingEnrollment: Boolean(isSiblingEnrollment || inheritedPasswordHash),
    siblingOfStudentName: data.siblingOfStudentName
  }).catch(err => {
    console.warn('[Resend Background Notice] Student registration notification dispatch:', err.message || err);
  });

  console.log(`[EMAIL DISPATCH] Student Registration Notification queued for Parent (${data.email}) and Admin.`);

  return res.status(201).json({
    student: created,
    credentials: {
      email: data.email,
      parentEmail: data.email
    }
  });
}));

// PUT /api/students/:id
studentsRouter.put('/:id', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = studentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const bodyParsed = updateStudentSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new ValidationError(bodyParsed.error.issues[0]?.message || 'Invalid student update data.');
  }

  const studentId = paramsParsed.data.id;
  const updateData = { ...bodyParsed.data };

  if (req.user?.role === ROLES.COACH) {
    const targetStudent = await db.getStudentById(studentId);
    if (targetStudent?.status === 'Inactive') {
      throw new AuthorizationError('Inactive students are read-only for coaches.');
    }

    delete (updateData as any).status;
    delete (updateData as any).dateOfLeaving;
    delete (updateData as any).coachId;
    delete (updateData as any).coachName;
  }

  const updated = await db.updateStudent(studentId, updateData);
  if (!updated) {
    throw new NotFoundError('Student not found.');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'student_update',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} ${req.user?.firstName || req.user?.username} updated profile for student ${updated.firstName} (${studentId})`,
    arguments: { studentId, updates: updateData },
    result: { studentId, firstName: updated.firstName }
  });

  sendStudentUpdatedEmails(updated, updateData).catch(err => {
    console.warn('[Resend Background Notice] Student update notification dispatch:', err.message || err);
  });

  return res.json(updated);
}));

// DELETE /api/students/:id
studentsRouter.delete('/:id', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = studentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const { id } = paramsParsed.data;
  const student = await db.getStudentById(id);
  const deactivated = await db.deleteStudent(id);
  if (!deactivated) {
    throw new NotFoundError('Student not found.');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: id,
    action: 'student_deactivate',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'}${req.user?.firstName || req.user?.username ? ' ' + (req.user?.firstName || req.user?.username) : ''} deactivated student profile (soft delete): ${student?.firstName || id}`,
    arguments: { studentId: id, studentName: student?.firstName },
    result: { success: true, softDelete: true }
  });

  return res.json({ success: true, message: 'Student profile has been deactivated. Historical records have been preserved.' });
}));

// PATCH /api/students/:id/assign-coach
studentsRouter.patch('/:id/assign-coach', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = assignCoachSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid coach assignment payload');
  }
  const { coachId } = parsed.data;
  try {
    const updatedStudent = await db.assignCoachToStudent(req.params.id, coachId || null);
    if (!updatedStudent) {
      throw new NotFoundError('Student not found.');
    }

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'student_assign_coach',
      summary: `Assigned coach ${coachId || 'None'} to student ${updatedStudent.firstName} (${req.params.id})`,
      arguments: { studentId: req.params.id, coachId },
      result: { studentId: req.params.id, coachId, assignmentChanged: updatedStudent.assignmentChanged }
    });

    return res.json(updatedStudent);
  } catch (err: any) {
    if (err.message === 'Student not found') {
      throw new NotFoundError('Student not found.');
    }
    if (err.message === 'Coach not found') {
      throw new NotFoundError('Coach not found.');
    }
    if (err.message?.includes('Cannot assign')) {
      throw new ValidationError(err.message);
    }
    throw err;
  }
}));
