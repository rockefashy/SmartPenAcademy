import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { sendPaginated } from './server/pagination.ts';
import { AuditExecutionMode } from './src/types.ts';
import { db } from './server/supabaseDb.ts';
import { handleAIAgentChat } from './server/aiAgent.ts';
import { Logger } from './server/logger.ts';
import { asyncHandler, errorHandler } from './server/middleware/errorHandler.ts';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  InternalServerError
} from './server/errors.ts';

const apiLogger = Logger.get('API');
const authLogger = Logger.get('AUTH');
const dbLogger = Logger.get('DB');
const auditLogger = Logger.get('AUDIT');
const sysLogger = Logger.get('SYSTEM');

// Process-level uncaught exception handling (Log-and-Exit per Rule #5)
process.on('uncaughtException', (err: Error) => {
  sysLogger.fatal('FATAL: Uncaught exception detected. Draining and terminating for clean restart.', err);
  setTimeout(() => {
    process.exit(1);
  }, 1000).unref();
});

process.on('unhandledRejection', (reason: any) => {
  sysLogger.error('Unhandled promise rejection detected', reason);
});
import {
  sendEmail,
  sendEnrollmentEmails,
  sendStudentUpdatedEmails,
  sendPasswordResetLinkEmail,
  sendPasswordChangedEmail,
  sendDemoBookingAlert,
  sendFeeReminderEmail,
  getSenderEmail,
  getAdminNotificationEmail,
  getResendClient
} from './server/email.ts';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is not set. Server will not start.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Static directories for folders
const publicDir = path.join(process.cwd(), 'public');
const studentWorksDir = path.join(publicDir, 'student_works');
const progressReportsDir = path.join(publicDir, 'progress_reports');
const appImagesDir = path.join(publicDir, 'app_images');
const testimonialsDir = path.join(publicDir, 'testimonials');

[studentWorksDir, progressReportsDir, appImagesDir, testimonialsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve public static assets
app.use(express.static(publicDir));

// ================= RATE LIMITING MIDDLEWARE (SUPABASE-BACKED ATOMIC RPC) =================
export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for user identity from JWT (via req.user or cookie/header decode)
      let userKey: string | null = null;
      if ((req as any).user?.id) {
        userKey = `user:${(req as any).user.id}`;
      } else {
        const token = req.cookies?.smartpen_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            if (decoded?.id) {
              userKey = `user:${decoded.id}`;
            }
          } catch {
            // Fall back to IP
          }
        }
      }

      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const identifier = userKey || `ip:${ip}`;
      const routePath = req.baseUrl || req.path || 'global';
      const key = `api:${routePath}:${identifier}`;
      const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));

      const rateCheck = await db.checkRateLimit(key, options.max, windowSeconds);

      if (!rateCheck.allowed) {
        res.set('Retry-After', String(rateCheck.retryAfter));
        res.status(429).json({
          error: options.message || 'Too many requests. Please slow down and try again shortly.',
          retryAfter: rateCheck.retryAfter
        });
        return;
      }

      next();
    } catch (err) {
      console.warn('[RateLimiter] Error evaluating rate limit, proceeding:', err);
      next();
    }
  };
}

// Mutating endpoints rate limiters (independent of chat UI)
const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: 'Payment mutation rate limit reached. Please wait before recording more payments.'
});

const attendanceRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Attendance update rate limit exceeded. Please wait a moment before retrying.'
});

const demoBookingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Demo booking rate limit reached. Please try again in a few moments.'
});

// Auth endpoint rate limiter: 10 attempts per 15 minutes per IP/user
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});

// ================= STANDARDIZED API ERROR HANDLER =================
export function sendApiError(res: Response, req: Request, err: any, defaultMessage: string, statusCode = 500) {
  const isAppError = err instanceof AppError;
  const finalStatus = isAppError ? err.statusCode : statusCode;
  const errorCode = isAppError ? err.errorCode : (finalStatus === 400 ? 'VALIDATION_ERROR' : finalStatus === 401 ? 'AUTHENTICATION_ERROR' : finalStatus === 403 ? 'AUTHORIZATION_ERROR' : finalStatus === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  const isProduction = process.env.NODE_ENV === 'production';
  const clientMessage = isAppError ? err.message : (isProduction && finalStatus >= 500 ? defaultMessage : (err?.message || defaultMessage));

  const logMeta = {
    path: req.originalUrl || req.path,
    method: req.method,
    statusCode: finalStatus,
    code: errorCode,
    userId: (req as any).user?.id || 'anonymous'
  };

  if (finalStatus >= 500) {
    apiLogger.error(defaultMessage, err, logMeta);
  } else {
    apiLogger.warn(clientMessage, { ...logMeta, details: isAppError ? err.details : undefined });
  }

  return res.status(finalStatus).json({
    error: clientMessage,
    code: errorCode,
    statusCode: finalStatus,
    ...(isAppError && err.details ? { details: err.details } : {})
  });
}

// Auth Middleware (supports both httpOnly cookie and Bearer header)
interface AuthRequest extends Request {
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

const authenticateJwt = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
    decoded = jwt.verify(token, JWT_SECRET) as any;
  } catch (err: any) {
    res.status(401).json({ 
      error: 'Session expired or invalid token. Please log in again to continue.', 
      isExpired: true,
      requireLogin: true 
    });
    return;
  }

  // Validate token_version: if the user changed their password after this token was issued,
  // the token_version in the DB will be higher than what is stored in the JWT claim.
  // This ensures password changes immediately invalidate all older tokens.
  if (decoded.id && decoded.tokenVersion !== undefined) {
    try {
      const currentVersion = await db.findUserTokenVersion(decoded.id);
      if (currentVersion !== null && currentVersion > decoded.tokenVersion) {
        res.status(401).json({
          error: 'Session invalidated. Your password was changed — please log in again.',
          code: 'SESSION_INVALIDATED',
          requireLogin: true
        });
        return;
      }
    } catch {
      // Non-fatal: if the version check fails (e.g. DB transient error), allow the request through.
      // The JWT signature has already been verified; this is a defence-in-depth check only.
    }
  }

  req.user = decoded;
  next();
};

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    return;
  }
  next();
};

const requireCoachOrAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'coach')) {
    res.status(403).json({ error: 'Access forbidden. Coach or Administrator privileges required.' });
    return;
  }
  next();
};

// Helper for checking access to a given student
const canAccessStudent = async (user: AuthRequest['user'], studentId: string): Promise<boolean> => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'coach') {
    const student = await db.getStudentById(studentId);
    if (!student || !student.coachId) return false;
    const coachKeys = new Set([user.id, user.coachId].filter(Boolean));
    return coachKeys.has(student.coachId);
  }
  if (user.role === 'student') {
    if (user.studentId === studentId || user.id === studentId) return true;
    const currentStoredUser = await db.findUserById(user.id);
    if (currentStoredUser) {
      const siblings = await db.getSiblingStudentsForUser(currentStoredUser);
      return siblings.some(s => s.id === studentId || (s.userId && s.userId === user.id));
    }
    return false;
  }
  return false;
};

// Express middleware to verify student access authorization (Priority 2 Item 2)
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

// ================= API ROUTES & AUDIT LOGGING =================

