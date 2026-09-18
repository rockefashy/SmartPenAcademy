import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';
import { ROLES } from '../../src/types.ts';
import { AuthRequest, authenticateJwt, getJwtSecret } from '../middleware/auth.ts';
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

  if (!loginIdentifier || !password) {
    recordAudit({
      actorId: 'anonymous',
      action: 'auth_login_failed',
      summary: 'Login attempt rejected: Missing identifier or password',
      arguments: { identifier: loginIdentifier },
      status: 'failed'
    });
    throw new ValidationError('Registered email address and password are required.');
  }

  // Look up candidate users matching email, username, or phone
  const candidateUsers = await db.findUsersByIdentifier(loginIdentifier);
  if (!candidateUsers || candidateUsers.length === 0) {
    recordAudit({
      actorId: 'anonymous',
      action: 'auth_login_failed',
      summary: `Login failed: No account found for identifier ${loginIdentifier}`,
      arguments: { identifier: loginIdentifier },
      status: 'failed'
    });
    throw new AuthenticationError('Invalid login credentials. No account found.');
  }

  // Filter candidates where password matches
  const validPasswordUsers = candidateUsers.filter(u => {
    return Boolean(u.passwordHash && bcrypt.compareSync(password, u.passwordHash));
  });

  if (validPasswordUsers.length === 0) {
    recordAudit({
      actorId: candidateUsers[0]?.id || 'anonymous',
      actorUsername: candidateUsers[0]?.username,
      actorRole: candidateUsers[0]?.role,
      action: 'auth_login_failed',
      summary: `Login failed: Invalid password supplied for ${loginIdentifier}`,
      arguments: { identifier: loginIdentifier },
      status: 'failed'
    });
    throw new AuthenticationError('Invalid password. Please verify your password.');
  }

  // Check active status helper for coach
  const isCoachActive = async (userObj: any) => {
    if (userObj.isActive === false) return false;
    const coachProfile = await db.getCoachById(userObj.coachId || userObj.id);
    return coachProfile ? coachProfile.status === 'Active' : true;
  };

  // If a specific role was requested and matches exactly one user
  if (role) {
    const roleMatched = validPasswordUsers.filter(u => u.role === role);
    if (roleMatched.length === 1) {
      const loggedUser = roleMatched[0];

      // Active status check during login for coaches (inactive coaches are strictly blocked)
      if (loggedUser.role === 'coach') {
        const active = await isCoachActive(loggedUser);
        if (!active) {
          recordAudit({
            actorId: loggedUser.id,
            action: 'auth_login_rejected_inactive_coach',
            summary: `Login rejected: Coach account ${loggedUser.email} is inactive`,
            arguments: { identifier: loginIdentifier },
            status: 'failed'
          });
          throw new AuthorizationError('Your coach account is currently inactive. Please contact administration.');
        }
      }

      recordAudit({
        actorId: loggedUser.id,
        actorUsername: loggedUser.username,
        actorRole: loggedUser.role,
        actorStudentId: loggedUser.studentId,
        action: 'auth_login',
        summary: `User ${loggedUser.firstName} (${loggedUser.username || loggedUser.email}) logged in successfully as ${loggedUser.role}`,
        arguments: { identifier: loginIdentifier, role: loggedUser.role },
        result: { userId: loggedUser.id, role: loggedUser.role }
      });
      return await issueUserSession(loggedUser, res);
    }
  }

  // Scenario A: Single user match
  if (validPasswordUsers.length === 1) {
    const loggedUser = validPasswordUsers[0];

    // Active status check during login for coaches (inactive coaches are strictly blocked)
    if (loggedUser.role === 'coach') {
      const active = await isCoachActive(loggedUser);
      if (!active) {
        recordAudit({
          actorId: loggedUser.id,
          action: 'auth_login_rejected_inactive_coach',
          summary: `Login rejected: Coach account ${loggedUser.email} is inactive`,
          arguments: { identifier: loginIdentifier },
          status: 'failed'
        });
        throw new AuthorizationError('Your coach account is currently inactive. Please contact administration.');
      }
    }

    // Single student or admin or coach
    if (loggedUser.role === ROLES.STUDENT) {
      // Check if this student/parent has siblings under the same email
      const siblings = await db.getSiblingStudentsForUser(loggedUser);
      if (siblings && siblings.length > 1) {
        // Multi-child disambiguation required
        const jwtSecret = getJwtSecret();
        const selectionToken = jwt.sign(
          {
            type: 'STUDENT_SELECTION',
            userId: loggedUser.id,
            candidateUserIds: [loggedUser.id]
          },
          jwtSecret,
          { expiresIn: '15m' }
        );

        recordAudit({
          actorId: loggedUser.id,
          actorUsername: loggedUser.username,
          actorRole: loggedUser.role,
          action: 'auth_login_disambiguation_students',
          summary: `Login required sibling selection for parent ${loggedUser.firstName} (${siblings.length} children linked)`,
          arguments: { identifier: loginIdentifier, studentCount: siblings.length }
        });

        return res.json({
          requiresStudentSelection: true,
          selectionToken,
          parentName: loggedUser.firstName,
          students: siblings.map(s => ({
            id: s.id,
            studentId: s.id,
            firstName: s.firstName || 'Student',
            gender: s.gender,
            gradeClass: s.gradeClass,
            schoolName: s.schoolName,
            avatarUrl: s.avatarUrl
          }))
        });
      }
    }

    recordAudit({
      actorId: loggedUser.id,
      actorUsername: loggedUser.username,
      actorRole: loggedUser.role,
      actorStudentId: loggedUser.studentId,
      action: 'auth_login',
      summary: `User ${loggedUser.firstName} (${loggedUser.username || loggedUser.email}) logged in successfully as ${loggedUser.role}`,
      arguments: { identifier: loginIdentifier, role: loggedUser.role },
      result: { userId: loggedUser.id, role: loggedUser.role }
    });

    return await issueUserSession(loggedUser, res);
  }

  // Scenario B: Multiple user accounts share this identifier (e.g. Dual Role Admin + Coach, or Sibling Accounts)
  const distinctRoles = Array.from(new Set(validPasswordUsers.map(u => u.role)));

  // Dual Role (e.g. user is both Admin and Coach, or Coach and Parent)
  if (distinctRoles.length > 1) {
    const jwtSecret = getJwtSecret();
    const selectionToken = jwt.sign(
      {
        type: 'ROLE_SELECTION',
        candidateUserIds: validPasswordUsers.map(u => u.id)
      },
      jwtSecret,
      { expiresIn: '15m' }
    );

    recordAudit({
      actorId: validPasswordUsers[0]?.id || 'anonymous',
      action: 'auth_login_disambiguation_roles',
      summary: `Login required role selection for ${loginIdentifier} (${distinctRoles.join(', ')})`,
      arguments: { identifier: loginIdentifier, roles: distinctRoles }
    });

    return res.json({
      requiresRoleSelection: true,
      selectionToken,
      roles: distinctRoles,
      users: validPasswordUsers.map(u => ({
        id: u.id,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName
      }))
    });
  }

  // All matching accounts have the same role (e.g. multiple students under the same parent email)
  if (distinctRoles[0] === ROLES.STUDENT) {
    // Sibling students under common parent
    const allSiblings = await db.getSiblingStudentsForUser(validPasswordUsers[0]);
    const jwtSecret = getJwtSecret();
    const selectionToken = jwt.sign(
      {
        type: 'STUDENT_SELECTION',
        candidateUserIds: validPasswordUsers.map(u => u.id)
      },
      jwtSecret,
      { expiresIn: '15m' }
    );

    recordAudit({
      actorId: validPasswordUsers[0]?.id || 'anonymous',
      action: 'auth_login_disambiguation_students',
      summary: `Login required sibling selection for parent ${validPasswordUsers[0]?.firstName} (${allSiblings.length} children)`,
      arguments: { identifier: loginIdentifier, siblingCount: allSiblings.length }
    });

    return res.json({
      requiresStudentSelection: true,
      selectionToken,
      parentName: validPasswordUsers[0]?.firstName,
      students: allSiblings.map(s => ({
        id: s.id,
        studentId: s.id,
        firstName: s.firstName || 'Student',
        gender: s.gender,
        gradeClass: s.gradeClass,
        schoolName: s.schoolName,
        avatarUrl: s.avatarUrl
      }))
    });
  }

  // Default fallback: log in with the first matching user
  const loggedUser = validPasswordUsers[0];
  recordAudit({
    actorId: loggedUser.id,
    actorUsername: loggedUser.username,
    actorRole: loggedUser.role,
    action: 'auth_login',
    summary: `User ${loggedUser.firstName} logged in via single fallback`,
    arguments: { identifier: loginIdentifier }
  });
  return await issueUserSession(loggedUser, res);
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

