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

async function runTargetedTests() {
  console.log('================================================================');
  console.log('       TARGETED RE-RUN: SCENARIOS 12 & 13 (updateFeeStatus)     ');
  console.log('================================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  const ts = Date.now();
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdFeeIds: string[] = [];

  try {
    console.log('[SETUP] Creating isolated test student and fee record...');

    const student = await db.createStudent({
      id: `std-cat2-target-${ts}`,
      studentName: `StudentTarget Tester${ts}`,
      firstName: 'StudentTarget',
      lastName: `Tester${ts}`,
      displayName: `StudentTarget Tester${ts}`,
      parentName: 'Parent Target',
      email: `target_${ts}@smartpen.test`,
      whatsappMobile: '9876543099',
      age: 10,
      gradeClass: 'Grade 5',
      schoolName: 'Smart Pen Lab',
      password: 'password123',
      status: 'Active'
    });
    createdStudentIds.push(student.id);
    if (student.userId) createdUserIds.push(student.userId);

    const fee = await db.saveFeeRecord({
      id: `fee-cat2-target-${ts}`,
      studentId: student.id,
      date: '2026-09-01',
      yearMonth: '2026-09',
      amount: 2500,
      status: 'Pending',
      notes: 'Initial September coaching fees'
    });
    createdFeeIds.push(fee.id);

    console.log(`[SETUP] Fixtures created: Student ID ${student.id}, Fee ID ${fee.id}\n`);

    const adminUser: User = {
      id: 'admin-live-test',
      role: 'admin',
      displayName: 'Master Admin',
      email: 'admin@smartpen.com'
    };

    // -------------------------------------------------------------
    // Scenario 12: Execution flow (confirmed: true) - Mutates status & amount in DB
    // -------------------------------------------------------------
    {
      const input = {
        feeId: fee.id,
        newStatus: 'Waived',
        newAmount: 1200,
        notes: 'Approved scholarship waiver',
        confirmed: true
      };
      const res = await executeTool('updateFeeStatus', input, adminUser);
      const dbFee = await db.findFeeById(fee.id);
      const statusUpdated = dbFee?.status === 'Waived';
      const amountUpdated = Number(dbFee?.amount) === 1200;
      const passed = res.success === true && statusUpdated && amountUpdated && res.summary.includes('updated to');
      const notes = passed
        ? `Fee updated to status='Waived', amount=1200. DB confirmed. Summary: ${res.summary}`
        : `Update failed or DB did not reflect changes: status=${dbFee?.status}, amount=${dbFee?.amount}, success=${res.success}, summary=${res.summary}`;
      record(12, 'updateFeeStatus: Execution flow (confirmed: true) - Mutates status & amount in DB', input, passed, notes);
    }

    // -------------------------------------------------------------
    // Scenario 13: Idempotency check - Status and amount already in effect
    // -------------------------------------------------------------
    {
      const input = {
        feeId: fee.id,
        newStatus: 'Waived',
        newAmount: 1200,
        confirmed: true
      };
      const res = await executeTool('updateFeeStatus', input, adminUser);
      const isAlreadyUpdated = res.result?.alreadyUpdated === true;
      const passed = res.success === true && isAlreadyUpdated && res.summary.includes('already in status');
      const notes = passed
        ? `Idempotency confirmed: already in status 'Waived', no mutation performed.`
        : `Idempotency check failed: alreadyUpdated=${isAlreadyUpdated}, summary=${res.summary}`;
      record(13, 'updateFeeStatus: Idempotency check - Status and amount already in effect', input, passed, notes);
    }

  } finally {
    console.log('[TEARDOWN] Cleaning up temporary test fixtures...');
    if (createdFeeIds.length > 0) {
      await supabase.from('fees').delete().in('id', createdFeeIds);
    }
    if (createdStudentIds.length > 0) {
      await supabase.from('students').delete().in('id', createdStudentIds);
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
    console.log('TARGETED RE-RUN RESULT: ALL SCENARIOS PASSED ✅');
  } else {
    console.log('TARGETED RE-RUN RESULT: SOME SCENARIOS FAILED ❌');
  }
  console.log('================================================================');
}

runTargetedTests().catch(console.error);
