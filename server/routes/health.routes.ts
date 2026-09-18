import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../supabaseDb.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { ValidationError } from '../errors.ts';
import {
  sendEmail,
  sendEnrollmentEmails,
  getSenderEmail,
  getAdminNotificationEmail
} from '../email.ts';

export const healthRouter = Router();

const testEmailSchema = z.object({
  to: z.string().email('Invalid email address format').optional(),
  type: z.enum(['enrollment', 'general']).optional().default('enrollment'),
  studentName: z.string().optional().default('Aarav Sharma'),
  parentName: z.string().optional().default('Priya Sharma')
});

// 1. Liveness Probe (GET /api/health)
healthRouter.get('/health', asyncHandler(async (req: Request, res: Response) => {
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
healthRouter.get('/ready', asyncHandler(async (req: Request, res: Response) => {
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

// 3. Email Service Status & Health Check (GET /api/email/status)
healthRouter.get('/email/status', asyncHandler(async (req: Request, res: Response) => {
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

// 4. Send Test Email (POST /api/email/test)
healthRouter.post('/email/test', asyncHandler(async (req: Request, res: Response) => {
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
