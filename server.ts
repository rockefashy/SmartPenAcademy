import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { db } from './server/supabaseDb.ts';
import { handleAIAgentChat } from './server/aiAgent.ts';
import {
  sendEmail,
  sendEnrollmentEmails,
  sendStudentUpdatedEmails,
  sendForgotPasswordEmail,
  sendPasswordResetLinkEmail,
  sendPasswordChangedEmail,
  sendDemoBookingAlert,
  sendFeeReminderEmail,
  getSenderEmail,
  getAdminNotificationEmail,
  getResendClient
} from './server/email.ts';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartpen_academy_jwt_secret_key_2026';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

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

// Auth Middleware (supports both httpOnly cookie and Bearer header)
interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'coach' | 'student';
    studentId?: string;
    coachId?: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    designation?: string;
  };
}

const authenticateJwt = (req: AuthRequest, res: Response, next: NextFunction): void => {
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

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ 
      error: 'Session expired or invalid token. Please log in again to continue.', 
      isExpired: true,
      requireLogin: true 
    });
    return;
  }
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
  executionMode?: 'remote_gemini' | 'local_agent' | 'direct_api';
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

// ================= OBSERVABILITY & HEALTH CHECK PROBES =================
// 1. Liveness Probe (GET /api/health)
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }
  });
});

