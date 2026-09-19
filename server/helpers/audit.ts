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
 * Sanitizes sensitive fields from arguments (passwords, tokens, large base64 payloads) to prevent credential leaks.
 */
export function sanitizeAuditArguments(args?: Record<string, any> | null): Record<string, any> {
  const sanitized: Record<string, any> = {};
  if (args && typeof args === 'object') {
    for (const [key, value] of Object.entries(args)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token')) {
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
 * Scrubs raw email addresses and phone numbers from unstructured summary strings
 * to prevent plain-text PII in audit event listings.
 */
export function sanitizeAuditSummary(summary: string): string {
  if (!summary) return '';
  return summary
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE_REDACTED]');
}

/**
 * Real-time Business Scenario & Tool Audit Logger.
 * Automatically sanitizes credentials, tokens, and PII.
 */
export async function recordAudit(params: RecordAuditParams) {
  const sanitizedArgs = sanitizeAuditArguments(params.arguments);
  const sanitizedSummary = sanitizeAuditSummary(params.summary);

  // Determine actor: if logged in user is available use id, otherwise 'anonymous'
  const actorId = (params.actorId && params.actorId !== 'system') ? params.actorId : 'anonymous';

  auditLogger.info(`[AUDIT EVENT] ${params.action}: ${sanitizedSummary}`, {
    actorId,
    action: params.action,
    status: params.status || 'success',
    arguments: sanitizedArgs
  });

  try {
    return await db.recordToolAuditLog({
      userId: actorId,
      actorId: actorId,
      actorRole: params.actorRole,
      actorUsername: params.actorUsername,
      actorStudentId: params.actorStudentId,
      toolName: params.action,
      summary: sanitizedSummary,
      actionSummary: sanitizedSummary,
      arguments: sanitizedArgs,
      result: params.result || {},
      status: params.status || 'success',
      success: params.status !== 'failed',
      executionMode: params.executionMode || 'direct_api'
    });
  } catch (err: any) {
    auditLogger.error(`[AUDIT PERSISTENCE FAILURE] Failed to write audit log to database for action "${params.action}": ${err.message}`, {
      action: params.action,
      error: err.message,
      actorId
    });
    return null;
  }
}

/**
 * Convenience helper to create a structured audit log directly from an Express request context,
 * eliminating repetitive boilerplate across route handlers.
 */
export async function auditFromReq(
  req: any,
  action: string,
  summary: string,
  args?: Record<string, any>,
  result?: Record<string, any> | null,
  status: 'success' | 'failed' = 'success',
  actorStudentId?: string
) {
  return await recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username || req.user?.email,
    actorRole: req.user?.role,
    actorStudentId: actorStudentId || req.user?.studentId,
    action,
    summary,
    arguments: args,
    result,
    status
  });
}

