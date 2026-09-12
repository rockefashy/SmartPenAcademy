import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { progressTrackerSchema } from '../schemas.ts';

export const saveProgressTrackerDeclaration: FunctionDeclaration = {
  name: 'saveProgressTracker',
  description: 'Record student diagnostic scores (grip, letter formation, spacing, speed, posture) and coach observations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student.'
      },
      evaluationDate: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format (default today).'
      },
      gripScore: { type: Type.NUMBER, description: 'Grip score 1 to 5' },
      letterFormationScore: { type: Type.NUMBER, description: 'Letter formation score 1 to 5' },
      spacingScore: { type: Type.NUMBER, description: 'Spacing score 1 to 5' },
      speedScore: { type: Type.NUMBER, description: 'Speed score 1 to 5' },
      postureScore: { type: Type.NUMBER, description: 'Posture score 1 to 5' },
      overallScore: { type: Type.NUMBER, description: 'Overall score/stars 1 to 5' },
      remarks: { type: Type.STRING, description: 'General progress remarks' },
      coachNotes: { type: Type.STRING, description: 'Coach confidential notes' }
    },
    required: ['studentNameOrId']
  }
};

export const saveProgressTrackerTool: AgentTool = {
  name: 'saveProgressTracker',
  declaration: saveProgressTrackerDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can save progress tracker scores.',
  rateLimit: { maxCalls: 15, windowMs: 60 * 1000 },
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
        summary: `Scoping Policy: You can only record progress tracker evaluations for assigned students. "${student.firstName}" is not assigned to you.`,
        success: false
      };
    }

    const payload = {
      studentId: student.id,
      evaluationDate: args?.evaluationDate || today,
      evaluationTitle: 'Milestone Evaluation',
      overallStars: Number(args?.overallScore) || 5,
      formationStars: args?.letterFormationScore,
      spacingStars: args?.spacingScore,
      speedStars: args?.speedScore,
      gripPostureStars: args?.gripScore || args?.postureScore,
      overallRemark: args?.remarks || 'Evaluated via SmartPen AI Assistant',
      teacherFeedback: args?.remarks || 'Evaluated via SmartPen AI Assistant',
      coachNotes: args?.coachNotes
    };

    const parsed = progressTrackerSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid evaluation format'}`,
        success: false
      };
    }

    const saved = await db.saveProgressTracker(payload as any);
    return {
      result: saved,
      summary: `📈 Recorded Progress Tracker evaluation for **${student.firstName}** on **${saved.evaluationDate}** with Overall Stars: **${saved.overallStars}/5**!`,
      success: true
    };
  }
};