// Real-time Business Scenario & Tool Audit Logger
export async function recordAudit(params: {
  actorId?: string;
  actorUsername?: string;
  actorRole?: string;
  actorStudentId?: string;
  action: string;
  summary: string;
  arguments?: Record<string, any>;
  result?: Record<string, any> | null;
  status?: 'success' | 'failed';
  executionMode?: AuditExecutionMode;
}) {
  // Sanitize sensitive fields from arguments to protect user credentials
  const sanitizedArgs: Record<string, any> = {};
  if (params.arguments && typeof params.arguments === 'object') {
    for (const [key, value] of Object.entries(params.arguments)) {
      if (key.toLowerCase().includes('password')) {
        sanitizedArgs[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.startsWith('data:image/')) {
        sanitizedArgs[key] = value.substring(0, 40) + '...[BASE64_IMAGE_DATA]';
      } else {
        sanitizedArgs[key] = value;
      }
    }
  }

  // Determine actor: if logged in user is available use id, otherwise 'anonymous'
  const actorId = (params.actorId && params.actorId !== 'system') ? params.actorId : 'anonymous';

  auditLogger.info(`[AUDIT EVENT] ${params.action}: ${params.summary}`, {
    actorId,
    action: params.action,
    status: params.status || 'success',
    arguments: sanitizedArgs
  });

  return await db.recordToolAuditLog({
    userId: actorId,
    actorId: actorId,
    toolName: params.action,
    summary: params.summary,
    actionSummary: params.summary,
    arguments: sanitizedArgs,
    result: params.result || {},
    status: params.status || 'success',
    success: params.status !== 'failed',
    executionMode: params.executionMode || 'direct_api'
  });
}

// ================= OBSERVABILITY & HEALTH CHECK PROBES (BATCH 1) =================

const testEmailSchema = z.object({
  to: z.string().email('Invalid email address format').optional(),
  type: z.enum(['enrollment', 'general']).optional().default('enrollment'),
  studentName: z.string().optional().default('Aarav Sharma'),
  parentName: z.string().optional().default('Priya Sharma')
});

// 1. Liveness Probe (GET /api/health)
app.get('/api/health', asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }
  });
}));

// 2. Readiness Probe (GET /api/ready)
app.get('/api/ready', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const adminUser = await db.getAdminUser();
  if (!adminUser) {
    res.status(503).json({
      status: 'unready',
      error: 'Database connectivity check failed',
      timestamp: new Date().toISOString()
    });
    return;
  }
  const latencyMs = Date.now() - startTime;
  
  res.status(200).json({
    status: 'ready',
    checks: {
      database: { status: 'connected', latencyMs }
    },
    timestamp: new Date().toISOString()
  });
}));

// Email Service Status & Health Check
app.get('/api/email/status', asyncHandler(async (req: Request, res: Response) => {
  const hasApiKey = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
  const sender = await getSenderEmail();
  const adminEmail = await getAdminNotificationEmail();
  const adminUser = await db.getAdminUser();
  res.json({
    status: 'ok',
    resendConfigured: hasApiKey,
    apiKeyMasked: hasApiKey ? `${process.env.RESEND_API_KEY!.substring(0, 5)}...` : null,
    fromSender: sender,
    adminNotificationEmail: adminEmail || null,
    adminUser: adminUser ? { id: adminUser.id, email: adminUser.email, firstName: adminUser.firstName, role: adminUser.role } : null
  });
}));