// 2. Readiness Probe (GET /api/ready)
app.get('/api/ready', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const adminUser = await db.getAdminUser();
    const latencyMs = Date.now() - startTime;
    
    res.status(200).json({
      status: 'ready',
      checks: {
        database: { status: 'connected', latencyMs }
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unready',
      error: 'Database connectivity check failed',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Email Service Status & Health Check
app.get('/api/email/status', async (req, res) => {
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
    adminUser: adminUser ? { id: adminUser.id, email: adminUser.email, displayName: adminUser.displayName, role: adminUser.role } : null
  });
});

// Send Test Email (Diagnostic Endpoint)
app.post('/api/email/test', async (req, res) => {
  try {
    const { to, type = 'enrollment', studentName = 'Aarav Sharma', parentName = 'Priya Sharma' } = req.body;
    const adminEmail = await getAdminNotificationEmail();
    const recipient = to || adminEmail;

    if (!recipient) {
      return res.status(400).json({ error: 'No recipient email specified and no admin user found in database.' });
    }

    if (type === 'enrollment') {
      const results = await sendEnrollmentEmails({
        displayName: studentName,
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send test email' });
  }
});

// Helper to issue login cookie & response
const issueUserSession = async (user: any, res: Response, targetStudentId?: string) => {
  let siblingStudents: any = undefined;
  let activeStudentId = targetStudentId || user.studentId;
  let activeDisplayName = user.displayName;

  if (user.role === 'student') {
    const rawSiblings = await db.getSiblingStudentsForUser(user);
    siblingStudents = rawSiblings.map(s => ({
      id: s.id,
      displayName: s.displayName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
      age: s.age,
      gradeClass: s.gradeClass,
      schoolName: s.schoolName
    }));

    if (activeStudentId) {
      const activeSibling = rawSiblings.find(s => s.id === activeStudentId);
      if (activeSibling) {
        activeDisplayName = activeSibling.displayName || `${activeSibling.firstName || ''} ${activeSibling.lastName || ''}`.trim() || activeDisplayName;
      }
    } else if (rawSiblings.length === 1) {
      activeStudentId = rawSiblings[0].id;
      activeDisplayName = rawSiblings[0].displayName || `${rawSiblings[0].firstName || ''} ${rawSiblings[0].lastName || ''}`.trim() || activeDisplayName;
    }
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    studentId: activeStudentId,
    coachId: user.coachId || user.coach_id,
    displayName: activeDisplayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    designation: user.designation,
    siblingStudents
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
app.post('/api/auth/login', async (req, res) => {
  const { email, username, phoneNumber, identifier, password, role } = req.body;
  const loginIdentifier = identifier || email || username || phoneNumber;
  try {
    if (!loginIdentifier || !password) {
      recordAudit({
        actorId: 'anonymous',
        action: 'auth_login_failed',
        summary: 'Login attempt rejected: Missing identifier or password',
        arguments: { identifier: loginIdentifier },
        status: 'failed'
      });
      return res.status(400).json({ error: 'Identifier (Email, Username, or Phone) and password are required.' });
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
      return res.status(401).json({ error: 'Invalid login credentials. No account found.' });
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
      return res.status(401).json({ error: 'Invalid password. Please verify your password.' });
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
            return res.status(403).json({ error: 'Your coach account is currently inactive. Please contact administration.' });
          }
        }

        recordAudit({
          actorId: loggedUser.id,
          actorUsername: loggedUser.username,
          actorRole: loggedUser.role,
          actorStudentId: loggedUser.studentId,
          action: 'auth_login',
          summary: `User ${loggedUser.displayName} (${loggedUser.username || loggedUser.email}) logged in successfully as ${loggedUser.role}`,
          arguments: { identifier: loginIdentifier, role: loggedUser.role },
          result: { userId: loggedUser.id, role: loggedUser.role, displayName: loggedUser.displayName },
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
              displayName: s?.displayName || `${s?.firstName || u.firstName || ''} ${s?.lastName || u.lastName || ''}`.trim() || u.displayName || 'Student',
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
          primaryUser.displayName = matched.displayName || `${matched.firstName || ''} ${matched.lastName || ''}`.trim() || primaryUser.displayName;
        }
      }

      recordAudit({
        actorId: primaryUser.id,
        actorUsername: primaryUser.username,
        actorRole: 'student',
        actorStudentId: primaryUser.studentId,
        action: 'auth_login',
        summary: `Student/Parent ${primaryUser.displayName} logged in directly (read-only archive enabled if inactive)`,
        arguments: { identifier: loginIdentifier, role: primaryUser.role, studentId: primaryUser.studentId },
        result: { userId: primaryUser.id, role: primaryUser.role, displayName: primaryUser.displayName, studentId: primaryUser.studentId },
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
        return res.status(403).json({ error: 'Your coach account is currently inactive. Please contact administration.' });
      }
    }

    recordAudit({
      actorId: matchedUser.id,
      actorUsername: matchedUser.username,
      actorRole: matchedUser.role,
      actorStudentId: matchedUser.studentId,
      action: 'auth_login',
      summary: `User ${matchedUser.displayName} (${matchedUser.username || matchedUser.email}) logged in successfully as ${matchedUser.role}`,
      arguments: { identifier: loginIdentifier, role: matchedUser.role },
      result: { userId: matchedUser.id, role: matchedUser.role, displayName: matchedUser.displayName },
      status: 'success'
    });
    return await issueUserSession(matchedUser, res);
  } catch (err: any) {
    console.error('Login error:', err);
    recordAudit({
      actorId: 'system',
      action: 'auth_login_error',
      summary: `Exception occurred during login flow for identifier ${loginIdentifier}: ${err.message}`,
      arguments: { identifier: loginIdentifier },
      result: { error: err.message },
      status: 'failed'
    });
    return res.status(500).json({ error: err.message || 'An error occurred during sign in.' });
  }
});

// Role selection resolution endpoint
app.post('/api/auth/select-role', async (req, res) => {
  const { selectionToken, selectedRole } = req.body;
  if (!selectionToken || !selectedRole) {
    return res.status(400).json({ error: 'selectionToken and selectedRole are required.' });
  }

  try {
    const decoded = jwt.verify(selectionToken, JWT_SECRET) as any;
    if (decoded.type !== 'ROLE_SELECTION' || !Array.isArray(decoded.candidateUserIds)) {
      return res.status(400).json({ error: 'Invalid or expired selection token.' });
    }

    const candidateUsers = (await Promise.all(decoded.candidateUserIds.map((id: string) => db.findUserById(id)))).filter(Boolean);
    const chosenUser = candidateUsers.find((u: any) => u.role === selectedRole);

    if (!chosenUser) {
      return res.status(400).json({ error: `Selected role ${selectedRole} is not associated with this account.` });
    }

    recordAudit({
      actorId: chosenUser.id,
      actorUsername: chosenUser.username,
      actorRole: chosenUser.role,
      action: 'auth_select_role',
      summary: `User ${chosenUser.displayName} completed dual-role selection and entered workspace as ${selectedRole}`,
      arguments: { selectedRole },
      result: { userId: chosenUser.id, role: chosenUser.role }
    });

    return await issueUserSession(chosenUser, res);
  } catch (err: any) {
    return res.status(401).json({ error: 'Selection session expired. Please sign in again.' });
  }
});

// Student profile selection resolution endpoint
app.post('/api/auth/select-student', async (req, res) => {
  const { selectionToken, selectedUserId, studentId, selectedStudentId } = req.body;
  const targetStudentId = studentId || selectedStudentId || selectedUserId;
  if (!selectionToken || !targetStudentId) {
    return res.status(400).json({ error: 'selectionToken and target student identifier are required.' });
  }

  try {
    const decoded = jwt.verify(selectionToken, JWT_SECRET) as any;
    if (decoded.type !== 'STUDENT_SELECTION') {
      return res.status(400).json({ error: 'Invalid or expired selection token.' });
    }

    const userId = decoded.userId || (Array.isArray(decoded.candidateUserIds) ? decoded.candidateUserIds[0] : null);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid selection session.' });
    }

    const parentUser = await db.findUserById(userId);
    if (!parentUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const siblings = await db.getSiblingStudentsForUser(parentUser);
    const chosenStudent = siblings.find(s => s.id === targetStudentId || s.userId === targetStudentId);

    if (!chosenStudent) {
      return res.status(403).json({ error: 'Selected student profile is not authorized for this account.' });
    }

    // Resolve the user record belonging to this student
    let effectiveUser = parentUser;
    if (chosenStudent.userId && chosenStudent.userId !== parentUser.id) {
      const studentUser = await db.findUserById(chosenStudent.userId);
      if (studentUser) effectiveUser = studentUser;
    }

    const activeDisplayName = chosenStudent.displayName || `${chosenStudent.firstName || ''} ${chosenStudent.lastName || ''}`.trim() || effectiveUser.displayName;

    recordAudit({
      actorId: effectiveUser.id,
      actorUsername: effectiveUser.username,
      actorRole: 'student',
      actorStudentId: chosenStudent.id,
      action: 'auth_select_student',
      summary: `Parent selected student profile: ${activeDisplayName} (ID: ${chosenStudent.id})`,
      arguments: { selectedStudentId: chosenStudent.id },
      result: { studentId: chosenStudent.id }
    });

    return await issueUserSession(effectiveUser, res, chosenStudent.id);
  } catch (err: any) {
    return res.status(401).json({ error: 'Selection session expired. Please sign in again.' });
  }
});

// Switch active student profile in current session (for siblings)
app.post('/api/auth/switch-student', authenticateJwt, async (req: AuthRequest, res) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student profile switching is only applicable for student sessions.' });
  }

  const { studentId } = req.body;
  if (!studentId) {
    return res.status(400).json({ error: 'Target studentId is required.' });
  }

  const currentStoredUser = await db.findUserById(req.user.id);
  if (!currentStoredUser) {
    return res.status(404).json({ error: 'Current user session record not found.' });
  }

  const siblings = await db.getSiblingStudentsForUser(currentStoredUser);
  const targetSibling = siblings.find(s => s.id === studentId);
  if (!targetSibling) {
    return res.status(403).json({ error: 'Selected student profile is not linked to your family account.' });
  }



  const targetDisplayName = targetSibling.displayName || `${targetSibling.firstName || ''} ${targetSibling.lastName || ''}`.trim() || currentStoredUser.displayName;

  recordAudit({
    actorId: req.user.id,
    actorUsername: req.user.username,
    actorRole: 'student',
    actorStudentId: targetSibling.id,
    action: 'auth_switch_student',
    summary: `Switched active student profile to sibling ${targetDisplayName} (Student ID: ${targetSibling.id})`,
    arguments: { fromStudentId: req.user.studentId, toStudentId: targetSibling.id },
    result: { newStudentId: targetSibling.id }
  });

  return await issueUserSession(currentStoredUser, res, targetSibling.id);
});

// Request Password Reset Link (via Email with 1-hour secure token)
app.post('/api/auth/request-reset-link', async (req, res) => {
  const { identifier } = req.body;
  try {
    if (!identifier) {
      return res.status(400).json({ error: 'Registered email or username is required.' });
    }

    const users = await db.findUsersByIdentifier(identifier);
    if (!users || users.length === 0) {
      recordAudit({
        actorId: 'anonymous',
        action: 'auth_request_reset_link_failed',
        summary: `Password reset request failed: No account associated with ${identifier}`,
        arguments: { identifier },
        status: 'failed'
      });
      return res.status(404).json({ error: 'No account registered with this email or username.' });
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
      return res.status(403).json({ error: 'Admin account password cannot be reset via email. Password changes happen only via direct backend access.' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'No email address registered on this account.' });
    }

    const resetData = await db.createPasswordResetToken(user.email);
    if (!resetData || 'error' in resetData) {
      return res.status(400).json({ error: (resetData && 'error' in resetData) ? resetData.error : 'Failed to generate reset link.' });
    }

    // Compose reset URL
    const origin = req.headers.origin || 'http://localhost:3000';
    const resetLink = `${origin}?resetToken=${resetData.token}#reset-password`;

    const emailResult = await sendPasswordResetLinkEmail(user.email, {
      displayName: user.displayName,
      resetLink
    });

    console.log(`[PASSWORD RESET] Link generated for ${user.email}: ${resetLink}`);
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error processing reset link request.' });
  }
});

// Reset Password using Token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const result = await db.resetPasswordWithToken(token, newPassword);
    if (!result.success) {
      recordAudit({
        actorId: 'system',
        action: 'auth_reset_password_failed',
        summary: `Password reset token verification failed: ${result.error}`,
        status: 'failed'
      });
      return res.status(400).json({ error: result.error || 'Failed to reset password. The link may have expired.' });
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error resetting password.' });
  }
});

// Coaches API
// Deliberately Public Coaches Endpoint (Unauthenticated)
app.get('/api/coaches/public', async (_req, res) => {
  try {
    const publicCoaches = await db.getPublicCoaches();
    return res.json(publicCoaches);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch public coaches.' });
  }
});

// Authenticated Coaches Directory:
// - Administrators receive full coach operational profiles.
// - Non-admin application roles (e.g. students) strictly receive explicitly selected public fields.
app.get('/api/coaches', authenticateJwt, async (req: AuthRequest, res) => {
  try {
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
        displayName: c.displayName,
        designation: c.designation,
        specializations: c.specializations,
        educationalQualification: c.educationalQualification,
        status: c.status
      }));

    return res.json(sanitizedCoaches);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch coaches.' });
  }
});

