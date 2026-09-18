import { db } from '../supabaseDb.ts';
import { AuditExecutionMode } from '../../src/types.ts';
import { Logger } from '../logger.ts';

const auditLogger = Logger.get('AUDIT');

export interface RecordAuditParams {
  actorId?: string;
  actorUsername?: string;
  actorRole?: string;
  actorStudentId?: string;
  action: string;
  summary: string;
  arguments?: Record<string, any>;
  result?: Record<string, any> | null;
  status?: 'success' | 'failed';
  executionMode?: AuditExecutionMode;
}

/**
 * Sanitizes sensitive fields from arguments (passwords, large base64 payloads) to prevent credential leaks.
 */
export function sanitizeAuditArguments(args?: Record<string, any> | null): Record<string, any> {
  const sanitized: Record<string, any> = {};
  if (args && typeof args === 'object') {
    for (const [key, value] of Object.entries(args)) {
      if (key.toLowerCase().includes('password')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.startsWith('data:image/')) {
        sanitized[key] = value.substring(0, 40) + '...[BASE64_IMAGE_DATA]';
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

/**
 * Real-time Business Scenario & Tool Audit Logger.
 * Automatically sanitizes passwords and base64 payloads to protect user credentials.
 */
export async function recordAudit(params: RecordAuditParams) {
  // Sanitize sensitive fields from arguments to protect user credentials
  const sanitizedArgs = sanitizeAuditArguments(params.arguments);

  // Determine actor: if logged in user is available use id, otherwise 'anonymous'
  const actorId = (params.actorId && params.actorId !== 'system') ? params.actorId : 'anonymous';

  auditLogger.info(`[AUDIT EVENT] ${params.action}: ${params.summary}`, {
    actorId,
    action: params.action,
    status: params.status || 'success',
    arguments: sanitizedArgs
  });

  return await db.recordToolAuditLog({
    userId: actorId,
    actorId: actorId,
    actorRole: params.actorRole,
    actorUsername: params.actorUsername,
    actorStudentId: params.actorStudentId,
    toolName: params.action,
    summary: params.summary,
    actionSummary: params.summary,
    arguments: sanitizedArgs,
    result: params.result || {},
    status: params.status || 'success',
    success: params.status !== 'failed',
    executionMode: params.executionMode || 'direct_api'
  });
}
