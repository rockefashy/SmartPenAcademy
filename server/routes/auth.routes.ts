import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';
import { ROLES } from '../../src/types.ts';
import { AuthRequest, authenticateJwt, optionalAuthenticateJwt, getJwtSecret } from '../middleware/auth.ts';
import { authRateLimiter } from '../middleware/rateLimiter.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { issueUserSession } from '../helpers/sessionHelper.ts';
import { resolveStudentContext } from '../helpers/studentContext.ts';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError
} from '../errors.ts';
import { Logger } from '../logger.ts';
import { sendPasswordResetLinkEmail, sendPasswordChangedEmail } from '../email.ts';
import { switchStudentSchema } from '../schemas.ts';

import { authService } from '../services/auth.service.ts';

const authLogger = Logger.get('AUTH');

export const authRouter = Router();

// Zod schema for login
const loginSchema = z.object({
  identifier: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
  phoneNumber: z.string().optional(),
  password: z.string().min(1, 'Password is required.'),
  role: z.enum([ROLES.ADMIN, ROLES.COACH, ROLES.STUDENT]).optional(),
});

// 1. Auth API - Unified Login with Multi-Account / Sibling / Role Disambiguation
authRouter.post('/login', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const loginParse = loginSchema.safeParse(req.body);
  if (!loginParse.success) {
    throw new ValidationError(loginParse.error.issues[0]?.message || 'Invalid request body.');
  }
  const { email, username, phoneNumber, identifier, password, role } = req.body;
  const loginIdentifier = identifier || email || username || phoneNumber;

  const result = await authService.authenticateUser({
    identifier: loginIdentifier,
    password,
    role
  });

  if (result.type === 'SESSION') {
    return await issueUserSession(result.user, res);
  }

  if (result.type === 'STUDENT_SELECTION') {
    return res.json({
      requiresStudentSelection: true,
      selectionToken: result.selectionToken,
      parentName: result.parentName,
      students: result.students,
      availableStudents: result.students
    });
  }

  if (result.type === 'ROLE_SELECTION') {
    return res.json({
      requiresRoleSelection: true,
      selectionToken: result.selectionToken,
      roles: result.roles,
      users: result.users
    });
  }
}));

const selectRoleSchema = z.object({
  selectionToken: z.string().min(1, 'selectionToken is required.'),
  selectedRole: z.enum([ROLES.ADMIN, ROLES.COACH, ROLES.STUDENT])
});

// Role selection resolution endpoint
authRouter.post('/select-role', asyncHandler(async (req: Request, res: Response) => {
  const parsed = selectRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'selectionToken and selectedRole are required.');
  }
  const { selectionToken, selectedRole } = parsed.data;

  const jwtSecret = getJwtSecret();
  let decoded: any;
  try {
    decoded = jwt.verify(selectionToken, jwtSecret);
  } catch {
    throw new AuthenticationError('Selection session expired. Please sign in again.');
  }
  if (decoded.type !== 'ROLE_SELECTION' || !Array.isArray(decoded.candidateUserIds)) {
    throw new ValidationError('Invalid or expired selection token.');
  }

  const candidateUsers = (await Promise.all(decoded.candidateUserIds.map((id: string) => db.findUserById(id)))).filter(Boolean);
  const chosenUser = candidateUsers.find((u: any) => u.role === selectedRole);

  if (!chosenUser) {
    throw new ValidationError(`Selected role ${selectedRole} is not associated with this account.`);
  }

  recordAudit({
    actorId: chosenUser.id,
    actorUsername: chosenUser.username,
    actorRole: chosenUser.role,
    action: 'auth_select_role',
    summary: `User ${chosenUser.firstName} completed dual-role selection and entered workspace as ${selectedRole}`,
    arguments: { selectedRole },
    result: { userId: chosenUser.id, role: chosenUser.role }
  });

  return await issueUserSession(chosenUser, res);
}));

const selectStudentSchema = z.object({
  selectionToken: z.string().min(1, 'selectionToken is required.'),
  selectedUserId: z.string().optional(),
  studentId: z.string().optional(),
  selectedStudentId: z.string().optional()
}).refine(data => Boolean(data.studentId || data.selectedStudentId || data.selectedUserId), {
  message: 'target student identifier is required.'
});

