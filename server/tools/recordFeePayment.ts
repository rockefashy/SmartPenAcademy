import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { db } from '../supabaseDb.ts';
import { createFeeSchema } from '../schemas.ts';

export const recordFeePaymentDeclaration: FunctionDeclaration = {
  name: 'recordFeePayment',
  description: 'Record an 8-class cycle coaching fee payment of ₹1,600 or custom amount and generate a receipt. If confirmed is false, returns a draft preview requiring user confirmation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of student making the fee payment.'
      },
      amount: {
        type: Type.NUMBER,
        description: 'Amount in INR (default 1600).'
      },
      cyclePeriod: {
        type: Type.STRING,
        description: 'Cycle label, e.g. "Classes 1 - 8", "Classes 9 - 16", or month e.g. "August 2026".'
      },
      paymentMethod: {
        type: Type.STRING,
        description: 'Payment method, e.g. "GPAY", "Cash", "Bank Transfer".'
      },
      confirmed: {
        type: Type.BOOLEAN,
        description: 'Set to true ONLY if the administrator explicitly said "confirm", "yes", "proceed", or explicitly confirmed the transaction. If false or omitted, the tool outputs a pending draft confirmation.'
      }
    },
    required: ['studentNameOrId']
  }
};

export const recordFeePaymentTool: AgentTool = {
  name: 'recordFeePayment',
  declaration: recordFeePaymentDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and assigned coaches can record coaching fee payments.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user, today } = context;

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
        summary: `Privacy Scoping: As a coach, you can only record fee payments for your assigned students. "${student.firstName}" is not assigned to your coaching roster.`,
        success: false
      };
    }

    const amount = Number(args?.amount) || 1600;
    const cyclePeriod = args?.cyclePeriod || 'Classes 1 - 8';
    const isConfirmed = args?.confirmed === true;

    // Two-step confirmation gate for irreversible financial mutations
    if (!isConfirmed) {
      return {
        result: {
          draft: true,
          studentName: student.firstName,
          studentId: student.id,
          amount,
          cyclePeriod,
          paymentMethod: args?.paymentMethod || 'GPAY (8861751000)'
        },
        summary: `⚠️ **Confirmation Required Before Recording Payment**\n\n• **Student**: ${student.firstName} (ID: ${student.id})\n• **Amount**: ₹${amount}\n• **Cycle**: ${cyclePeriod}\n• **Method**: ${args?.paymentMethod || 'GPAY (8861751000)'}\n\nPlease reply **"Confirm payment"** or **"Yes, record fee for ${student.firstName}"** to finalize this financial transaction.`,
        success: true
      };
    }

    const feePayload = {
      studentId: student.id,
      yearMonth: cyclePeriod,
      amount,
      status: 'Paid' as const,
      paidDate: today,
      paymentMethod: args?.paymentMethod || 'GPAY (8861751000)'
    };

    // Authoritative Zod schema validation (parity with POST /api/fees)
    const parsed = createFeeSchema.safeParse(feePayload);
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid fee payment record.'}`,
        success: false
      };
    }

    const feeRecord = await db.saveFeeRecord(parsed.data as any);

    return {
      result: feeRecord,
      summary: `✓ **Payment Confirmed & Recorded**: ₹${amount} for **${student.firstName}** (${cyclePeriod}). Receipt Number: **${feeRecord.receiptNumber || 'N/A'}** (${args?.paymentMethod || 'GPAY'}).`,
      success: true
    };
  }
};
