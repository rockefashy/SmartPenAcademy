import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { updateStudentSchema } from '../schemas.ts';

export const updateStudentProfileDeclaration: FunctionDeclaration = {
  name: 'updateStudentProfile',
  description: 'Update student profile details such as grade, school name, preferred slot/days, handwriting style, or notes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student.'
      },
      gradeClass: {
        type: Type.STRING,
        description: 'New grade (e.g. "Grade 5").'
      },
      schoolName: {
        type: Type.STRING,
        description: 'School name.'
      },
      handwritingStyle: {
        type: Type.STRING,
        description: '"Print", "Cursive", or "Both".'
      },
      preferredDays: {
        type: Type.STRING,
        description: 'Batch days (e.g. "Mon, Wed, Fri").'
      },
      preferredSlot: {
        type: Type.STRING,
        description: 'Class time slot (e.g. "05:00 PM").'
      },
      notes: {
        type: Type.STRING,
        description: 'Diagnostic notes or learning remarks.'
      }
    },
    required: ['studentNameOrId']
  }
};

export const updateStudentProfileTool: AgentTool = {
  name: 'updateStudentProfile',
  declaration: updateStudentProfileDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and assigned coaches can edit student profiles.',
  rateLimit: { maxCalls: 15, windowMs: 60 * 1000 },
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
        summary: `Scoping Policy: As a coach, you can only update student profiles assigned to your roster. "${student.displayName}" is not assigned to you.`,
        success: false
      };
    }

    const updates: any = {};
    if (args.gradeClass) updates.gradeClass = args.gradeClass;
    if (args.schoolName) updates.schoolName = args.schoolName;
    if (args.handwritingStyle) updates.handwritingStyle = args.handwritingStyle;
    if (args.preferredDays) updates.preferredDays = args.preferredDays;
    if (args.preferredSlot) updates.preferredSlot = args.preferredSlot;
    if (args.notes) updates.notes = args.notes;

    const parsed = updateStudentSchema.safeParse(updates);
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid student updates'}`,
        success: false
      };
    }

    const updated = await db.updateStudent(student.id, parsed.data as any);
    return {
      result: updated,
      summary: `✓ Successfully updated profile for **${student.displayName}** (${student.gradeClass})!`,
      success: true
    };
  }
};