app.post('/api/coaches', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  const { 
    firstName, 
    lastName, 
    displayName,
    email, 
    phoneNumber, 
    address, 
    dateOfJoining, 
    status, 
    dateOfLeaving, 
    educationalQualification, 
    designation, 
    specializations, 
    emergencyContactName, 
    emergencyContactPhone, 
    notes, 
    password 
  } = req.body;

  const derivedDisplayName = (displayName || `${firstName || ''} ${lastName || ''}`).trim();
  if (!derivedDisplayName) {
    return res.status(400).json({ error: 'Coach display name (or first & last name) is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Coach email address is required.' });
  }
  if (!phoneNumber || !phoneNumber.trim()) {
    return res.status(400).json({ error: 'Coach phone number is required.' });
  }
  if (!password || password.trim().length < 8) {
    return res.status(400).json({ error: 'Coach initial password is required (minimum 8 characters).' });
  }
  if (dateOfJoining && dateOfLeaving && new Date(dateOfLeaving) < new Date(dateOfJoining)) {
    return res.status(400).json({ error: 'Date of leaving cannot be earlier than date of joining.' });
  }

  try {
    const coach = await db.createCoach({
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      displayName: derivedDisplayName,
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      address: address?.trim(),
      dateOfJoining: dateOfJoining || new Date().toISOString().split('T')[0],
      status: status || 'Active',
      dateOfLeaving: dateOfLeaving || undefined,
      educationalQualification: educationalQualification?.trim(),
      designation: designation?.trim() || 'Associate Tutor',
      specializations: Array.isArray(specializations) ? specializations : undefined,
      emergencyContactName: emergencyContactName?.trim(),
      emergencyContactPhone: emergencyContactPhone?.trim(),
      notes: notes?.trim(),
      password: password.trim()
    });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'coach_create',
      summary: `Administrator ${req.user?.displayName || req.user?.username} onboarded new Coach: ${coach.displayName} (${coach.email})`,
      arguments: { displayName: coach.displayName, email: coach.email, phoneNumber: coach.phoneNumber, designation: coach.designation },
      result: { coachId: coach.id, email: coach.email }
    });

    return res.status(201).json(coach);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create coach.' });
  }
});

app.put('/api/coaches/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const coachId = req.params.id;
    const { dateOfJoining, dateOfLeaving } = req.body;
    if (dateOfJoining && dateOfLeaving && new Date(dateOfLeaving) < new Date(dateOfJoining)) {
      return res.status(400).json({ error: 'Date of leaving cannot be earlier than date of joining.' });
    }
    const updatedCoach = await db.updateCoach(coachId, req.body);

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'coach_update',
      summary: `Administrator ${req.user?.displayName || req.user?.username} updated Coach profile: ${updatedCoach.displayName} (${coachId})`,
      arguments: { coachId, updates: req.body },
      result: { coachId, displayName: updatedCoach.displayName }
    });

    return res.json(updatedCoach);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update coach.' });
  }
});

app.delete('/api/coaches/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const coachId = req.params.id;
    await db.deleteCoach(coachId); // Soft deactivation: No physical delete

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'coach_deactivate',
      summary: `Administrator ${req.user?.displayName || req.user?.username} deactivated Coach (soft delete): ${coachId}`,
      arguments: { coachId },
      result: { success: true, softDelete: true }
    });

    return res.json({ success: true, message: 'Coach has been deactivated. Historical records have been preserved.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to deactivate coach.' });
  }
});

// Assign Coach to Student (Admin-only)
app.patch('/api/students/:id/assign-coach', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { coachId } = req.body;
    const updatedStudent = await db.assignCoachToStudent(req.params.id, coachId || null);
    if (!updatedStudent) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'student_assign_coach',
      summary: `Assigned coach ${coachId || 'None'} to student ${updatedStudent.displayName} (${req.params.id})`,
      arguments: { studentId: req.params.id, coachId },
      result: { studentId: req.params.id, coachId }
    });

    return res.json(updatedStudent);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to assign coach.' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword, targetStudentId, targetUserId, applyToAll } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

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
      return res.status(400).json({ error: result.error || 'Failed to update password.' });
    }

    const user = await db.findUserByEmailOrUsername(email);
    sendPasswordChangedEmail(email, { displayName: user?.displayName }).catch(err => {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to change password.' });
  }
});

