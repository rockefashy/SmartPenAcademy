import { AttendanceRecord } from '../../src/types';
import { getSupabase, PaginationParams, applyQueryPagination } from './client.ts';

export function mapAttendanceRow(row: any): AttendanceRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    classNumber: row.class_number !== undefined && row.class_number !== null ? Number(row.class_number) : 1,
    date: row.date || '',
    status: row.status || 'Present',
    coachNotes: row.coach_notes || undefined,
    markedBy: row.marked_by || undefined,
    createdAt: row.created_at || ''
  };
}

export class AttendanceDatabase {
  async getAttendanceByMonth(
    yearMonth: string,
    options?: PaginationParams & { studentIds?: string[] }
  ): Promise<AttendanceRecord[]> {
    const supabase = getSupabase();
    if (options?.studentIds && options.studentIds.length === 0) {
      return [];
    }

    // In PostgreSQL, 'date' is of type DATE so ilike fails. Calculate month range:
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${yearMonth}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    let query = supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true });

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
      throw new Error(`Failed to fetch attendance for ${yearMonth}: ${error.message}`);
    }
    return (data || []).map(mapAttendanceRow);
  }

  async getAttendanceByStudent(studentId: string, options?: PaginationParams): Promise<AttendanceRecord[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .order('date', { ascending: true });

    query = applyQueryPagination(query, options);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch attendance for student ${studentId}: ${error.message}`);
    }
    return (data || []).map(mapAttendanceRow);
  }

  async saveAttendanceBatch(records: AttendanceRecord[]): Promise<AttendanceRecord[]> {
    if (!records || records.length === 0) return [];
    const supabase = getSupabase();

    // Look up existing attendance counts for students missing classNumber
    const studentIdsNeedingCount = Array.from(
      new Set(records.filter(r => r.classNumber === undefined || r.classNumber === null || isNaN(Number(r.classNumber))).map(r => r.studentId))
    );

    const countMap = new Map<string, number>();
    for (const sid of studentIdsNeedingCount) {
      const { count } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', sid);
      countMap.set(sid, count || 0);
    }

    const rows = records.map(r => {
      let classNum = r.classNumber !== undefined && r.classNumber !== null ? Number(r.classNumber) : NaN;
      if (isNaN(classNum) || classNum <= 0) {
        const curr = countMap.get(r.studentId) || 0;
        classNum = curr + 1;
        countMap.set(r.studentId, classNum);
      }

      return {
        id: r.id || `att-${r.studentId}-${r.date}`,
        student_id: r.studentId,
        class_number: classNum,
        date: r.date,
        status: r.status || 'Present',
        coach_notes: r.coachNotes || null,
        marked_by: r.markedBy || null,
        created_at: new Date().toISOString()
      };
    });

    const { data: upsertedRows, error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'id' })
      .select('*');

    if (error) {
      throw new Error(`Failed to save attendance batch: ${error.message}`);
    }

    // Keep students.attended_classes in sync
    const uniqueStudentIds = Array.from(new Set(records.map(r => r.studentId).filter(Boolean)));
    for (const sid of uniqueStudentIds) {
      const { data: presentRows } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', sid)
        .eq('status', 'Present');
      await supabase
        .from('students')
        .update({ attended_classes: presentRows?.length || 0, updated_at: new Date().toISOString() })
        .eq('id', sid);
    }

    return (upsertedRows || []).map(mapAttendanceRow);
  }

  async findAttendanceById(id: string): Promise<AttendanceRecord | null> {
    const supabase = getSupabase();
    if (!id) return null;
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find attendance record ${id}: ${error.message}`);
    }
    return data ? mapAttendanceRow(data) : null;
  }

  async deleteAttendance(id: string): Promise<void> {
    const supabase = getSupabase();
    if (!id || typeof id !== 'string') {
      throw new Error('[Data Integrity Error] deleteAttendance requires a valid record id.');
    }
    const { data: existing } = await supabase
      .from('attendance')
      .select('student_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete attendance: ${error.message}`);
    }

    if (existing?.student_id) {
      const { data: presentRows } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', existing.student_id)
        .eq('status', 'Present');
      await supabase
        .from('students')
        .update({ attended_classes: presentRows?.length || 0, updated_at: new Date().toISOString() })
        .eq('id', existing.student_id);
    }
  }

  async getAttendanceCountByMonth(yearMonth: string, studentIds?: string[]): Promise<number> {
    if (studentIds && studentIds.length === 0) return 0;
    const supabase = getSupabase();
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${yearMonth}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    let query = supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('date', startDate)
      .lt('date', endDate);

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

  async getAttendanceCountByStudent(studentId: string): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);
    if (error) return 0;
    return count || 0;
  }
}

export const attendanceDb = new AttendanceDatabase();