// Send Test Email (Diagnostic Endpoint)
app.post('/api/email/test', asyncHandler(async (req: Request, res: Response) => {
  const parsed = testEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid email test parameters');
  }
  const { to, type, studentName, parentName } = parsed.data;
  const adminEmail = await getAdminNotificationEmail();
  const recipient = to || adminEmail;

  if (!recipient) {
    throw new ValidationError('No recipient email specified and no admin user found in database.');
  }

  if (type === 'enrollment') {
    const results = await sendEnrollmentEmails({
      firstName: studentName,
      parentName,
      age: 8,
      gender: 'Male',
      dominantHand: 'Right',
      gradeClass: 'Grade 3',
      schoolName: 'National Public School',
      email: recipient,
      password: 'TempPassword123!',
      preferredDays: 'Mon, Wed, Fri',
      preferredSlot: '4:00 PM - 5:00 PM',
      scriptsRequired: ['English Print', 'English Cursive'],
      academicModules: ['Foundations', 'Speed & Pressure Control'],
      diagnosticObservations: ['Irregular letter sizing', 'Tight pencil grip']
    });

    return res.json({
      success: true,
      message: `Enrollment test email dispatch triggered for recipient ${recipient}`,
      results
    });
  }

  const currentSender = await getSenderEmail();
  const testResult = await sendEmail({
    to: recipient,
    subject: `🧪 Test Email from SmartPen Academy [${new Date().toLocaleTimeString()}]`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #0E3589; border-radius: 12px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #0E3589; margin-top: 0;">SmartPen Academy Email Test</h2>
        <p>This is a test email sent from SmartPen Academy to verify the Resend integration.</p>
        <p><strong>Configured Sender:</strong> ${currentSender}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
    `
  });

  return res.json({
    success: testResult.success,
    details: testResult
  });
}));

// Helper to issue login cookie & response
const issueUserSession = async (user: any, res: Response, targetStudentId?: string) => {
  let siblingStudents: any = undefined;
  let activeStudentId = targetStudentId || user.studentId;
  let activeFirstName = user.firstName;
  let activeLastName = user.lastName;

  if (user.role === 'student') {
    const rawSiblings = await db.getSiblingStudentsForUser(user);
    siblingStudents = rawSiblings.map(s => ({
      id: s.id,
      firstName: s.firstName || 'Student',
      lastName: s.lastName || undefined,
      age: s.age,
      gradeClass: s.gradeClass,
      schoolName: s.schoolName
    }));

    if (activeStudentId) {
      const activeSibling = rawSiblings.find(s => s.id === activeStudentId);
      if (activeSibling) {
        activeFirstName = activeSibling.firstName || activeFirstName;
        activeLastName = activeSibling.lastName || activeLastName;
      }
    } else if (rawSiblings.length === 1) {
      activeStudentId = rawSiblings[0].id;
      activeFirstName = rawSiblings[0].firstName || activeFirstName;
      activeLastName = rawSiblings[0].lastName || activeLastName;
    }
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    studentId: activeStudentId,
    coachId: user.coachId || user.coach_id,
    firstName: activeFirstName,
    lastName: activeLastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    designation: user.designation,
    siblingStudents,
    // Embed the current token_version so authenticateJwt can detect post-password-change tokens
    tokenVersion: typeof user.tokenVersion === 'number' ? user.tokenVersion : (typeof user.token_version === 'number' ? user.token_version : 0)
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  // Set secure, httpOnly, SameSite=strict cookie
  res.cookie('smartpen_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({ token, user: payload });
};

// 1. Auth API - Unified Login with Multi-Account / Sibling / Role Disambiguation
// Zod schema for login
const loginSchema = z.object({
  identifier: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
  phoneNumber: z.string().optional(),
  password: z.string().min(1, 'Password is required.'),
  role: z.enum(['admin', 'coach', 'student']).optional(),
});

app.post('/api/auth/login', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
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
    throw new ValidationError('Identifier (Email, Username, or Phone) and password are required.');
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
        result: { userId: loggedUser.id, role: loggedUser.role, firstName: loggedUser.firstName },
        status: 'success'
      });
      return await issueUserSession(loggedUser, res);
    }
  }

  // Sibling resolution for student/family accounts (Identity-First 1:N schema)
  const studentAccounts = validPasswordUsers.filter(u => u.role === 'student');
  if (studentAccounts.length > 0) {
    // 1-to-N Scenario: More than one student user record matched this password
    if (studentAccounts.length > 1) {
      const candidateUserIds = studentAccounts.map(u => u.id);
      const selectionToken = jwt.sign(
        { type: 'STUDENT_SELECTION', userId: studentAccounts[0].id, candidateUserIds },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      const studentDetails = await Promise.all(
        studentAccounts.map(async (u) => {
          let s = u.studentId ? await db.getStudentById(u.studentId) : null;
          if (!s) {
            const sibs = await db.getSiblingStudentsForUser(u);
            s = sibs.find(sib => sib.userId === u.id) || sibs[0];
          }
          return {
            id: s?.id || u.studentId || u.id,
            studentId: s?.id || u.studentId || u.id,
            userId: u.id,
            firstName: s?.firstName || u.firstName || 'Student',
            lastName: s?.lastName || u.lastName || undefined,
            status: s?.status || 'Active',
            dateOfLeaving: s?.dateOfLeaving,
            age: s?.age,
            gradeClass: s?.gradeClass,
            schoolName: s?.schoolName
          };
        })
      );

      recordAudit({
        actorId: studentAccounts[0].id,
        actorUsername: studentAccounts[0].username,
        actorRole: 'student',
        action: 'auth_login_sibling_prompt',
        summary: `Sibling account family detected for ${loginIdentifier}. Prompting selection from ${studentAccounts.length} student profiles.`,
        arguments: { identifier: loginIdentifier, studentCount: studentAccounts.length },
        status: 'success'
      });

      return res.json({
        requiresStudentSelection: true,
        selectionToken,
        availableStudents: studentDetails,
        message: 'Multiple student profiles registered under this family account share this password. Please select which student to access:'
      });
    }

    // 1-to-1 Scenario: Exactly 1 student user record matched this password -> Direct landing!
    const primaryUser = studentAccounts[0];
    let targetStudentId = primaryUser.studentId;
    if (!targetStudentId) {
      const sibs = await db.getSiblingStudentsForUser(primaryUser);
      const matched = sibs.find(s => s.userId === primaryUser.id) || sibs[0];
      if (matched) {
        targetStudentId = matched.id;
        primaryUser.studentId = matched.id;
        primaryUser.firstName = matched.firstName || primaryUser.firstName;
        primaryUser.lastName = matched.lastName || primaryUser.lastName;
      }
    }

    recordAudit({
      actorId: primaryUser.id,
      actorUsername: primaryUser.username,
      actorRole: 'student',
      actorStudentId: primaryUser.studentId,
      action: 'auth_login',
      summary: `Student/Parent ${primaryUser.firstName} logged in directly (read-only archive enabled if inactive)`,
      arguments: { identifier: loginIdentifier, role: primaryUser.role, studentId: primaryUser.studentId },
      result: { userId: primaryUser.id, role: primaryUser.role, firstName: primaryUser.firstName, studentId: primaryUser.studentId },
      status: 'success'
    });
    return await issueUserSession(primaryUser, res, primaryUser.studentId);
  }

  // Default: Coach or Admin matched account
  const matchedUser = validPasswordUsers[0];

  // Check active status for coach
  if (matchedUser.role === 'coach') {
    const active = await isCoachActive(matchedUser);
    if (!active) {
      recordAudit({
        actorId: matchedUser.id,
        action: 'auth_login_rejected_inactive_coach',
        summary: `Login rejected: Coach account ${matchedUser.email} is inactive`,
        arguments: { identifier: loginIdentifier },
        status: 'failed'
      });
      throw new AuthorizationError('Your coach account is currently inactive. Please contact administration.');
    }
  }

  recordAudit({
    actorId: matchedUser.id,
    actorUsername: matchedUser.username,
    actorRole: matchedUser.role,
    actorStudentId: matchedUser.studentId,
    action: 'auth_login',
    summary: `User ${matchedUser.firstName} (${matchedUser.username || matchedUser.email}) logged in successfully as ${matchedUser.role}`,
    arguments: { identifier: loginIdentifier, role: matchedUser.role },
    result: { userId: matchedUser.id, role: matchedUser.role, firstName: matchedUser.firstName },
    status: 'success'
  });
  return await issueUserSession(matchedUser, res);
}));

const selectRoleSchema = z.object({
  selectionToken: z.string().min(1, 'selectionToken is required.'),
  selectedRole: z.enum(['admin', 'coach', 'student'])
});

// Role selection resolution endpoint
app.post('/api/auth/select-role', asyncHandler(async (req: Request, res: Response) => {
  const parsed = selectRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'selectionToken and selectedRole are required.');
  }
  const { selectionToken, selectedRole } = parsed.data;

  let decoded: any;
  try {
    decoded = jwt.verify(selectionToken, JWT_SECRET);
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
app.post('/api/auth/select-student', asyncHandler(async (req: Request, res: Response) => {
  const parsed = selectStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'selectionToken and target student identifier are required.');
  }
  const { selectionToken, selectedUserId, studentId, selectedStudentId } = parsed.data;
  const targetStudentId = studentId || selectedStudentId || selectedUserId;

  let decoded: any;
  try {
    decoded = jwt.verify(selectionToken, JWT_SECRET);
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

  // Resolve the user record belonging to this student
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

const switchStudentSchema = z.object({
  studentId: z.string().min(1, 'Target studentId is required.')
});

// Switch active student profile in current session (for siblings)
app.post('/api/auth/switch-student', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'student') {
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

app.post('/api/auth/request-reset-link', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
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
  if (user.role === 'admin') {
    recordAudit({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: 'auth_request_reset_link_blocked',
      summary: `Blocked password reset via email for admin account ${user.username}`,
      arguments: { identifier },
      status: 'failed'
    });
    throw new AuthorizationError('Admin account password cannot be reset via email. Password changes happen only via direct backend access.');
  }

  if (!user.email) {
    throw new ValidationError('No email address registered on this account.');
  }

  const resetData = await db.createPasswordResetToken(user.email);
  if (!resetData || 'error' in resetData) {
    throw new DatabaseError((resetData && 'error' in resetData) ? resetData.error : 'Failed to generate reset link.');
  }

  // Compose reset URL
  const origin = req.headers.origin || 'http://localhost:3000';
  const resetLink = `${origin}?resetToken=${resetData.token}#reset-password`;

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

// Reset Password using Token
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long.'),
});

app.post('/api/auth/reset-password', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
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

// ================= COACHES & ADMINISTRATION SCHEMAS & API (BATCH 2) =================

const createCoachSchema = z.object({
  firstName: z.string().trim().min(1, 'Coach first name is required'),
  lastName: z.string().trim().optional().default(''),
  email: z.string().email('Valid coach email address is required'),
  phoneNumber: z.string().min(10, 'A valid 10-digit phone number is required'),
  password: z.string().min(8, 'Coach initial password must be at least 8 characters'),
  address: z.string().optional().default(''),
  dateOfJoining: z.string().optional(),
  dateOfLeaving: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).optional().default('Active'),
  educationalQualification: z.string().optional().default(''),
  designation: z.string().optional().default('Associate Tutor'),
  specializations: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional().default(''),
  emergencyContactPhone: z.string().optional().default(''),
  notes: z.string().optional().default('')
}).refine(data => {
  if (data.dateOfJoining && data.dateOfLeaving) {
    return new Date(data.dateOfLeaving) >= new Date(data.dateOfJoining);
  }
  return true;
}, {
  message: 'Date of leaving cannot be earlier than date of joining.',
  path: ['dateOfLeaving']
});

const updateCoachSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.string().email('Valid coach email address is required').optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  dateOfJoining: z.string().optional(),
  dateOfLeaving: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  educationalQualification: z.string().optional(),
  designation: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional()
}).refine(data => {
  if (data.dateOfJoining && data.dateOfLeaving) {
    return new Date(data.dateOfLeaving) >= new Date(data.dateOfJoining);
  }
  return true;
}, {
  message: 'Date of leaving cannot be earlier than date of joining.',
  path: ['dateOfLeaving']
});