// Student profile selection resolution endpoint
authRouter.post('/select-student', asyncHandler(async (req: Request, res: Response) => {
  const parsed = selectStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'selectionToken and target student identifier are required.');
  }
  const { selectionToken, selectedUserId, studentId, selectedStudentId } = parsed.data;
  const targetStudentId = studentId || selectedStudentId || selectedUserId;

  const jwtSecret = getJwtSecret();
  let decoded: any;
  try {
    decoded = jwt.verify(selectionToken, jwtSecret);
  } catch {
    throw new AuthenticationError('Selection session expired. Please sign in again.');
  }
  if (decoded.type !== 'STUDENT_SELECTION') {
    throw new ValidationError('Invalid or expired selection token.');
  }

  const userId = decoded.userId || (Array.isArray(decoded.candidateUserIds) ? decoded.candidateUserIds[0] : null);
  if (!userId) {
    throw new ValidationError('Invalid selection session.');
  }

  const parentUser = await db.findUserById(userId);
  if (!parentUser) {
    throw new NotFoundError('User account not found.');
  }

  const siblings = await db.getSiblingStudentsForUser(parentUser);
  const chosenStudent = siblings.find(s => s.id === targetStudentId || s.userId === targetStudentId);

  if (!chosenStudent) {
    throw new AuthorizationError('Selected student profile is not authorized for this account.');
  }

  // Resolve user record belonging to this student
  let effectiveUser = parentUser;
  if (chosenStudent.userId && chosenStudent.userId !== parentUser.id) {
    const studentUser = await db.findUserById(chosenStudent.userId);
    if (studentUser) effectiveUser = studentUser;
  }

  const activeFirstName = chosenStudent.firstName || effectiveUser.firstName;

  recordAudit({
    actorId: effectiveUser.id,
    actorUsername: effectiveUser.username,
    actorRole: 'student',
    actorStudentId: chosenStudent.id,
    action: 'auth_select_student',
    summary: `Parent selected student profile: ${activeFirstName} (ID: ${chosenStudent.id})`,
    arguments: { selectedStudentId: chosenStudent.id },
    result: { studentId: chosenStudent.id }
  });

  return await issueUserSession(effectiveUser, res, chosenStudent.id);
}));

// Switch active student profile in current session (for siblings)
authRouter.post('/switch-student', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user?.role !== ROLES.STUDENT) {
    throw new AuthorizationError('Student profile switching is only applicable for student sessions.');
  }

  const parsed = switchStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Target studentId is required.');
  }
  const { studentId } = parsed.data;

  const currentStoredUser = await db.findUserById(req.user.id);
  if (!currentStoredUser) {
    throw new NotFoundError('Current user session record not found.');
  }

  const siblings = await db.getSiblingStudentsForUser(currentStoredUser);
  const targetSibling = siblings.find(s => s.id === studentId);
  if (!targetSibling) {
    throw new AuthorizationError('Selected student profile is not linked to your family account.');
  }

  const targetFirstName = targetSibling.firstName || currentStoredUser.firstName;

  recordAudit({
    actorId: req.user.id,
    actorUsername: req.user.username,
    actorRole: 'student',
    actorStudentId: targetSibling.id,
    action: 'auth_switch_student',
    summary: `Switched active student profile to sibling ${targetFirstName} (Student ID: ${targetSibling.id})`,
    arguments: { fromStudentId: req.user.studentId, toStudentId: targetSibling.id },
    result: { newStudentId: targetSibling.id }
  });

  return await issueUserSession(currentStoredUser, res, targetSibling.id);
}));

// Request Password Reset Link (via Email with 1-hour secure token)
const requestResetLinkSchema = z.object({
  identifier: z.string().min(1, 'Registered email or username is required.'),
});

