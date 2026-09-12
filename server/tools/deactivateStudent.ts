import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, validateWithSchema } from './helpers.ts';

export const deactivateStudentDeclaration: FunctionDeclaration = {
  name: 'deactivateStudent',
  description: 'Soft-deactivate an active student, placing their account into a read-only historical archive and disabling portal login. Requires explicit confirmation before executing.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student to deactivate.'
      },
      dateOfLeaving: {
        type: Type.STRING,
        description: 'Optional date of leaving in YYYY-MM-DD format (defaults to current date if omitted).'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional exit remarks, reason for leaving, or withdrawal notes.'
      },
      confirmed: {
        type: Type.BOOLEAN,
        description: 'Set to true ONLY if the administrator explicitly said "confirm", "yes", "proceed", or explicitly confirmed the deactivation. If false or omitted, the tool outputs a pending draft confirmation.'
      }
    },
    required: ['studentNameOrId']
  }
};

const deactivateStudentSchema = z.object({
  studentNameOrId: z.string({ message: 'Student identifier is required.' }).trim().min(1, 'Student identifier is required.'),
  dateOfLeaving: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of leaving must be in YYYY-MM-DD format (e.g. "2026-09-10")').optional(),
  notes: z.string().trim().optional(),
  confirmed: z.boolean().optional().default(false)
});

type DeactivateStudentInput = z.infer<typeof deactivateStudentSchema>;

export const deactivateStudentTool: AgentTool = {
  name: 'deactivateStudent',
  declaration: deactivateStudentDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can deactivate students.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const today = context.today || new Date().toISOString().split('T')[0];

    // 1. Validate parameters
    const validation = validateWithSchema<DeactivateStudentInput>(deactivateStudentSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for student deactivation.',
        success: false
      };
    }

    const { studentNameOrId, dateOfLeaving, notes, confirmed } = validation.data;

    // 2. Entity resolution
    const student = await findStudent(studentNameOrId);
    if (!student) {
      return {
        result: null,
        summary: `Could not find student matching "${studentNameOrId}".`,
        success: false
      };
    }

    // 3. Idempotency check: Already Inactive
    if (student.status === 'Inactive') {
      const recordedLeaving = student.dateOfLeaving || 'N/A';
      return {
        result: {
          student,
          alreadyInactive: true
        },
        summary: `Student "${student.firstName}" is already Inactive (recorded date of leaving: ${recordedLeaving}). No changes made.`,
        success: true
      };
    }

    const effectiveDate = dateOfLeaving || today;

    // 4. Draft confirmation (confirmed !== true)
    if (!confirmed) {
      return {
        result: {
          draft: true,
          studentId: student.id,
          firstName: student.firstName,
          gradeClass: student.gradeClass || 'N/A',
          schoolName: student.schoolName || 'N/A',
          parentName: student.parentName,
          parentPhone: student.whatsappMobile || 'N/A',
          assignedCoach: student.coachName || 'None',
          dateOfLeaving: effectiveDate,
          notes: notes || undefined
        },
        summary: `⚠️ **Confirmation Required: Deactivate Student**\n\n` +
          `• **Student**: ${student.firstName} (ID: ${student.id})\n` +
          `• **Grade / School**: ${student.gradeClass || 'N/A'} • ${student.schoolName || 'N/A'}\n` +
          `• **Parent**: ${student.parentName} (${student.whatsappMobile || 'N/A'})\n` +
          `• **Assigned Coach**: ${student.coachName || 'None'}\n` +
          `• **Date of Leaving**: ${effectiveDate}\n\n` +
          `**Operational Impact**:\n` +
          `1. Student portal login will be disabled immediately.\n` +
          `2. Attendance marking and fee processing will be blocked.\n` +
          `3. Student will be placed into read-only historical archive.\n` +
          `4. Historical records (attendance, receipts, works) are preserved permanently.\n\n` +
          `To proceed, please reply: **"Confirm deactivation of ${student.firstName}"** or **"Yes, deactivate student"**.`,
        success: true
      };
    }

    // 5. Execution (confirmed === true)
    try {
      const updated = await db.updateStudent(student.id, {
        status: 'Inactive',
        dateOfLeaving: effectiveDate,
        notes: notes || undefined
      });

      if (!updated) {
        return {
          result: null,
          summary: `Failed to deactivate student "${student.firstName}".`,
          success: false
        };
      }

      return {
        result: {
          student: updated,
          deactivated: true
        },
        summary: `✓ Student **${updated.firstName}** has been successfully deactivated (soft delete). Historical records remain preserved.`,
        success: true
      };
    } catch (err: any) {
      return {
        result: null,
        summary: `Deactivation Error: ${err.message || 'Failed to deactivate student.'}`,
        success: false
      };
    }
  }
};
