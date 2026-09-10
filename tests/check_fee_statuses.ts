import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, serviceRoleKey!);

async function main() {
  const { data: cols, error: cErr } = await supabase
    .from('fees')
    .select('*')
    .limit(1);
  console.log('Sample fee row keys:', cols ? Object.keys(cols[0] || {}) : null);

  // Check what happens if we insert 'Pending'
  const { error: pErr } = await supabase
    .from('fees')
    .insert({ id: 'test-pending-check', student_id: 'test', status: 'Pending', date: '2026-09-01', year_month: '2026-09', amount: 100 });
  console.log('Insert Pending result:', pErr?.message);

  // Check what happens if we insert 'Overdue'
  const { error: oErr } = await supabase
    .from('fees')
    .insert({ id: 'test-overdue-check', student_id: 'test', status: 'Overdue', date: '2026-09-01', year_month: '2026-09', amount: 100 });
  console.log('Insert Overdue result:', oErr?.message);

  // Check what happens if we insert 'FakeStatus'
  const { error: fErr } = await supabase
    .from('fees')
    .insert({ id: 'test-fake-check', student_id: 'test', status: 'FakeStatus', date: '2026-09-01', year_month: '2026-09', amount: 100 });
  console.log('Insert FakeStatus result:', fErr?.message);
}

main().catch(console.error);
