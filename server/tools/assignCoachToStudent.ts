import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, findCoach } from './helpers.ts';

export const assignCoachToStudentDeclaration: FunctionDeclaration = {
  name: 'assignCoachToStudent',
  description: 'Assign or reassign an active coach to an active student, or unassign by passing null/none.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student to assign.'
      },
      coachNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the coach to assign (pass "none", "null", or leave blank to unassign).'
      }
    },
    required: ['studentNameOrId']
  }
};

export const assignCoachToStudentTool: AgentTool = {
  name: 'assignCoachToStudent',
  declaration: assignCoachToStudentDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can assign or reassign coaches.',
  rateLimit: { maxCalls: 15, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    // 1. Resolve student
    const student = await findStudent(args?.studentNameOrId);
    if (!student) {
      return {
        result: null,
        summary: `Could not find student matching "${args?.studentNameOrId}".`,
        success: false
      };
    }

    // 2. Resolve coach (if specified and not unassign)
    let targetCoachId: string | null = null;
    let targetCoachName: string | null = null;
    const rawCoach = typeof args?.coachNameOrId === 'string' ? args.coachNameOrId.trim() : '';
    const isUnassign = !rawCoach || ['none', 'null', 'unassign', 'remove'].includes(rawCoach.toLowerCase());

    if (!isUnassign) {
      const coach = await findCoach(rawCoach);
      if (!coach) {
        return {
          result: null,
          summary: `Could not find coach matching "${args?.coachNameOrId}".`,
          success: false
        };
      }
      targetCoachId = coach.id;
      targetCoachName = coach.displayName;
    }

    // 3. Invoke hardened DB method (enforces active status, existence, idempotency)
    try {
      const updated = await db.assignCoachToStudent(student.id, targetCoachId);
      if (!updated) {
        return {
          result: null,
          summary: `Failed to update coach assignment for "${student.displayName}".`,
          success: false
        };
      }

      const effectiveCoachName = updated.coachName || targetCoachName;

      if (updated.assignmentChanged === false) {
        return {
          result: updated,
          summary: `Coach assignment for **${student.displayName}** is already ${effectiveCoachName ? `Coach **${effectiveCoachName}**` : 'unassigned'}. No change was needed.`,
          success: true
        };
      }

      if (targetCoachId) {
        return {
          result: updated,
          summary: `✓ Successfully assigned Coach **${effectiveCoachName}** to **${student.displayName}**.`,
          success: true
        };
      } else {
        return {
          result: updated,
          summary: `✓ Successfully unassigned coach from **${student.displayName}**.`,
          success: true
        };
      }
    } catch (err: any) {
      return {
        result: null,
        summary: `Assignment Error: ${err.message}`,
        success: false
      };
    }
  }
};
