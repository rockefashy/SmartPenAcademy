import { ToolAuditLog } from '../../src/types';
import { getSupabase, applyOffsetPagination } from './client.ts';

export function mapToolAuditLogRow(row: any): ToolAuditLog {
  return {
    id: row.id,
    userId: row.user_id || row.actor_id || '',
    userRole: row.user_role || row.actor_role || '',
    actorId: row.user_id || row.actor_id || '',
    actorUsername: row.actor_username || undefined,
    actorRole: (row.user_role || row.actor_role || undefined) as any,
    actorStudentId: row.actor_student_id || undefined,
    executionMode: row.execution_mode || undefined,
    toolName: row.tool_name,
    arguments: row.arguments || row.input_payload || {},
    result: row.result || row.output_result || {},
    actionSummary: row.action_summary || row.summary || '',
    status: row.status || (row.success ? 'success' : 'failed'),
    createdAt: row.created_at || ''
  };
}

export class AuditDatabase {
  async recordToolAuditLog(log: any): Promise<ToolAuditLog> {
    const supabase = getSupabase();
    const id = crypto.randomUUID();

    // Format actor: always logged in userId or 'anonymous'
    const rawUserId = log.userId || log.actorId;
    const userId = (!rawUserId || rawUserId === 'system') ? 'anonymous' : rawUserId;

    const row: any = {
      id,
      user_id: userId,
      user_role: log.actorRole || log.userRole || 'student',
      actor_student_id: log.actorStudentId || null,
      execution_mode: log.executionMode || 'remote_gemini',
      tool_name: log.toolName || log.action || 'system_action',
      action_summary: log.actionSummary || log.summary || '',
      arguments: log.arguments || {},
      input_payload: log.arguments || {},
      result: log.result || {},
      output_result: log.result || {},
      status: log.status || (log.success !== false ? 'success' : 'failed'),
      created_at: new Date().toISOString()
    };
    if (log.actorUsername) {
      row.actor_username = log.actorUsername;
    }

    let { data, error } = await supabase
      .from('tool_audit_logs')
      .insert(row)
      .select()
      .single();

    // If actor_username column is not yet present on tool_audit_logs (prior to migration 006 execution), retry without actor_username
    if (error && error.message && error.message.includes('actor_username')) {
      console.warn('[AuditDatabase] Warning: public.tool_audit_logs.actor_username column missing in database; falling back to schema-compatible row without actor_username. Run migration 006 to enable actor_username recording.');
      const fallbackRow = { ...row };
      delete fallbackRow.actor_username;
      const retryResult = await supabase
        .from('tool_audit_logs')
        .insert(fallbackRow)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error(`[AuditDatabase] Fatal error recording tool audit log: ${error.message}`);
      throw new Error(`Failed to record tool audit log: ${error.message}`);
    }

    return mapToolAuditLogRow(data);
  }

  async getToolAuditLogs(options?: { page?: number; limit?: number } | number): Promise<ToolAuditLog[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('tool_audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeof options === 'object' && options !== null && options.page && options.limit) {
      query = applyOffsetPagination(query, options.page, options.limit);
    } else {
      const limit = typeof options === 'number' ? options : (options?.limit || 50);
      query = applyOffsetPagination(query, 1, limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }
    return (data || []).map(mapToolAuditLogRow);
  }

  async getToolAuditLogsCount(): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('tool_audit_logs')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }
}

export const auditDb = new AuditDatabase();
