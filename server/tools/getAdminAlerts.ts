import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const getAdminAlertsDeclaration: FunctionDeclaration = {
  name: 'getAdminAlerts',
  description: 'Get real-time admin alerts for 8-class fee dues, demo bookings, and registrations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      unreadOnly: {
        type: Type.BOOLEAN,
        description: 'Whether to only return unread alerts.'
      }
    }
  }
};

export const getAdminAlertsTool: AgentTool = {
  name: 'getAdminAlerts',
  declaration: getAdminAlertsDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can view operational alerts.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const alerts = await db.getAlerts();
    const unread = alerts.filter(a => !a.isRead);
    const targetList = args?.unreadOnly ? unread : alerts;

    return {
      result: { total: alerts.length, unreadCount: unread.length, alerts: targetList },
      summary: `🔔 **System Alerts (${unread.length} unread / ${alerts.length} total)**:\n${targetList.length === 0 ? '✓ All alerts are cleared!' : targetList.map(a => `• **${a.title}**: ${a.message}`).join('\n')}`,
      success: true
    };
  }
};