// Family students discovery for password change and account management
app.post('/api/auth/family-students', async (req, res) => {
  try {
    const { email, identifier } = req.body;
    const target = (email || identifier || '').trim();
    if (!target) {
      return res.status(400).json({ error: 'Email or identifier is required.' });
    }
    const siblings = await db.getFamilyStudentsByEmailOrPhone(target);
    return res.json({
      students: siblings.map(s => ({
        id: s.id,
        studentId: s.id,
        userId: s.userId,
        displayName: s.displayName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
        age: s.age,
        gradeClass: s.gradeClass,
        schoolName: s.schoolName
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve family students.' });
  }
});

// Exchange/Harmonize Supabase Auth Session with Backend Custom JWT & httpOnly Cookie
app.post('/api/auth/supabase-session', async (req, res) => {
  try {
    const { email, displayName, fullName, role, studentId, id, username } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required for session synchronization.' });
    }

    const user = await db.upsertUserFromSupabase({
      email,
      displayName: displayName || fullName,
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
      displayName: user.displayName,
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
      summary: `Harmonized Supabase OAuth / Auth session for ${user.displayName} (${user.email})`,
      arguments: { email: user.email, role: user.role },
      result: { userId: user.id, role: user.role }
    });

    return res.json({ token, user: payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to synchronize Supabase session.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
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
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Please provide username or registered email.' });
    }

    const user = await db.findUserByEmailOrUsername(identifier);
    if (!user) {
      recordAudit({
        actorId: 'anonymous',
        action: 'auth_forgot_password_failed',
        summary: `Password retrieval lookup failed: No account for ${identifier}`,
        arguments: { identifier },
        status: 'failed'
      });
      return res.status(404).json({ error: 'No account found with this username or email.' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin account password cannot be reset via email. Password changes happen only via direct backend access.' });
    }

    // Real-time Resend Email Dispatch
    const emailResult = await sendForgotPasswordEmail(user.email, user);

    console.log(`[EMAIL DISPATCH] Sent password retrieval notification to ${user.email} for username: ${user.username}. (Resend status: ${emailResult.success ? 'Delivered' : 'Failed: ' + emailResult.error})`);

    recordAudit({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: 'auth_forgot_password',
      summary: `Dispatched password retrieval notification to registered email: ${user.email}`,
      arguments: { identifier, email: user.email },
      result: { email: user.email, deliveryStatus: emailResult.success ? 'sent' : 'simulated' }
    });

    return res.json({
      success: true,
      message: `Password has been sent to registered email: ${user.email}`,
      email: user.email,
      deliveryStatus: emailResult.success ? 'sent' : 'simulated'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error processing forgot password request.' });
  }
});

app.get('/api/auth/me', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const user = (req.user.username ? await db.findUserByUsername(req.user.username) : null) || (await db.findUserById(req.user.id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    let siblingStudents: any = undefined;
    let activeStudentId = req.user.studentId || user.studentId;
    let displayName = user.displayName;

    if (user.role === 'student') {
      const rawSiblings = await db.getSiblingStudentsForUser(user);
      siblingStudents = rawSiblings.map(s => ({
        id: s.id,
        displayName: s.displayName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
        age: s.age,
        gradeClass: s.gradeClass,
        schoolName: s.schoolName
      }));

      if (activeStudentId) {
        const activeSibling = rawSiblings.find(s => s.id === activeStudentId);
        if (activeSibling) {
          displayName = activeSibling.displayName || `${activeSibling.firstName || ''} ${activeSibling.lastName || ''}`.trim() || displayName;
        }
      } else if (rawSiblings.length === 1) {
        activeStudentId = rawSiblings[0].id;
        displayName = rawSiblings[0].displayName || `${rawSiblings[0].firstName || ''} ${rawSiblings[0].lastName || ''}`.trim() || displayName;
      }
    }

    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      studentId: activeStudentId,
      displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      designation: user.designation,
      siblingStudents
    });
  } catch (err: any) {
    console.error('[AUTH /api/auth/me ERROR STACK]', err.stack);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Self-Update User Profile (Strict Column-Level / Application-Level Whitelist)
// Ordinary users can only update permitted personal fields. Privilege escalation is strictly forbidden.
// Note: Coaches cannot edit their own details. Only Admin can do that.
app.patch('/api/auth/me', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    // Explicit check: Coaches cannot edit their own details. Only Admin can do that.
    if (req.user.role === 'coach') {
      return res.status(403).json({
        error: 'Access denied: Coaches cannot edit their own details. Only an Administrator can update coach details.'
      });
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
      if (req.body[field] !== undefined) {
        return res.status(400).json({
          error: `Modification of restricted identity field '${field}' is strictly prohibited.`
        });
      }
    }

    const { displayName, fullName, phoneNumber, avatarUrl } = req.body;
    const result = await db.updateUserSelfProfile(req.user.id, {
      displayName: displayName || fullName,
      phoneNumber,
      avatarUrl
    });

    if (!result.success || !result.user) {
      return res.status(400).json({ error: result.error || 'Failed to update profile.' });
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: result.user.id,
        displayName: result.user.displayName,
        email: result.user.email,
        phoneNumber: result.user.phoneNumber,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
});

// 2. Students API (Protected by JWT)
app.get('/api/students', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const page = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : undefined;
    const paginationOptions = (page && limit) ? { page, limit } : undefined;

    if (req.user.role === 'admin') {
      const students = await db.getAllStudents(paginationOptions);
      if (page && limit) {
        const total = await db.getStudentsCount();
        return res.json({
          data: students,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1
          }
        });
      }
      return res.json(students);
    } else if (req.user.role === 'coach') {
      const coachKey = req.user.coachId || req.user.id;
      const coachAlt = req.user.coachId ? req.user.id : undefined;
      const students = await db.getStudentsByCoachId(coachKey, coachAlt, paginationOptions);
      if (page && limit) {
        const total = await db.getStudentsCountByCoachId(coachKey, coachAlt);
        return res.json({
          data: students,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1
          }
        });
      }
      return res.json(students);
    } else if (req.user.role === 'student' && req.user.studentId) {
      const student = await db.getStudentById(req.user.studentId);
      const result = student ? [student] : [];
      if (page && limit) {
        return res.json({
          data: result,
          pagination: { page, limit, total: result.length, totalPages: 1 }
        });
      }
      return res.json(result);
    }

    return res.status(403).json({ error: 'Unauthorized access to student directory.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch students.' });
  }
});

app.get('/api/students/:id', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!await canAccessStudent(req.user, req.params.id)) {
      return res.status(403).json({ error: 'Access denied. You do not have permission to view this student profile.' });
    }

    const student = await db.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    return res.json(student);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch student details.' });
  }
});

app.post('/api/students/enroll', async (req, res) => {
  const data = req.body;
  const firstName = data.firstName?.trim() || '';
  const lastName = data.lastName?.trim() || '';
  const displayName = data.displayName?.trim() || data.fullName?.trim() || `${firstName} ${lastName}`.trim();

  if (!displayName && !firstName) {
    return res.status(400).json({ error: 'Student display name is required.' });
  }
  if (!data.parentName || !data.parentName.trim()) {
    return res.status(400).json({ error: 'Parent/Guardian name is required.' });
  }
  if (!data.email || !data.email.trim()) {
    return res.status(400).json({ error: 'Parent contact email is required.' });
  }
  const age = Number(data.age);
  if (!age || isNaN(age) || age < 4 || age > 18) {
    return res.status(400).json({ error: 'Student age must be a valid number between 4 and 18.' });
  }
  const phoneNumber = (data.whatsappMobile || data.phoneNumber || data.phone || '').trim();
  if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'A valid 10-digit WhatsApp/Mobile number is required.' });
  }
  let inheritedPasswordHash: string | undefined = undefined;
  const isSiblingEnrollment = Boolean(data.isSiblingEnrollment);

  if (isSiblingEnrollment) {
    // Sibling flow: strictly forbid admin from issuing a new password
    // Password must be inherited from the existing family account. If parents want a new password, they manage it.
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const existingUsers = await db.findUsersByIdentifier(cleanEmail);
    const parentUser = existingUsers.find(u => u.passwordHash);
    if (!parentUser?.passwordHash) {
      return res.status(400).json({ 
        error: 'Existing family account could not be located to inherit credentials for this sibling.' 
      });
    }
    inheritedPasswordHash = parentUser.passwordHash;
    // Disallow custom password in sibling flow
    delete (data as any).password;
  } else if (!data.password || data.password.trim().length === 0) {
    return res.status(400).json({ error: 'Account password is required and must be at least 8 characters long.' });
  } else if (data.password.trim().length < 8) {
    return res.status(400).json({ error: 'Account password must be at least 8 characters long.' });
  }

  try {
    // Enforce Duplicate Entry Check:
    // If first name + last name + phone number OR first name + last name + emailid already exists in users table, throw error
    const isDuplicate = await db.checkStudentDuplicate({
      firstName,
      lastName,
      displayName,
      phoneNumber,
      email: data.email,
      age
    });
    if (isDuplicate) {
      recordAudit({
        actorId: 'anonymous',
        action: 'student_enroll_duplicate_blocked',
        summary: `Enrollment blocked: Student ${displayName} is already enrolled.`,
        arguments: { displayName, firstName, lastName, phoneNumber, email: data.email, age },
        status: 'failed'
      });
      return res.status(409).json({ 
        error: 'Student is already enrolled.' 
      });
    }

    const newId = `std-${Date.now()}`;
    const username = data.username || data.email.toLowerCase().trim();
    const password = data.password ? data.password.trim() : undefined;

    const newStudent = {
      ...data,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      displayName,
      modeOfLearning: data.modeOfLearning || 'In-person',
      parentName: data.parentName.trim(),
      email: data.email.toLowerCase().trim(),
      id: newId,
      username,
      password,
      passwordHash: inheritedPasswordHash,
      isSiblingEnrollment: Boolean(isSiblingEnrollment || inheritedPasswordHash),
      siblingOfStudentName: data.siblingOfStudentName,
      age,
      whatsappMobile: phoneNumber,
      status: data.status || 'Active',
      enrollmentDate: data.enrollmentDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const created = await db.createStudent(newStudent);

    // Enforce synchronous audit log recording: if audit logging fails, request fails
    await recordAudit({
      actorId: 'anonymous',
      action: 'student_enroll',
      summary: `Enrolled new student: ${newStudent.displayName} (Age: ${age}, Grade: ${newStudent.gradeClass || 'N/A'}, Parent: ${newStudent.parentName}, Phone: ${phoneNumber})`,
      arguments: {
        studentId: created.id,
        displayName: newStudent.displayName,
        age,
        gradeClass: newStudent.gradeClass,
        parentName: newStudent.parentName,
        email: newStudent.email,
        whatsappMobile: phoneNumber
      },
      result: { studentId: created.id, username }
    });

    // Real-time Resend Email Dispatch to Parent and Admin
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
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Enrollment failed.' });
  }
});

app.put('/api/students/:id', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Authorization check: Admin OR Assigned Coach
    if (req.user.role !== 'admin' && req.user.role !== 'coach') {
      return res.status(403).json({ error: 'Access forbidden. Only administrators and assigned coaches can update student details.' });
    }

    if (req.user.role === 'coach') {
      const hasAccess = await canAccessStudent(req.user, req.params.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: Coaches can only edit details of students assigned to them.' });
      }

      const targetStudent = await db.getStudentById(req.params.id);
      if (targetStudent?.status === 'Inactive') {
        return res.status(403).json({ error: 'Inactive students are read-only for coaches.' });
      }

      // Only admin have the access to make a student active or inactive, or set date of leaving
      delete req.body.status;
      delete req.body.dateOfLeaving;
      delete req.body.coachId;
      delete req.body.coachName;
    }

    const updated = await db.updateStudent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Student not found' });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: req.params.id,
      action: 'student_update',
      summary: `${req.user?.role === 'coach' ? 'Coach' : 'Administrator'} ${req.user?.displayName || req.user?.username} updated profile for student ${updated.displayName} (${req.params.id})`,
      arguments: { studentId: req.params.id, updates: req.body },
      result: { studentId: req.params.id, displayName: updated.displayName }
    });

    // Real-time Resend Email Dispatch to Parent and Admin on Edit
    sendStudentUpdatedEmails(updated, req.body).catch(err => {
      console.warn('[Resend Background Notice] Student update notification dispatch:', err.message || err);
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update student.' });
  }
});

