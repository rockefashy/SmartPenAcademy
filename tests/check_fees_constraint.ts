import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, serviceRoleKey!);

async function main() {
  const { data, error } = await supabase
    .from('fees')
    .select('status')
    .limit(10);
  console.log('Sample fees:', { data, error });
}

main().catch(console.error);
