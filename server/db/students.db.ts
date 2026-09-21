import bcrypt from 'bcryptjs';
import { StudentProfile, AttendanceRecord, FeeRecord } from '../../src/types';
import { getSupabase, PaginationParams, applyRowCeiling, applyQueryPagination } from './client.ts';

async function resolveCoachName(coachId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, user_id')
    .eq('id', coachId)
    .maybeSingle();

  if (!coach || !coach.user_id) return null;

  const { data: user } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('id', coach.user_id)
    .maybeSingle();

  if (user) {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || null;
  }
  return null;
}

export function normalizeToDayArray(raw?: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(d => {
        const u = String(d).trim().toUpperCase();
        if (u.startsWith('SUN')) return 'SUN';
        if (u.startsWith('MON')) return 'MON';
        if (u.startsWith('TUE')) return 'TUE';
        if (u.startsWith('WED')) return 'WED';
        if (u.startsWith('THU')) return 'THU';
        if (u.startsWith('FRI')) return 'FRI';
        if (u.startsWith('SAT')) return 'SAT';
        return u;
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,&/]|(\band\b)/i)
      .map(s => s.trim())
      .filter(s => s && !['&', ',', 'and', '/'].includes(s.toLowerCase()))
      .map(d => {
        const u = d.toUpperCase();
        if (u.startsWith('SUN')) return 'SUN';
        if (u.startsWith('MON')) return 'MON';
        if (u.startsWith('TUE')) return 'TUE';
        if (u.startsWith('WED')) return 'WED';
        if (u.startsWith('THU')) return 'THU';
        if (u.startsWith('FRI')) return 'FRI';
        if (u.startsWith('SAT')) return 'SAT';
        return u;
      })
      .filter(Boolean);
  }
  return [];
}