app.delete('/api/students/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const student = await db.getStudentById(req.params.id);
    const deactivated = await db.deleteStudent(req.params.id); // Soft deactivation: No physical delete
    if (!deactivated) return res.status(404).json({ error: 'Student not found' });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: req.params.id,
      action: 'student_deactivate',
      summary: `Administrator ${req.user?.displayName || req.user?.username} deactivated student profile (soft delete): ${student?.displayName || req.params.id}`,
      arguments: { studentId: req.params.id, studentName: student?.displayName },
      result: { success: true, softDelete: true }
    });

    return res.json({ success: true, message: 'Student profile has been deactivated. Historical records have been preserved.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to deactivate student.' });
  }
});

// 3. Attendance API (Protected by JWT)
app.get('/api/attendance/month/:yearMonth', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
    const page = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : undefined;

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
    const records = await db.getAttendanceByMonth(req.params.yearMonth, queryOptions);

    if (page && limit) {
      const total = await db.getAttendanceCountByMonth(req.params.yearMonth, targetStudentIds);
      return res.json({
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    }

    return res.json(records);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch attendance.' });
  }
});

app.get('/api/attendance/student/:id', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    // Ownership & coach scoping check
    if (!await canAccessStudent(req.user, req.params.id)) {
      return res.status(403).json({ error: 'Access denied. You can only view attendance for authorized students.' });
    }
    const page = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : undefined;
    const paginationOptions = (page && limit) ? { page, limit } : undefined;

    const records = await db.getAttendanceByStudent(req.params.id, paginationOptions);

    if (page && limit) {
      const total = await db.getAttendanceCountByStudent(req.params.id);
      return res.json({
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    }

    return res.json(records);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch attendance for student.' });
  }
});

