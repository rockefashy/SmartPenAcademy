import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent } from './helpers.ts';
import { switchStudentSchema } from '../schemas.ts';

export const switchActiveSiblingDeclaration: FunctionDeclaration = {
  name: 'switchActiveSibling',
  description: 'Switch the active student profile to a sibling under the same family account.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the sibling student to switch to.'
      }
    },
    required: ['studentNameOrId']
  }
};

export const switchActiveSiblingTool: AgentTool = {
  name: 'switchActiveSibling',
  declaration: switchActiveSiblingDeclaration,
  allowedRoles: ['student'],
  selfServiceOnly: true,
  accessDeniedMessage: 'Access Denied: Only family/student accounts can switch siblings.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    if (!user) {
      return {
        result: null,
        summary: 'Authentication required.',
        success: false
      };
    }

    const targetStudent = await findStudent(args?.studentNameOrId);
    if (!targetStudent) {
      return {
        result: null,
        summary: `Could not find student matching "${args?.studentNameOrId}".`,
        success: false
      };
    }

    const parsed = switchStudentSchema.safeParse({ studentId: targetStudent.id });
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message}`,
        success: false
      };
    }

    const currentUser = await db.findUserById(user.id);
    if (!currentUser) {
      return {
        result: null,
        summary: 'User account not found.',
        success: false
      };
    }

    const familyStudents = await db.getSiblingStudentsForUser(currentUser);
    const isFamilyMember = familyStudents.some(s => s.id === targetStudent.id);
    if (!isFamilyMember && targetStudent.id !== user.studentId) {
      return {
        result: null,
        summary: `Security Policy: "${targetStudent.displayName}" does not belong to your linked family account.`,
        success: false
      };
    }

    return {
      result: {
        switchedToStudentId: targetStudent.id,
        displayName: targetStudent.displayName,
        gradeClass: targetStudent.gradeClass
      },
      summary: `✓ Switched active student context to **${targetStudent.displayName}** (${targetStudent.gradeClass}). You can now view their attendance, fee status, and progress reports!`,
      success: true
    };
  }
};
