import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { db } from '../supabaseDb.ts';
import { sendFeeReminderEmail } from '../email.ts';

export const sendFeeReminderDeclaration: FunctionDeclaration = {
  name: 'sendFeeReminder',
  description: 'Send a fee payment reminder to a parent with Google Pay UPI link to 8861751000.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student whose parent should receive reminder.'
      },
      amount: {
        type: Type.NUMBER,
        description: 'Fee amount in INR (default 1600).'
      }
    },
    required: ['studentNameOrId']
  }
};

export const sendFeeReminderTool: AgentTool = {
  name: 'sendFeeReminder',
  declaration: sendFeeReminderDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and assigned coaches can dispatch fee reminders.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;

    const student = await findStudent(args?.studentNameOrId);
    if (!student) {
      return {
        result: null,
        summary: `Could not find student matching "${args?.studentNameOrId}".`,
        success: false
      };
    }

    if (user?.role === 'coach' && !verifyToolStudentAccess(user, student)) {
      return {
        result: null,
        summary: `Privacy Scoping: As a coach, you can only dispatch fee reminders to your assigned students. "${student.firstName}" is not assigned to your coaching roster.`,
        success: false
      };
    }

    const amount = Number(args?.amount) || 1600;
    const gpayLink = `upi://pay?pa=8861751000@okbizaxis&pn=SmartPen%20Academy&am=${amount}&cu=INR`;

    const reminder = await db.saveFeeReminder({
      studentId: student.id,
      parentEmail: student.email,
      parentName: student.parentName,
      studentName: student.firstName,
      amount,
      month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      gpayLink,
      status: 'Sent'
    });

    if (student.email) {
      sendFeeReminderEmail({
        toEmail: student.email,
        parentName: student.parentName,
        studentName: student.firstName,
        amount,
        gpayLink
      }).catch(err => {
        console.error('[Resend Background Error] AI agent fee reminder email dispatch:', err);
      });
    }

    return {
      result: reminder,
      summary: `📲 Dispatched Fee Reminder of **₹${amount}** to **${student.parentName}** (${student.email}) for student **${student.firstName}** with Google Pay UPI link to **8861751000**.`,
      success: true
    };
  }
};
