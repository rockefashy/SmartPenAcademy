import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { db } from '../supabaseDb.ts';

export const generateProgressReportDeclaration: FunctionDeclaration = {
  name: 'generateProgressReport',
  description: 'Generate or draft a student progress report (e.g. After 10 Classes) with skill star ratings and coach remarks.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student.'
      },
      milestoneTitle: {
        type: Type.STRING,
        description: 'e.g. "After 10 Classes" or "Level 1 Completion".'
      },
      overallStars: {
        type: Type.NUMBER,
        description: 'Rating out of 5 (1 to 5).'
      },
      feedback: {
        type: Type.STRING,
        description: 'Coach observation and guidance feedback.'
      }
    },
    required: ['studentNameOrId']
  }
};

export const generateProgressReportTool: AgentTool = {
  name: 'generateProgressReport',
  declaration: generateProgressReportDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and assigned coaches can create progress reports.',
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
        summary: `Scoping Policy: You can only generate progress reports for students assigned to you. "${student.firstName}" is not assigned to your coaching roster.`,
        success: false
      };
    }

    const stars = Number(args?.overallStars) || 5;
    const report = await db.saveProgressReport({
      studentId: student.id,
      reportDate: today,
      reportTitle: 'Progress Report',
      milestoneTitle: args?.milestoneTitle || 'After 10 Classes',
      completedClasses: 10,
      totalClasses: 10,
      skills: [
        { skillKey: 'letterFormation', skillName: 'Letter Formation & Geometry', beforeStars: 2, afterStars: stars, progressNote: 'Excellent improvement in loop control' },
        { skillKey: 'lineAlignment', skillName: 'Line Alignment & Margin Balance', beforeStars: 2, afterStars: Math.max(3, stars), progressNote: 'Consistently touches baseline' },
        { skillKey: 'spacingControl', skillName: 'Word Spacing & Flow', beforeStars: 2, afterStars: stars, progressNote: 'Proper uniform finger spacing' },
        { skillKey: 'speedWpm', skillName: 'Writing Speed & Exam Fluency', beforeStars: 2, afterStars: Math.max(3, stars - 1), progressNote: 'Achieved +12 WPM increase' },
        { skillKey: 'pencilGrip', skillName: 'Dynamic Tripod Grip & Posture', beforeStars: 2, afterStars: stars, progressNote: 'Relaxed hand posture with zero fatigue' }
      ],
      overallStars: stars,
      overallRemark: 'Outstanding handwriting transformation!',
      teacherFeedback: args?.feedback || 'Shows high dedication during coaching sessions. Keep up the daily practice!',
      nextSteps: ['Continue 10-minute daily speed drills', 'Maintain relaxed tripod pencil grip'],
      savedToFolder: '/progress_reports/'
    });

    return {
      result: report,
      summary: `⭐ Generated Progress Report (**${report.milestoneTitle}**) for **${student.firstName}** with **${stars} Stars** rating!`,
      success: true
    };
  }
};