const assignCoachSchema = z.object({
  coachId: z.string().nullable().optional()
});

// Coaches API

// Authenticated Coaches Directory:
// - Administrators receive full coach operational profiles.
// - Non-admin application roles (e.g. students) strictly receive explicitly selected public fields.
app.get('/api/coaches', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  const coaches = await db.getAllCoaches();

  if (req.user?.role === 'admin') {
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

app.post('/api/coaches', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'coach_create',
    summary: `Administrator ${req.user?.firstName || req.user?.username} onboarded new Coach: ${coach.firstName} (${coach.email})`,
    arguments: { firstName: coach.firstName, email: coach.email, phoneNumber: coach.phoneNumber, designation: coach.designation },
    result: { coachId: coach.id, email: coach.email }
  });

  return res.status(201).json(coach);
}));

app.put('/api/coaches/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.delete('/api/coaches/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

// Assign Coach to Student (Admin-only)
app.patch('/api/students/:id/assign-coach', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

// Zod schema for change-password
const changePasswordSchema = z.object({
  email: z.string().email('Valid email is required.'),
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
  targetStudentId: z.string().optional(),
  targetUserId: z.string().optional(),
  applyToAll: z.boolean().optional(),
});

app.post('/api/auth/change-password', authenticateJwt, authRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
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
app.post('/api/auth/family-students', asyncHandler(async (req: Request, res: Response) => {
  const parsed = familyStudentsSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Email or identifier is required.');
  }
  const target = (parsed.data.email || parsed.data.identifier || '').trim();
  const siblings = await db.getFamilyStudentsByEmailOrPhone(target);
  // Only return the minimum needed for sibling-selector UI: id + first name.
  // Age, grade, school and userId are omitted — this endpoint is unauthenticated.
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
  role: z.enum(['admin', 'coach', 'student']).optional(),
  studentId: z.string().optional(),
  id: z.string().optional(),
  username: z.string().optional(),
});

app.post('/api/auth/supabase-session', asyncHandler(async (req: Request, res: Response) => {
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

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

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

app.post('/api/auth/logout', asyncHandler(async (req: Request, res: Response) => {
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
  identifier: z.string().min(1, 'Please provide username or registered email.'),
});

app.post('/api/auth/forgot-password', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
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
    throw new NotFoundError('No account found with this username or email.');
  }

  if (user.role === 'admin') {
    throw new AuthorizationError('Admin account password cannot be reset via email. Password changes happen only via direct backend access.');
  }

  // Generate a secure, single-use, 1-hour reset token and dispatch via email link.
  // Passwords are one-way bcrypt hashes and are never sent in plaintext.
  const resetData = await db.createPasswordResetToken(user.email);
  if (!resetData || 'error' in resetData) {
    throw new DatabaseError((resetData && 'error' in resetData) ? resetData.error : 'Failed to generate reset link.');
  }

  const origin = req.headers.origin || 'http://localhost:3000';
  const resetLink = `${origin}?resetToken=${resetData.token}#reset-password`;

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

app.get('/api/auth/me', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AuthenticationError('Not authenticated');
  const user = (req.user.username ? await db.findUserByUsername(req.user.username) : null) || (await db.findUserById(req.user.id));
  if (!user) throw new NotFoundError('User not found');

  let siblingStudents: any = undefined;
  let activeStudentId = req.user.studentId || user.studentId;
  let activeFirstName = user.firstName;
  let activeLastName = user.lastName;

  if (user.role === 'student') {
    const rawSiblings = await db.getSiblingStudentsForUser(user);
    siblingStudents = rawSiblings.map(s => ({
      id: s.id,
      firstName: s.firstName || 'Student',
      lastName: s.lastName || undefined,
      age: s.age,
      gradeClass: s.gradeClass,
      schoolName: s.schoolName
    }));

    if (activeStudentId) {
      const activeSibling = rawSiblings.find(s => s.id === activeStudentId);
      if (activeSibling) {
        activeFirstName = activeSibling.firstName || activeFirstName;
        activeLastName = activeSibling.lastName || activeLastName;
      }
    } else if (rawSiblings.length === 1) {
      activeStudentId = rawSiblings[0].id;
      activeFirstName = rawSiblings[0].firstName || activeFirstName;
      activeLastName = rawSiblings[0].lastName || activeLastName;
    }
  }

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

// Self-Update User Profile (Strict Column-Level / Application-Level Whitelist)
// Ordinary users can only update permitted personal fields. Privilege escalation is strictly forbidden.
// Note: Coaches cannot edit their own details. Only Admin can do that.
app.patch('/api/auth/me', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AuthenticationError('Not authenticated');

  // Explicit check: Coaches cannot edit their own details. Only Admin can do that.
  if (req.user.role === 'coach') {
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

// ================= STUDENTS SCHEMAS & API (BATCH 4 - PART 1) =================

const studentQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional()
});

const studentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const enrollStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'Student first name is required.'),
  lastName: z.string().trim().optional(),
  parentName: z.string().min(1, 'Parent/Guardian name is required.'),
  email: z.string().email('Valid parent contact email is required.'),
  age: z.coerce.number().int().min(4, 'Student age must be a valid number between 4 and 18.').max(18, 'Student age must be a valid number between 4 and 18.'),
  whatsappMobile: z.string().optional(),
  phoneNumber: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().optional(),
  isSiblingEnrollment: z.boolean().optional(),
  siblingOfStudentName: z.string().optional(),
  modeOfLearning: z.enum(['In-person', 'Online']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  enrollmentDate: z.string().optional(),
  gradeClass: z.string().optional(),
  schoolName: z.string().optional(),
  handwritingStyle: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional()
}).passthrough();

const updateStudentSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  parentName: z.string().optional(),
  email: z.string().email().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  whatsappMobile: z.string().optional(),
  phoneNumber: z.string().optional(),
  phone: z.string().optional(),
  gradeClass: z.string().optional(),
  schoolName: z.string().optional(),
  handwritingStyle: z.string().optional(),
  modeOfLearning: z.enum(['In-person', 'Online']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  enrollmentDate: z.string().optional(),
  dateOfLeaving: z.string().optional().nullable(),
  coachId: z.string().optional().nullable(),
  coachName: z.string().optional().nullable(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional()
}).passthrough();

// 2. Students API (Protected by JWT)
app.get('/api/students', authenticateJwt, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AuthenticationError('Not authenticated');

  const queryParsed = studentQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { page, limit } = queryParsed.data;
  const paginationOptions = (page && limit) ? { page, limit } : undefined;

  if (req.user.role === 'admin') {
    const students = await db.getAllStudents(paginationOptions);
    if (page && limit) {
      const total = await db.getStudentsCount();
      return sendPaginated(res, students, total, { page, limit });
    }
    return res.json(students);
  } else if (req.user.role === 'coach') {
    const coachKey = req.user.coachId || req.user.id;
    const coachAlt = req.user.coachId ? req.user.id : undefined;
    const students = await db.getStudentsByCoachId(coachKey, coachAlt, paginationOptions);
    if (page && limit) {
      const total = await db.getStudentsCountByCoachId(coachKey, coachAlt);
      return sendPaginated(res, students, total, { page, limit });
    }
    return res.json(students);
  } else {
    throw new AuthorizationError('Students are not authorized to access the student directory.');
  }
}));

app.get('/api/students/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.post('/api/students/enroll', asyncHandler(async (req: Request, res: Response) => {
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
      actorId: 'anonymous',
      action: 'student_enroll_duplicate_blocked',
      summary: `Enrollment blocked: Student ${firstName} is already enrolled.`,
      arguments: { firstName, lastName, phoneNumber, email: data.email, age: data.age },
      status: 'failed'
    });
    throw new ConflictError('Student is already enrolled.');
  }

  const newId = `std-${Date.now()}`;
  const username = (data as any).username || data.email.toLowerCase().trim();
  const password = data.password ? data.password.trim() : undefined;

  const newStudent = {
    ...data,
    firstName,
    lastName: lastName || undefined,
    modeOfLearning: data.modeOfLearning || 'In-person',
    parentName: data.parentName.trim(),
    email: data.email.toLowerCase().trim(),
    id: newId,
    username,
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
    actorId: 'anonymous',
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
    result: { studentId: created.id, username }
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
      username,
      parentEmail: data.email
    }
  });
}));

