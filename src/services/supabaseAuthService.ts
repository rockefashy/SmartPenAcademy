import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';

export const supabaseAuthService = {
  // Check if Supabase Auth is enabled & active
  isEnabled(): boolean {
    return isSupabaseConfigured && !!supabase;
  },

  // 1. Sign In with Supabase Auth
  async signIn(identifier: string, password: string): Promise<{ token: string; user: User } | null> {
    if (!this.isEnabled()) return null;

    let email = identifier.trim();

    // If identifier is not an email format, lookup email from public.users
    if (!email.includes('@')) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('email, id, full_name, role, student_id')
          .or(`email.ilike.${email}%,id.eq.${email}`)
          .limit(1)
          .maybeSingle();

        if (data && data.email) {
          email = data.email;
        } else {
          // Special fallback for quick test accounts
          if (identifier === 'admin') email = 'admin@smartpen.academy';
          if (identifier === 'student_khwaish') email = 'parent.khwaish@gmail.com';
        }
      } catch (e) {
        console.warn('[SupabaseAuth] Username to email resolution fallback:', e);
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If user does not exist in Supabase auth yet (e.g. initial demo/test users), we can auto-provision or throw
        throw error;
      }

      if (!data.session || !data.user) {
        throw new Error('No session returned from Supabase Auth');
      }

      // Fetch extended profile from public.users table
      let userProfile: any = null;
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('email', data.user.email)
          .maybeSingle();
        userProfile = profile;
      } catch {
        // fallback
      }

      const meta = data.user.user_metadata || {};
      const appUser: User = {
        id: userProfile?.id || data.user.id,
        username: data.user.email?.split('@')[0] || 'user',
        email: data.user.email || '',
        fullName: userProfile?.full_name || meta.full_name || meta.name || data.user.email?.split('@')[0] || 'User',
        role: userProfile?.role || meta.role || (data.user.email?.includes('admin') ? 'admin' : 'student'),
        studentId: userProfile?.student_id || meta.student_id,
      };

      return {
        token: data.session.access_token,
        user: appUser,
      };
    } catch (err: any) {
      console.warn('[SupabaseAuth] signIn error:', err.message);
      throw err;
    }
  },

  // 2. Sign Up with Supabase Auth
  async signUp(
    email: string,
    password: string,
    metadata: { fullName: string; role?: 'admin' | 'student'; studentId?: string; phone?: string }
  ): Promise<{ user: User; session: any } | null> {
    if (!this.isEnabled()) return null;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata.fullName,
          role: metadata.role || 'student',
          student_id: metadata.studentId,
          phone: metadata.phone,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Failed to create account in Supabase Auth');

    // Upsert into public.users
    try {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: metadata.fullName,
        role: metadata.role || 'student',
        student_id: metadata.studentId,
        phone: metadata.phone,
        is_active: true,
      }, { onConflict: 'email' });
    } catch (e) {
      console.warn('[SupabaseAuth] Error syncing public.users profile:', e);
    }

    const appUser: User = {
      id: data.user.id,
      username: email.split('@')[0],
      email: data.user.email || email,
      fullName: metadata.fullName,
      role: metadata.role || 'student',
      studentId: metadata.studentId,
    };

    return {
      user: appUser,
      session: data.session,
    };
  },

  // 3. Forgot Password / Password Reset
  async resetPassword(email: string): Promise<boolean> {
    if (!this.isEnabled()) return false;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) throw error;
    return true;
  },

  // 4. Sign Out
  async signOut(): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[SupabaseAuth] Sign out error:', e);
    }
  },

  // 5. Get Current User / Session
  async getCurrentUser(): Promise<User | null> {
    if (!this.isEnabled()) return null;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) return null;

      const user = session.user;
      // Fetch public profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      const meta = user.user_metadata || {};
      return {
        id: profile?.id || user.id,
        username: user.email?.split('@')[0] || 'user',
        email: user.email || '',
        fullName: profile?.full_name || meta.full_name || user.email?.split('@')[0] || 'User',
        role: profile?.role || meta.role || (user.email?.includes('admin') ? 'admin' : 'student'),
        studentId: profile?.student_id || meta.student_id,
      };
    } catch {
      return null;
    }
  },
};
