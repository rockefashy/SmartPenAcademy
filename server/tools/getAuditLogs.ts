import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { auditLogsQuerySchema } from '../schemas.ts';

export const getAuditLogsDeclaration: FunctionDeclaration = {
  name: 'getAuditLogs',
  description: 'View recent security, administrative, and AI tool execution audit logs across the academy.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.INTEGER,
        description: 'Number of logs to retrieve (default 20, max 50).'
      }
    }
  }
};

export const getAuditLogsTool: AgentTool = {
  name: 'getAuditLogs',
  declaration: getAuditLogsDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can view security and audit logs.',
  rateLimit: { maxCalls: 20, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const parsed = auditLogsQuerySchema.safeParse(args || {});
    const limit = parsed.success ? (parsed.data.limit || 20) : 20;

    const logs = await db.getToolAuditLogs(limit);
    const list = logs.slice(0, 10).map((l, idx) => `${idx + 1}. **${l.toolName}** by *${l.actorUsername || l.actorRole}* [${l.success ? '✓' : '✗'}]: ${l.summary}`).join('\n');

    return {
      result: { count: logs.length, logs },
      summary: `🛡️ **Academy Tool Audit History (${logs.length} events)**:\n${logs.length === 0 ? 'No audit events recorded yet.' : list}`,
      success: true
    };
  }
};