authRouter.post(['/request-reset-link', '/forgot-password'], authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const rrlParse = requestResetLinkSchema.safeParse(req.body);
  if (!rrlParse.success) {
    throw new ValidationError(rrlParse.error.issues[0]?.message || 'Invalid request body.');
  }
  const { identifier } = rrlParse.data;

  const users = await db.findUsersByIdentifier(identifier);
  if (!users || users.length === 0) {
    recordAudit({
      actorId: 'anonymous',
      action: 'auth_request_reset_link_failed',
      summary: `Password reset request failed: No account associated with ${identifier}`,
      arguments: { identifier },
      status: 'failed'
    });
    throw new NotFoundError('No account registered with this email or username.');
  }

  const user = users[0];

  if (!user.email) {
    throw new ValidationError('No email address registered on this account.');
  }

  const resetData = await db.createPasswordResetToken(user.email);
  if (!resetData || 'error' in resetData) {
    throw new DatabaseError((resetData && 'error' in resetData) ? resetData.error : 'Failed to generate reset link.');
  }

  // Compose reset URL
  const origin = req.headers.origin || 'http://localhost:3000';
  const resetLink = `${origin}?resetToken=${resetData.token}&email=${encodeURIComponent(user.email)}#reset-password`;

  const emailResult = await sendPasswordResetLinkEmail(user.email, {
    firstName: user.firstName,
    resetLink
  });

  console.log(`[PASSWORD RESET] Link generated for ${user.email} (token redacted for security).`);
  recordAudit({
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    actorStudentId: user.studentId,
    action: 'auth_request_reset_link',
    summary: `Dispatched 1-hour secure password reset link to registered email: ${user.email}`,
    arguments: { identifier, email: user.email },
    result: { email: user.email, deliveryStatus: emailResult.success ? 'sent' : 'simulated' }
  });

  return res.json({
    success: true,
    message: `Password reset link dispatched to ${user.email}. Link valid for 60 minutes.`,
    email: user.email,
    deliveryStatus: emailResult.success ? 'sent' : 'simulated'
  });
}));

// Verify Reset Token and return associated email
authRouter.get('/verify-reset-token', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    throw new ValidationError('Reset token is required.');
  }
  const result = await db.getUserByResetToken(token);
  if (!result) {
    throw new NotFoundError('Invalid or expired password reset link.');
  }
  return res.json({ valid: true, email: result.email });
}));

// Reset Password using Token
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long.').regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number.'),
});

authRouter.post('/reset-password', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const rpParse = resetPasswordSchema.safeParse(req.body);
  if (!rpParse.success) {
    throw new ValidationError(rpParse.error.issues[0]?.message || 'Invalid request body.');
  }
  const { token, newPassword } = rpParse.data;

  const result = await db.resetPasswordWithToken(token, newPassword);
  if (!result.success) {
    recordAudit({
      actorId: 'anonymous',
      action: 'auth_reset_password_failed',
      summary: `Password reset token verification failed: ${result.error}`,
      status: 'failed'
    });
    throw new ValidationError(result.error || 'Failed to reset password. The link may have expired.');
  }

  recordAudit({
    actorId: 'anonymous',
    action: 'auth_reset_password',
    summary: `Password successfully updated via secure reset token for account ${result.email || ''}`,
    arguments: {},
    result: { success: true, email: result.email }
  });

  return res.json({
    success: true,
    message: 'Password successfully reset! You can now log in with your new password.'
  });
}));

const changePasswordSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.').regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number.'),
  targetStudentId: z.string().optional(),
  targetUserId: z.string().optional(),
  applyToAll: z.boolean().optional(),
});

