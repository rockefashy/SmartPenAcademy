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
    username: row.email,
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

    // Strict defense: Disallow wildcard-only identifiers
    if (clean === '%' || clean === '_' || clean.length === 0) return [];

    const phoneDigits = loginIdentifier.replace(/\D/g, '');

    // 1. Primary privileged pre-authentication RPC path (bypasses RLS via hardened SECURITY DEFINER)
    let userCandidates: any[] = [];
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_auth_user_by_identifier', { p_identifier: clean });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        userCandidates = rpcData.slice(0, 5);
      }
    } catch {
      // Fall through to explicit column projection
    }

    // 2. Direct targeted query fallback if RPC didn't return matches
    if (userCandidates.length === 0) {
      let query = supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version');

      if (clean.includes('@')) {
        query = query.eq('email', clean);
      } else if (phoneDigits && phoneDigits.length >= 10) {
        query = query.eq('phone', phoneDigits);
      } else {
        query = query.eq('email', clean);
      }

      const { data, error } = await query.limit(5);
      if (!error && Array.isArray(data) && data.length > 0) {
        userCandidates = data;
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
      const matchChecks = await Promise.all(
        targetUsers.map(async (u: any) => ({
          user: u,
          matches: Boolean(u.password_hash && await bcrypt.compare(currentPassword, u.password_hash))
        }))
      );
      const passwordMatchingUsers = matchChecks.filter(m => m.matches).map(m => m.user);

      if (passwordMatchingUsers.length === 0) {
        return { success: false, error: 'Incorrect current password.' };
      }

      // If applyToAll is true (or default when not targeting a specific student),
      // update all matching users whose current password matched
      targetUsers = passwordMatchingUsers;
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update each user's password_hash and strictly increment their OWN token_version
    const updatePromises = targetUsers.map((u: any) => {
      const nextVersion = (typeof u.token_version === 'number' ? u.token_version : 0) + 1;
      return supabase
        .from('users')
        .update({
          password_hash: newHash,
          token_version: nextVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', u.id);
    });

    const updateResults = await Promise.all(updatePromises);
    const hasError = updateResults.some(r => r.error);
    if (hasError) {
      return { success: false, error: 'Failed to update password for one or more target accounts.' };
    }

    return { success: true, updatedCount: targetUsers.length };
  }

  async createPasswordResetToken(email: string): Promise<{ token: string } | { error: string }> {
    const supabase = getSupabase();
    const cleanEmail = email.trim().toLowerCase();
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, email, token_version')
      .eq('email', cleanEmail);

    if (findError || !users || users.length === 0) {
      return { error: 'No account registered with this email address.' };
    }

    // Generate secure random token and store its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    const userIds = users.map(u => u.id);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_password_token: hashedToken,
        reset_password_expiry: expiry
      })
      .in('id', userIds);

    if (updateError) {
      return { error: `Failed to create reset token: ${updateError.message}` };
    }

    // Return the unhashed token to be dispatched via email
    return { token: rawToken };
  }

  async getUserByResetToken(token: string): Promise<{ email: string } | null> {
    if (!token) return null;
    const supabase = getSupabase();
    const cleanToken = token.trim();
    const hashedToken = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const { data: users, error: findError } = await supabase
      .from('users')
      .select('email, reset_password_expiry')
      .or(`reset_password_token.eq.${hashedToken},reset_password_token.eq.${cleanToken}`)
      .limit(1);

    if (findError || !users || users.length === 0) {
      return null;
    }

    const user = users[0];
    if (user.reset_password_expiry && Number(user.reset_password_expiry) < Date.now()) {
      return null;
    }

    return { email: user.email };
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; email?: string; error?: string }> {
    if (!token || !newPassword || newPassword.length < 8) {
      return { success: false, error: 'Invalid reset parameters or password too short.' };
    }

    const supabase = getSupabase();
    const cleanToken = token.trim();
    const hashedToken = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, email, token_version, reset_password_expiry')
      .or(`reset_password_token.eq.${hashedToken},reset_password_token.eq.${cleanToken}`);

    if (findError || !users || users.length === 0) {
      return { success: false, error: 'Invalid or expired password reset link.' };
    }

    const sampleUser = users[0];
    if (sampleUser.reset_password_expiry && Number(sampleUser.reset_password_expiry) < Date.now()) {
      return { success: false, error: 'Password reset link has expired. Please request a new one.' };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    const email = sampleUser.email;

    // Fetch all family members sharing this email to update them together
    const { data: allFamilyUsers } = await supabase
      .from('users')
      .select('id, token_version')
      .eq('email', email);

    const targetUsers = allFamilyUsers && allFamilyUsers.length > 0 ? allFamilyUsers : users;

    // Update each user with new hash, incremented token_version, and clear reset token
    const updatePromises = targetUsers.map(u => {
      const nextVersion = (typeof u.token_version === 'number' ? u.token_version : 0) + 1;
      return supabase
        .from('users')
        .update({
          password_hash: newHash,
          token_version: nextVersion,
          reset_password_token: null,
          reset_password_expiry: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', u.id);
    });

    const results = await Promise.all(updatePromises);
    const hasError = results.some(r => r.error);
    if (hasError) {
      return { success: false, error: 'Failed to update password on all account records.' };
    }

    return { success: true, email };
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
