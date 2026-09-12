import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { studentWorkUploadSchema } from '../schemas.ts';

export const uploadStudentWorkDeclaration: FunctionDeclaration = {
  name: 'uploadStudentWork',
  description: 'Attach or record a student handwriting sample, homework photo, or diagnostic exercise.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student.'
      },
      imageData: {
        type: Type.STRING,
        description: 'Base64 image data or image URL of the work sample.'
      },
      category: {
        type: Type.STRING,
        description: '"Assessment", "Classwork", "Homework", or "Milestone". Default is "Classwork".'
      },
      comments: {
        type: Type.STRING,
        description: 'Coach feedback or observation on letter forms, grip, or neatness.'
      }
    },
    required: ['studentNameOrId', 'imageData']
  }
};

export const uploadStudentWorkTool: AgentTool = {
  name: 'uploadStudentWork',
  declaration: uploadStudentWorkDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can upload student work samples.',
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
        summary: `Scoping Policy: As a coach, you can only upload work samples for assigned students. "${student.firstName}" is not assigned to you.`,
        success: false
      };
    }

    const payload = {
      studentId: student.id,
      imageData: args.imageData,
      captureDate: today,
      category: args.category || 'Classwork',
      comments: args.comments || 'Uploaded via SmartPen AI Assistant'
    };

    const parsed = studentWorkUploadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid work sample format'}`,
        success: false
      };
    }

    const saved = await db.saveStudentWork(parsed.data as any);
    return {
      result: saved,
      summary: `📸 Successfully attached **${saved.category}** handwriting sample for **${student.firstName}** on ${saved.captureDate}!`,
      success: true
    };
  }
};
