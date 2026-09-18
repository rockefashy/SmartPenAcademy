import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types.ts';

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
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

// Custom fetch wrapper to handle transient Supabase PostgREST clock skew (PGRST303 "JWT issued at future")
const fetchWithSkewRetry: typeof fetch = async (input, init) => {
  let res = await fetch(input, init);
  if (res.status === 401) {
    try {
      const cloned = res.clone();
      const text = await cloned.text();
      if (text.includes('JWT issued at future') || text.includes('PGRST303')) {
        console.warn('[SUPABASE] Transient clock skew detected ("JWT issued at future"). Retrying query after 1.2s backoff...');
        await new Promise(resolve => setTimeout(resolve, 1200));
        res = await fetch(input, init);
      }
    } catch {
      // Ignore clone/text read error and proceed with original response
    }
  }
  return res;
};

export const serverSupabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: fetchWithSkewRetry,
  }
});
