import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ROLES } from '../../src/types.ts';
import { db } from '../supabaseDb.ts';
import { asyncHandler } from './errorHandler.ts';
import { ValidationError, AuthorizationError } from '../errors.ts';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'coach' | 'student';
    studentId?: string;
    coachId?: string;
    firstName: string;
    lastName?: string;
    email: string;
    phoneNumber?: string;
    designation?: string;
  };
}

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return secret;
};

/**
 * Authentication middleware supporting both secure httpOnly cookies and Authorization: Bearer headers.
 * Validates token signature, expiration, and token_version for instant password-change revocation.
 */
export const authenticateJwt = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  // 1. Check secure httpOnly cookie first
  if (req.cookies && req.cookies.smartpen_token) {
    token = req.cookies.smartpen_token;
  }

  // 2. Fallback to Authorization Bearer header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized. Please sign in with valid credentials.', requireLogin: true });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as any;
  } catch (err: any) {
    res.status(401).json({ 
      error: 'Session expired or invalid token. Please log in again to continue.', 
      isExpired: true,
      requireLogin: true 
    });
    return;
  }

  // 1. Reject disambiguation/selection tokens from accessing standard API routes
  if (decoded.type === 'STUDENT_SELECTION' || decoded.type === 'ROLE_SELECTION') {
    res.status(401).json({
      error: 'Invalid session token: Selection token cannot be used for API access.',
      requireLogin: true
    });
    return;
  }

  // 2. Validate token_version: if the user changed their password, token_version in DB is higher. Fail closed on error.
  if (decoded.id) {
    try {
      const currentVersion = await db.findUserTokenVersion(decoded.id);
      if (currentVersion !== null) {
        const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
        if (currentVersion > tokenVersion) {
          res.status(401).json({
            error: 'Session invalidated. Your password was changed — please log in again.',
            code: 'SESSION_INVALIDATED',
            requireLogin: true
          });
          return;
        }
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to verify session security state.' });
      return;
    }
  }

  // 3. Reject deactivated coaches from continuing to make coach API requests
  if (decoded.role === ROLES.COACH && decoded.id) {
    try {
      const coachProfile = await db.getCoachById(decoded.coachId || decoded.id);
      if (coachProfile && coachProfile.status === 'Inactive') {
        res.status(403).json({
          error: 'Your coach account is currently inactive. Please contact administration.',
          code: 'ACCOUNT_INACTIVE'
        });
        return;
      }
    } catch {
      // Allow through if transient DB lookup fails for coach profile
    }
  }

  req.user = decoded;
  next();
};

/**
 * Optional authentication middleware that extracts user context if a valid session token
 * is present, without throwing 401 if unauthenticated.
 */
export const optionalAuthenticateJwt = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  if (req.cookies && req.cookies.smartpen_token) {
    token = req.cookies.smartpen_token;
  }

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return next();
  }

  try {
    const decoded: any = jwt.verify(token, getJwtSecret());
    if (decoded.type !== 'STUDENT_SELECTION' && decoded.type !== 'ROLE_SELECTION' && decoded.id) {
      const currentVersion = await db.findUserTokenVersion(decoded.id);
      const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
      if (currentVersion === null || currentVersion <= tokenVersion) {
        req.user = decoded;
      }
    }
  } catch {
    // Ignore invalid/expired tokens for optional auth
  }

  next();
};

/**
 * Role-Based Access Control: requires administrator privileges.
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user?.role !== ROLES.ADMIN) {
    res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    return;
  }
  next();
};

/**
 * Role-Based Access Control: requires coach or administrator privileges.
 */
export const requireCoachOrAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.COACH)) {
    res.status(403).json({ error: 'Access forbidden. Coach or Administrator privileges required.' });
    return;
  }
  next();
};

/**
 * Helper for checking access to a given student based on role and coach assignment / sibling relations.
 */
export const canAccessStudent = async (user: AuthRequest['user'], studentId: string): Promise<boolean> => {
  if (!user) return false;
  if (user?.role === ROLES.ADMIN) return true;
  if (user?.role === ROLES.COACH) {
    const student = await db.getStudentById(studentId);
    if (!student || !student.coachId) return false;
    const coachKeys = new Set([user.id, user.coachId].filter(Boolean));
    return coachKeys.has(student.coachId);
  }
  if (user?.role === ROLES.STUDENT) {
    if (user.studentId === studentId || user.id === studentId) return true;
    const currentStoredUser = await db.findUserById(user.id);
    if (currentStoredUser) {
      const siblings = await db.getSiblingStudentsForUser(currentStoredUser);
      return siblings.some(s => s.id === studentId);
    }
    return false;
  }
  return false;
};

/**
 * Express middleware to verify student access authorization on route parameter/body/query.
 */
export const verifyStudentAccess = (paramName: string = 'id') => {
  return asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const studentId = req.params[paramName] || req.body[paramName] || req.query[paramName];
    if (!studentId) {
      throw new ValidationError(`Student identifier parameter '${paramName}' is missing.`);
    }
    const hasAccess = await canAccessStudent(req.user, String(studentId));
    if (!hasAccess) {
      throw new AuthorizationError('Access denied. You do not have permission to view or manage this student profile.');
    }
    next();
  });
};
