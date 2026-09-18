import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../supabaseDb.ts';
import {
  AuthRequest,
  authenticateJwt,
  requireAdmin,
  requireCoachOrAdmin,
  verifyStudentAccess
} from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { recordAudit } from '../helpers/audit.ts';
import { sendFeeReminderEmail } from '../email.ts';
import { ValidationError } from '../errors.ts';

export const remindersRouter = Router();

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

// POST /api/reminders/whatsapp
remindersRouter.post('/whatsapp', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
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

// POST /api/reminders/send
remindersRouter.post('/send', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = reminderSendSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid fee reminder dispatch parameters.');
  }
  const { studentId, parentEmail, parentName, studentName, amount, month, gpayLink } = parsed.data;

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
