import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types.ts';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Server-side Supabase client MUST use the service-role key.
// Falling back to the anon key silently changes the permission model:
//   - The service-role key bypasses RLS (intentional for backend use)
//   - The anon key is subject to RLS (different behaviour, different errors)
// If the service-role key is not configured, fail fast at startup.
if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.error('[FATAL] SUPABASE_URL is not configured. Set SUPABASE_URL in the environment.');
  process.exit(1);
}

if (!supabaseServiceRoleKey) {
  console.error('[FATAL] SUPABASE_SERVICE_ROLE_KEY is not configured. The server requires the service-role key. Set SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

export const isServerSupabaseConfigured = true;

export const serverSupabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