authRouter.post('/request-reset-link', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
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
  newPassword: z.string().min(8, 'Password must be at least 8 characters long.'),
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
      actorId: 'system',
      action: 'auth_reset_password_failed',
      summary: `Password reset token verification failed: ${result.error}`,
      status: 'failed'
    });
    throw new ValidationError(result.error || 'Failed to reset password. The link may have expired.');
  }

  recordAudit({
    actorId: 'system',
    action: 'auth_reset_password',
    summary: 'Password successfully updated via secure reset token',
    arguments: {},
    result: { success: true }
  });

  return res.json({
    success: true,
    message: 'Password successfully reset! You can now log in with your new password.'
  });
}));

const changePasswordSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
  targetStudentId: z.string().optional(),
  targetUserId: z.string().optional(),
  applyToAll: z.boolean().optional(),
});

authRouter.post('/change-password', authenticateJwt, authRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
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
      actorId: 'system',
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
    actorId: user?.id || 'system',
    actorUsername: user?.username || email,
    actorRole: user?.role || 'student',
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

// Family students discovery for password change and account management
authRouter.post('/family-students', asyncHandler(async (req: Request, res: Response) => {
  const parsed = familyStudentsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Email or identifier is required.');
  }
  const target = (parsed.data.email || parsed.data.identifier || '').trim();
  const siblings = await db.getFamilyStudentsByEmailOrPhone(target);
  return res.json({
    students: siblings.map(s => ({
      id: s.id,
      studentId: s.id,
      firstName: s.firstName || 'Student'
    }))
  });
}));

