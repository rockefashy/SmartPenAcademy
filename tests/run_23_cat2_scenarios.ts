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

async function runLiveTests() {
  console.log('================================================================');
  console.log('  CONSOLIDATED LIVE TEST SUITE: CATEGORY 2 TOOLS (23 SCENARIOS) ');
  console.log('  Tools: deactivateCoach, updateFeeStatus,                     ');
  console.log('         deleteAttendanceRecord, bulkDeleteStudentWorks         ');
  console.log('================================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  const ts = Date.now();
  const createdCoachIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdFeeIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  const createdWorkIds: string[] = [];

  try {
    console.log('[SETUP] Creating isolated test entities in database...');

    // 1. Coach to be deactivated in Tool 1 (deactivateCoach)
    const coachToDeact = await db.createCoach({
      firstName: 'DeactCoach',
      lastName: `Tester${ts}`,
      email: `deact_coach_${ts}@smartpen.test`,
      phoneNumber: '9876543001',
      designation: 'Staff Coach',
      specializations: ['Cursive'],
      status: 'Active',
      password: 'password123'
    });
    createdCoachIds.push(coachToDeact.id);

    // 2. Student assigned to coachToDeact
    const studentForDeact = await db.createStudent({
      id: `std-cat2-deact-${ts}`,
      studentName: `StudentDeact Child${ts}`,
      firstName: 'StudentDeact',
      lastName: `Child${ts}`,
      parentName: 'Parent Deact',
      email: `studentdeact_${ts}@smartpen.test`,
      whatsappMobile: '9876543002',
      age: 9,
      gradeClass: 'Grade 4',
      schoolName: 'Deact Academy',
      password: 'password123',
      coachId: coachToDeact.id,
      status: 'Active'
    });
    createdStudentIds.push(studentForDeact.id);
    if (studentForDeact.userId) createdUserIds.push(studentForDeact.userId);

    // 3. Persistent Coach 1 (assigned to student1)
    const coach1 = await db.createCoach({
      firstName: 'ActiveCoach',
      lastName: `One${ts}`,
      email: `activecoach1_${ts}@smartpen.test`,
      phoneNumber: '9876543011',
      designation: 'Senior Coach',
      specializations: ['Calligraphy'],
      status: 'Active',
      password: 'password123'
    });
    createdCoachIds.push(coach1.id);

    // 4. Persistent Coach 2 (assigned to student2)
    const coach2 = await db.createCoach({
      firstName: 'ActiveCoach',
      lastName: `Two${ts}`,
      email: `activecoach2_${ts}@smartpen.test`,
      phoneNumber: '9876543012',
      designation: 'Associate Coach',
      specializations: ['Speed Writing'],
      status: 'Active',
      password: 'password123'
    });
    createdCoachIds.push(coach2.id);

    // 5. Student 1 (assigned to coach1)
    const student1 = await db.createStudent({
      id: `std-cat2-one-${ts}`,
      studentName: `StudentOne Tester${ts}`,
      firstName: 'StudentOne',
      lastName: `Tester${ts}`,
      parentName: 'Parent One',
      email: `student1_${ts}@smartpen.test`,
      whatsappMobile: '9876543021',
      age: 10,
      gradeClass: 'Grade 5',
      schoolName: 'Smart Pen Lab',
      password: 'password123',
      coachId: coach1.id,
      status: 'Active'
    });
    createdStudentIds.push(student1.id);
    if (student1.userId) createdUserIds.push(student1.userId);

    // 6. Student 2 (assigned to coach2)
    const student2 = await db.createStudent({
      id: `std-cat2-two-${ts}`,
      studentName: `StudentTwo Tester${ts}`,
      firstName: 'StudentTwo',
      lastName: `Tester${ts}`,
      parentName: 'Parent Two',
      email: `student2_${ts}@smartpen.test`,
      whatsappMobile: '9876543022',
      age: 11,
      gradeClass: 'Grade 6',
      schoolName: 'Smart Pen Lab',
      password: 'password123',
      coachId: coach2.id,
      status: 'Active'
    });
    createdStudentIds.push(student2.id);
    if (student2.userId) createdUserIds.push(student2.userId);

    // 7. Fee Records
    const fee1 = await db.saveFeeRecord({
      id: `fee-cat2-1-${ts}`,
      studentId: student1.id,
      date: '2026-09-01',
      yearMonth: '2026-09',
      amount: 2500,
      status: 'Pending',
      notes: 'September coaching fees'
    });
    createdFeeIds.push(fee1.id);

    const fee2 = await db.saveFeeRecord({
      id: `fee-cat2-2-${ts}`,
      studentId: student2.id,
      date: '2026-09-01',
      yearMonth: '2026-09',
      amount: 2500,
      status: 'Pending',
      notes: 'September fees student 2'
    });
    createdFeeIds.push(fee2.id);

    // 8. Attendance Record for student1
    const attId1 = `att-cat2-1-${ts}`;
    await db.saveAttendanceBatch([{
      id: attId1,
      studentId: student1.id,
      classNumber: 1,
      date: '2026-09-08',
      status: 'Present',
      coachNotes: 'Good stroke technique'
    }]);
    createdAttendanceIds.push(attId1);

    // 9. Student Works
    const work1 = await db.saveStudentWork({
      id: `work-cat2-1-${ts}`,
      studentId: student1.id,
      captureDate: '2026-09-05',
      category: 'Practice Sheet',
      comments: 'Work sample 1',
      imageData: 'https://example.com/test1.jpg'
    });
    createdWorkIds.push(work1.id);

    const work2 = await db.saveStudentWork({
      id: `work-cat2-2-${ts}`,
      studentId: student2.id,
      captureDate: '2026-09-06',
      category: 'Homework',
      comments: 'Work sample 2 (coach 2 student)',
      imageData: 'https://example.com/test2.jpg'
    });
    createdWorkIds.push(work2.id);

    const work3 = await db.saveStudentWork({
      id: `work-cat2-3-${ts}`,
      studentId: student1.id,
      captureDate: '2026-09-07',
      category: 'Practice Sheet',
      comments: 'Work sample 3',
      imageData: 'https://example.com/test3.jpg'
    });
    createdWorkIds.push(work3.id);

    console.log('[SETUP] Test fixtures created successfully.\n');

    // Context Users
    const adminUser: User = {
      id: 'admin-live-test',
      role: 'admin',
      firstName: 'Master Admin',
      lastName: 'User',
      isActive: true,
      email: 'admin@smartpen.com'
    };

    const coachUser1: User = {
      id: coach1.id,
      coachId: coach1.id,
      role: 'coach',
      firstName: coach1.firstName,
      lastName: coach1.lastName || 'Coach',
      isActive: true,
      email: coach1.email
    };

    const coachUser2: User = {
      id: coach2.id,
      coachId: coach2.id,
      role: 'coach',
      firstName: coach2.firstName,
      lastName: coach2.lastName || 'Coach',
      isActive: true,
      email: coach2.email
    };

    const studentUser: User = {
      id: student1.id,
      studentId: student1.id,
      role: 'student',
      firstName: student1.firstName,
      lastName: student1.lastName || 'Student',
      isActive: true,
      email: student1.email
    };

    // =========================================================================
    // TOOL 1: deactivateCoach (SCENARIOS 1 - 6)
    // =========================================================================

    // Scenario 1: Auth check - Coach caller rejected
    {
      const input = { coachNameOrId: coachToDeact.id, confirmed: false };
      const res = await executeTool('deactivateCoach', input, coachUser1);
      const passed = !res.success && res.summary.includes('Only administrators can deactivate coaches');
      record(1, 'deactivateCoach: Auth check - Coach caller rejected', input, passed, res.summary);
    }

    // Scenario 2: Auth check - Student caller rejected
    {
      const input = { coachNameOrId: coachToDeact.id, confirmed: false };
      const res = await executeTool('deactivateCoach', input, studentUser);
      const passed = !res.success && res.summary.includes('Only administrators can deactivate coaches');
      record(2, 'deactivateCoach: Auth check - Student caller rejected', input, passed, res.summary);
    }

    // Scenario 3: Not-found check - Non-existent coach query
    {
      const input = { coachNameOrId: 'non-existent-coach-id-99999', confirmed: false };
      const res = await executeTool('deactivateCoach', input, adminUser);
      const passed = !res.success && res.summary.includes('Could not find coach matching');
      record(3, 'deactivateCoach: Not-found check - Non-existent coach rejected', input, passed, res.summary);
    }

    // Scenario 4: Draft flow (confirmed: false) - Shows warning and assigned students
    {
      const input = { coachNameOrId: coachToDeact.id, confirmed: false };
      const res = await executeTool('deactivateCoach', input, adminUser);
      const isDraft = res.result?.draft === true;
      const countMatch = res.result?.assignedStudentCount >= 1;
      const confirmPrompt = res.summary.includes('Confirm deactivation of');
      const c = await db.getCoachById(coachToDeact.id);
      const coachStillActive = c?.status === 'Active';
      const passed = res.success === true && isDraft && countMatch && confirmPrompt && coachStillActive;
      record(4, 'deactivateCoach: Draft flow (confirmed: false) - Pending confirmation', input, passed, res.summary);
    }

    // Scenario 5: Execution flow (confirmed: true) - Coach soft-deleted & students unassigned
    {
      const input = { coachNameOrId: coachToDeact.id, confirmed: true, notes: 'Retiring from academy' };
      const res = await executeTool('deactivateCoach', input, adminUser);
      const c = await db.getCoachById(coachToDeact.id);
      const coachIsInactive = c?.status === 'Inactive';
      const st = await db.getStudentById(studentForDeact.id);
      const studentUnassigned = st?.coachId === null || st?.coachId === undefined;
      const passed = res.success === true && coachIsInactive && studentUnassigned && res.summary.includes('✓ Coach **');
      record(5, 'deactivateCoach: Execution flow (confirmed: true) - Deactivates coach & cascades unassignment', input, passed, res.summary);
    }

    // Scenario 6: Idempotency check - Already inactive coach
    {
      const input = { coachNameOrId: coachToDeact.id, confirmed: true };
      const res = await executeTool('deactivateCoach', input, adminUser);
      const isAlreadyInactive = res.result?.alreadyInactive === true;
      const passed = res.success === true && isAlreadyInactive && res.summary.includes('already Inactive');
      record(6, 'deactivateCoach: Idempotency check - Already inactive coach', input, passed, res.summary);
    }

    // =========================================================================
    // TOOL 2: updateFeeStatus (SCENARIOS 7 - 13)
    // =========================================================================

    // Scenario 7: Auth check - Student caller rejected
    {
      const input = { feeId: fee1.id, newStatus: 'Waived' };
      const res = await executeTool('updateFeeStatus', input, studentUser);
      const passed = !res.success && res.summary.includes('Only administrators and assigned coaches can modify fee records');
      record(7, 'updateFeeStatus: Auth check - Student caller rejected', input, passed, res.summary);
    }

    // Scenario 8: Coach scoping - Coach rejected for unassigned student
    {
      const input = { feeId: fee2.id, newStatus: 'Waived', confirmed: false };
      const res = await executeTool('updateFeeStatus', input, coachUser1);
      const passed = !res.success && res.summary.includes('Privacy Scoping: As a coach, you can only modify fee records for students assigned to you');
      record(8, 'updateFeeStatus: Coach scoping - Rejected for unassigned student fee', input, passed, res.summary);
    }

    // Scenario 9: Coach scoping - Coach allowed to draft fee update for assigned student
    {
      const input = { feeId: fee1.id, newStatus: 'Paid', confirmed: false };
      const res = await executeTool('updateFeeStatus', input, coachUser1);
      const passed = res.success === true && res.result?.draft === true && res.summary.includes('Confirmation Required');
      record(9, 'updateFeeStatus: Coach scoping - Allowed to draft update for assigned student', input, passed, res.summary);
    }

    // Scenario 10: Not-found check - Invalid fee ID rejected
    {
      const input = { feeId: 'fee-non-existent-99999', newStatus: 'Waived', confirmed: false };
      const res = await executeTool('updateFeeStatus', input, adminUser);
      const passed = !res.success && res.summary.includes('Could not find fee record');
      record(10, 'updateFeeStatus: Not-found check - Non-existent fee ID rejected', input, passed, res.summary);
    }

    // Scenario 11: Draft flow (confirmed: false) - Resolves by student & period, DB unchanged
    {
      const input = {
        studentNameOrId: student1.id,
        period: '2026-09',
        newStatus: 'Waived',
        newAmount: 1200,
        notes: 'Sibling scholarship discount',
        confirmed: false
      };
      const res = await executeTool('updateFeeStatus', input, adminUser);
      const isDraft = res.result?.draft === true;
      const statusMatched = res.result?.newStatus === 'Waived';
      const amountMatched = res.result?.newAmount === 1200;
      const promptMatched = res.summary.includes('Confirm fee status change');
      const dbFee = await db.findFeeById(fee1.id);
      const feeUnchanged = dbFee?.status === 'Pending' && Number(dbFee?.amount) === 2500;
      const passed = res.success === true && isDraft && statusMatched && amountMatched && promptMatched && feeUnchanged;
      record(11, 'updateFeeStatus: Draft flow (confirmed: false) - Pending confirmation & DB intact', input, passed, res.summary);
    }

    // Scenario 12: Execution flow (confirmed: true) - Successfully updates fee in DB
    {
      const input = {
        feeId: fee1.id,
        newStatus: 'Waived',
        newAmount: 1200,
        notes: 'Approved scholarship waiver',
        confirmed: true
      };
      const res = await executeTool('updateFeeStatus', input, adminUser);
      const dbFee = await db.findFeeById(fee1.id);
      const statusUpdated = dbFee?.status === 'Waived';
      const amountUpdated = Number(dbFee?.amount) === 1200;
      const passed = res.success === true && statusUpdated && amountUpdated && res.summary.includes('updated to');
      record(12, 'updateFeeStatus: Execution flow (confirmed: true) - Mutates status & amount in DB', input, passed, res.summary);
    }

    // Scenario 13: Idempotency check - Attempt to set to existing status & amount
    {
      const input = {
        feeId: fee1.id,
        newStatus: 'Waived',
        newAmount: 1200,
        confirmed: true
      };
      const res = await executeTool('updateFeeStatus', input, adminUser);
      const isAlreadyUpdated = res.result?.alreadyUpdated === true;
      const passed = res.success === true && isAlreadyUpdated && res.summary.includes('already in status');
      record(13, 'updateFeeStatus: Idempotency check - Status and amount already in effect', input, passed, res.summary);
    }

    // =========================================================================
    // TOOL 3: deleteAttendanceRecord (SCENARIOS 14 - 18)
    // =========================================================================

    // Scenario 14: Auth check - Coach caller rejected
    {
      const input = { attendanceId: attId1, confirmed: false };
      const res = await executeTool('deleteAttendanceRecord', input, coachUser1);
      const passed = !res.success && res.summary.includes('Only administrators can delete attendance records');
      record(14, 'deleteAttendanceRecord: Auth check - Coach caller rejected', input, passed, res.summary);
    }

    // Scenario 15: Auth check - Student caller rejected
    {
      const input = { attendanceId: attId1, confirmed: false };
      const res = await executeTool('deleteAttendanceRecord', input, studentUser);
      const passed = !res.success && res.summary.includes('Only administrators can delete attendance records');
      record(15, 'deleteAttendanceRecord: Auth check - Student caller rejected', input, passed, res.summary);
    }

    // Scenario 16: Not-found check - Non-existent attendance record
    {
      const input = { attendanceId: 'att-non-existent-99999', confirmed: false };
      const res = await executeTool('deleteAttendanceRecord', input, adminUser);
      const passed = !res.success && res.summary.includes('Could not find attendance record');
      record(16, 'deleteAttendanceRecord: Not-found check - Non-existent ID rejected', input, passed, res.summary);
    }

    // Scenario 17: Draft flow (confirmed: false) - Resolves student & date, DB row preserved
    {
      const input = {
        studentNameOrId: student1.id,
        date: '2026-09-08',
        notes: 'Accidental duplicate entry',
        confirmed: false
      };
      const res = await executeTool('deleteAttendanceRecord', input, adminUser);
      const isDraft = res.result?.draft === true;
      const dateMatched = res.result?.date === '2026-09-08';
      const promptMatched = res.summary.includes('Confirm deletion of attendance record');
      const { data: currentAtt } = await supabase.from('attendance').select('id').eq('id', attId1).maybeSingle();
      const stillExists = Boolean(currentAtt);
      const passed = res.success === true && isDraft && dateMatched && promptMatched && stillExists;
      record(17, 'deleteAttendanceRecord: Draft flow (confirmed: false) - Pending confirmation & DB intact', input, passed, res.summary);
    }

    // Scenario 18: Execution flow (confirmed: true) - Deletes attendance from DB
    {
      const input = { attendanceId: attId1, confirmed: true };
      const res = await executeTool('deleteAttendanceRecord', input, adminUser);
      const { data: checkRow } = await supabase.from('attendance').select('id').eq('id', attId1).maybeSingle();
      const isDeleted = !checkRow;
      const passed = res.success === true && isDeleted && res.summary.includes('✓ Attendance record for **');
      record(18, 'deleteAttendanceRecord: Execution flow (confirmed: true) - Deletes record from DB', input, passed, res.summary);
    }

    // =========================================================================
    // TOOL 4: bulkDeleteStudentWorks (SCENARIOS 19 - 23)
    // =========================================================================

    // Scenario 19: Auth check - Student caller rejected
    {
      const input = { studentWorkIds: [work1.id], confirmed: false };
      const res = await executeTool('bulkDeleteStudentWorks', input, studentUser);
      const passed = !res.success && res.summary.includes('Only administrators and assigned coaches can delete student work samples');
      record(19, 'bulkDeleteStudentWorks: Auth check - Student caller rejected', input, passed, res.summary);
    }

    // Scenario 20: Parameter validation - Empty array rejected
    {
      const input = { studentWorkIds: [], confirmed: false };
      const res = await executeTool('bulkDeleteStudentWorks', input, adminUser);
      const passed = !res.success && (res.summary.includes('at least one') || res.summary.includes('Validation Error'));
      record(20, 'bulkDeleteStudentWorks: Parameter validation - Empty array rejected', input, passed, res.summary);
    }

    // Scenario 21: Coach scoping - Coach rejected for unassigned student's work
    {
      const input = { studentWorkIds: [work2.id], confirmed: false };
      const res = await executeTool('bulkDeleteStudentWorks', input, coachUser1);
      const passed = !res.success && res.summary.includes('Privacy Scoping: As a coach, you can only delete work samples for your assigned students');
      record(21, 'bulkDeleteStudentWorks: Coach scoping - Rejected for unassigned student work sample', input, passed, res.summary);
    }

    // Scenario 22: Draft flow (confirmed: false) - Details samples & DB remains intact
    {
      const input = {
        studentWorkIds: [work1.id, work3.id],
        reason: 'Blurry upload cleanup',
        confirmed: false
      };
      const res = await executeTool('bulkDeleteStudentWorks', input, adminUser);
      const isDraft = res.result?.draft === true;
      const countMatched = res.result?.count === 2;
      const promptMatched = res.summary.includes('Confirm deletion of');
      const w1 = await db.findStudentWorkById(work1.id);
      const w3 = await db.findStudentWorkById(work3.id);
      const samplesIntact = Boolean(w1) && Boolean(w3);
      const passed = res.success === true && isDraft && countMatched && promptMatched && samplesIntact;
      record(22, 'bulkDeleteStudentWorks: Draft flow (confirmed: false) - Pending confirmation & DB intact', input, passed, res.summary);
    }

    // Scenario 23: Execution flow (confirmed: true) & Audit Log Verification
    {
      const input = {
        studentWorkIds: [work1.id, work3.id],
        reason: 'Blurry upload cleanup',
        confirmed: true
      };
      const res = await executeTool('bulkDeleteStudentWorks', input, adminUser);
      const w1 = await db.findStudentWorkById(work1.id);
      const w3 = await db.findStudentWorkById(work3.id);
      const samplesDeleted = !w1 && !w3;
      const execSuccess = res.success === true && res.summary.includes('Successfully deleted 2 student work sample');

      const { data: auditLogs, error: aErr } = await supabase
        .from('tool_audit_logs')
        .select('*')
        .in('tool_name', ['deactivateCoach', 'updateFeeStatus', 'deleteAttendanceRecord', 'bulkDeleteStudentWorks'])
        .order('created_at', { ascending: false })
        .limit(10);

      const hasAudit = !aErr && Array.isArray(auditLogs) && auditLogs.length >= 4;
      const allRemote = auditLogs?.every(l => l.execution_mode === 'remote_gemini');

      const passed = execSuccess && samplesDeleted && hasAudit && allRemote;
      const notes = passed
        ? `Deleted 2 samples. Audit verified: found ${auditLogs?.length} recent Category 2 log entries with execution_mode='remote_gemini'.`
        : `Execution or Audit check failed: samplesDeleted=${samplesDeleted}, hasAudit=${hasAudit}, allRemote=${allRemote}, summary=${res.summary}`;
      record(23, 'bulkDeleteStudentWorks: Execution flow & Category 2 Audit verification', input, passed, notes);
    }

  } finally {
    console.log('[TEARDOWN] Cleaning up temporary test entities...');
    if (createdWorkIds.length > 0) {
      await supabase.from('student_works').delete().in('id', createdWorkIds);
    }
    if (createdAttendanceIds.length > 0) {
      await supabase.from('attendance').delete().in('id', createdAttendanceIds);
    }
    if (createdFeeIds.length > 0) {
      await supabase.from('fees').delete().in('id', createdFeeIds);
    }
    if (createdStudentIds.length > 0) {
      await supabase.from('students').delete().in('id', createdStudentIds);
    }
    if (createdCoachIds.length > 0) {
      await supabase.from('coaches').delete().in('id', createdCoachIds);
    }
    if (createdUserIds.length > 0) {
      await supabase.from('users').delete().in('id', createdUserIds);
    }
    console.log('[TEARDOWN] Cleaned up test fixtures successfully.\n');
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log('================================================================');
  console.log(`TOTAL SCENARIOS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  if (failedCount === 0) {
    console.log('SUITE RESULT: ALL 23 SCENARIOS PASSED ✅');
  } else {
    console.log('SUITE RESULT: SOME SCENARIOS FAILED ❌');
  }
  console.log('================================================================');
}

runLiveTests().catch(console.error);
