import bcrypt from 'bcryptjs';
import { CoachProfile, StudentProfile, ROLES } from '../../src/types';
import { getSupabase, applyRowCeiling } from './client.ts';
import { mapStudentRow } from './students.db.ts';

export function mapCoachRow(row: any, studentCount = 0, userRow?: any): CoachProfile {
  const firstName = userRow?.first_name || row.first_name || 'Coach';
  const lastName = userRow?.last_name || row.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || firstName;

  let specs: string[] = [];
  if (Array.isArray(row.specializations)) {
    specs = row.specializations;
  } else if (typeof row.specializations === 'string' && row.specializations.trim()) {
    try {
      const parsed = JSON.parse(row.specializations);
      if (Array.isArray(parsed)) specs = parsed;
    } catch {
      specs = row.specializations.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  return {
    id: row.id,
    firstName,
    lastName,
    displayName,
    email: userRow?.email || row.email || '',
    phoneNumber: userRow?.phone || row.phone || row.phone_number || '',
    address: row.address || undefined,
    dateOfJoining: row.date_of_joining || undefined,
    status: (row.status === 'Inactive' ? 'Inactive' : 'Active'),
    dateOfLeaving: row.date_of_leaving || undefined,
    educationalQualification: row.educational_qualification || undefined,
    designation: row.designation || 'Principal Coach',
    specializations: specs,
    emergencyContactName: row.emergency_contact_name || undefined,
    emergencyContactPhone: row.emergency_contact_phone || undefined,
    notes: row.notes || row.bio || undefined,
    assignedStudentCount: studentCount,
    activeStudentsCount: studentCount,
    studentCount: studentCount,
    userId: row.user_id || userRow?.id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined
  };
}

export class CoachesDatabase {
  async getAllCoaches(): Promise<CoachProfile[]> {
    const supabase = getSupabase();

    // 1. Fetch coaches from dedicated `coaches` table using explicit projection
    const { data: coachesData, error: coachError } = await applyRowCeiling(
      supabase
        .from('coaches')
        .select('id, user_id, address, date_of_joining, status, date_of_leaving, educational_qualification, designation, specializations, emergency_contact_name, emergency_contact_phone, notes, created_at, updated_at')
        .order('created_at', { ascending: false })
    );

    if (coachError) {
      console.error(`[CoachesDatabase] Error fetching from coaches table: ${coachError.message}`);
      throw new Error(`Failed to fetch coaches from database: ${coachError.message}`);
    }

    // 2. Fetch coach users from users table using explicit projection
    const { data: coachUsers, error: userError } = await applyRowCeiling(
      supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, is_active, created_at')
        .eq('role', 'coach')
    );

    if (userError) {
      console.error(`[CoachesDatabase] Error fetching coach users from users table: ${userError.message}`);
    }

    const { data: students } = await supabase
      .from('students')
      .select('id, coach_id');

    const coachesList = coachesData || [];
    const userLookupByUserId = new Map<string, any>();

    (coachUsers || []).forEach((u: any) => {
      userLookupByUserId.set(u.id, u);
      if (u.email) userLookupByUserId.set(u.email.toLowerCase(), u);
    });

    // Data integrity validation: Detect and LOG orphaned coach users who lack a coaches table record.
    if (coachUsers && coachUsers.length > 0) {
      for (const u of coachUsers) {
        const matchesCoach = coachesList.some(
          (c: any) => c.id === u.id || c.user_id === u.id || (c.email && u.email && c.email.toLowerCase() === u.email.toLowerCase())
        );
        if (!matchesCoach) {
          console.error(`[DATA_INTEGRITY_ANOMALY] User "${u.id}" (${u.email}) has role='coach' in users table but no corresponding profile exists in the coaches table.`);
        }
      }
    }

    // Return real coach records from coaches table (single source of truth)
    return coachesList.map((c: any) => {
      const assignedCount = (students || []).filter((s: any) => s.coach_id === c.id).length;
      const linkedUser = (c.user_id && userLookupByUserId.get(c.user_id)) || userLookupByUserId.get(c.id) || (c.email ? userLookupByUserId.get(c.email.toLowerCase()) : null);
      return mapCoachRow(c, assignedCount, linkedUser);
    });
  }

  async getCoachById(id: string): Promise<CoachProfile | null> {
    const supabase = getSupabase();

    const { data: coachData } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('coach_id', id);

    const studentCount = students?.length || 0;

    let linkedUser: any = null;
    const lookupUserId = coachData?.user_id || id;
    if (lookupUserId) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', lookupUserId)
        .maybeSingle();
      linkedUser = uData;
    }

    if (coachData) {
      return mapCoachRow(coachData, studentCount, linkedUser);
    }

    if (linkedUser && linkedUser.role === ROLES.COACH) {
      const firstName = linkedUser.first_name || 'Coach';
      const lastName = linkedUser.last_name || '';
      return mapCoachRow({
        id: linkedUser.id,
        user_id: linkedUser.id,
        first_name: firstName,
        last_name: lastName,
        designation: linkedUser.designation || 'Principal Coach',
        status: linkedUser.is_active !== false ? 'Active' : 'Inactive',
        created_at: linkedUser.created_at
      }, studentCount, linkedUser);
    }

    return null;
  }

  async createCoach(data: {
    firstName?: string;
    lastName?: string;
    email: string;
    phoneNumber: string;
    address?: string;
    dateOfJoining?: string;
    status?: 'Active' | 'Inactive';
    dateOfLeaving?: string;
    educationalQualification?: string;
    designation?: string;
    specializations?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    password?: string;
  }): Promise<CoachProfile> {
    if (data.dateOfJoining && data.dateOfLeaving && new Date(data.dateOfLeaving) < new Date(data.dateOfJoining)) {
      throw new Error('Date of leaving cannot be earlier than date of joining.');
    }

    const supabase = getSupabase();
    const coachId = `coach-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let firstName = (data.firstName || '').trim();
    let lastName = (data.lastName || '').trim();

    if (!lastName) {
      lastName = '';
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedPhone = data.phoneNumber ? data.phoneNumber.trim() : '';
    if (!normalizedPhone) {
      throw new Error("A valid phone number is required to create a coach profile.");
    }
    const coachStatus = data.status === 'Inactive' ? 'Inactive' : 'Active';
    const designation = data.designation?.trim() || 'Principal Coach';
    const specs = Array.isArray(data.specializations)
      ? data.specializations
      : [];

    const dateOfJoining = (data.dateOfJoining && data.dateOfJoining.trim())
      ? data.dateOfJoining.trim()
      : new Date().toISOString().split('T')[0];
    const dateOfLeaving = (data.dateOfLeaving && data.dateOfLeaving.trim())
      ? data.dateOfLeaving.trim()
      : null;

    // 1. Validate password first
    if (!data.password || data.password.trim().length < 8) {
      throw new Error("A valid password (minimum 8 characters) is required to create a coach account.");
    }
    const initialPassword = data.password.trim();
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    // 2. Identity-First: Create or resolve user record first
    let createdUser: any = null;
    let assignedUserId: string = '';
    let isNewUser = false;

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      assignedUserId = existingUser.id;
      const { data: updatedU, error: uUpdateError } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          role: 'coach',
          password_hash: passwordHash,
          is_active: coachStatus === 'Active',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (uUpdateError) {
        console.warn(`[CoachesDatabase] Warning updating user for coach: ${uUpdateError.message}`);
      }
      createdUser = updatedU || existingUser;
    } else {
      assignedUserId = `usr-${coachId}`;
      isNewUser = true;
      const { data: newU, error: uInsertError } = await supabase
        .from('users')
        .insert({
          id: assignedUserId,
          email: normalizedEmail,
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          role: 'coach',
          password_hash: passwordHash,
          is_active: coachStatus === 'Active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (uInsertError) {
        throw new Error(`Failed to create coach user credentials: ${uInsertError.message}`);
      }
      createdUser = newU;
    }

    // 3. Insert into coaches table with forward-written user_id
    const coachPayload: any = {
      id: coachId,
      user_id: assignedUserId || null,
      address: (data.address && data.address.trim()) ? data.address.trim() : null,
      date_of_joining: dateOfJoining,
      status: coachStatus,
      date_of_leaving: dateOfLeaving,
      educational_qualification: (data.educationalQualification && data.educationalQualification.trim()) ? data.educationalQualification.trim() : null,
      designation: designation,
      specializations: specs,
      emergency_contact_name: (data.emergencyContactName && data.emergencyContactName.trim()) ? data.emergencyContactName.trim() : null,
      emergency_contact_phone: (data.emergencyContactPhone && data.emergencyContactPhone.trim()) ? data.emergencyContactPhone.trim() : null,
      notes: (data.notes && data.notes.trim()) ? data.notes.trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertedCoach, error: coachError } = await supabase
      .from('coaches')
      .insert(coachPayload)
      .select()
      .single();

    if (coachError) {
      // Roll back user if newly created
      if (isNewUser && assignedUserId) {
        await supabase.from('users').delete().eq('id', assignedUserId);
      }
      console.error('[CoachesDatabase] Error inserting into coaches table:', coachError);
      throw new Error(`Failed to create coach profile in database: ${coachError.message}${coachError.details ? ` (${coachError.details})` : ''}`);
    }

    return mapCoachRow(insertedCoach || coachPayload, 0, createdUser);
  }

  async updateCoach(id: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    dateOfJoining?: string;
    status?: 'Active' | 'Inactive';
    dateOfLeaving?: string;
    educationalQualification?: string;
    designation?: string;
    specializations?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    password?: string;
  }): Promise<CoachProfile> {
    if (updates.dateOfJoining && updates.dateOfLeaving && new Date(updates.dateOfLeaving) < new Date(updates.dateOfJoining)) {
      throw new Error('Date of leaving cannot be earlier than date of joining.');
    }

    const supabase = getSupabase();

    let firstName = updates.firstName?.trim();
    let lastName = updates.lastName?.trim();
    const patch: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.address !== undefined) patch.address = updates.address.trim() || null;
    if (updates.dateOfJoining !== undefined) patch.date_of_joining = updates.dateOfJoining?.trim() || null;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.dateOfLeaving !== undefined) patch.date_of_leaving = updates.dateOfLeaving?.trim() || null;
    if (updates.educationalQualification !== undefined) patch.educational_qualification = updates.educationalQualification.trim() || null;
    if (updates.designation !== undefined) patch.designation = updates.designation.trim() || null;
    if (updates.specializations !== undefined) patch.specializations = updates.specializations;
    if (updates.emergencyContactName !== undefined) patch.emergency_contact_name = updates.emergencyContactName.trim() || null;
    if (updates.emergencyContactPhone !== undefined) patch.emergency_contact_phone = updates.emergencyContactPhone.trim() || null;
    if (updates.notes !== undefined) patch.notes = updates.notes.trim() || null;

    const { data: updatedCoach, error } = await supabase
      .from('coaches')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update coach: ${error.message}`);
    }

    // Sync changes to associated user in users table
    const userPatch: any = {
      updated_at: new Date().toISOString()
    };
    if (firstName !== undefined) userPatch.first_name = firstName;
    if (lastName !== undefined) userPatch.last_name = lastName;
    if (updates.email) userPatch.email = updates.email.toLowerCase().trim();
    if (updates.phoneNumber) userPatch.phone = updates.phoneNumber.trim();
    if (updates.status) userPatch.is_active = updates.status === 'Active';
    if (updates.password && updates.password.trim().length >= 8) {
      userPatch.password_hash = bcrypt.hashSync(updates.password.trim(), 10);
    }

    let updatedUser: any = null;
    if (Object.keys(userPatch).length > 0) {
      try {
        if (updatedCoach?.user_id) {
          const { data: uData } = await supabase
            .from('users')
            .update(userPatch)
            .eq('id', updatedCoach.user_id)
            .select()
            .maybeSingle();
          updatedUser = uData;
        } else {
          const { data: uData } = await supabase
            .from('users')
            .update(userPatch)
            .eq('id', id)
            .select()
            .maybeSingle();
          updatedUser = uData;
        }
      } catch (e: any) {
        console.warn(`[CoachesDatabase] Notice updating user for coach ${id}: ${e.message}`);
      }
    }

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('coach_id', id);

    return mapCoachRow(updatedCoach, students?.length || 0, updatedUser);
  }

  async deleteCoach(id: string): Promise<boolean> {
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];

    // 1. Unassign coach from any students so active students are not stranded
    try {
      await supabase
        .from('students')
        .update({ coach_id: null, updated_at: new Date().toISOString() })
        .eq('coach_id', id);
    } catch (e: any) {
      console.warn(`[CoachesDatabase] Notice unassigning coach ${id} from students: ${e.message}`);
    }

    // 2. Soft Deactivation in coaches table: Set Inactive & date_of_leaving
    const { error: coachError } = await supabase
      .from('coaches')
      .update({
        status: 'Inactive',
        date_of_leaving: today,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (coachError) {
      throw new Error(`Failed to deactivate coach: ${coachError.message}`);
    }

    // 3. Deactivate linked user account in users table
    try {
      const { data: coachRecord } = await supabase
        .from('coaches')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle();

      const targetUserId = coachRecord?.user_id || id;
      await supabase
        .from('users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId);
    } catch (e: any) {
      console.warn(`[CoachesDatabase] Notice setting coach user inactive for ${id}: ${e.message}`);
    }

    return true;
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
      const coachData = await this.getCoachById(coachId);
      if (!coachData) {
        throw new Error('Coach not found');
      }
      if (coachData.status !== 'Active') {
        throw new Error('Cannot assign an inactive coach to a student.');
      }

      coachName = `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() || null;
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

export const coachesDb = new CoachesDatabase();
