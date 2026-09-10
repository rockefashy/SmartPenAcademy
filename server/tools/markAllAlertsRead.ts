import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const markAllAlertsReadDeclaration: FunctionDeclaration = {
  name: 'markAllAlertsRead',
  description: 'Clear and mark all academy operational alerts as read.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const markAllAlertsReadTool: AgentTool = {
  name: 'markAllAlertsRead',
  declaration: markAllAlertsReadDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can clear alerts.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(_args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    await db.markAllAlertsAsRead();
    return {
      result: { cleared: true },
      summary: '✓ All academy operational alerts have been marked as read.',
      success: true
    };
  }
};
