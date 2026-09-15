#!/usr/bin/env node
/**
 * Smart Pen Academy - Database Cleanup & Entity Deletion CLI
 *
 * Provides safe command-line utilities to:
 *   1. Delete a student (cascading child records and linked user login)
 *   2. Delete a coach (unassigning students and removing linked user login)
 *   3. Find & purge all orphan records across the database
 *
 * Usage:
 *   npx tsx scripts/db-cleanup.ts --list-orphans
 *   npx tsx scripts/db-cleanup.ts --cleanup-orphans [--dry-run]
 *   npx tsx scripts/db-cleanup.ts --delete-student <student_id> [--dry-run] [--keep-user]
 *   npx tsx scripts/db-cleanup.ts --delete-coach <coach_id> [--dry-run] [--keep-user]
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`
[db-cleanup] ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in your .env file!

To execute this CLI script locally:
1. Add SUPABASE_SERVICE_ROLE_KEY to your local .env file.
   (Find it in Supabase Dashboard -> Project Settings -> API -> service_role secret).

OR (Recommended):
Run the SQL script directly in the Supabase Dashboard SQL Editor without needing API keys:
   scripts/admin_delete_and_cleanup.sql
`);
    process.exit(1);
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface CliOptions {
  action: 'list-orphans' | 'cleanup-orphans' | 'delete-student' | 'delete-coach' | 'help';
  targetId?: string;
  dryRun: boolean;
  keepUser: boolean;
}

function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    action: 'help',
    dryRun: false,
    keepUser: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.action = 'help';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--keep-user') {
      options.keepUser = true;
    } else if (arg === '--list-orphans') {
      options.action = 'list-orphans';
    } else if (arg === '--cleanup-orphans') {
      options.action = 'cleanup-orphans';
    } else if (arg === '--delete-student' && args[i + 1]) {
      options.action = 'delete-student';
      options.targetId = args[++i];
    } else if (arg === '--delete-coach' && args[i + 1]) {
      options.action = 'delete-coach';
      options.targetId = args[++i];
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Smart Pen Academy - Database Cleanup & Entity Deletion CLI

Usage:
  npx tsx scripts/db-cleanup.ts [options]

Commands:
  --list-orphans                         Audit database and list count of all orphaned rows
  --cleanup-orphans [--dry-run]          Delete/fix all orphaned records across all tables
  --delete-student <id> [--dry-run]      Hard delete student, cascading child records & user
  --delete-coach <id> [--dry-run]        Hard delete coach, unassign students & delete user
  --keep-user                            (Optional) Preserve the linked users auth record
  --help, -h                             Show this help message
`);
}

// -----------------------------------------------------------------------------
// 1. DELETE STUDENT CASCADE
// -----------------------------------------------------------------------------
async function deleteStudentCascade(studentId: string, dryRun: boolean, keepUser: boolean): Promise<void> {
  console.log(`\n=== DELETING STUDENT: ${studentId} ${dryRun ? '(DRY RUN)' : ''} ===`);

  const supabase = getSupabaseClient();
  const { data: student, error: fetchErr } = await supabase
    .from('students')
    .select('id, first_name, last_name, user_id, coach_id')
    .eq('id', studentId)
    .single();

  if (fetchErr || !student) {
    console.error(`[db-cleanup] Student not found: ${studentId} (${fetchErr?.message || 'No row'})`);
    return;
  }

  console.log(`Found Student: ${student.first_name} ${student.last_name} (User ID: ${student.user_id || 'none'})`);

  // Count child records
  const tables = [
    { name: 'attendance', col: 'student_id' },
    { name: 'fees', col: 'student_id' },
    { name: 'progress_trackers', col: 'student_id' },
    { name: 'student_works', col: 'student_id' },
    { name: 'fee_reminders', col: 'student_id' },
    { name: 'alerts', col: 'student_id' },
  ];

  for (const t of tables) {
    const { count } = await supabase.from(t.name).select('*', { count: 'exact', head: true }).eq(t.col, studentId);
    console.log(`  -> ${t.name}: ${count || 0} record(s) to delete`);

    if (!dryRun && count && count > 0) {
      const { error } = await supabase.from(t.name).delete().eq(t.col, studentId);
      if (error) console.error(`     Error deleting from ${t.name}:`, error.message);
    }
  }

  // Unlink testimonials
  const { count: testimonialCount } = await supabase.from('testimonials').select('*', { count: 'exact', head: true }).eq('student_id', studentId);
  if (testimonialCount && testimonialCount > 0) {
    console.log(`  -> testimonials: unlinking ${testimonialCount} testimonial(s)`);
    if (!dryRun) {
      await supabase.from('testimonials').update({ student_id: null }).eq('student_id', studentId);
    }
  }

  // Delete student row
  console.log(`  -> students: deleting profile ${studentId}`);
  if (!dryRun) {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) throw new Error(`Failed to delete student: ${error.message}`);
  }

  // Delete linked user row
  if (student.user_id && !keepUser) {
    console.log(`  -> users: deleting login user ${student.user_id}`);
    if (!dryRun) {
      const { error } = await supabase.from('users').delete().eq('id', student.user_id);
      if (error) console.warn(`     Notice deleting user ${student.user_id}:`, error.message);
    }
  }

  console.log(`\nDone! Student ${studentId} ${dryRun ? 'would be' : 'successfully'} deleted.\n`);
}

// -----------------------------------------------------------------------------
// 2. DELETE COACH CASCADE
// -----------------------------------------------------------------------------
async function deleteCoachCascade(coachId: string, dryRun: boolean, keepUser: boolean): Promise<void> {
  console.log(`\n=== DELETING COACH: ${coachId} ${dryRun ? '(DRY RUN)' : ''} ===`);

  const supabase = getSupabaseClient();
  const { data: coach, error: fetchErr } = await supabase
    .from('coaches')
    .select('id, first_name, last_name, user_id')
    .eq('id', coachId)
    .single();

  if (fetchErr || !coach) {
    console.error(`[db-cleanup] Coach not found: ${coachId} (${fetchErr?.message || 'No row'})`);
    return;
  }

  console.log(`Found Coach: ${coach.first_name} ${coach.last_name} (User ID: ${coach.user_id || 'none'})`);

  // Unassign students
  const { data: assignedStudents } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('coach_id', coachId);

  const studentCount = assignedStudents?.length || 0;
  console.log(`  -> students: unassigning ${studentCount} student(s) currently assigned to this coach`);

  if (!dryRun && studentCount > 0) {
    const { error } = await supabase.from('students').update({ coach_id: null, updated_at: new Date().toISOString() }).eq('coach_id', coachId);
    if (error) console.error(`     Error unassigning students:`, error.message);
  }

  // Delete coach row
  console.log(`  -> coaches: deleting coach profile ${coachId}`);
  if (!dryRun) {
    const { error } = await supabase.from('coaches').delete().eq('id', coachId);
    if (error) throw new Error(`Failed to delete coach: ${error.message}`);
  }

  // Delete linked user login
  if (coach.user_id && !keepUser) {
    console.log(`  -> users: deleting coach login ${coach.user_id}`);
    if (!dryRun) {
      const { error } = await supabase.from('users').delete().eq('id', coach.user_id);
      if (error) console.warn(`     Notice deleting user:`, error.message);
    }
  }

  console.log(`\nDone! Coach ${coachId} ${dryRun ? 'would be' : 'successfully'} deleted.\n`);
}

// -----------------------------------------------------------------------------
// 3. AUDIT & PURGE ORPHAN RECORDS
// -----------------------------------------------------------------------------
async function auditAndCleanOrphans(purge: boolean): Promise<void> {
  console.log(`\n=== ${purge ? 'PURGING' : 'AUDITING'} ORPHAN RECORDS ===\n`);

  const supabase = getSupabaseClient();
  const { data: students } = await supabase.from('students').select('id, user_id, coach_id');
  const studentIds = new Set((students || []).map(s => s.id));
  const studentUserIds = new Set((students || []).map(s => s.user_id).filter(Boolean));
  const studentCoachIds = new Set((students || []).map(s => s.coach_id).filter(Boolean));

  // 2. Get all valid coach IDs & user IDs
  const { data: coaches } = await supabase.from('coaches').select('id, user_id');
  const coachIds = new Set((coaches || []).map(c => c.id));
  const coachUserIds = new Set((coaches || []).map(c => c.user_id).filter(Boolean));

  // 3. Get all valid user IDs
  const { data: users } = await supabase.from('users').select('id, role');
  const userIds = new Set((users || []).map(u => u.id));

  console.log(`Master counts: ${studentIds.size} Students, ${coachIds.size} Coaches, ${userIds.size} Users.\n`);

  // Helper to check orphan records pointing to students
  const checkStudentChildOrphans = async (tableName: string) => {
    const { data: rows } = await supabase.from(tableName).select('id, student_id');
    const orphans = (rows || []).filter(r => !r.student_id || !studentIds.has(r.student_id));
    console.log(`  -> ${tableName}: ${orphans.length} orphan rows (student_id not in students)`);

    if (purge && orphans.length > 0) {
      const orphanIds = orphans.map(o => o.id);
      for (let i = 0; i < orphanIds.length; i += 100) {
        const batch = orphanIds.slice(i, i + 100);
        await supabase.from(tableName).delete().in('id', batch);
      }
      console.log(`     [CLEANED] Deleted ${orphans.length} rows from ${tableName}`);
    }
  };

  await checkStudentChildOrphans('attendance');
  await checkStudentChildOrphans('fees');
  await checkStudentChildOrphans('progress_trackers');
  await checkStudentChildOrphans('student_works');
  await checkStudentChildOrphans('fee_reminders');

  // Alerts
  const { data: alerts } = await supabase.from('alerts').select('id, student_id');
  const orphanAlerts = (alerts || []).filter(a => a.student_id && !studentIds.has(a.student_id));
  console.log(`  -> alerts: ${orphanAlerts.length} orphan rows`);
  if (purge && orphanAlerts.length > 0) {
    await supabase.from('alerts').delete().in('id', orphanAlerts.map(a => a.id));
    console.log(`     [CLEANED] Deleted ${orphanAlerts.length} orphan alerts`);
  }

  // Broken coach reference in students
  const brokenStudentCoaches = (students || []).filter(s => s.coach_id && !coachIds.has(s.coach_id));
  console.log(`  -> students with non-existent coach_id: ${brokenStudentCoaches.length}`);
  if (purge && brokenStudentCoaches.length > 0) {
    for (const s of brokenStudentCoaches) {
      await supabase.from('students').update({ coach_id: null }).eq('id', s.id);
    }
    console.log(`     [CLEANED] Unset invalid coach_id on ${brokenStudentCoaches.length} student(s)`);
  }

  // Broken user reference in students
  const brokenStudentUsers = (students || []).filter(s => s.user_id && !userIds.has(s.user_id));
  console.log(`  -> students with non-existent user_id: ${brokenStudentUsers.length}`);
  if (purge && brokenStudentUsers.length > 0) {
    for (const s of brokenStudentUsers) {
      await supabase.from('students').update({ user_id: null }).eq('id', s.id);
    }
    console.log(`     [CLEANED] Unset invalid user_id on ${brokenStudentUsers.length} student(s)`);
  }

  // Broken user reference in coaches
  const brokenCoachUsers = (coaches || []).filter(c => c.user_id && !userIds.has(c.user_id));
  console.log(`  -> coaches with non-existent user_id: ${brokenCoachUsers.length}`);
  if (purge && brokenCoachUsers.length > 0) {
    for (const c of brokenCoachUsers) {
      await supabase.from('coaches').update({ user_id: null }).eq('id', c.id);
    }
    console.log(`     [CLEANED] Unset invalid user_id on ${brokenCoachUsers.length} coach(es)`);
  }

  // Orphan users with role 'student' (no student profile points to them)
  const orphanStudentUsers = (users || []).filter(u => u.role === 'student' && !studentUserIds.has(u.id));
  console.log(`  -> users (role='student') with no student profile: ${orphanStudentUsers.length}`);
  if (purge && orphanStudentUsers.length > 0) {
    await supabase.from('users').delete().in('id', orphanStudentUsers.map(u => u.id));
    console.log(`     [CLEANED] Deleted ${orphanStudentUsers.length} orphan student users`);
  }

  // Orphan users with role 'coach' (no coach profile points to them)
  const orphanCoachUsers = (users || []).filter(u => u.role === 'coach' && !coachUserIds.has(u.id));
  console.log(`  -> users (role='coach') with no coach profile: ${orphanCoachUsers.length}`);
  if (purge && orphanCoachUsers.length > 0) {
    await supabase.from('users').delete().in('id', orphanCoachUsers.map(u => u.id));
    console.log(`     [CLEANED] Deleted ${orphanCoachUsers.length} orphan coach users`);
  }

  console.log(`\nAudit & Cleanup Complete!\n`);
}

// -----------------------------------------------------------------------------
// MAIN ENTRYPOINT
// -----------------------------------------------------------------------------
async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  switch (options.action) {
    case 'list-orphans':
      await auditAndCleanOrphans(false);
      break;
    case 'cleanup-orphans':
      await auditAndCleanOrphans(!options.dryRun);
      break;
    case 'delete-student':
      if (!options.targetId) {
        console.error('Please specify a student ID, e.g. --delete-student std-1234');
        process.exit(1);
      }
      await deleteStudentCascade(options.targetId, options.dryRun, options.keepUser);
      break;
    case 'delete-coach':
      if (!options.targetId) {
        console.error('Please specify a coach ID, e.g. --delete-coach cch-1234');
        process.exit(1);
      }
      await deleteCoachCascade(options.targetId, options.dryRun, options.keepUser);
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch(err => {
  console.error('[db-cleanup] Fatal error:', err);
  process.exit(1);
});
