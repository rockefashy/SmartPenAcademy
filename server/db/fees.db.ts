import { FeeRecord, FeeReminder } from '../../src/types';
import { getSupabase, PaginationParams, applyQueryPagination, safeIsoDate } from './client.ts';

export function mapFeeRow(row: any): FeeRecord {
  const status: 'Paid' | 'Pending' | 'Overdue' | 'Waived' =
    (row.status === 'Paid' || row.status === 'Pending' || row.status === 'Overdue' || row.status === 'Waived')
      ? row.status
      : (row.is_paid ? 'Paid' : 'Pending');

  return {
    id: row.id,
    studentId: row.student_id,
    date: row.date || row.paid_date || '',
    yearMonth: row.year_month || '',
    milestone: row.milestone || undefined,
    amount: row.amount !== undefined && row.amount !== null ? Number(row.amount) : 0,
    status,
    paidDate: row.paid_date || undefined,
    receiptNumber: row.receipt_number || row.receipt_no || '',
    paymentMethod: row.payment_method || undefined,
    notes: row.notes || undefined
  };
}

export function mapFeeReminderRow(row: any): FeeReminder {
  return {
    id: row.id,
    studentId: row.student_id,
    parentEmail: row.parent_email || row.parent_phone || '',
    parentName: row.parent_name || '',
    studentName: '',
    amount: row.amount_due !== undefined && row.amount_due !== null ? Number(row.amount_due) : 0,
    month: row.due_date || '',
    gpayLink: row.amount_due ? `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${row.amount_due}&cu=INR` : '',
    status: row.status || 'Sent',
    sentDate: row.sent_at || row.created_at || '',
    sentAt: row.sent_at || row.created_at || ''
  };
}