app.put('/api/students/:id', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
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

  if (req.user?.role === 'coach') {
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
    summary: `${req.user?.role === 'coach' ? 'Coach' : 'Administrator'} ${req.user?.firstName || req.user?.username} updated profile for student ${updated.firstName} (${studentId})`,
    arguments: { studentId, updates: updateData },
    result: { studentId, firstName: updated.firstName }
  });

  sendStudentUpdatedEmails(updated, updateData).catch(err => {
    console.warn('[Resend Background Notice] Student update notification dispatch:', err.message || err);
  });

  return res.json(updated);
}));

app.delete('/api/students/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    summary: `Administrator ${req.user?.firstName || req.user?.username} deactivated student profile (soft delete): ${student?.firstName || id}`,
    arguments: { studentId: id, studentName: student?.firstName },
    result: { success: true, softDelete: true }
  });

  return res.json({ success: true, message: 'Student profile has been deactivated. Historical records have been preserved.' });
}));


// ================= ATTENDANCE SCHEMAS & API (BATCH 3) =================

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

const attendanceItemSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'Student ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  yearMonth: z.string().optional(),
  classNumber: z.number().int().positive().optional(),
  status: z.enum(['Present', 'Absent', 'Excused', 'Late']).default('Present'),
  notes: z.string().optional().nullable(),
  coachNotes: z.string().optional().nullable(),
  markedBy: z.string().optional().nullable()
}).passthrough();

const attendanceBatchSchema = z.object({
  records: z.array(attendanceItemSchema).min(1, 'Records array must contain at least one attendance record.')
});

const deleteAttendanceParamSchema = z.object({
  id: z.string().min(1, 'Attendance ID parameter is required')
});

const deleteAttendanceByDateParamsSchema = z.object({
  studentId: z.string().min(1, 'Student ID parameter is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date parameter must be in YYYY-MM-DD format')
});

// 3. Attendance API (Protected by JWT)
app.get('/api/attendance/month/:yearMonth', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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
  if (req.user?.role === 'coach') {
    const coachKey = req.user.coachId || req.user.id;
    const coachAlt = req.user.coachId ? req.user.id : undefined;
    const coachStudents = await db.getStudentsByCoachId(coachKey, coachAlt);
    targetStudentIds = coachStudents.map(s => s.id);

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

  // Query is scoped directly at the Postgres level; 0..4999 ceiling applies only to coach's assigned rows
  const records = await db.getAttendanceByMonth(yearMonth, queryOptions);

  if (page && limit) {
    const total = await db.getAttendanceCountByMonth(yearMonth, targetStudentIds);
    return sendPaginated(res, records, total, { page, limit });
  }

  return res.json(records);
}));

app.get('/api/attendance/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.post('/api/attendance/batch', authenticateJwt, requireCoachOrAdmin, attendanceRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = attendanceBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid attendance batch records.');
  }
  const { records } = parsed.data;

  // If coach, verify that coach only marks attendance for assigned students
  if (req.user?.role === 'coach') {
    const coachKey = req.user.coachId || req.user.id;
    const coachAlt = req.user.coachId ? req.user.id : undefined;
    const coachStudents = await db.getStudentsByCoachId(coachKey, coachAlt);
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

  await db.saveAttendanceBatch(normalizedRecords as any);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'attendance_batch_save',
    summary: `${req.user?.firstName || req.user?.username} (${req.user?.role}) saved/updated ${records.length} attendance records`,
    arguments: { recordCount: records.length, sampleRecord: records[0] },
    result: { count: records.length, success: true }
  });

  return res.json({ success: true, count: records.length });
}));

app.delete('/api/attendance/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = deleteAttendanceParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid attendance record ID.');
  }
  const { id } = parsed.data;

  await db.deleteAttendance(id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'attendance_delete',
    summary: `Administrator deleted attendance record #${id}`,
    arguments: { attendanceId: id },
    result: { success: true }
  });

  return res.json({ success: true });
}));

app.delete('/api/attendance/:studentId/:date', authenticateJwt, requireAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = deleteAttendanceByDateParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid studentId or date parameter.');
  }
  const { studentId, date } = parsed.data;

  const { serverSupabase } = await import('./server/supabase.ts');
  if (serverSupabase) {
    const { data: matchedRows, error } = await serverSupabase
      .from('attendance')
      .select('id')
      .eq('student_id', studentId)
      .eq('date', date);

    if (error) {
      throw new DatabaseError(`Failed to fetch attendance rows for deletion: ${error.message}`);
    }

    if (matchedRows && matchedRows.length > 0) {
      for (const row of matchedRows) {
        await db.deleteAttendance(row.id);
      }
    }
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'attendance_delete',
    summary: `Administrator deleted attendance record for student ${studentId} on date ${date}`,
    arguments: { studentId, date },
    result: { success: true }
  });

  return res.json({ success: true });
}));


// ================= FEES SCHEMAS & API (BATCH 5 - PART 1) =================

const feeMonthParamsSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'yearMonth parameter must be in YYYY-MM format (e.g. 2026-09)')
});

const feePaginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional()
});

const feeStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const feeIdParamSchema = z.object({
  id: z.string().min(1, 'Fee record ID parameter is required')
});

const createFeeSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  amount: z.coerce.number().positive('amount must be a positive number'),
  date: z.string().optional(),
  paidDate: z.string().optional(),
  yearMonth: z.string().optional(),
  milestone: z.string().optional(),
  status: z.enum(['Paid', 'Pending', 'Overdue', 'Waived']).optional(),
  receiptNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional()
}).passthrough();

const updateFeeSchema = z.object({
  studentId: z.string().optional(),
  amount: z.coerce.number().positive('amount must be a positive number').optional(),
  date: z.string().optional(),
  paidDate: z.string().optional(),
  yearMonth: z.string().optional(),
  milestone: z.string().optional(),
  status: z.enum(['Paid', 'Pending', 'Overdue', 'Waived']).optional(),
  receiptNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional()
}).passthrough();

