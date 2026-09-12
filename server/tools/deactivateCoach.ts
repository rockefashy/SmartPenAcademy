import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findCoach, validateWithSchema } from './helpers.ts';

export const deactivateCoachDeclaration: FunctionDeclaration = {
  name: 'deactivateCoach',
  description: 'Soft-deactivate a coach, disabling their login portal access and unassigning all active students currently assigned to them. Requires explicit confirmation before executing.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      coachNameOrId: {
        type: Type.STRING,
        description: 'Name, email, or ID of the coach to deactivate.'
      },
      dateOfLeaving: {
        type: Type.STRING,
        description: 'Optional date of leaving in YYYY-MM-DD format (defaults to current date if omitted).'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional exit remarks or termination reason.'
      },
      confirmed: {
        type: Type.BOOLEAN,
        description: 'Set to true ONLY if the administrator explicitly said "confirm", "yes", "proceed", or explicitly confirmed the coach deactivation. If false or omitted, the tool outputs a pending draft confirmation.'
      }
    },
    required: ['coachNameOrId']
  }
};

const deactivateCoachSchema = z.object({
  coachNameOrId: z.string({ message: 'Coach identifier is required.' }).trim().min(1, 'Coach identifier is required.'),
  dateOfLeaving: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of leaving must be in YYYY-MM-DD format (e.g. "2026-09-10")').optional(),
  notes: z.string().trim().optional(),
  confirmed: z.boolean().optional().default(false)
});

type DeactivateCoachInput = z.infer<typeof deactivateCoachSchema>;

export const deactivateCoachTool: AgentTool = {
  name: 'deactivateCoach',
  declaration: deactivateCoachDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can deactivate coaches.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const today = context.today || new Date().toISOString().split('T')[0];

    // 1. Validate parameters
    const validation = validateWithSchema<DeactivateCoachInput>(deactivateCoachSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for coach deactivation.',
        success: false
      };
    }

    const { coachNameOrId, dateOfLeaving, notes, confirmed } = validation.data;

    // 2. Entity resolution
    const coach = await findCoach(coachNameOrId);
    if (!coach) {
      return {
        result: null,
        summary: `Could not find coach matching "${coachNameOrId}".`,
        success: false
      };
    }

    // 3. Idempotency check: Already Inactive
    if (coach.status === 'Inactive') {
      const recordedLeaving = coach.dateOfLeaving || 'N/A';
      return {
        result: {
          coach,
          alreadyInactive: true
        },
        summary: `Coach "${coach.firstName}" is already Inactive (recorded date of leaving: ${recordedLeaving}). No changes made.`,
        success: true
      };
    }

    const effectiveDate = dateOfLeaving || today;

    // Fetch active students assigned to this coach to accurately describe side effects
    const allStudents = await db.getAllStudents();
    const assignedStudents = allStudents.filter(s => s.coachId === coach.id && s.status === 'Active');

    // 4. Draft confirmation (confirmed !== true)
    if (!confirmed) {
      const studentListPreview = assignedStudents.length > 0
        ? ` (${assignedStudents.map(s => s.firstName).join(', ')})`
        : '';

      return {
        result: {
          draft: true,
          coachId: coach.id,
          firstName: coach.firstName,
          designation: coach.designation || 'Coach',
          email: coach.email,
          phone: coach.phoneNumber || 'N/A',
          assignedStudentCount: assignedStudents.length,
          assignedStudents: assignedStudents.map(s => ({ id: s.id, name: s.firstName })),
          dateOfLeaving: effectiveDate,
          notes: notes || undefined
        },
        summary: `⚠️ **Confirmation Required: Deactivate Coach**\n\n` +
          `• **Coach**: ${coach.firstName} (ID: ${coach.id}, ${coach.designation || 'Coach'})\n` +
          `• **Active Assigned Students**: ${assignedStudents.length} student(s)${studentListPreview}\n` +
          `• **Date of Leaving**: ${effectiveDate}\n\n` +
          `**Operational Impact**:\n` +
          `1. Coach portal login will be disabled immediately.\n` +
          `2. All ${assignedStudents.length} active student(s) will be unassigned (coach_id set to null).\n` +
          `3. Coach will be removed from active coaching assignments.\n` +
          `4. Historical coaching and attendance records are permanently preserved.\n\n` +
          `To proceed, please reply: **"Confirm deactivation of ${coach.firstName}"** or **"Yes, deactivate coach"**.`,
        success: true
      };
    }

    // 5. Execution (confirmed === true)
    try {
      await db.deleteCoach(coach.id);

      return {
        result: {
          coachId: coach.id,
          firstName: coach.firstName,
          deactivated: true,
          unassignedStudentCount: assignedStudents.length
        },
        summary: `✓ Coach **${coach.firstName}** has been successfully deactivated (soft delete). ${assignedStudents.length} assigned student(s) have been unassigned. Historical records remain preserved.`,
        success: true
      };
    } catch (err: any) {
      return {
        result: null,
        summary: `Deactivation Error: ${err.message || 'Failed to deactivate coach.'}`,
        success: false
      };
    }
  }
};
