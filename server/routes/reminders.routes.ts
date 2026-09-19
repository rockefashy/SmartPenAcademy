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
import { ValidationError, NotFoundError } from '../errors.ts';

export const remindersRouter = Router();

const reminderWhatsappSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  amount: z.coerce.number().positive('amount must be a positive number'),
  parentPhone: z.string().optional(),
  parentName: z.string().optional(),
  studentName: z.string().optional(),
  milestone: z.string().optional(),
  receiptNumber: z.string().optional()
});

const reminderSendSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  amount: z.coerce.number().positive('amount must be a positive number').optional(),
  parentEmail: z.string().optional(),
  parentName: z.string().optional(),
  studentName: z.string().optional(),
  month: z.string().optional()
});

// POST /api/reminders/whatsapp
remindersRouter.post('/whatsapp', authenticateJwt, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = reminderWhatsappSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid WhatsApp reminder parameters.');
  }
  const { studentId, parentPhone, parentName, studentName, amount, milestone, receiptNumber } = parsed.data;

  const student = await db.getStudentById(studentId);
  const resolvedParentName = student?.parentName || parentName || 'Parent';
  const resolvedStudentName = student?.firstName || studentName || 'Student';
  const rawPhone = student?.whatsappMobile || parentPhone || '';
  const cleanPhone = rawPhone.replace(/[^\d+]/g, '');

  const periodText = milestone || 'Current Period';
  const receiptText = receiptNumber ? ` (Ref: ${receiptNumber})` : '';

  // Derive authoritative amount from database pending fee if available
  let finalAmount = Number(amount);
  try {
    const studentFees = await db.getFeesByStudent(studentId);
    const pendingRecord = studentFees.find(f => f.status === 'Pending' || f.status === 'Overdue');
    if (pendingRecord && pendingRecord.amount) {
      finalAmount = Number(pendingRecord.amount);
    }
  } catch {
    // Fall back to provided amount
  }

  const messageText = `Dear ${resolvedParentName}, greetings from SmartPen Academy! ✍️\n\nThis is a fee payment request for ${resolvedStudentName}'s handwriting program for ${periodText}${receiptText}.\n\n• Amount: ₹${finalAmount}\n• Mode: In-Person Reception Settlement (Cash / UPI / Card)\n• UPI ID: smartpen.academy@okaxis\n\nKindly complete the settlement at the academy reception or via UPI. Thank you for your continued partnership in ${resolvedStudentName}'s handwriting mastery!\n\nWarm regards,\nMrs. Deepthy Rock\nSmartPen Academy`;

  const encodedMessage = encodeURIComponent(messageText);
  const whatsappUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  const canonicalGpayLink = `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${finalAmount}&cu=INR`;

  const reminder = await db.saveFeeReminder({
    studentId,
    parentEmail: cleanPhone || 'whatsapp',
    parentName: resolvedParentName,
    studentName: resolvedStudentName,
    amount: finalAmount,
    month: periodText,
    gpayLink: canonicalGpayLink,
    status: 'Sent'
  });

  console.log(`[WHATSAPP REMINDER] Prepared WhatsApp reminder for ${resolvedParentName} (${cleanPhone}), Student: ${resolvedStudentName}, Amount: ₹${finalAmount}, Milestone: ${periodText}`);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'reminder_whatsapp_create',
    summary: `Prepared WhatsApp fee settlement reminder of ₹${finalAmount} for student ${resolvedStudentName} (Parent: ${resolvedParentName})`,
    arguments: { studentId, parentPhone: cleanPhone, amount: finalAmount, milestone: periodText },
    result: { reminderId: reminder.id, status: 'Sent' }
  });

  return res.json({
    success: true,
    reminder,
    messageText,
    whatsappUrl,
    message: `WhatsApp reminder prepared and logged for ${resolvedParentName}!`
  });
}));

// POST /api/reminders/send
remindersRouter.post('/send', authenticateJwt, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = reminderSendSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid fee reminder dispatch parameters.');
  }
  const { studentId, parentName, studentName, amount, month } = parsed.data;

  // Authoritative student record lookup from DB prevents recipient hijacking
  const student = await db.getStudentById(studentId);
  if (!student) {
    throw new NotFoundError('Student record not found.');
  }

  // Authoritative pending fee lookup from DB prevents billing amount manipulation
  let finalAmount = student.feePerCycle || 1600;
  try {
    const studentFees = await db.getFeesByStudent(studentId);
    const pendingRecord = studentFees.find(f => f.status === 'Pending' || f.status === 'Overdue');
    if (pendingRecord && pendingRecord.amount) {
      finalAmount = Number(pendingRecord.amount);
    } else if (amount && req.user?.role === 'admin') {
      // Administrators may specify an ad-hoc amount if no pending fee record is found
      finalAmount = Number(amount);
    }
  } catch {
    // Fall back to student cycle fee
  }

  const targetEmail = student.email;
  const resolvedParentName = student.parentName || parentName || 'Parent';
  const resolvedStudentName = student.firstName || studentName || 'Student';
  const canonicalGpayLink = `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${finalAmount}&cu=INR`;
  const periodMonth = month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const reminder = await db.saveFeeReminder({
    studentId,
    parentEmail: targetEmail || '',
    parentName: resolvedParentName,
    studentName: resolvedStudentName,
    amount: finalAmount,
    month: periodMonth,
    gpayLink: canonicalGpayLink,
    status: 'Sent'
  });

  if (targetEmail) {
    sendFeeReminderEmail({
      toEmail: targetEmail,
      parentName: resolvedParentName,
      studentName: resolvedStudentName,
      amount: finalAmount,
      month: periodMonth,
      gpayLink: canonicalGpayLink
    }).catch(err => {
      console.warn('[Resend Background Notice] Fee reminder dispatch:', err.message || err);
    });
  }

  console.log(`[EMAIL DISPATCH] Fee Reminder Sent to ${targetEmail || 'student record'} for student ${resolvedStudentName}, Amount ₹${finalAmount}`);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: studentId,
    action: 'reminder_email_send',
    summary: `Dispatched payment reminder of ₹${finalAmount} via email to ${targetEmail || 'student'} for student ${resolvedStudentName}`,
    arguments: { studentId, parentEmail: targetEmail, amount: finalAmount, month: periodMonth },
    result: { reminderId: reminder.id }
  });

  return res.json({
    success: true,
    reminder,
    message: `Payment reminder with payment details dispatched to ${targetEmail || 'student'}!`
  });
}));