authRouter.post('/change-password', optionalAuthenticateJwt, authRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const cpParse = changePasswordSchema.safeParse(req.body);
  if (!cpParse.success) {
    throw new ValidationError(cpParse.error.issues[0]?.message || 'Invalid request body.');
  }
  const { email, currentPassword, newPassword, targetStudentId, targetUserId, applyToAll } = cpParse.data;

  const result = await db.changeUserPassword(email, currentPassword, newPassword, {
    targetStudentId,
    targetUserId,
    applyToAll: applyToAll !== undefined ? Boolean(applyToAll) : true
  });

  if (!result.success) {
    recordAudit({
      actorId: req.user?.id || 'anonymous',
      actorUsername: req.user?.username || email,
      actorRole: req.user?.role || 'student',
      action: 'auth_change_password_failed',
      summary: `Password change failed for ${email}: ${result.error}`,
      arguments: { email, targetStudentId },
      status: 'failed'
    });
    throw new ValidationError(result.error || 'Failed to update password.');
  }

  const user = await db.findUserByEmailOrUsername(email);
  sendPasswordChangedEmail(email, { firstName: user?.firstName }).catch(err => {
    console.warn('[Resend Background Notice] Password changed email dispatch:', err.message || err);
  });

  // Clear session cookie to enforce automatic logout
  res.clearCookie('smartpen_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  console.log(`[PASSWORD CHANGED] Password updated for ${email} (targetStudentId: ${targetStudentId || 'all'}). User logged out.`);
  recordAudit({
    actorId: req.user?.id || user?.id || 'anonymous',
    actorUsername: req.user?.username || user?.username || email,
    actorRole: req.user?.role || user?.role || 'student',
    action: 'auth_change_password',
    summary: `Password updated successfully for account ${email}. Target: ${targetStudentId || 'all'}. User logged out.`,
    arguments: { email, targetStudentId, applyToAll },
    result: { success: true, updatedCount: result.updatedCount }
  });

  return res.json({
    success: true,
    message: 'Password updated successfully! You have been logged out. Please sign in with your new password.',
    loggedOut: true
  });
}));

const familyStudentsSchema = z.object({
  email: z.string().optional(),
  identifier: z.string().optional()
}).refine(data => Boolean((data.email || data.identifier || '').trim()), {
  message: 'Email or identifier is required.'
});

// Family students discovery for password change and account management (Authenticated)
authRouter.post('/family-students', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = familyStudentsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Email or identifier is required.');
  }
  const target = (parsed.data.email || parsed.data.identifier || '').trim().toLowerCase();

  // Non-admins can only query family students for their own registered email
  if (req.user?.role !== ROLES.ADMIN) {
    const callerEmail = (req.user?.email || '').trim().toLowerCase();
    if (!callerEmail || callerEmail !== target) {
      throw new AuthorizationError('Access denied: You can only query family students for your own account.');
    }
  }

  const siblings = await db.getFamilyStudentsByEmailOrPhone(target);
  return res.json({
    students: siblings.map(s => ({
      id: s.id,
      studentId: s.id,
      firstName: s.firstName || 'Student'
    }))
  });
}));



authRouter.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  res.clearCookie('smartpen_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  recordAudit({
    actorId: 'system',
    action: 'auth_logout',
    summary: 'User session logged out and authentication cookie cleared',
    arguments: {}
  });

  return res.json({ success: true, message: 'Logged out successfully' });
}));

// Zod schema for forgot-password
const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Please enter your registered email address.'),
});

authRouter.post('/forgot-password', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const fpParse = forgotPasswordSchema.safeParse(req.body);
  if (!fpParse.success) {
    throw new ValidationError(fpParse.error.issues[0]?.message || 'Invalid request body.');
  }
  const { identifier } = fpParse.data;

  const user = await db.findUserByEmailOrUsername(identifier);
  if (!user) {
    recordAudit({
      actorId: 'anonymous',
      action: 'auth_forgot_password_failed',
      summary: `Password retrieval lookup failed: No account for ${identifier}`,
      arguments: { identifier },
      status: 'failed'
    });
    // Anti-enumeration defense: Return generic success without revealing account non-existence
    return res.json({
      success: true,
      message: 'If an account is associated with this email address, a password reset link has been dispatched.',
      deliveryStatus: 'simulated'
    });
  }

  const resetData = await db.createPasswordResetToken(user.email);
  if (!resetData || 'error' in resetData) {
    throw new DatabaseError((resetData && 'error' in resetData) ? resetData.error : 'Failed to generate reset link.');
  }

  // Strictly use configured APP_URL or server host, never unvalidated client Origin
  const appBaseUrl = (process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://smartpenacademy.com' : 'http://localhost:3000')).trim().replace(/\/$/, '');
  const resetLink = `${appBaseUrl}?resetToken=${resetData.token}&email=${encodeURIComponent(user.email)}#reset-password`;

  const emailResult = await sendPasswordResetLinkEmail(user.email, {
    firstName: user.firstName,
    resetLink
  });

  authLogger.info(`Password reset link dispatched (token redacted)`, { email: user.email });

  recordAudit({
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    actorStudentId: user.studentId,
    action: 'auth_forgot_password',
    summary: `Dispatched 1-hour secure password reset link to registered email: ${user.email}`,
    arguments: { identifier, email: user.email },
    result: { email: user.email, deliveryStatus: emailResult.success ? 'sent' : 'simulated' }
  });

  return res.json({
    success: true,
    message: 'If an account is associated with this email address, a password reset link has been dispatched.',
    deliveryStatus: emailResult.success ? 'sent' : 'simulated'
  });
}));

