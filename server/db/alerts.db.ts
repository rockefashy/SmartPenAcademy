import { AdminAlert } from '../../src/types';
import { getSupabase, applyRowCeiling } from './client.ts';

export function mapAlertRow(row: any): AdminAlert {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    studentId: row.student_id || undefined,
    type: (row.alert_type || 'info') as any,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || ''
  };
}

export class AlertsDatabase {
  async getAlerts(): Promise<AdminAlert[]> {
    const supabase = getSupabase();
    const { data, error } = await applyRowCeiling(
      supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
    );

    if (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`);
    }
    return (data || []).map(mapAlertRow);
  }

  async markAlertAsRead(id: string): Promise<AdminAlert | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark alert read: ${error.message}`);
    }
    return data ? mapAlertRow(data) : null;
  }

  async markAllAlertsAsRead(): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to mark all alerts read: ${error.message}`);
    }
  }

  async deleteAlert(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete alert: ${error.message}`);
    }
  }
}

export const alertsDb = new AlertsDatabase();