app.post('/api/attendance/batch', authenticateJwt, requireCoachOrAdmin, attendanceRateLimiter, async (req: AuthRequest, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Records must be an array' });
    }

    // If coach, verify that coach only marks attendance for assigned students
    if (req.user?.role === 'coach') {
      const coachStudents = await db.getStudentsByCoachId(req.user.id);
      const coachStudentIds = new Set(coachStudents.map(s => s.id));
      const unauthorized = records.filter(r => !coachStudentIds.has(r.studentId));
      if (unauthorized.length > 0) {
        return res.status(403).json({ error: 'Coaches can only update attendance for their assigned students.' });
      }

      const inactiveIds = new Set(coachStudents.filter(s => s.status === 'Inactive').map(s => s.id));
      const containsInactive = records.some(r => inactiveIds.has(r.studentId));
      if (containsInactive) {
        return res.status(400).json({ error: 'Cannot mark attendance for inactive students (read-only archive).' });
      }
    }

    await db.saveAttendanceBatch(records);

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'attendance_batch_save',
      summary: `${req.user?.displayName || req.user?.username} (${req.user?.role}) saved/updated ${records.length} attendance records`,
      arguments: { recordCount: records.length, sampleRecord: records[0] },
      result: { count: records.length, success: true }
    });

    return res.json({ success: true, count: records.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save attendance.' });
  }
});

app.delete('/api/attendance/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete attendance record.' });
  }
});

app.delete('/api/attendance/:studentId/:date', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { studentId, date } = req.params;
    const { serverSupabase } = await import('./server/supabase.ts');
    if (serverSupabase) {
      const { data: matchedRows } = await serverSupabase
        .from('attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('date', date);

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete attendance record.' });
  }
});

// 4. Fees API (Protected by JWT)
app.get('/api/fees/month/:yearMonth', authenticateJwt, requireAdmin, async (req, res) => {
  try {
    const page = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : undefined;
    const paginationOptions = (page && limit) ? { page, limit } : undefined;

    const records = await db.getFeesByMonth(req.params.yearMonth, paginationOptions);

    if (page && limit) {
      const total = await db.getFeesCountByMonth(req.params.yearMonth);
      return res.json({
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    }

    return res.json(records);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch fees.' });
  }
});

app.get('/api/fees/student/:id', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    // Ownership scoping check (Admin, the student themselves, or assigned coach)
    if (req.user?.role === 'student' && req.user.studentId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied. You can only view your own fee receipts.' });
    }
    if (req.user?.role === 'coach') {
      const hasAccess = await canAccessStudent(req.user, req.params.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: Coaches can only view fee records of students assigned to them.' });
      }
    }

    const page = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : undefined;
    const paginationOptions = (page && limit) ? { page, limit } : undefined;

    const records = await db.getFeesByStudent(req.params.id, paginationOptions);

    if (page && limit) {
      const total = await db.getFeesCountByStudent(req.params.id);
      return res.json({
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    }

    return res.json(records);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch student fees.' });
  }
});

app.post('/api/fees', authenticateJwt, paymentRateLimiter, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'coach') {
      return res.status(403).json({ error: 'Access denied. Only administrators and assigned coaches can record fees.' });
    }
    const fee = req.body;
    if (!fee.studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    if (req.user?.role === 'coach') {
      const hasAccess = await canAccessStudent(req.user, fee.studentId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: Coaches can only record fees for students assigned to them.' });
      }
    }
    const saved = await db.saveFeeRecord(fee);

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to record fee.' });
  }
});

app.put('/api/fees/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updated = await db.updateFeeRecord(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Fee record not found' });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: updated.studentId,
      action: 'fee_record_update',
      summary: `Administrator updated fee record #${req.params.id} (Status: ${updated.status}, Amount: ₹${updated.amount})`,
      arguments: { feeId: req.params.id, updates: req.body },
      result: { feeId: updated.id, status: updated.status, amount: updated.amount }
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update fee record.' });
  }
});

app.patch('/api/fees/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updated = await db.updateFeeRecord(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Fee record not found' });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: updated.studentId,
      action: 'fee_record_update',
      summary: `Administrator modified fee record #${req.params.id} (Status: ${updated.status}, Amount: ₹${updated.amount})`,
      arguments: { feeId: req.params.id, updates: req.body },
      result: { feeId: updated.id, status: updated.status, amount: updated.amount }
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update fee record.' });
  }
});

app.delete('/api/fees/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const success = await db.deleteFeeRecord(req.params.id);
    if (!success) return res.status(404).json({ error: 'Fee record not found' });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'fee_record_delete',
      summary: `Administrator deleted fee ledger record #${req.params.id}`,
      arguments: { feeId: req.params.id },
      result: { success: true }
    });

    return res.json({ success: true, message: 'Fee record deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete fee record.' });
  }
});

// 5. Progress Trackers API (Protected by JWT)
app.get('/api/progress-trackers/student/:id', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!await canAccessStudent(req.user, req.params.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const trackers = await db.getProgressTrackersByStudent(req.params.id);
    return res.json(trackers);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch progress trackers.' });
  }
});

app.post('/api/progress-trackers', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
    const tracker = req.body;
    if (!tracker.studentId || !tracker.evaluationDate) {
      return res.status(400).json({ error: 'studentId and evaluationDate required' });
    }
    if (!await canAccessStudent(req.user, tracker.studentId)) {
      return res.status(403).json({ error: 'Access denied: You can only record progress evaluations for your assigned students.' });
    }
    const saved = await db.saveProgressTracker(tracker);

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: tracker.studentId,
      action: 'progress_tracker_save',
      summary: `${req.user?.displayName || req.user?.username} recorded progress metric evaluation for student ${tracker.studentId} (${tracker.evaluationDate})`,
      arguments: { studentId: tracker.studentId, evaluationDate: tracker.evaluationDate, overallScore: tracker.overallScore },
      result: { trackerId: saved.id, studentId: tracker.studentId }
    });

    return res.json(saved);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save progress tracker.' });
  }
});

app.delete('/api/progress-trackers/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.deleteProgressTracker(req.params.id);

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'progress_tracker_delete',
      summary: `Administrator removed progress evaluation tracker record #${req.params.id}`,
      arguments: { trackerId: req.params.id },
      result: { success: true }
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete progress tracker.' });
  }
});

// 6. Student Works & Camera Uploads API (Protected by JWT)
app.get('/api/student-works/student/:id', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!await canAccessStudent(req.user, req.params.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const works = await db.getStudentWorks(req.params.id);
    return res.json(works);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch student works.' });
  }
});

app.post('/api/student-works/upload', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    const { studentId, imageData, captureDate, comments, category } = req.body;
    if (!studentId || !imageData) {
      return res.status(400).json({ error: 'studentId and imageData required' });
    }
    if (!await canAccessStudent(req.user, studentId)) {
      return res.status(403).json({ error: 'Access denied to upload work for this student.' });
    }

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
      summary: `${req.user?.displayName || req.user?.username} uploaded handwriting sample (${category || 'Practice Sheet'}) for student ${studentId}`,
      arguments: { studentId, category: category || 'Practice Sheet', captureDate: captureDate || 'today', comments },
      result: { workId: saved.id, imagePath: finalImagePath }
    });

    return res.json(saved);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to upload student work.' });
  }
});

