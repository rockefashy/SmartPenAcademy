import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const viewOwnWorkSamplesDeclaration: FunctionDeclaration = {
  name: 'viewOwnWorkSamples',
  description: 'View your own uploaded handwriting work samples, homework exercises, and progress photos.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const viewOwnWorkSamplesTool: AgentTool = {
  name: 'viewOwnWorkSamples',
  declaration: viewOwnWorkSamplesDeclaration,
  allowedRoles: ['student'],
  selfServiceOnly: true,
  accessDeniedMessage: 'Access Denied: Only authenticated student accounts can view their work samples.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(_args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    if (!user?.studentId) {
      return {
        result: null,
        summary: 'Access Denied: No student ID is linked to your student account.',
        success: false
      };
    }

    const works = await db.getStudentWorks(user.studentId);
    const summaryList = works.map((w, idx) => `${idx + 1}. **${w.category || 'Classwork'}** (${w.captureDate || 'Recent'}): ${w.comments || 'No remarks'}`).join('\n');

    return {
      result: { count: works.length, works },
      summary: `📸 **Your Handwriting Work Gallery (${works.length} samples)**:\n${works.length === 0 ? 'No handwriting work samples have been uploaded yet.' : summaryList}`,
      success: true
    };
  }
};