export class FeesDatabase {
  async getFeesByMonth(
    yearMonth: string,
    options?: PaginationParams & { studentIds?: string[] }
  ): Promise<FeeRecord[]> {
    const supabase = getSupabase();
    if (options?.studentIds && options.studentIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('fees')
      .select('*')
      .or(`year_month.eq.${yearMonth},date.gte.${yearMonth}-01,paid_date.gte.${yearMonth}-01`);

    // Database-level scoping for coach assigned students
    if (options?.studentIds && options.studentIds.length > 0) {
      if (options.studentIds.length === 1) {
        query = query.eq('student_id', options.studentIds[0]);
      } else {
        query = query.in('student_id', options.studentIds);
      }
    }

    query = applyQueryPagination(query, options);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch fees for ${yearMonth}: ${error.message}`);
    }
    return (data || []).map(mapFeeRow);
  }

  async getFeesByStudent(studentId: string, options?: PaginationParams): Promise<FeeRecord[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('fees')
      .select('*')
      .eq('student_id', studentId)
      .order('paid_date', { ascending: false });

    query = applyQueryPagination(query, options);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch fees for student ${studentId}: ${error.message}`);
    }
    return (data || []).map(mapFeeRow);
  }

  async findFeeById(id: string): Promise<FeeRecord | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('fees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find fee record ${id}: ${error.message}`);
    }
    return data ? mapFeeRow(data) : null;
  }

  async saveFeeRecord(fee: Partial<FeeRecord>): Promise<FeeRecord> {
    const supabase = getSupabase();
    if (!fee.studentId) {
      throw new Error("Cannot save fee record without a valid studentId.");
    }
    if (fee.amount === undefined || fee.amount === null || isNaN(Number(fee.amount))) {
      throw new Error("Cannot save fee record without a valid numeric amount.");
    }

    const feeId = fee.id || `fee-${Date.now()}`;
    const effectiveDate = safeIsoDate(fee.date) || safeIsoDate(fee.paidDate) || safeIsoDate((fee as any).createdAt) || safeIsoDate(new Date());
    if (!effectiveDate) {
      throw new Error("Cannot save fee record without a valid date.");
    }

    const yearMonth = fee.yearMonth?.trim() || effectiveDate.substring(0, 7);
    if (!yearMonth) {
      throw new Error("Cannot save fee record without a valid year_month.");
    }

    const status = (fee.status === 'Paid' || fee.status === 'Pending' || fee.status === 'Overdue' || fee.status === 'Waived')
      ? fee.status
      : ((fee as any).isPaid ? 'Paid' : 'Pending');
    const isPaid = status === 'Paid';
    const paidDate = safeIsoDate(fee.paidDate) || (isPaid ? effectiveDate : null);

    const row: any = {
      id: feeId,
      student_id: fee.studentId,
      date: effectiveDate,
      year_month: yearMonth,
      milestone: fee.milestone || fee.period || null,
      status,
      paid_date: paidDate,
      amount: Number(fee.amount),
      payment_method: fee.paymentMethod || null,
      notes: fee.notes || null,
      created_at: (fee as any).createdAt || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('fees')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save fee record: ${error.message}`);
    }

    return mapFeeRow(data);
  }

  async updateFeeRecord(id: string, updates: Partial<FeeRecord>): Promise<FeeRecord | null> {
    const supabase = getSupabase();
    const updateData: any = {};

    if (updates.date !== undefined) {
      const validDate = safeIsoDate(updates.date);
      if (validDate) {
        updateData.date = validDate;
        if (!updates.yearMonth) {
          updateData.year_month = validDate.substring(0, 7);
        }
      }
    }
    if (updates.yearMonth !== undefined && updates.yearMonth.trim()) {
      updateData.year_month = updates.yearMonth.trim();
    }
    if (updates.milestone !== undefined) updateData.milestone = updates.milestone;
    if (updates.paidDate !== undefined) {
      updateData.paid_date = safeIsoDate(updates.paidDate) || null;
    }
    if ((updates as any).isPaid !== undefined && updates.status === undefined) {
      updateData.status = (updates as any).isPaid ? 'Paid' : 'Pending';
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status === 'Paid' && !updates.paidDate) {
        updateData.paid_date = new Date().toISOString().split('T')[0];
      } else if (updates.status !== 'Paid' && updates.paidDate === undefined) {
        updateData.paid_date = null;
      }
    }
    if (updates.amount !== undefined && updates.amount !== null && !isNaN(Number(updates.amount))) {
      updateData.amount = Number(updates.amount);
    }
    if (updates.receiptNumber !== undefined || (updates as any).receiptNo !== undefined) {
      const incomingReceipt = String(updates.receiptNumber || (updates as any).receiptNo || '').trim();
      if (incomingReceipt) {
        const existing = await this.findFeeById(id);
        if (existing?.receiptNumber && incomingReceipt !== existing.receiptNumber) {
          throw new Error("receipt_number is immutable and cannot be updated.");
        }
      }
    }
    if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await supabase
      .from('fees')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update fee record ${id}: ${error.message}`);
    }

    return data ? mapFeeRow(data) : null;
  }

  async deleteFeeRecord(id: string): Promise<boolean> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('fees')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete fee record ${id}: ${error.message}`);
    }
    return true;
  }

  async saveFeeReminder(reminder: Partial<FeeReminder>): Promise<FeeReminder> {
    const supabase = getSupabase();
    const id = reminder.id || `rem-${Date.now()}`;
    const row = {
      id,
      student_id: reminder.studentId,
      parent_name: reminder.parentName || null,
      parent_phone: (reminder as any).parentPhone || null,
      parent_email: reminder.parentEmail || null,
      amount_due: reminder.amount !== undefined && reminder.amount !== null ? Number(reminder.amount) : null,
      due_date: reminder.month || null,
      status: reminder.status || null,
      sent_at: reminder.sentDate || (reminder as any).sentAt || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('fee_reminders')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save fee reminder: ${error.message}`);
    }

    return mapFeeReminderRow(data);
  }

  async getFeesCountByMonth(yearMonth: string, studentIds?: string[]): Promise<number> {
    if (studentIds && studentIds.length === 0) return 0;
    const supabase = getSupabase();
    let query = supabase
      .from('fees')
      .select('*', { count: 'exact', head: true })
      .or(`year_month.eq.${yearMonth},date.gte.${yearMonth}-01,paid_date.gte.${yearMonth}-01`);

    if (studentIds && studentIds.length > 0) {
      if (studentIds.length === 1) {
        query = query.eq('student_id', studentIds[0]);
      } else {
        query = query.in('student_id', studentIds);
      }
    }

    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  }

  async getFeesCountByStudent(studentId: string): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('fees')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);
    if (error) return 0;
    return count || 0;
  }
}

export const feesDb = new FeesDatabase();