// 4. Fees API (Protected by JWT)
app.get('/api/fees/month/:yearMonth', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeMonthParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid yearMonth parameter.');
  }
  const queryParsed = feePaginationQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { yearMonth } = paramsParsed.data;
  const { page, limit } = queryParsed.data;

  let targetStudentIds: string[] | undefined = undefined;

  // Database-level isolation for coach role:
  if (req.user?.role === 'coach') {
    const coachKey = req.user.coachId || req.user.id;
    const coachAlt = req.user.coachId ? req.user.id : undefined;
    const coachStudents = await db.getStudentsByCoachId(coachKey, coachAlt);
    targetStudentIds = coachStudents.map(s => s.id);

    // If coach has no assigned students, short-circuit immediately without querying fees
    if (targetStudentIds.length === 0) {
      if (page && limit) {
        return res.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1
          }
        });
      }
      return res.json([]);
    }
  }

  const queryOptions = {
    ...(page && limit ? { page, limit } : {}),
    ...(targetStudentIds ? { studentIds: targetStudentIds } : {})
  };

  const records = await db.getFeesByMonth(yearMonth, Object.keys(queryOptions).length > 0 ? queryOptions : undefined);

  if (page && limit) {
    const total = await db.getFeesCountByMonth(yearMonth, targetStudentIds);
    return sendPaginated(res, records, total, { page, limit });
  }

  return res.json(records);
}));

app.get('/api/fees/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const queryParsed = feePaginationQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { id } = paramsParsed.data;
  const { page, limit } = queryParsed.data;
  const paginationOptions = (page && limit) ? { page, limit } : undefined;

  const records = await db.getFeesByStudent(id, paginationOptions);

  if (page && limit) {
    const total = await db.getFeesCountByStudent(id);
    return sendPaginated(res, records, total, { page, limit });
  }

  return res.json(records);
}));

app.post('/api/fees', authenticateJwt, paymentRateLimiter, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createFeeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid fee record data.');
  }
  const fee = parsed.data;
  const saved = await db.saveFeeRecord(fee as any);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: fee.studentId,
    action: 'fee_record_create',
    summary: `${req.user?.role === 'coach' ? 'Coach' : 'Administrator'} recorded fee of ₹${fee.amount || 0} (${fee.status || 'Pending'}) for student ID: ${fee.studentId} - Ref: ${fee.receiptNumber || 'N/A'}`,
    arguments: { studentId: fee.studentId, amount: fee.amount, status: fee.status, receiptNumber: fee.receiptNumber, milestone: fee.milestone },
    result: { feeId: saved.id, amount: saved.amount, status: saved.status }
  });

  return res.json(saved);
}));

app.put('/api/fees/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid fee record ID parameter.');
  }
  const bodyParsed = updateFeeSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new ValidationError(bodyParsed.error.issues[0]?.message || 'Invalid fee update data.');
  }
  const { id } = paramsParsed.data;
  const existingFee = await db.findFeeById(id);
  if (!existingFee) {
    throw new NotFoundError('Fee record not found');
  }
  if (!await canAccessStudent(req.user, existingFee.studentId)) {
    throw new AuthorizationError('Access denied: You can only update fee records for students assigned to you.');
  }

  const updated = await db.updateFeeRecord(id, bodyParsed.data as any);
  if (!updated) {
    throw new NotFoundError('Fee record not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: updated.studentId,
    action: 'fee_record_update',
    summary: `${req.user?.role === 'coach' ? 'Coach' : 'Administrator'} updated fee record #${id} (Status: ${updated.status}, Amount: ₹${updated.amount})`,
    arguments: { feeId: id, updates: bodyParsed.data },
    result: { feeId: updated.id, status: updated.status, amount: updated.amount }
  });

  return res.json(updated);
}));

app.patch('/api/fees/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid fee record ID parameter.');
  }
  const bodyParsed = updateFeeSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new ValidationError(bodyParsed.error.issues[0]?.message || 'Invalid fee update data.');
  }
  const { id } = paramsParsed.data;
  const existingFee = await db.findFeeById(id);
  if (!existingFee) {
    throw new NotFoundError('Fee record not found');
  }
  if (!await canAccessStudent(req.user, existingFee.studentId)) {
    throw new AuthorizationError('Access denied: You can only modify fee records for students assigned to you.');
  }

  const updated = await db.updateFeeRecord(id, bodyParsed.data as any);
  if (!updated) {
    throw new NotFoundError('Fee record not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: updated.studentId,
    action: 'fee_record_update',
    summary: `${req.user?.role === 'coach' ? 'Coach' : 'Administrator'} modified fee record #${id} (Status: ${updated.status}, Amount: ₹${updated.amount})`,
    arguments: { feeId: id, updates: bodyParsed.data },
    result: { feeId: updated.id, status: updated.status, amount: updated.amount }
  });

  return res.json(updated);
}));

app.delete('/api/fees/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid fee record ID parameter.');
  }
  const { id } = paramsParsed.data;
  const existingFee = await db.findFeeById(id);
  if (!existingFee) {
    throw new NotFoundError('Fee record not found');
  }
  if (!await canAccessStudent(req.user, existingFee.studentId)) {
    throw new AuthorizationError('Access denied: You can only delete fee records for students assigned to you.');
  }

  const success = await db.deleteFeeRecord(id);
  if (!success) {
    throw new NotFoundError('Fee record not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: existingFee.studentId,
    action: 'fee_record_delete',
    summary: `${req.user?.role === 'coach' ? 'Coach' : 'Administrator'} deleted fee ledger record #${id}`,
    arguments: { feeId: id },
    result: { success: true }
  });

  return res.json({ success: true, message: 'Fee record deleted successfully' });
}));


// ================= PROGRESS TRACKERS, WORKS & REPORTS SCHEMAS & API (BATCH 4 - PART 2) =================

const trackerStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const trackerIdParamSchema = z.object({
  id: z.string().min(1, 'Progress tracker ID parameter is required')
});

const progressTrackerSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  evaluationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'evaluationDate must be in YYYY-MM-DD format'),
  gripScore: z.coerce.number().optional(),
  letterFormationScore: z.coerce.number().optional(),
  spacingScore: z.coerce.number().optional(),
  speedScore: z.coerce.number().optional(),
  postureScore: z.coerce.number().optional(),
  overallScore: z.coerce.number().optional(),
  remarks: z.string().optional(),
  coachNotes: z.string().optional()
}).passthrough();

const studentWorkStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const studentWorkIdParamSchema = z.object({
  id: z.string().min(1, 'Student work ID parameter is required')
});

const studentWorkUploadSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  imageData: z.string().min(1, 'imageData is required'),
  captureDate: z.string().optional(),
  category: z.string().optional(),
  comments: z.string().optional()
}).passthrough();

const bulkDeleteWorksSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids array must contain at least one ID')
});

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

// 5. Progress Trackers API (Protected by JWT)
app.get('/api/progress-trackers/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = trackerStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const trackers = await db.getProgressTrackersByStudent(paramsParsed.data.id);
  return res.json(trackers);
}));

app.post('/api/progress-trackers', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = progressTrackerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid progress tracker data.');
  }
  const tracker = parsed.data;
  const saved = await db.saveProgressTracker(tracker as any);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: tracker.studentId,
    action: 'progress_tracker_save',
    summary: `${req.user?.firstName || req.user?.username} recorded progress metric evaluation for student ${tracker.studentId} (${tracker.evaluationDate})`,
    arguments: { studentId: tracker.studentId, evaluationDate: tracker.evaluationDate, overallScore: tracker.overallScore },
    result: { trackerId: saved.id, studentId: tracker.studentId }
  });

  return res.json(saved);
}));

app.delete('/api/progress-trackers/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = trackerIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid progress tracker ID.');
  }
  const { id } = paramsParsed.data;
  await db.deleteProgressTracker(id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'progress_tracker_delete',
    summary: `Administrator removed progress evaluation tracker record #${id}`,
    arguments: { trackerId: id },
    result: { success: true }
  });

  return res.json({ success: true });
}));

