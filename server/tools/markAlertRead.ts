import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const markAlertReadDeclaration: FunctionDeclaration = {
  name: 'markAlertRead',
  description: 'Acknowledge or mark a specific academy alert as read.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      alertIdOrTitle: {
        type: Type.STRING,
        description: 'Alert ID, title keyword, or "latest" / "all".'
      }
    }
  }
};

export const markAlertReadTool: AgentTool = {
  name: 'markAlertRead',
  declaration: markAlertReadDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can acknowledge operational alerts.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const alerts = await db.getAlerts();
    if (alerts.length === 0) {
      return {
        result: { acknowledged: false },
        summary: '✓ All academy operational alerts are already cleared and acknowledged.',
        success: true
      };
    }

    const query = String(args?.alertIdOrTitle || '').toLowerCase().trim();
    let alert = alerts.find(a => 
      a.id.toLowerCase() === query || 
      a.title.toLowerCase().includes(query) || 
      (a.message && a.message.toLowerCase().includes(query))
    );

    if (!alert && (query === '' || query === 'latest' || query === 'first' || query === 'recent' || query === 'alert')) {
      alert = alerts.find(a => !a.isRead) || alerts[0];
    }

    if (!alert) {
      return {
        result: null,
        summary: `Could not find alert matching "${args?.alertIdOrTitle}". Available alerts: ${alerts.map(a => `"${a.title}"`).join(', ')}`,
        success: false
      };
    }

    const updated = await db.markAlertAsRead(alert.id);
    return {
      result: updated,
      summary: `✓ Acknowledged alert: **${alert.title}**`,
      success: true
    };
  }
};