// Session Probe Endpoint (Returns 200 with user or null, preventing console 401s on initial landing load)
authRouter.get('/session', optionalAuthenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }

  const user = (req.user.username ? await db.findUserByUsername(req.user.username) : null) || (await db.findUserById(req.user.id));
  if (!user) {
    return res.json({ authenticated: false, user: null });
  }

  const {
    activeStudentId,
    activeFirstName,
    activeLastName,
    siblingStudents
  } = await resolveStudentContext(user, req.user.studentId);

  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      studentId: activeStudentId,
      firstName: activeFirstName,
      lastName: activeLastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      designation: user.designation,
      siblingStudents
    }
  });
}));

authRouter.get('/me', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AuthenticationError('Not authenticated');
  const user = (req.user.username ? await db.findUserByUsername(req.user.username) : null) || (await db.findUserById(req.user.id));
  if (!user) throw new NotFoundError('User not found');

  const {
    activeStudentId,
    activeFirstName,
    activeLastName,
    siblingStudents
  } = await resolveStudentContext(user, req.user.studentId);

  return res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    studentId: activeStudentId,
    firstName: activeFirstName,
    lastName: activeLastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    designation: user.designation,
    siblingStudents
  });
}));

const patchMeSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phoneNumber: z.string().max(25).optional(),
  avatarUrl: z.string().max(500).refine(val => {
    if (!val) return true;
    return val.startsWith('data:image/') || val.startsWith('/') || val.startsWith('https://') || val.startsWith('http://');
  }, 'avatarUrl must be a valid image data URI, relative path, or URL').optional()
});

authRouter.patch('/me', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AuthenticationError('Not authenticated');

  // Explicit check: Coaches cannot edit their own details. Only Admin can do that.
  if (req.user?.role === ROLES.COACH) {
    throw new AuthorizationError('Access denied: Coaches cannot edit their own details. Only an Administrator can update coach details.');
  }

  // Explicit rejection of sensitive or privilege-bearing fields
  const restrictedFields = [
    'role',
    'id',
    'email',
    'is_active',
    'isActive',
    'token_version',
    'tokenVersion',
    'student_id',
    'studentId',
    'coach_id',
    'coachId',
    'password_hash',
    'passwordHash',
    'reset_password_token',
    'reset_password_expiry'
  ];

  for (const field of restrictedFields) {
    if ((req.body as any)[field] !== undefined) {
      throw new ValidationError(`Modification of restricted identity field '${field}' is strictly prohibited.`);
    }
  }

  const parsed = patchMeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid profile update parameters.');
  }

  const { firstName, lastName, phoneNumber, avatarUrl } = parsed.data;
  const result = await db.updateUserSelfProfile(req.user.id, {
    firstName,
    lastName,
    phoneNumber,
    avatarUrl
  });

  if (!result.success || !result.user) {
    throw new ValidationError(result.error || 'Failed to update profile.');
  }

  return res.json({
    success: true,
    message: 'Profile updated successfully.',
    user: {
      id: result.user.id,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phoneNumber: result.user.phoneNumber,
      role: result.user.role,
      avatarUrl: result.user.avatarUrl
    }
  });
}));