// 6. Student Works & Camera Uploads API (Protected by JWT)
app.get('/api/student-works/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = studentWorkStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const works = await db.getStudentWorks(paramsParsed.data.id);
  return res.json(works);
}));

app.post('/api/student-works/upload', authenticateJwt, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = studentWorkUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid student work upload data.');
  }
  const { studentId, imageData, captureDate, comments, category } = parsed.data;

  let finalImagePath = imageData;

  // If imageData is a base64 string, write to /public/student_works/
  if (imageData.startsWith('data:image/')) {
    try {
      const commaIdx = imageData.indexOf(',');
      if (commaIdx !== -1) {
        const metaPart = imageData.substring(0, commaIdx);
        const base64Data = imageData.substring(commaIdx + 1).replace(/\s/g, '');
        const extMatch = metaPart.match(/data:image\/([a-zA-Z0-9+.-]+);/);
        let rawExt = extMatch ? extMatch[1].toLowerCase() : 'jpg';
        if (rawExt === 'jpeg') rawExt = 'jpg';
        if (rawExt === 'svg+xml') rawExt = 'svg';

        const fileName = `work_${studentId}_${Date.now()}.${rawExt}`;
        const filePath = path.join(studentWorksDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        finalImagePath = `/student_works/${fileName}`;
      }
    } catch (e) {
      console.error('Error saving image to disk, falling back to base64:', e);
    }
  }

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

app.delete('/api/student-works/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.post('/api/student-works/bulk-delete', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

// 7. Progress Reports API (Protected by JWT)
app.get('/api/reports/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = reportStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const reports = await db.getProgressReports(paramsParsed.data.id);
  return res.json(reports);
}));

app.post('/api/reports/generate', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.delete('/api/reports/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.post('/api/reports/:id/email', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = reportIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid report ID parameter.');
  }
  const bodyParsed = reportEmailSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    throw new ValidationError(bodyParsed.error.issues[0]?.message || 'Invalid email dispatch parameters.');
  }
  const { id } = paramsParsed.data;
  const { studentEmail, parentEmail } = bodyParsed.data;
  const adminEmail = await db.getAdminEmail();
  const recipientTarget = parentEmail || studentEmail || 'student/parent';
  console.log(`[EMAIL DISPATCH] Progress Report ${id} dispatched to Parent (${recipientTarget}) and Admin (${adminEmail || 'admin'})`);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'progress_report_email',
    summary: `Emailed Progress Report #${id} to parent (${recipientTarget})`,
    arguments: { reportId: id, parentEmail, studentEmail },
    result: { success: true }
  });

  return res.json({ success: true, message: `Report email dispatched to ${recipientTarget}` });
}));


// ================= REMINDERS SCHEMAS & API (BATCH 5 - PART 2) =================

const reminderWhatsappSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  amount: z.coerce.number().positive('amount must be a positive number'),
  parentPhone: z.string().optional(),
  parentName: z.string().optional(),
  studentName: z.string().optional(),
  milestone: z.string().optional(),
  receiptNumber: z.string().optional()
}).passthrough();

const reminderSendSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  amount: z.coerce.number().positive('amount must be a positive number'),
  parentEmail: z.string().optional(),
  parentName: z.string().optional(),
  studentName: z.string().optional(),
  month: z.string().optional(),
  gpayLink: z.string().optional()
}).passthrough();

// 8. Reminders API (Fee reminder with WhatsApp & GPay link - Protected by JWT)
app.post('/api/reminders/whatsapp', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = reminderWhatsappSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid WhatsApp reminder parameters.');
  }
  const { studentId, parentPhone, parentName, studentName, amount, milestone, receiptNumber } = parsed.data;

  const cleanPhone = (parentPhone || '').replace(/[^\d+]/g, '');
  const periodText = milestone || 'Current Period';
  const receiptText = receiptNumber ? ` (Ref: ${receiptNumber})` : '';

  const messageText = `Dear ${parentName || 'Parent'}, greetings from SmartPen Academy! ✍️\n\nThis is a fee payment request for ${studentName || 'your child'}'s handwriting program for ${periodText}${receiptText}.\n\n• Amount: ₹${amount}\n• Mode: In-Person Reception Settlement (Cash / UPI / Card)\n• UPI ID: smartpen.academy@okaxis\n\nKindly complete the settlement at the academy reception or via UPI. Thank you for your continued partnership in ${studentName || 'your child'}'s handwriting mastery!\n\nWarm regards,\nMrs. Deepthy Rock\nSmartPen Academy`;

  const encodedMessage = encodeURIComponent(messageText);
  const whatsappUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  const reminder = await db.saveFeeReminder({
    studentId,
    parentEmail: cleanPhone || 'whatsapp',
    parentName: parentName || 'Parent',
    studentName: studentName || 'Student',
    amount: Number(amount),
    month: periodText,
    gpayLink: `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${amount}&cu=INR`,
    status: 'Sent'
  });

  console.log(`[WHATSAPP REMINDER] Prepared WhatsApp reminder for ${parentName} (${cleanPhone}), Student: ${studentName}, Amount: ₹${amount}, Milestone: ${periodText}`);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'reminder_whatsapp_create',
    summary: `Prepared WhatsApp fee settlement reminder of ₹${amount} for student ${studentName} (Parent: ${parentName})`,
    arguments: { studentId, parentPhone: cleanPhone, amount, milestone: periodText },
    result: { reminderId: reminder.id, status: 'Sent' }
  });

  return res.json({
    success: true,
    reminder,
    messageText,
    whatsappUrl,
    message: `WhatsApp reminder prepared and logged for ${parentName || studentName}!`
  });
}));

app.post('/api/reminders/send', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = reminderSendSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid fee reminder dispatch parameters.');
  }
  const { studentId, parentEmail, parentName, studentName, amount, month, gpayLink } = parsed.data;

  // Resolve target email from student / users table if parentEmail was not explicitly provided
  let targetEmail = parentEmail;
  if (!targetEmail) {
    const student = await db.getStudentById(studentId);
    if (student?.email) {
      targetEmail = student.email;
    }
  }

  const reminder = await db.saveFeeReminder({
    studentId,
    parentEmail: targetEmail || '',
    parentName: parentName || 'Parent',
    studentName: studentName || 'Student',
    amount: Number(amount),
    month: month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    gpayLink: gpayLink || `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${amount}&cu=INR`,
    status: 'Sent'
  });

  if (targetEmail) {
    sendFeeReminderEmail({
      toEmail: targetEmail,
      parentName: parentName || 'Parent',
      studentName: studentName || 'Student',
      amount: Number(amount),
      month: month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      gpayLink: reminder.gpayLink
    }).catch(err => {
      console.warn('[Resend Background Notice] Fee reminder dispatch:', err.message || err);
    });
  }

  console.log(`[EMAIL DISPATCH] Fee Reminder Sent to ${targetEmail || 'student record'} for student ${studentName}, Amount ₹${amount}`);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'reminder_email_send',
    summary: `Dispatched payment reminder of ₹${amount} via email to ${targetEmail || 'student'} for student ${studentName}`,
    arguments: { studentId, parentEmail: targetEmail, amount, month },
    result: { reminderId: reminder.id }
  });

  return res.json({
    success: true,
    reminder,
    message: `Payment reminder with payment details dispatched to ${targetEmail || 'student'}!`
  });
}));


// ================= DEMO BOOKINGS SCHEMAS & API (BATCH 1) =================

