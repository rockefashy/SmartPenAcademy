import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const viewOwnProgressReportsDeclaration: FunctionDeclaration = {
  name: 'viewOwnProgressReports',
  description: 'View your official milestone progress reports, skill star evaluations, and coach observations.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const viewOwnProgressReportsTool: AgentTool = {
  name: 'viewOwnProgressReports',
  declaration: viewOwnProgressReportsDeclaration,
  allowedRoles: ['student'],
  selfServiceOnly: true,
  accessDeniedMessage: 'Access Denied: Only authenticated students can view their progress reports.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(_args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    if (!user?.studentId) {
      return {
        result: null,
        summary: 'Access Denied: No student ID is linked to your account.',
        success: false
      };
    }

    const reports = await db.getProgressReports(user.studentId);
    const reportList = reports.map((r, idx) => `${idx + 1}. ⭐ **${r.milestoneTitle}** (${r.reportDate}) - Overall: ${r.overallStars}/5 Stars\n   Coach Feedback: "${r.teacherFeedback}"`).join('\n\n');

    return {
      result: { count: reports.length, reports },
      summary: `📋 **Your Progress Reports (${reports.length} milestones)**:\n\n${reports.length === 0 ? 'No progress reports have been generated yet.' : reportList}`,
      success: true
    };
  }
};