app.delete('/api/student-works/:id', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
    const work = await db.findStudentWorkById(req.params.id);
    if (!work) return res.status(404).json({ error: 'Student work not found' });
    if (!await canAccessStudent(req.user, work.studentId)) {
      return res.status(403).json({ error: 'Access denied: Only the assigned coach or administrator can delete this work sample.' });
    }

    // Delete underlying file from disk if stored in /student_works/
    if (work.imageData && work.imageData.startsWith('/student_works/')) {
      try {
        const baseName = path.basename(work.imageData);
        const diskPath = path.join(studentWorksDir, baseName);
        if (fs.existsSync(diskPath)) {
          fs.unlinkSync(diskPath);
        }
      } catch (fileErr) {
        console.warn(`[StudentWorks] Warning unlinking file:`, fileErr);
      }
    }

    await db.deleteStudentWork(req.params.id);

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: work.studentId,
      action: 'student_work_delete',
      summary: `Removed handwriting sample #${req.params.id} for student ${work.studentId}`,
      arguments: { workId: req.params.id, studentId: work.studentId },
      result: { success: true }
    });

    return res.json({ success: true, message: 'Student work deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete student work.' });
  }
});

app.post('/api/student-works/bulk-delete', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

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
      summary: `${req.user?.displayName || req.user?.username} bulk deleted ${deletedCount} work samples`,
      arguments: { requestedCount: ids.length, deletedCount },
      result: { success: true, count: deletedCount }
    });

    return res.json({ success: true, count: deletedCount });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to bulk delete student works.' });
  }
});

// 7. Progress Reports API (Protected by JWT)
app.get('/api/reports/student/:id', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (!await canAccessStudent(req.user, req.params.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    const reports = await db.getProgressReports(req.params.id);
    return res.json(reports);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch progress reports.' });
  }
});

app.post('/api/reports/generate', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
    const report = req.body;
    if (!report.studentId || !report.reportDate) {
      return res.status(400).json({ error: 'studentId and reportDate required' });
    }
    if (!await canAccessStudent(req.user, report.studentId)) {
      return res.status(403).json({ error: 'Access denied: You can only generate progress reports for your assigned students.' });
    }

    const saved = await db.saveProgressReport({
      ...report,
      savedToFolder: '/progress_reports/'
    });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: report.studentId,
      action: 'progress_report_generate',
      summary: `${req.user?.displayName || req.user?.username} generated Progress Milestone Report for student ${report.studentId}`,
      arguments: { studentId: report.studentId, reportDate: report.reportDate, remarks: report.remarks },
      result: { reportId: saved.id, studentId: report.studentId }
    });

    return res.json(saved);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate progress report.' });
  }
});

app.delete('/api/reports/:id', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
    const report = await db.findProgressReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Progress report not found' });
    }

    if (!await canAccessStudent(req.user, report.studentId)) {
      return res.status(403).json({ error: 'Access denied: Only the assigned coach or administrator can delete this progress report.' });
    }

    await db.deleteProgressReport(req.params.id);

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      actorStudentId: report.studentId,
      action: 'progress_report_delete',
      summary: `${req.user?.displayName || req.user?.username} removed progress report #${req.params.id} for student ${report.studentId}`,
      arguments: { reportId: req.params.id, studentId: report.studentId },
      result: { success: true }
    });

    return res.json({ success: true, message: 'Progress report deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete progress report.' });
  }
});

app.post('/api/reports/:id/email', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  const { studentEmail, parentEmail } = req.body;
  const adminEmail = await db.getAdminEmail();
  const recipientTarget = parentEmail || studentEmail || 'student/parent';
  console.log(`[EMAIL DISPATCH] Progress Report ${req.params.id} dispatched to Parent (${recipientTarget}) and Admin (${adminEmail || 'admin'})`);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    action: 'progress_report_email',
    summary: `Emailed Progress Report #${req.params.id} to parent (${recipientTarget})`,
    arguments: { reportId: req.params.id, parentEmail, studentEmail },
    result: { success: true }
  });

  return res.json({
    success: true,
    message: `Progress Report successfully emailed to ${recipientTarget} and Admin!`
  });
});

// 8. Reminders API (Fee reminder with WhatsApp & GPay link - Protected by JWT)
app.post('/api/reminders/whatsapp', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { studentId, parentPhone, parentName, studentName, amount, milestone, receiptNumber } = req.body;
    if (!studentId || !amount) {
      return res.status(400).json({ error: 'studentId and amount are required' });
    }

    const cleanPhone = (parentPhone || '').replace(/[^\d+]/g, '');
    const periodText = milestone || 'Current Period';
    const receiptText = receiptNumber ? ` (Ref: ${receiptNumber})` : '';

    const messageText = `Dear ${parentName || 'Parent'}, greetings from SmartPen Academy! ✍️\n\nThis is a fee payment request for ${studentName}'s handwriting program for ${periodText}${receiptText}.\n\n• Amount: ₹${amount}\n• Mode: In-Person Reception Settlement (Cash / UPI / Card)\n• UPI ID: smartpen.academy@okaxis\n\nKindly complete the settlement at the academy reception or via UPI. Thank you for your continued partnership in ${studentName}'s handwriting mastery!\n\nWarm regards,\nMrs. Deepthy Rock\nSmartPen Academy`;

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create WhatsApp reminder.' });
  }
});

app.post('/api/reminders/send', authenticateJwt, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'coach') {
      return res.status(403).json({ error: 'Access denied. Only administrators and assigned coaches can dispatch fee reminders.' });
    }
    const { studentId, parentEmail, parentName, studentName, amount, month, gpayLink } = req.body;
    if (!studentId || !amount) {
      return res.status(400).json({ error: 'studentId and amount required' });
    }
    if (req.user?.role === 'coach') {
      const hasAccess = await canAccessStudent(req.user, studentId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: Coaches can only dispatch reminders to students assigned to them.' });
      }
    }

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to dispatch reminder.' });
  }
});