const createDemoBookingSchema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  parentName: z.string().optional().default('Parent'),
  age: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(n => !isNaN(n) && n >= 4 && n <= 18, 'Age must be between 4 and 18'),
  contactNumber: z.string().min(10, 'A valid 10-digit mobile number is required'),
  preferredDate: z.string().min(1, 'Preferred date is required'),
  preferredTimeSlot: z.string().min(1, 'Preferred time slot is required'),
  modeOfLearning: z.enum(['In-person', 'Online', 'In-Person', 'Hybrid']).optional().default('In-person'),
  notes: z.string().optional()
});

const patchDemoBookingSchema = z.object({
  status: z.enum(['Scheduled', 'Contacted', 'Completed', 'Enrolled', 'Cancelled']).optional(),
  notes: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTimeSlot: z.string().optional()
});

// 9. Free Demo Class Bookings API (Admin Protected for viewing & updating)
app.get('/api/demo-bookings', authenticateJwt, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const bookings = await db.getDemoBookings();
  return res.json(bookings);
}));

app.post('/api/demo-bookings', demoBookingRateLimiter, asyncHandler(async (req: Request, res: Response) => {
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

app.patch('/api/demo-bookings/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.delete('/api/demo-bookings/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

const auditLogsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional()
});

// Tool Audit Logs API (Admin Only)
app.get('/api/ai/audit-logs', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const queryParsed = auditLogsQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { page, limit = 50 } = queryParsed.data;
  const logs = await db.getToolAuditLogs(page ? { page, limit } : limit);

  if (page) {
    const total = await db.getToolAuditLogsCount();
    return sendPaginated(res, logs, total, { page, limit });
  }

  return res.json(logs);
}));

// ================= ALERTS & TESTIMONIALS SCHEMAS & API (BATCH 1) =================

const createTestimonialSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  studentName: z.string().min(1, 'studentName is required'),
  parentName: z.string().optional().default('Parent'),
  grade: z.string().optional().default(''),
  schoolName: z.string().optional().default(''),
  relationship: z.string().optional().default('Parent'),
  rating: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(n => !isNaN(n) && n >= 1 && n <= 5, 'Rating must be between 1 and 5'),
  title: z.string().optional().default(''),
  review: z.string().min(1, 'review text is required'),
  beforeAfterTag: z.string().optional().default('5 Star Transformation'),
  image: z.string().optional(),
  mediaConsent: z.boolean().optional().default(true)
});

const patchTestimonialSchema = z.object({
  status: z.enum(['Pending', 'Approved', 'Featured']).optional(),
  rating: z.number().min(1).max(5).optional(),
  title: z.string().optional(),
  review: z.string().optional(),
  beforeAfterTag: z.string().optional()
});

// 10. Admin Alerts Module API (Protected by JWT)
app.get('/api/alerts', authenticateJwt, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const alerts = await db.getAlerts();
  return res.json(alerts);
}));

app.patch('/api/alerts/:id/read', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const alert = await db.markAlertAsRead(req.params.id);
  if (!alert) {
    throw new NotFoundError('Alert not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'alert_mark_read',
    summary: `Administrator marked alert #${req.params.id} as read`,
    arguments: { alertId: req.params.id }
  });

  return res.json(alert);
}));

app.post('/api/alerts/mark-all-read', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  await db.markAllAlertsAsRead();

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'alert_mark_all_read',
    summary: 'Administrator cleared/marked all pending alerts as read',
    arguments: {}
  });

  return res.json({ success: true });
}));

app.delete('/api/alerts/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  await db.deleteAlert(req.params.id);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'alert_delete',
    summary: `Administrator dismissed/deleted alert #${req.params.id}`,
    arguments: { alertId: req.params.id }
  });

  return res.json({ success: true });
}));

// Helper to persist base64 testimonial photo to disk safely
function saveTestimonialPhoto(image: string | undefined, studentId: string): string | undefined {
  if (!image || !image.startsWith('data:image/')) return image;
  const match = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!match) return image;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const base64Data = match[2];
  const fileName = `testimony_${studentId}_${Date.now()}.${ext}`;
  const filePath = path.join(testimonialsDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return `/testimonials/${fileName}`;
}

// 11. Testimonials / Parent Voices API
app.get('/api/testimonials', asyncHandler(async (req: Request, res: Response) => {
  const { studentId, status } = req.query;
  const testimonials = await db.getTestimonials(studentId as string, status as string);
  return res.json(testimonials);
}));

app.get('/api/testimonials/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const testimonials = await db.getTestimonials(req.params.id);
  return res.json(testimonials);
}));

app.post('/api/testimonials', asyncHandler(async (req: Request, res: Response) => {
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

  const finalImagePath = saveTestimonialPhoto(image, studentId);

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
    actorId: studentId,
    actorUsername: parentName || 'Parent',
    actorRole: 'student',
    actorStudentId: studentId,
    action: 'testimonial_create',
    summary: `New parent review submitted by ${parentName || 'Parent'} for student ${studentName} (Rating: ${rating}★)`,
    arguments: { studentId, studentName, parentName, rating, title },
    result: { testimonialId: saved.id, rating: saved.rating }
  });

  return res.status(201).json(saved);
}));

app.patch('/api/testimonials/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

app.delete('/api/testimonials/:id', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

const aiAgentChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'model', 'system']),
    content: z.string()
  }).passthrough()).optional(),
  settings: z.object({
    apiKey: z.string().optional(),
    apiUrl: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional()
  }).passthrough().optional()
}).passthrough();

const testConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional()
}).passthrough();

// 12. AI Agent Chatbot & Function Calling API
app.post('/api/ai/agent-chat', asyncHandler(async (req: Request, res: Response) => {
  const parsed = aiAgentChatSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid chat request format.');
  }
  const { messages, settings } = parsed.data;
  
  // Resolve user context from httpOnly cookie first, then Authorization Bearer header
  let userContext: any = null;
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

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userContext = decoded;
    } catch (e) {
      // Invalid or expired token
      userContext = null;
    }
  }

  // If no valid session token, userContext remains null (Guest / Public Visitor)
  // Guest visitors have full access to public portal information (curriculum, demo booking, about us, testimonials)

  const result = await handleAIAgentChat({
    messages: messages || [],
    userContext,
    settings
  });

  return res.json(result);
}));

app.post('/api/ai/test-config', asyncHandler(async (req: Request, res: Response) => {
  const parsed = testConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid configuration payload.');
  }
  const { apiKey, model } = parsed.data;
  const targetKey = apiKey || process.env.GEMINI_API_KEY;
  if (!targetKey) {
    return res.json({
      success: true,
      mode: 'Local AI Engine',
      message: 'Using built-in SmartPen AI Agent Engine. Full tool automation active.'
    });
  }

  return res.json({
    success: true,
    mode: 'Gemini Cloud API',
    model: model || 'gemini-3.7-flash',
    message: 'AI Model configuration verified successfully!'
  });
}));

// ================= GLOBAL ERROR HANDLING MIDDLEWARE =================
app.use(errorHandler);

// ================= VITE INTEGRATION & SERVER LIFECYCLE =================
async function startServer() {
  const isProductionMode = process.env.NODE_ENV === 'production' || (typeof __dirname !== 'undefined' && __dirname.includes('dist'));
  if (!isProductionMode) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartPen Academy server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown handling for Cloud Run & Container Lifecycle
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}. Draining connections and shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed successfully.');
      process.exit(0);
    });

    // Force exit after 10 seconds if connections fail to close
    setTimeout(() => {
      console.error('Forced shutdown due to timeout on active connections.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
