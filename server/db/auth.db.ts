import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User, ROLES } from '../../src/types';
import { getSupabase } from './client.ts';

export interface StoredUser extends User {
  passwordHash?: string;
  phoneNumber?: string;
  coachId?: string | null;
  designation?: string | null;
  resetPasswordToken?: string;
  resetPasswordExpiry?: number;
  createdAt?: string;
  tokenVersion?: number;
}

export function mapUserRow(row: any, coachDesignation?: string | null): StoredUser {
  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || firstName || 'User';
  return {
    id: row.id,
    email: row.email,
    phone: row.phone || '',
    phoneNumber: row.phone || undefined,
    firstName,
    lastName,
    displayName,
    role: row.role || 'student',
    studentId: row.student_id || undefined,
    coachId: row.coach_id || undefined,
    avatarUrl: row.avatar_url || undefined,
    isActive: row.is_active !== false,
    designation: coachDesignation || undefined,
    passwordHash: row.password_hash || undefined,
    resetPasswordToken: row.reset_password_token || undefined,
    resetPasswordExpiry: row.reset_password_expiry ? Number(row.reset_password_expiry) : undefined,
    createdAt: row.created_at || undefined,
    tokenVersion: typeof row.token_version === 'number' ? row.token_version : 1
  };
}

export class AuthDatabase {
  async findUsersByIdentifier(loginIdentifier: string): Promise<StoredUser[]> {
    if (!loginIdentifier || typeof loginIdentifier !== 'string') return [];
    const supabase = getSupabase();
    const clean = loginIdentifier.trim().toLowerCase();
    const phoneDigits = loginIdentifier.replace(/\D/g, '');

    // 1. Primary privileged pre-authentication RPC path (bypasses RLS via hardened SECURITY DEFINER)
    let userCandidates: any[] = [];
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_auth_user_by_identifier', { p_identifier: clean });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        userCandidates = rpcData;
      }
    } catch {
      // Fall through to explicit column projection
    }

    // 2. Direct targeted query fallback if RPC didn't return matches
    if (userCandidates.length === 0) {
      const filterConditions = [
        `email.ilike.${clean}`
      ];
      // Retain phone lookup for planned future phone authentication enhancement
      if (phoneDigits && phoneDigits.length >= 10) {
        filterConditions.push(`phone.eq.${phoneDigits}`);
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version')
        .or(filterConditions.join(','));

      if (!error && Array.isArray(data) && data.length > 0) {
        userCandidates = data;
      } else {
        // If username prefix or exact email search is required
        const { data: emailData } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version')
          .ilike('email', clean.includes('@') ? clean : `${clean}@%`);
        if (emailData && emailData.length > 0) {
          userCandidates = emailData;
        }
      }
    }

    if (userCandidates.length === 0) return [];

    // Identity-First: Enrich user candidates with coachId/designation or studentId from child tables
    const userIds = userCandidates.map((u: any) => u.id);
    const [coachResult, studentResult] = await Promise.all([
      supabase.from('coaches').select('id, user_id, designation').in('user_id', userIds),
      supabase.from('students').select('id, user_id').in('user_id', userIds)
    ]);

    const coachMap = new Map<string, { id: string; designation?: string }>();
    if (coachResult.data) {
      coachResult.data.forEach((c: any) => {
        if (c.user_id) coachMap.set(c.user_id, { id: c.id, designation: c.designation });
      });
    }

    const studentMap = new Map<string, string>();
    if (studentResult.data) {
      studentResult.data.forEach((s: any) => {
        if (s.user_id && !studentMap.has(s.user_id)) {
          studentMap.set(s.user_id, s.id);
        }
      });
    }

    return userCandidates.map((u: any) => {
      const coachInfo = coachMap.get(u.id);
      const studentId = studentMap.get(u.id);
      const mapped = mapUserRow(u, coachInfo?.designation || null);
      if (coachInfo) mapped.coachId = coachInfo.id;
      if (studentId) mapped.studentId = studentId;
      return mapped;
    });
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error looking up user ${id}: ${error.message}`);
    }
    if (!data) return null;

    let coachDesignation: string | null = null;
    let coachId: string | undefined = undefined;
    let studentId: string | undefined = undefined;

    if (data.role === ROLES.COACH) {
      try {
        const { data: coachData } = await supabase
          .from('coaches')
          .select('id, designation')
          .eq('user_id', data.id)
          .maybeSingle();
        if (coachData) {
          coachId = coachData.id;
          coachDesignation = coachData.designation;
        }
      } catch {
        // fallback
      }
    } else if (data.role === ROLES.STUDENT) {
      try {
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', data.id)
          .limit(1)
          .maybeSingle();
        if (studentData) {
          studentId = studentData.id;
        }
      } catch {
        // fallback
      }
    }

    const user = mapUserRow(data, coachDesignation);
    if (coachId) user.coachId = coachId;
    if (studentId) user.studentId = studentId;
    return user;
  }

  async findUserByEmailOrUsername(identifier: string): Promise<StoredUser | null> {
    const users = await this.findUsersByIdentifier(identifier);
    return users.length > 0 ? users[0] : null;
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    return this.findUserByEmailOrUsername(username);
  }

  async findUserByStudentId(studentId: string): Promise<StoredUser | null> {
    const supabase = getSupabase();

    // Identity-First lookup: Check students.user_id foreign key
    const { data: stdData } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('id', studentId)
      .maybeSingle();

    if (stdData?.user_id) {
      const user = await this.findUserById(stdData.user_id);
      if (user) {
        user.studentId = studentId;
        return user;
      }
    }

    return null;
  }

  async getAdminUser(): Promise<StoredUser | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version, created_at')
      .eq('role', 'admin')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseDatabase] Error querying admin user from users table: ${error.message}`);
      throw new Error(`Failed to query admin user: ${error.message}`);
    }
    return data ? mapUserRow(data) : null;
  }

  async getAdminEmail(): Promise<string | null> {
    const admin = await this.getAdminUser();
    return admin?.email || null;
  }

  async changeUserPassword(
    email: string,
    currentPassword?: string,
    newPassword?: string,
    options?: { targetStudentId?: string; targetUserId?: string; applyToAll?: boolean }
  ): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const supabase = getSupabase();
    const cleanEmail = email.trim().toLowerCase();

    // Query all users matching this email
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, password_hash, token_version')
      .ilike('email', cleanEmail);

    if (findError || !users || users.length === 0) {
      return { success: false, error: 'User account not found.' };
    }

    // Determine target users to update
    let targetUsers = users;

    if (options?.targetUserId) {
      targetUsers = users.filter((u: any) => u.id === options.targetUserId);
      if (targetUsers.length === 0) {
        return { success: false, error: 'Target user profile not found.' };
      }
    } else if (options?.targetStudentId) {
      // Find user linked to targetStudentId
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id, user_id')
        .eq('id', options.targetStudentId)
        .maybeSingle();

      if (studentRecord?.user_id) {
        targetUsers = users.filter((u: any) => u.id === studentRecord.user_id);
      }
      if (targetUsers.length === 0) {
        return { success: false, error: 'Target student account not found.' };
      }
    }

    // If currentPassword was provided, verify it
    if (currentPassword) {
      const passwordMatchingUsers = targetUsers.filter((u: any) =>
        u.password_hash && bcrypt.compareSync(currentPassword, u.password_hash)
      );

      if (passwordMatchingUsers.length === 0) {
        return { success: false, error: 'Incorrect current password.' };
      }

      // If applyToAll is true (or default when not targeting a specific student),
      // update all matching users whose current password matched
      targetUsers = passwordMatchingUsers;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const targetIds = targetUsers.map((u: any) => u.id);

    // Update password_hash and increment token_version to invalidate existing tokens
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        token_version: ((targetUsers[0] as any)?.token_version || 1) + 1
      })
      .in('id', targetIds);

    if (updateError) {
      return { success: false, error: `Failed to update password: ${updateError.message}` };
    }

    return { success: true, updatedCount: targetIds.length };
  }

  async createPasswordResetToken(email: string): Promise<{ token: string } | { error: string }> {
    const supabase = getSupabase();
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (findError || !user) {
      return { error: 'No account registered with this email address.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_password_token: token,
        reset_password_expiry: expiry
      })
      .eq('id', user.id);

    if (updateError) {
      return { error: `Failed to create reset token: ${updateError.message}` };
    }

    return { token };
  }

  async getUserByResetToken(token: string): Promise<{ email: string } | null> {
    if (!token) return null;
    const supabase = getSupabase();
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('email, reset_password_expiry')
      .eq('reset_password_token', token.trim())
      .maybeSingle();

    if (findError || !user) {
      return null;
    }

    if (user.reset_password_expiry && Number(user.reset_password_expiry) < Date.now()) {
      return null;
    }

    return { email: user.email };
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!token || !newPassword || newPassword.length < 8) {
      return { success: false, error: 'Invalid reset parameters or password too short.' };
    }

    const supabase = getSupabase();
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('reset_password_token', token)
      .maybeSingle();

    if (findError || !user) {
      return { success: false, error: 'Invalid or expired password reset link.' };
    }

    if (user.reset_password_expiry && Number(user.reset_password_expiry) < Date.now()) {
      return { success: false, error: 'Password reset link has expired. Please request a new one.' };
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        reset_password_token: null,
        reset_password_expiry: null
      })
      .eq('id', user.id);

    if (updateError) {
      return { success: false, error: `Failed to reset password: ${updateError.message}` };
    }

    return { success: true };
  }

  async upsertUserFromSupabase(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'coach' | 'student' | 'parent';
    studentId?: string;
    id?: string;
    username?: string;
  }): Promise<StoredUser> {
    const supabase = getSupabase();
    const targetId = userData.id || `usr-${Date.now()}`;
    const targetRole = userData.role || 'student';
    const firstName = userData.firstName;
    const lastName = userData.lastName;

    // Lookup-first strategy: never overwrite an existing user's role from client-supplied data
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, username, is_active, student_id, coach_id, phone_number')
      .eq('email', userData.email)
      .maybeSingle();

    if (existingUser) {
      // User exists — return without modifying role or security fields
      return mapUserRow(existingUser);
    }

    // New user — insert with the provided role
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: targetId,
        email: userData.email,
        first_name: firstName,
        last_name: lastName,
        role: targetRole,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to sync user session in database: ${error.message}`);
    }

    return mapUserRow(data);
  }

  async updateUserSelfProfile(userId: string, allowedUpdates: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; user?: StoredUser; error?: string }> {
    const supabase = getSupabase();

    // Check user role: Coaches cannot edit their own details. Only Admin can do that.
    const { data: targetUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (targetUser?.role === ROLES.COACH) {
      return { success: false, error: 'Access denied: Coaches cannot edit their own details. Only an Administrator can update coach details.' };
    }

    // Explicit column-level whitelist: only allow safe self-profile fields
    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (allowedUpdates.phoneNumber !== undefined) {
      payload.phone = allowedUpdates.phoneNumber.trim();
    }
    if (allowedUpdates.avatarUrl !== undefined) {
      payload.avatar_url = allowedUpdates.avatarUrl.trim();
    }

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, token_version, created_at, updated_at')
      .single();

    if (error) {
      return { success: false, error: `Failed to update user profile: ${error.message}` };
    }

    return { success: true, user: mapUserRow(data) };
  }

  // Lightweight token-version check used by authenticateJwt to invalidate tokens after password change.
  async findUserTokenVersion(userId: string): Promise<number | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, token_version')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as any).token_version ?? null;
  }

  // Rate limiting (Supabase-backed atomic RPC)
  async checkRateLimit(
    key: string,
    maxCalls: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    const supabase = getSupabase();

    // 1. Primary path: Invoke atomic SECURITY DEFINER Postgres function
    try {
      const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
        p_key: key,
        p_max_calls: maxCalls,
        p_window_seconds: windowSeconds,
      });

      if (!error && data) {
        const rpcRes = data as any;
        return {
          allowed: Boolean(rpcRes?.allowed),
          retryAfter: Number(rpcRes?.retry_after || 0),
        };
      }

      if (error) {
        console.warn(`[SupabaseDatabase] RPC check_and_increment_rate_limit notice: ${error.message}`);
      }
    } catch (rpcErr: any) {
      console.warn(`[SupabaseDatabase] RPC check_and_increment_rate_limit exception: ${rpcErr.message}`);
    }

    // 2. Direct table fallback against public.rate_limits
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();

      const { data: existing, error: selectErr } = await supabase
        .from('rate_limits')
        .select('key, count, reset_at')
        .eq('key', key)
        .maybeSingle();

      if (!selectErr && existing) {
        const isExpired = new Date(existing.reset_at) < now;
        if (isExpired) {
          await supabase
            .from('rate_limits')
            .update({ count: 1, reset_at: resetAt })
            .eq('key', key);
          return { allowed: true, retryAfter: 0 };
        }

        if (existing.count >= maxCalls) {
          const retryAfter = Math.max(1, Math.ceil((new Date(existing.reset_at).getTime() - now.getTime()) / 1000));
          return { allowed: false, retryAfter };
        }

        await supabase
          .from('rate_limits')
          .update({ count: existing.count + 1 })
          .eq('key', key);
        return { allowed: true, retryAfter: 0 };
      }

      // No record yet or initial insert
      await supabase
        .from('rate_limits')
        .upsert({
          key,
          count: 1,
          reset_at: resetAt,
          created_at: nowIso,
        }, { onConflict: 'key' });

      return { allowed: true, retryAfter: 0 };
    } catch (tableErr: any) {
      console.warn(`[SupabaseDatabase] Direct rate_limits table fallback notice: ${tableErr.message}`);
      return { allowed: true, retryAfter: 0 };
    }
  }
}

export const authDb = new AuthDatabase();