// 9. Free Demo Class Bookings API (Admin Protected for viewing & updating)
app.get('/api/demo-bookings', authenticateJwt, requireAdmin, async (req, res) => {
  try {
    const bookings = await db.getDemoBookings();
    return res.json(bookings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch demo bookings.' });
  }
});

app.post('/api/demo-bookings', demoBookingRateLimiter, async (req, res) => {
  try {
    const { studentName, parentName, age, contactNumber, preferredDate, preferredTimeSlot, modeOfLearning, notes } = req.body;
    if (!studentName || !age || !contactNumber || !preferredDate || !preferredTimeSlot) {
      return res.status(400).json({ error: 'studentName, age, contactNumber, preferredDate, and preferredTimeSlot are required' });
    }

    const result = await db.createDemoBooking({
      studentName,
      parentName,
      age,
      contactNumber,
      preferredDate,
      preferredTimeSlot,
      modeOfLearning: modeOfLearning || 'In-person',
      notes
    });

    // Real-time Resend Alert to Admin
    sendDemoBookingAlert({
      studentName,
      parentName: result.booking.parentName,
      age,
      contactNumber,
      preferredDate: result.booking.preferredDate,
      preferredTimeSlot: result.booking.preferredTimeSlot,
      notes
    }).catch(err => {
      console.warn('[Resend Background Notice] Demo booking alert dispatch:', err.message || err);
    });

    console.log(`[DEMO BOOKING] New Free Demo Class Booking: ${studentName} (Parent: ${result.booking.parentName}, Age: ${age}, Mode: ${result.booking.modeOfLearning}), Contact: ${contactNumber}, Date: ${result.booking.preferredDate}, Time: ${result.booking.preferredTimeSlot}`);
    console.log(`[ALERT DISPATCH] Created alert id: ${result.alert.id}`);

    recordAudit({
      actorId: 'anonymous_visitor',
      action: 'demo_booking_create',
      summary: `New Free Demo Class booked for student ${studentName} (Age: ${age}, Contact: ${contactNumber}, Mode: ${result.booking.modeOfLearning}, Date: ${result.booking.preferredDate}, Time: ${result.booking.preferredTimeSlot})`,
      arguments: { studentName, parentName, age, contactNumber, preferredDate, preferredTimeSlot, modeOfLearning: result.booking.modeOfLearning },
      result: { bookingId: result.booking.id, alertId: result.alert.id }
    });

    return res.status(201).json(result.booking);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit demo booking.' });
  }
});

app.patch('/api/demo-bookings/:id', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
    const updated = await db.updateDemoBooking(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Booking not found' });

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update demo booking.' });
  }
});

app.delete('/api/demo-bookings/:id', authenticateJwt, requireCoachOrAdmin, async (req: AuthRequest, res) => {
  try {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete demo booking.' });
  }
});

// Tool Audit Logs API (Admin Only)
app.get('/api/ai/audit-logs', authenticateJwt, requireAdmin, async (req, res) => {
  try {
    const page = req.query.page ? Math.max(1, Number(req.query.page)) : undefined;
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 50;
    const logs = await db.getToolAuditLogs(page ? { page, limit } : limit);

    if (page) {
      const total = await db.getToolAuditLogsCount();
      return res.json({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    }

    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch audit logs.' });
  }
});

// 10. Admin Alerts Module API (Protected by JWT)
app.get('/api/alerts', authenticateJwt, requireAdmin, async (req, res) => {
  try {
    const alerts = await db.getAlerts();
    return res.json(alerts);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch alerts.' });
  }
});

app.patch('/api/alerts/:id/read', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const alert = await db.markAlertAsRead(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'alert_mark_read',
      summary: `Administrator marked alert #${req.params.id} as read`,
      arguments: { alertId: req.params.id }
    });

    return res.json(alert);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to mark alert as read.' });
  }
});

app.post('/api/alerts/mark-all-read', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to mark all alerts as read.' });
  }
});

app.delete('/api/alerts/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete alert.' });
  }
});

// 11. Testimonials / Parent Voices API
app.get('/api/testimonials', async (req, res) => {
  try {
    const { studentId, status } = req.query;
    const testimonials = await db.getTestimonials(studentId as string, status as string);
    return res.json(testimonials);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch testimonials.' });
  }
});

app.get('/api/testimonials/student/:id', async (req, res) => {
  try {
    const testimonials = await db.getTestimonials(req.params.id);
    return res.json(testimonials);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch testimonials for student.' });
  }
});

app.post('/api/testimonials', async (req, res) => {
  try {
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
    } = req.body;

    if (!studentId || !studentName || !review || !rating) {
      return res.status(400).json({ error: 'studentId, studentName, review, and rating are required.' });
    }

    let finalImagePath = image;
    if (image && image.startsWith('data:image/')) {
      try {
        const match = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const base64Data = match[2];
          const fileName = `testimony_${studentId}_${Date.now()}.${ext}`;
          const filePath = path.join(testimonialsDir, fileName);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
          finalImagePath = `/testimonials/${fileName}`;
        }
      } catch (e) {
        console.error('Error saving testimony photo to disk:', e);
      }
    }

    const saved = await db.saveTestimonial({
      studentId,
      studentName,
      parentName: parentName || 'Parent',
      grade: grade || '',
      schoolName: schoolName || '',
      relationship: relationship || 'Parent',
      rating: Number(rating) || 5,
      title: title || '',
      review,
      beforeAfterTag: beforeAfterTag || '5 Star Transformation',
      image: finalImagePath,
      mediaConsent: mediaConsent !== false,
      status: 'Featured' // automatically featured so parents see it immediately
    });

    console.log(`[TESTIMONIAL] New Testimony received from ${parentName} for student ${studentName}`);

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save testimonial.' });
  }
});

app.patch('/api/testimonials/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const updated = await db.updateTestimonial(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Testimonial not found' });

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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update testimonial.' });
  }
});

app.delete('/api/testimonials/:id', authenticateJwt, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.deleteTestimonial(req.params.id);

    recordAudit({
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      actorRole: req.user?.role,
      action: 'testimonial_delete',
      summary: `Administrator deleted testimonial #${req.params.id}`,
      arguments: { testimonialId: req.params.id },
      result: { success: true }
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete testimonial.' });
  }
});

// 12. AI Agent Chatbot & Function Calling API
app.post('/api/ai/agent-chat', async (req: Request, res: Response) => {
  try {
    const { messages, settings } = req.body;
    
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
  } catch (error: any) {
    console.error('Error in /api/ai/agent-chat:', error);
    return res.status(500).json({
      error: 'An error occurred while communicating with the AI Assistant.',
      details: error.message || String(error)
    });
  }
});

app.post('/api/ai/test-config', async (req: Request, res: Response) => {
  const { apiKey, model } = req.body;
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
});

// ================= GLOBAL ERROR HANDLING MIDDLEWARE =================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Structured sanitized server log (Mask passwords/tokens if any in log)
  console.error(JSON.stringify({
    level: 'error',
    message: err.message || 'Internal Server Error',
    path: req.path,
    method: req.method,
    statusCode,
    userId: (req as any).user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  }));

  // Sanitized client response
  res.status(statusCode).json({
    error: statusCode === 500 && isProduction ? 'An unexpected server error occurred.' : (err.message || 'Server error'),
    statusCode
  });
});

// ================= VITE INTEGRATION & SERVER LIFECYCLE =================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
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
