import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { db } from '../server/supabaseDb.ts';
import { executeTool } from '../server/aiAgent.ts';
import { User } from '../src/types.ts';

interface TestResult {
  id: number;
  name: string;
  input: string;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];

function record(id: number, name: string, input: any, passed: boolean, notes: string) {
  results.push({ id, name, input: JSON.stringify(input), passed, notes });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] Scenario ${id}: ${name}`);
  console.log(`       Input: ${JSON.stringify(input)}`);
  console.log(`       Notes: ${notes}\n`);
}

async function runScenario26() {
  console.log('================================================================');
  console.log('       TARGETED RE-RUN: SCENARIO 26 (getStudentWorkSamples)     ');
  console.log('================================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  const ts = Date.now();
  const createdStudentIds: string[] = [];
  const createdCoachIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    console.log('[SETUP] Creating isolated fixtures for Scenario 26...');

    // Coach 1 (Caller)
    const coach1 = await db.createCoach({
      firstName: 'Scen26Coach',
      lastName: `One${ts}`,
      email: `scen26_coach1_${ts}@smartpen.test`,
      phoneNumber: '9876543081',
      designation: 'Senior Coach',
      status: 'Active',
      specializations: ['Cursive'],
      password: 'password123'
    });
    createdCoachIds.push(coach1.id);
    if (coach1.userId) createdUserIds.push(coach1.userId);

    // Coach 2
    const coach2 = await db.createCoach({
      firstName: 'Scen26Coach',
      lastName: `Two${ts}`,
      email: `scen26_coach2_${ts}@smartpen.test`,
      phoneNumber: '9876543082',
      designation: 'Staff Coach',
      status: 'Active',
      specializations: ['Print'],
      password: 'password123'
    });
    createdCoachIds.push(coach2.id);
    if (coach2.userId) createdUserIds.push(coach2.userId);

    // Student 2 assigned to Coach 2
    const student2 = await db.createStudent({
      id: `std-cat1-s26-2-${ts}`,
      studentName: `StudentTwo Scen26Tester${ts}`,
      firstName: 'StudentTwo',
      lastName: `Scen26Tester${ts}`,
      parentName: 'Parent Two',
      email: `s26_student2_${ts}@smartpen.test`,
      whatsappMobile: '9876543084',
      age: 12,
      gradeClass: 'Grade 7',
      schoolName: 'Smart Pen Academy',
      password: 'password123',
      coachId: coach2.id,
      status: 'Active'
    });
    createdStudentIds.push(student2.id);
    if (student2.userId) createdUserIds.push(student2.userId);

    const coachUser1: User = {
      id: coach1.userId || `usr-coach1-${ts}`,
      role: 'coach',
      coachId: coach1.id,
      firstName: coach1.firstName,
      lastName: coach1.lastName || 'Coach',
      isActive: true,
      email: coach1.email
    };

    console.log('[SETUP] Fixtures initialized successfully.\n');

    // Scenario 26: Sanity check (getStudentWorkSamples) - Coach denied for unassigned student
    {
      const input = { studentNameOrId: student2.id };
      const res = await executeTool('getStudentWorkSamples', input, coachUser1);
      const passed = !res.success && res.summary.includes('Privacy Scoping') && res.summary.includes('not assigned to you');
      record(26, 'getStudentWorkSamples: Scoping check - Coach denied for unassigned student', input, passed, res.summary);
    }

  } finally {
    console.log('[TEARDOWN] Cleaning up temporary test fixtures...');
    if (createdStudentIds.length > 0) {
      await supabase.from('students').delete().in('id', createdStudentIds);
    }
    if (createdCoachIds.length > 0) {
      await supabase.from('coaches').delete().in('id', createdCoachIds);
    }
    if (createdUserIds.length > 0) {
      await supabase.from('users').delete().in('id', createdUserIds);
    }
    console.log('[TEARDOWN] Cleanup complete.\n');
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log('================================================================');
  console.log(`TOTAL SCENARIOS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  if (failedCount === 0) {
    console.log('SUITE RESULT: SCENARIO 26 PASSED ✅');
  } else {
    console.log('SUITE RESULT: SCENARIO 26 FAILED ❌');
  }
  console.log('================================================================');
}

runScenario26().catch(console.error);