export function mapStudentRow(row: any, userRow?: any, resolvedCoachName?: string | null): StudentProfile {
  const firstName = userRow?.first_name || row.first_name || '';
  const lastName = userRow?.last_name || row.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || firstName;

  let dominantHand: 'Right' | 'Left' = 'Right';
  let preferredDays: string[] | undefined = undefined;
  if (Array.isArray(row.preferred_days) && row.preferred_days.length > 0) {
    preferredDays = normalizeToDayArray(row.preferred_days);
  } else if (typeof row.preferred_days === 'string' && row.preferred_days.trim()) {
    preferredDays = normalizeToDayArray(row.preferred_days);
  }
  let relationship: string | undefined = undefined;
  let scriptsRequired: string[] = [];
  let academicModules: string[] = [];
  let studentNotes: string | undefined = row.notes || undefined;
  let dateOfLeaving: string | undefined = row.date_of_leaving || undefined;

  if (row.notes) {
    try {
      const parsed = JSON.parse(row.notes);
      if (parsed && typeof parsed === 'object') {
        if (parsed.dominantHand) dominantHand = parsed.dominantHand === 'Left' ? 'Left' : 'Right';
        if ((!preferredDays || preferredDays.length === 0) && parsed.preferredDays) {
          preferredDays = normalizeToDayArray(parsed.preferredDays);
        }
        if (parsed.relationship) relationship = parsed.relationship;
        if (Array.isArray(parsed.scriptsRequired)) scriptsRequired = parsed.scriptsRequired;
        if (Array.isArray(parsed.academicModules)) academicModules = parsed.academicModules;
        if (parsed.dateOfLeaving && !dateOfLeaving) dateOfLeaving = parsed.dateOfLeaving;
        studentNotes = parsed.customNotes || parsed.notes || undefined;
      }
    } catch {
      // notes was plain text
      studentNotes = row.notes;
    }
  }

  if (row.dominant_hand) {
    dominantHand = row.dominant_hand === 'Left' ? 'Left' : 'Right';
  }

  return {
    id: row.student_id || row.id,
    firstName,
    lastName,
    displayName,
    age: row.age !== undefined && row.age !== null ? Number(row.age) : 0,
    gradeClass: row.grade || row.grade_class || undefined,
    dominantHand,
    schoolName: row.school_name || undefined,
    parentName: row.parent_name || '',
    relationship,
    modeOfLearning: row.mode_of_learning || 'In-person',
    email: userRow?.email || row.parent_email || row.email || '',
    whatsappMobile: userRow?.phone || row.emergency_contact_phone || '',
    emergencyContactName: row.emergency_contact_name || undefined,
    emergencyContactPhone: row.emergency_contact_phone || undefined,
    emergencyPhone: row.emergency_contact_phone || undefined,
    enrollmentDate: row.enrollment_date || row.created_at?.split('T')[0] || undefined,
    status: row.status || 'Active',
    dateOfLeaving: dateOfLeaving || undefined,
    userId: row.user_id || userRow?.id || undefined,
    coachId: row.coach_id || undefined,
    coachName: resolvedCoachName || row.coach_name || undefined,
    preferredDays: preferredDays && preferredDays.length > 0 ? preferredDays : undefined,
    preferredSlot: row.preferred_slot || undefined,
    scriptsRequired,
    academicModules,
    totalClasses: row.total_classes !== undefined && row.total_classes !== null ? Number(row.total_classes) : undefined,
    attendedClasses: row.attended_classes !== undefined && row.attended_classes !== null ? Number(row.attended_classes) : 0,
    classesPerCycle: row.classes_per_cycle !== undefined && row.classes_per_cycle !== null ? Number(row.classes_per_cycle) : 8,
    feePerCycle: row.fee_per_cycle !== undefined && row.fee_per_cycle !== null ? Number(row.fee_per_cycle) : 1600,
    notes: studentNotes,
    avatarUrl: row.avatar_url || userRow?.avatar_url || undefined,
    diagnosticObservations: Array.isArray(row.diagnostic_observations) ? row.diagnostic_observations : [],
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

export async function attachStudentHistory(students: StudentProfile[]): Promise<StudentProfile[]> {
  if (!students || students.length === 0) return students;
  const supabase = getSupabase();
  const studentIds = students.map(s => s.id).filter(Boolean);
  if (studentIds.length === 0) return students;

  try {
    const [attRes, feeRes] = await Promise.all([
      applyRowCeiling(
        supabase
          .from('attendance')
          .select('student_id, status')
          .in('student_id', studentIds)
      ),
      applyRowCeiling(
        supabase
          .from('fees')
          .select('student_id, status')
          .in('student_id', studentIds)
      )
    ]);

    const attMap = new Map<string, AttendanceRecord[]>();
    if (!attRes.error && Array.isArray(attRes.data)) {
      for (const row of attRes.data) {
        const studentId = row.student_id;
        if (!attMap.has(studentId)) attMap.set(studentId, []);
        attMap.get(studentId)!.push({
          id: '',
          studentId,
          date: '',
          classNumber: 1,
          status: row.status || 'Present'
        });
      }
    }

    const feeMap = new Map<string, FeeRecord[]>();
    if (!feeRes.error && Array.isArray(feeRes.data)) {
      for (const row of feeRes.data) {
        const studentId = row.student_id;
        if (!feeMap.has(studentId)) feeMap.set(studentId, []);
        feeMap.get(studentId)!.push({
          id: '',
          studentId,
          amount: 0,
          date: '',
          yearMonth: '',
          receiptNumber: '',
          paymentMethod: 'GPAY',
          status: (row.status as FeeRecord['status']) || 'Paid'
        });
      }
    }

    for (const s of students) {
      const studentAtt = attMap.get(s.id) || [];
      s.attendanceHistory = studentAtt;
      s.attendedClasses = studentAtt.filter(a => a.status === 'Present').length;
      s.feeHistory = feeMap.get(s.id) || [];
    }
  } catch (err: any) {
    console.warn('[StudentsDatabase.attachStudentHistory] Failed to attach attendance/fee history:', err?.message);
  }

  return students;
}

export class StudentsDatabase {
  async getSiblingStudentsForUser(user: { id?: string; email?: string; phoneNumber?: string; studentId?: string }): Promise<StudentProfile[]> {
    if (!user.id && !user.phoneNumber && !user.email) return [];
    const supabase = getSupabase();
    const phoneClean = (user.phoneNumber || '').replace(/\D/g, '');
    const cleanEmail = (user.email || '').trim().toLowerCase();

    const orConditions: string[] = [];
    if (user.id) {
      orConditions.push(`user_id.eq.${user.id}`);
    }
    if (user.studentId) {
      orConditions.push(`id.eq.${user.studentId}`);
    }
    if (phoneClean && phoneClean.length >= 7) {
      orConditions.push(`emergency_contact_phone.ilike.%${phoneClean.slice(-10)}%`);
    }

    // Also link by all user accounts sharing the same email
    if (cleanEmail) {
      const { data: siblingUsers } = await supabase
        .from('users')
        .select('id')
        .ilike('email', cleanEmail);
      if (siblingUsers && siblingUsers.length > 0) {
        const siblingUserIds = siblingUsers.map((u: any) => u.id).filter(Boolean);
        if (siblingUserIds.length > 0) {
          orConditions.push(`user_id.in.(${siblingUserIds.join(',')})`);
        }
      }
    }

    let query = supabase
      .from('students')
      .select('id, user_id, coach_id, age, grade, school_name, parent_name, mode_of_learning, emergency_contact_name, emergency_contact_phone, status, preferred_slot, preferred_days, total_classes, attended_classes, notes, avatar_url, diagnostic_observations, created_at, updated_at');

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const seenIds = new Set<string>();
    const siblings: any[] = [];
    for (const s of data) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        siblings.push(s);
      }
    }

    const userIds = siblings.map((s: any) => s.user_id).filter(Boolean);
    const userMap = new Map();
    if (userIds.length > 0) {
      const { data: uData } = await supabase.from('users').select('*').in('id', userIds);
      (uData || []).forEach((u: any) => userMap.set(u.id, u));
    }
    return siblings.map((s: any) => mapStudentRow(s, userMap.get(s.user_id)));
  }

  async getFamilyStudentsByEmailOrPhone(identifier: string): Promise<StudentProfile[]> {
    if (!identifier || typeof identifier !== 'string') return [];
    const supabase = getSupabase();
    const clean = identifier.trim().toLowerCase();

    // Strict defense: disallow wildcard-only identifiers
    if (clean === '%' || clean === '_' || clean.length < 3) return [];

    const phoneDigits = identifier.replace(/\D/g, '');

    let userQuery = supabase
      .from('users')
      .select('id, email, phone, first_name, last_name');

    if (clean.includes('@')) {
      userQuery = userQuery.eq('email', clean);
    } else if (phoneDigits && phoneDigits.length >= 10) {
      userQuery = userQuery.eq('phone', phoneDigits);
    } else {
      userQuery = userQuery.eq('email', clean);
    }

    const { data: users } = await userQuery.limit(10);

    const userIds = (users || []).map((u: any) => u.id);
    const orConditions: string[] = [];
    if (userIds.length > 0) {
      orConditions.push(`user_id.in.(${userIds.join(',')})`);
    }
    if (phoneDigits && phoneDigits.length >= 10) {
      orConditions.push(`emergency_contact_phone.eq.${phoneDigits.slice(-10)}`);
    }

    if (orConditions.length === 0) return [];

    const { data: students, error } = await supabase
      .from('students')
      .select('id, user_id, coach_id, age, grade, school_name, parent_name, mode_of_learning, emergency_contact_name, emergency_contact_phone, status, preferred_slot, preferred_days, total_classes, attended_classes, notes, avatar_url, diagnostic_observations, created_at, updated_at')
      .or(orConditions.join(','));

    if (error || !students) return [];

    const seenIds = new Set<string>();
    const uniqueStudents: any[] = [];
    for (const s of students) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        uniqueStudents.push(s);
      }
    }
    const userMap = new Map();
    (users || []).forEach((u: any) => userMap.set(u.id, u));

    return uniqueStudents.map((s: any) => mapStudentRow(s, userMap.get(s.user_id)));
  }

  async getAllStudents(options?: PaginationParams & { searchQuery?: string }): Promise<StudentProfile[]> {
    const supabase = getSupabase();
    const limit = options?.limit ?? 1000;
    const offset = options?.page && options?.limit ? (options.page - 1) * options.limit : 0;
    const cleanQuery = (options?.searchQuery || '').trim();

    try {
      const { data, error } = await (supabase as any).rpc('get_all_students_search', {
        p_query: cleanQuery || null,
        p_limit: limit,
        p_offset: offset
      });

      if (!error && Array.isArray(data)) {
        const mappedRpc = data.map((row: any) => mapStudentRow(row, row, row.coach_name));
        return await attachStudentHistory(mappedRpc);
      }
      if (error) {
        console.warn(`[StudentsDatabase.getAllStudents] get_all_students_search RPC error, falling back:`, error.message);
      }
    } catch (err: any) {
      console.warn(`[StudentsDatabase.getAllStudents] RPC execution failed, falling back:`, err?.message);
    }

    // Defensive legacy fallback
    let query = supabase.from('students').select('*');
    query = applyQueryPagination(query, options);
    const { data: students, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch students from database: ${error.message}`);
    }

    const { data: users } = await applyRowCeiling(
      supabase.from('users').select('*')
    );
    const userMap = new Map();
    (users || []).forEach((u: any) => {
      if (u.id) userMap.set(u.id, u);
    });

    const { data: coaches } = await applyRowCeiling(
      supabase.from('coaches').select('id, user_id')
    );
    const coachMap = new Map<string, string>();
    (coaches || []).forEach((c: any) => {
      const u = c.user_id ? userMap.get(c.user_id) : null;
      const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
      if (name) coachMap.set(c.id, name);
    });

    let mapped = (students || []).map((s: any) => {
      const user = (s.user_id && userMap.get(s.user_id)) || userMap.get(s.id);
      const coachName = s.coach_id ? (coachMap.get(s.coach_id) || null) : null;
      return mapStudentRow(s, user, coachName);
    });

    if (cleanQuery) {
      const q = cleanQuery.toLowerCase();
      mapped = mapped.filter((s: StudentProfile) =>
        s.id.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q) ||
        (s.coachName && s.coachName.toLowerCase().includes(q))
      );
    }

    return await attachStudentHistory(mapped);
  }

  async getStudentsCount(): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }

  async getStudentsByCoachId(coachId: string, alternateId?: string, options?: PaginationParams): Promise<StudentProfile[]> {
    const supabase = getSupabase();
    const rawIds = [coachId, alternateId].filter(Boolean) as string[];
    if (rawIds.length === 0) return [];

    const { data: coachRows } = await supabase
      .from('coaches')
      .select('id, user_id')
      .or(`id.in.(${rawIds.join(',')}),user_id.in.(${rawIds.join(',')})`);

    const allCoachIds = new Set<string>(rawIds);
    (coachRows || []).forEach((c: any) => {
      if (c.id) allCoachIds.add(c.id);
      if (c.user_id) allCoachIds.add(c.user_id);
    });

    const targetIds = Array.from(allCoachIds);

    let query = supabase.from('students').select('*');
    if (targetIds.length === 1) {
      query = query.eq('coach_id', targetIds[0]);
    } else {
      query = query.in('coach_id', targetIds);
    }

    query = applyQueryPagination(query, options);

    const { data: students, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch coach students: ${error.message}`);
    }

    const { data: users } = await applyRowCeiling(
      supabase.from('users').select('*')
    );

    const userMap = new Map();
    (users || []).forEach((u: any) => {
      if (u.id) userMap.set(u.id, u);
    });

    const { data: coaches } = await applyRowCeiling(
      supabase.from('coaches').select('id, user_id')
    );

    const coachMap = new Map<string, string>();
    (coaches || []).forEach((c: any) => {
      const u = c.user_id ? userMap.get(c.user_id) : null;
      const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
      if (name) coachMap.set(c.id, name);
    });

    const mapped = (students || []).map((s: any) => {
      const user = (s.user_id && userMap.get(s.user_id)) || userMap.get(s.id);
      const coachName = s.coach_id ? (coachMap.get(s.coach_id) || null) : null;
      return mapStudentRow(s, user, coachName);
    });
    return await attachStudentHistory(mapped);
  }

  async getStudentsCountByCoachId(coachId: string, alternateId?: string): Promise<number> {
    const supabase = getSupabase();
    const rawIds = [coachId, alternateId].filter(Boolean) as string[];
    if (rawIds.length === 0) return 0;

    const { data: coachRows } = await supabase
      .from('coaches')
      .select('id, user_id')
      .or(`id.in.(${rawIds.join(',')}),user_id.in.(${rawIds.join(',')})`);

    const allCoachIds = new Set<string>(rawIds);
    (coachRows || []).forEach((c: any) => {
      if (c.id) allCoachIds.add(c.id);
      if (c.user_id) allCoachIds.add(c.user_id);
    });

    const targetIds = Array.from(allCoachIds);

    let query = supabase.from('students').select('*', { count: 'exact', head: true });
    if (targetIds.length === 1) {
      query = query.eq('coach_id', targetIds[0]);
    } else {
      query = query.in('coach_id', targetIds);
    }
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  }

  async getStudentById(id: string): Promise<StudentProfile | null> {
    const supabase = getSupabase();
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup student ${id}: ${error.message}`);
    }
    if (!student) return null;

    let user: any = null;
    const lookupUserId = student.user_id || student.id;
    if (lookupUserId) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', lookupUserId)
        .maybeSingle();
      user = uData;
    }

    let coachName: string | null = null;
    if (student.coach_id) {
      coachName = await resolveCoachName(student.coach_id);
    }

    const studentProfile = mapStudentRow(student, user, coachName);
    const [withHistory] = await attachStudentHistory([studentProfile]);
    return withHistory || studentProfile;
  }

  async checkStudentDuplicate(
    param1: string | { firstName?: string; lastName?: string; phoneNumber?: string; email?: string; age?: number },
    param2?: number | string,
    param3?: string,
    param4?: string
  ): Promise<boolean> {
    const supabase = getSupabase();

    let firstName = '';
    let lastName = '';
    let phoneNumber = '';
    let email = '';

    if (typeof param1 === 'object' && param1 !== null) {
      firstName = (param1.firstName || '').trim();
      lastName = (param1.lastName || '').trim();
      phoneNumber = (param1.phoneNumber || '').trim();
      email = (param1.email || '').trim();
    } else if (typeof param1 === 'string') {
      firstName = param1.trim();
      if (typeof param2 === 'number') {
        phoneNumber = (param3 || '').trim();
      } else if (typeof param2 === 'string') {
        lastName = param2.trim();
        phoneNumber = (param3 || '').trim();
        email = (param4 || '').trim();
      }
    }

    const cleanFirstName = firstName.toLowerCase();
    const cleanLastName = lastName.toLowerCase();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const cleanEmail = email.toLowerCase();

    // 1. Check USERS table
    const { data: users, error: uError } = await supabase
      .from('users')
      .select('id, first_name, last_name, phone, email, role');

    if (!uError && users) {
      for (const u of users) {
        const uFirst = (u.first_name || '').trim().toLowerCase();
        const uLast = (u.last_name || '').trim().toLowerCase();
        const uPhone = (u.phone || '').replace(/\D/g, '');
        const uEmail = (u.email || '').trim().toLowerCase();

        const nameMatches = Boolean(
          cleanFirstName && uFirst === cleanFirstName &&
          ((cleanLastName && uLast === cleanLastName) || (!cleanLastName && !uLast))
        );

        if (nameMatches) {
          const phoneMatches = Boolean(
            cleanPhone.length >= 7 &&
            uPhone.length >= 7 &&
            (cleanPhone === uPhone || cleanPhone.endsWith(uPhone) || uPhone.endsWith(cleanPhone) || cleanPhone.includes(uPhone) || uPhone.includes(cleanPhone))
          );

          const emailMatches = Boolean(cleanEmail && uEmail && cleanEmail === uEmail);

          if (phoneMatches || emailMatches) {
            return true;
          }
        }
      }
    }

    return false;
  }

  async createStudent(student: any): Promise<StudentProfile> {
    const supabase = getSupabase();
    const studentId = student.id || crypto.randomUUID();

    const ageNum = student.age !== undefined && student.age !== null && student.age !== '' ? Number(student.age) : null;

    let firstName = (student.firstName || '').trim();
    let lastName = (student.lastName || '').trim();

    if (!firstName && student.name) {
      const parts = student.name.trim().split(' ');
      firstName = parts[0] || 'Student';
      lastName = parts.slice(1).join(' ') || '';
    }
    if (!firstName) firstName = 'Student';

    const phone = (student.whatsappMobile || student.phoneNumber || student.phone || student.emergencyContactPhone || '').trim();
    if (!phone) {
      throw new Error("A valid phone number is required to create a student account.");
    }
    const email = student.email ? student.email.toLowerCase().trim() : null;
    const userFirstName = student.firstName?.trim() || firstName;
    const userLastName = student.lastName?.trim() || lastName;

    // 1. Identity-First: Create or link user account in public.users first
    let createdUser: any = null;
    let assignedUserId: string = student.userId || '';
    let isNewUserCreated = false;

    // Check if an existing user account already exists with the EXACT SAME first name, last name, and email
    if (!assignedUserId && email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email)
        .ilike('first_name', userFirstName)
        .ilike('last_name', userLastName)
        .maybeSingle();

      if (existingUser) {
        assignedUserId = existingUser.id;
        createdUser = existingUser;
      }
    }

    if (!assignedUserId && (email || student.password || student.passwordHash)) {
      let passwordHash = student.passwordHash;
      if (!passwordHash && student.password && student.password.trim()) {
        passwordHash = await bcrypt.hash(student.password.trim(), 12);
      }
      if (!passwordHash) {
        throw new Error("A valid password is required to create a student user account.");
      }
      assignedUserId = crypto.randomUUID();

      const { data: uData, error: uError } = await supabase
        .from('users')
        .insert({
          id: assignedUserId,
          email: email,
          first_name: userFirstName,
          last_name: userLastName,
          phone: phone,
          role: 'student',
          password_hash: passwordHash,
          is_active: true
        })
        .select()
        .single();

      if (uError) {
        throw new Error(`Failed to create student user account: ${uError.message}`);
      }
      createdUser = uData;
      isNewUserCreated = true;
    }

    // 2. Insert into students table with forward-written user_id
    const preferredDaysArray = normalizeToDayArray(student.preferredDays);
    const metaNotesPayload: any = {
      dominantHand: student.dominantHand || 'Right',
      preferredDays: preferredDaysArray.length > 0 ? preferredDaysArray.join(' & ') : undefined,
      relationship: student.relationship || undefined,
      scriptsRequired: Array.isArray(student.scriptsRequired) ? student.scriptsRequired : [],
      academicModules: Array.isArray(student.academicModules) ? student.academicModules : [],
      dateOfLeaving: student.dateOfLeaving?.trim() || undefined,
      customNotes: student.notes || undefined
    };

    const studentRow: any = {
      id: studentId,
      user_id: assignedUserId || null,
      age: isNaN(ageNum as number) ? null : ageNum,
      grade: student.gradeClass || student.grade || null,
      school_name: student.schoolName || null,
      parent_name: student.parentName || null,
      mode_of_learning: student.modeOfLearning || 'In-person',
      emergency_contact_name: student.emergencyContactName?.trim() || null,
      emergency_contact_phone: (student.emergencyContactPhone || student.emergencyPhone || '').trim() || null,
      status: student.status || 'Active',
      coach_id: student.coachId || null,
      preferred_slot: student.preferredSlot || null,
      preferred_days: preferredDaysArray,
      classes_per_cycle: student.classesPerCycle !== undefined && student.classesPerCycle !== null ? Number(student.classesPerCycle) : 8,
      fee_per_cycle: student.feePerCycle !== undefined && student.feePerCycle !== null ? Number(student.feePerCycle) : 1600,
      total_classes: student.totalClasses !== undefined && student.totalClasses !== null ? Number(student.totalClasses) : 8,
      attended_classes: student.attendedClasses !== undefined && student.attendedClasses !== null ? Number(student.attendedClasses) : 0,
      notes: JSON.stringify(metaNotesPayload),
      avatar_url: student.avatarUrl || null,
      diagnostic_observations: Array.isArray(student.diagnosticObservations) ? student.diagnosticObservations : []
    };

    let { data, error } = await supabase
      .from('students')
      .insert(studentRow)
      .select()
      .single();

    if (error && error.message && error.message.includes('user_id')) {
      const fallbackRow = { ...studentRow };
      delete fallbackRow.user_id;
      const retryResult = await supabase
        .from('students')
        .insert(fallbackRow)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      if (isNewUserCreated && assignedUserId) {
        await supabase.from('users').delete().eq('id', assignedUserId);
      }
      throw new Error(`Failed to create student in database: ${error.message}`);
    }

    let coachName: string | null = null;
    if (studentRow.coach_id) {
      coachName = await resolveCoachName(studentRow.coach_id);
    }

    const mapped = mapStudentRow(data, createdUser, coachName);
    if (!mapped.email && email) {
      mapped.email = email;
    }
    if (!mapped.whatsappMobile && phone) {
      mapped.whatsappMobile = phone;
    }
    return mapped;
  }

  async updateStudent(id: string, updates: Partial<StudentProfile>): Promise<StudentProfile | null> {
    const supabase = getSupabase();
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.age !== undefined) updateData.age = Number(updates.age);
    if (updates.gradeClass !== undefined) updateData.grade = updates.gradeClass;
    if (updates.schoolName !== undefined) updateData.school_name = updates.schoolName;
    if (updates.parentName !== undefined) updateData.parent_name = updates.parentName;
    if (updates.modeOfLearning !== undefined) updateData.mode_of_learning = updates.modeOfLearning;
    if (updates.emergencyContactName !== undefined) updateData.emergency_contact_name = updates.emergencyContactName;
    if (updates.emergencyContactPhone !== undefined || updates.emergencyPhone !== undefined) {
      updateData.emergency_contact_phone = updates.emergencyContactPhone || updates.emergencyPhone;
    }
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.coachId !== undefined) updateData.coach_id = updates.coachId || null;
    if (updates.preferredSlot !== undefined) updateData.preferred_slot = updates.preferredSlot;
    if (updates.preferredDays !== undefined) {
      updateData.preferred_days = normalizeToDayArray(updates.preferredDays);
    }
    if (updates.enrollmentDate !== undefined) updateData.enrollment_date = updates.enrollmentDate;
    if (updates.totalClasses !== undefined) updateData.total_classes = Number(updates.totalClasses);
    if (updates.attendedClasses !== undefined) updateData.attended_classes = Number(updates.attendedClasses);
    if (updates.classesPerCycle !== undefined) updateData.classes_per_cycle = Number(updates.classesPerCycle);
    if (updates.feePerCycle !== undefined) updateData.fee_per_cycle = Number(updates.feePerCycle);

    if (updates.dominantHand !== undefined || updates.preferredDays !== undefined || updates.relationship !== undefined || updates.notes !== undefined || updates.scriptsRequired !== undefined || updates.academicModules !== undefined || updates.dateOfLeaving !== undefined || updates.status !== undefined) {
      const { data: currentStudent } = await supabase
        .from('students')
        .select('notes, user_id')
        .eq('id', id)
        .maybeSingle();

      let existingMeta: any = {};
      if (currentStudent?.notes) {
        try {
          existingMeta = JSON.parse(currentStudent.notes);
        } catch {
          existingMeta = { customNotes: currentStudent.notes };
        }
      }

      if (updates.dominantHand !== undefined) existingMeta.dominantHand = updates.dominantHand;
      if (updates.preferredDays !== undefined) {
        const norm = normalizeToDayArray(updates.preferredDays);
        existingMeta.preferredDays = norm.length > 0 ? norm.join(' & ') : undefined;
      }
      if (updates.relationship !== undefined) existingMeta.relationship = updates.relationship;
      if (updates.notes !== undefined) existingMeta.customNotes = updates.notes;
      if (updates.scriptsRequired !== undefined) existingMeta.scriptsRequired = updates.scriptsRequired;
      if (updates.academicModules !== undefined) existingMeta.academicModules = updates.academicModules;

      if (updates.dateOfLeaving !== undefined) {
        existingMeta.dateOfLeaving = updates.dateOfLeaving?.trim() || null;
      }
      if (updates.status !== undefined) {
        if (updates.status === 'Inactive') {
          if (!updates.dateOfLeaving && !existingMeta.dateOfLeaving) {
            existingMeta.dateOfLeaving = new Date().toISOString().split('T')[0];
          }
        } else if (updates.status === 'Active') {
          existingMeta.dateOfLeaving = null;
        }
      }

      updateData.notes = JSON.stringify(existingMeta);
    }

    if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
    if (updates.diagnosticObservations !== undefined) updateData.diagnostic_observations = updates.diagnosticObservations;

    let updatedStudent = null;
    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update student ${id}: ${error.message}`);
    }
    updatedStudent = data;

    let firstName = updates.firstName?.trim();
    let lastName = updates.lastName?.trim();

    // Also update public.users if contact info, name, or password is updated
    if (updates.email !== undefined || updates.whatsappMobile !== undefined || firstName !== undefined || lastName !== undefined || (updates.password && updates.password.trim().length >= 8)) {
      const userUpdates: any = {
        updated_at: new Date().toISOString()
      };
      if (updates.email !== undefined) userUpdates.email = updates.email.toLowerCase().trim();
      if (updates.whatsappMobile !== undefined) userUpdates.phone = updates.whatsappMobile.trim();
      if (firstName !== undefined) userUpdates.first_name = firstName;
      if (lastName !== undefined) userUpdates.last_name = lastName;
      if (updates.password && updates.password.trim().length >= 8) {
        userUpdates.password_hash = await bcrypt.hash(updates.password.trim(), 12);
      }

      let targetUserId = updatedStudent?.user_id;
      if (!targetUserId) {
        const { data: directUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', id)
          .maybeSingle();
        if (directUser?.id) {
          targetUserId = directUser.id;
          await supabase
            .from('students')
            .update({ user_id: targetUserId })
            .eq('id', id);
        }
      }

      if (targetUserId) {
        await supabase
          .from('users')
          .update(userUpdates)
          .eq('id', targetUserId);
      }
    }

    let user: any = null;
    if (updatedStudent?.user_id) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', updatedStudent.user_id)
        .maybeSingle();
      user = uData;
    }

    let coachName: string | null = null;
    const coachIdToLookup = updatedStudent?.coach_id || updates.coachId;
    if (coachIdToLookup) {
      coachName = await resolveCoachName(coachIdToLookup);
    }

    return updatedStudent ? mapStudentRow(updatedStudent, user, coachName) : null;
  }

  async deleteStudent(id: string): Promise<boolean> {
    // Soft Deactivation: No physical deletion of student records
    const today = new Date().toISOString().split('T')[0];
    const updated = await this.updateStudent(id, {
      status: 'Inactive',
      dateOfLeaving: today
    });
    return Boolean(updated);
  }

  async assignCoachToStudent(
    studentId: string,
    coachId: string | null
  ): Promise<(StudentProfile & { assignmentChanged: boolean }) | null> {
    const supabase = getSupabase();

    // 1. Student existence and status check
    const { data: studentRow, error: studentErr } = await supabase
      .from('students')
      .select('id, coach_id, status')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr) {
      throw new Error(`Failed to lookup student: ${studentErr.message}`);
    }
    if (!studentRow) {
      throw new Error('Student not found');
    }
    if (studentRow.status !== 'Active') {
      throw new Error('Cannot assign a coach to an inactive student.');
    }

    // 2. Coach existence and status check (when coachId is non-null)
    let coachName: string | null = null;
    if (coachId) {
      const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id, user_id, status')
        .eq('id', coachId)
        .maybeSingle();

      if (coachErr) {
        throw new Error(`Failed to lookup coach: ${coachErr.message}`);
      }
      if (!coachRow) {
        throw new Error('Coach not found');
      }
      if (coachRow.status !== 'Active') {
        throw new Error('Cannot assign an inactive coach to a student.');
      }

      if (coachRow.user_id) {
        const { data: coachUser } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', coachRow.user_id)
          .maybeSingle();
        if (coachUser) {
          coachName = `${coachUser.first_name || ''} ${coachUser.last_name || ''}`.trim() || null;
        }
      }
    }

    // 3. Idempotency check
    const currentCoachId = studentRow.coach_id || null;
    const targetCoachId = coachId || null;
    const assignmentChanged = currentCoachId !== targetCoachId;

    // 4. Update student record
    const { data, error } = await supabase
      .from('students')
      .update({
        coach_id: targetCoachId,
        updated_at: new Date().toISOString()
      })
      .eq('id', studentId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to assign coach: ${error.message}`);
    }

    let user: any = null;
    if (data?.user_id) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user_id)
        .maybeSingle();
      user = uData;
    }

    if (!data) return null;

    const mapped = mapStudentRow(data, user, coachName);
    return {
      ...mapped,
      assignmentChanged
    };
  }
}

export const studentsDb = new StudentsDatabase();
