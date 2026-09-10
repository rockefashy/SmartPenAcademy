import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, verifyToolStudentAccess, validateWithSchema } from './helpers.ts';

export const updateFeeStatusDeclaration: FunctionDeclaration = {
  name: 'updateFeeStatus',
  description: 'Update the payment status (e.g. Paid, Pending, Waived, Overdue) or amount of an existing coaching fee record. Requires explicit confirmation before executing.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      feeId: {
        type: Type.STRING,
        description: 'Exact ID of the fee record to update (optional if student and period provided).'
      },
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student associated with the fee record.'
      },
      period: {
        type: Type.STRING,
        description: 'Billing cycle or month of the fee (e.g. "Classes 1 - 8", "2026-09").'
      },
      newStatus: {
        type: Type.STRING,
        description: 'The updated status: "Paid", "Pending", "Waived", or "Overdue".'
      },
      newAmount: {
        type: Type.NUMBER,
        description: 'Optional adjusted fee amount in INR.'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional remark or reason for adjusting fee status/amount.'
      },
      confirmed: {
        type: Type.BOOLEAN,
        description: 'Set to true ONLY if the user explicitly said "confirm", "yes", "proceed", or explicitly confirmed the fee status change. If false or omitted, the tool outputs a pending draft confirmation.'
      }
    },
    required: ['newStatus']
  }
};

const updateFeeStatusSchema = z.object({
  feeId: z.string().trim().optional(),
  studentNameOrId: z.string().trim().optional(),
  period: z.string().trim().optional(),
  newStatus: z.enum(['Paid', 'Pending', 'Waived', 'Overdue'], {
    message: 'newStatus must be one of "Paid", "Pending", "Waived", or "Overdue".'
  }),
  newAmount: z.coerce.number().positive('Amount must be positive').optional(),
  notes: z.string().trim().optional(),
  confirmed: z.boolean().optional().default(false)
});

type UpdateFeeStatusInput = z.infer<typeof updateFeeStatusSchema>;

export const updateFeeStatusTool: AgentTool = {
  name: 'updateFeeStatus',
  declaration: updateFeeStatusDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and assigned coaches can modify fee records.',
  rateLimit: { maxCalls: 15, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;

    // 1. Validate parameters
    const validation = validateWithSchema<UpdateFeeStatusInput>(updateFeeStatusSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for fee status update.',
        success: false
      };
    }

    const { feeId, studentNameOrId, period, newStatus, newAmount, notes, confirmed } = validation.data;

    // Must provide either feeId or studentNameOrId
    if (!feeId && !studentNameOrId) {
      return {
        result: null,
        summary: 'Validation Error: Please provide either a "feeId" or a "studentNameOrId" to identify the fee record.',
        success: false
      };
    }

    // 2. Entity Resolution
    let feeRecord: any = null;
    let student: any = null;

    if (feeId) {
      feeRecord = await db.findFeeById(feeId);
      if (!feeRecord) {
        return {
          result: null,
          summary: `Could not find fee record matching ID "${feeId}".`,
          success: false
        };
      }
      student = await db.getStudentById(feeRecord.studentId);
    } else if (studentNameOrId) {
      student = await findStudent(studentNameOrId);
      if (!student) {
        return {
          result: null,
          summary: `Could not find student matching "${studentNameOrId}".`,
          success: false
        };
      }

      const allFees = await db.getFeesByMonth(period ? period.substring(0, 7) : new Date().toISOString().substring(0, 7), {
        studentIds: [student.id]
      });

      // Filter to student's fees
      let matchedFees = allFees.filter(f => f.studentId === student.id);
      if (period) {
        matchedFees = matchedFees.filter(f => f.yearMonth.toLowerCase() === period.toLowerCase() || f.date?.startsWith(period));
      }

      if (matchedFees.length === 0) {
        return {
          result: null,
          summary: `Could not find any fee record for student "${student.displayName}"${period ? ` matching period "${period}"` : ''}.`,
          success: false
        };
      }
      // Pick exact or most recent fee record
      feeRecord = matchedFees[0];
    }

    // 3. Authorization & Scoping check for coaches
    if (user?.role === 'coach' && student) {
      if (!verifyToolStudentAccess(user, student)) {
        return {
          result: null,
          summary: `Privacy Scoping: As a coach, you can only modify fee records for students assigned to you. "${student.displayName}" is not in your roster.`,
          success: false
        };
      }
    }

    // 4. Idempotency Check
    const studentDisplayName = student?.displayName || `Student (${feeRecord.studentId})`;
    const isAmountUnchanged = newAmount === undefined || feeRecord.amount === newAmount;
    if (feeRecord.status === newStatus && isAmountUnchanged) {
      return {
        result: { fee: feeRecord, alreadyUpdated: true },
        summary: `Fee record #${feeRecord.id} for "${studentDisplayName}" is already in status "${newStatus}"${newAmount !== undefined ? ` with amount ₹${feeRecord.amount}` : ''}. No changes made.`,
        success: true
      };
    }

    // 5. Draft Confirmation (confirmed !== true)
    if (!confirmed) {
      return {
        result: {
          draft: true,
          feeId: feeRecord.id,
          studentName: studentDisplayName,
          studentId: feeRecord.studentId,
          cyclePeriod: feeRecord.yearMonth,
          currentStatus: feeRecord.status,
          currentAmount: feeRecord.amount,
          newStatus,
          newAmount: newAmount !== undefined ? newAmount : feeRecord.amount,
          notes: notes || undefined
        },
        summary: `⚠️ **Confirmation Required: Modify Fee Record Status**\n\n` +
          `• **Student**: ${studentDisplayName} (ID: ${feeRecord.studentId})\n` +
          `• **Fee Record**: #${feeRecord.id} (${feeRecord.yearMonth})\n` +
          `• **Current Status & Amount**: ${feeRecord.status} • ₹${feeRecord.amount}\n` +
          `• **Proposed New Status**: **${newStatus}**${newAmount !== undefined ? ` • New Amount: **₹${newAmount}**` : ''}\n\n` +
          `**Financial Ledger Impact**:\n` +
          `1. Financial ledger record #${feeRecord.id} will be updated to status "${newStatus}".\n` +
          `2. Student fee alerts and pending balance calculations will adjust accordingly.\n\n` +
          `To proceed, please reply: **"Confirm fee status change for ${studentDisplayName}"** or **"Yes, update fee status"**.`,
        success: true
      };
    }

    // 6. Execution (confirmed === true)
    try {
      const updates: any = {
        status: newStatus
      };
      if (newAmount !== undefined) updates.amount = newAmount;
      if (notes) updates.notes = notes;

      const updated = await db.updateFeeRecord(feeRecord.id, updates);
      if (!updated) {
        return {
          result: null,
          summary: `Failed to update fee record #${feeRecord.id}.`,
          success: false
        };
      }

      return {
        result: {
          fee: updated,
          updated: true
        },
        summary: `✓ Fee record #${updated.id} for **${studentDisplayName}** (${updated.yearMonth}) updated to **${updated.status}**${newAmount !== undefined ? ` (Amount: ₹${updated.amount})` : ''}.`,
        success: true
      };
    } catch (err: any) {
      return {
        result: null,
        summary: `Fee Update Error: ${err.message || 'Failed to update fee record.'}`,
        success: false
      };
    }
  }
};