// Exchange/Harmonize Supabase Auth Session with Backend Custom JWT & httpOnly Cookie
const supabaseSessionSchema = z.object({
  email: z.string().email('Valid email is required for session synchronization.'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum([ROLES.ADMIN, ROLES.COACH, ROLES.STUDENT]).optional(),
  studentId: z.string().optional(),
  id: z.string().optional(),
  username: z.string().optional(),
});

authRouter.post('/supabase-session', asyncHandler(async (req: Request, res: Response) => {
  const ssParse = supabaseSessionSchema.safeParse(req.body);
  if (!ssParse.success) {
    throw new ValidationError(ssParse.error.issues[0]?.message || 'Invalid request body.');
  }
  const { email, firstName, lastName, role, studentId, id, username } = ssParse.data;

  const user = await db.upsertUserFromSupabase({
    email,
    firstName,
    lastName,
    role,
    studentId,
    id,
    username
  });

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    studentId: user.studentId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email
  };

  const jwtSecret = getJwtSecret();
  const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  // Set secure, httpOnly, SameSite=strict cookie
  res.cookie('smartpen_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  recordAudit({
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    actorStudentId: user.studentId,
    action: 'auth_supabase_sync_session',
    summary: `Harmonized Supabase OAuth / Auth session for ${user.firstName} (${user.email})`,
    arguments: { email: user.email, role: user.role },
    result: { userId: user.id, role: user.role }
  });

  return res.json({ token, user: payload });
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
    throw new NotFoundError('No account found with this email address.');
  }

  const resetData = await db.createPasswordResetToken(user.email);
  if (!resetData || 'error' in resetData) {
    throw new DatabaseError((resetData && 'error' in resetData) ? resetData.error : 'Failed to generate reset link.');
  }

  const origin = req.headers.origin || 'http://localhost:3000';
  const resetLink = `${origin}?resetToken=${resetData.token}&email=${encodeURIComponent(user.email)}#reset-password`;

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
    message: `Password reset link dispatched to ${user.email}. Link valid for 60 minutes.`,
    email: user.email,
    deliveryStatus: emailResult.success ? 'sent' : 'simulated'
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
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  avatarUrl: z.string().optional()
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
