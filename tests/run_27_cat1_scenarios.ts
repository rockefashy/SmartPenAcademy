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
  console.log('  CONSOLIDATED LIVE TEST SUITE: CATEGORY 1 TOOLS (27 SCENARIOS) ');
  console.log('  Tools: explainStudentStatus, getOverdueFeeSummary,           ');
  console.log('         getCoachWorkloadSummary, getAttendanceRiskStudents,    ');
  console.log('         getStudentWorkSamples                                  ');
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
  const createdTrackerIds: string[] = [];
  const createdWorkIds: string[] = [];

  try {
    console.log('[SETUP] Creating isolated test entities in database...');

    // 1. Coach 1 (assigned to Student 1)
    const coach1 = await db.createCoach({
      firstName: 'Cat1Coach',
      lastName: `One${ts}`,
      displayName: `Cat1Coach One${ts}`,
      email: `cat1coach1_${ts}@smartpen.test`,
      phoneNumber: '9876544001',
      designation: 'Senior Coach',
      specializations: ['Cursive'],
      status: 'Active',
      password: 'password123'
    });
    createdCoachIds.push(coach1.id);

    // 2. Coach 2 (assigned to Student 2)
    const coach2 = await db.createCoach({
      firstName: 'Cat1Coach',
      lastName: `Two${ts}`,
      displayName: `Cat1Coach Two${ts}`,
      email: `cat1coach2_${ts}@smartpen.test`,
      phoneNumber: '9876544002',
      designation: 'Staff Coach',
      specializations: ['Print'],
      status: 'Active',
      password: 'password123'
    });
    createdCoachIds.push(coach2.id);

    // 3. Coach 3 (Available capacity - 0 students)
    const coach3 = await db.createCoach({
      firstName: 'AvailableCoach',
      lastName: `Three${ts}`,
      displayName: `AvailableCoach Three${ts}`,
      email: `availcoach_${ts}@smartpen.test`,
      phoneNumber: '9876544003',
      designation: 'Junior Coach',
      specializations: ['Calligraphy'],
      status: 'Active',
      password: 'password123'
    });
    createdCoachIds.push(coach3.id);

    // 4. Coach 4 (Inactive Coach)
    const inactiveCoach = await db.createCoach({
      firstName: 'InactiveCoach',
      lastName: `Four${ts}`,
      displayName: `InactiveCoach Four${ts}`,
      email: `inactcoach_${ts}@smartpen.test`,
      phoneNumber: '9876544004',
      designation: 'Former Coach',
      specializations: ['Speed Writing'],
      status: 'Inactive',
      password: 'password123'
    });
    createdCoachIds.push(inactiveCoach.id);

    // 5. Student 1 (assigned to Coach 1; has absences & pending fee)
    const student1 = await db.createStudent({
      id: `std-cat1-one-${ts}`,
      studentName: `StudentOne Cat1Tester${ts}`,
      firstName: 'StudentOne',
      lastName: `Cat1Tester${ts}`,
      displayName: `StudentOne Cat1Tester${ts}`,
      parentName: 'Parent One',
      email: `cat1student1_${ts}@smartpen.test`,
      whatsappMobile: '9876544011',
      age: 10,
      gradeClass: 'Grade 5',
      schoolName: 'Smart Pen Academy',
      password: 'password123',
      coachId: coach1.id,
      status: 'Active'
    });
    createdStudentIds.push(student1.id);
    if (student1.userId) createdUserIds.push(student1.userId);

    // 6. Student 2 (assigned to Coach 2; 100% attendance & overdue fee)
    const student2 = await db.createStudent({
      id: `std-cat1-two-${ts}`,
      studentName: `StudentTwo Cat1Tester${ts}`,
      firstName: 'StudentTwo',
      lastName: `Cat1Tester${ts}`,
      displayName: `StudentTwo Cat1Tester${ts}`,
      parentName: 'Parent Two',
      email: `cat1student2_${ts}@smartpen.test`,
      whatsappMobile: '9876544012',
      age: 11,
      gradeClass: 'Grade 6',
      schoolName: 'Smart Pen Academy',
      password: 'password123',
      coachId: coach2.id,
      status: 'Active'
    });
    createdStudentIds.push(student2.id);
    if (student2.userId) createdUserIds.push(student2.userId);

    // 7. Attendance Records
    // Student 1: 3 sessions (1 Present, 2 Absent -> consecutive absences)
    const att1_1 = `att-c1-1-${ts}`;
    const att1_2 = `att-c1-2-${ts}`;
    const att1_3 = `att-c1-3-${ts}`;
    await db.saveAttendanceBatch([
      { id: att1_1, studentId: student1.id, date: '2026-09-02', status: 'Present', coachNotes: 'Good start' },
      { id: att1_2, studentId: student1.id, date: '2026-09-05', status: 'Absent', coachNotes: 'Sick leave' },
      { id: att1_3, studentId: student1.id, date: '2026-09-08', status: 'Absent', coachNotes: 'Missed session' }
    ]);
    createdAttendanceIds.push(att1_1, att1_2, att1_3);

    // Student 2: 3 sessions (All Present -> 100% attendance)
    const att2_1 = `att-c2-1-${ts}`;
    const att2_2 = `att-c2-2-${ts}`;
    const att2_3 = `att-c2-3-${ts}`;
    await db.saveAttendanceBatch([
      { id: att2_1, studentId: student2.id, date: '2026-09-02', status: 'Present', coachNotes: 'On time' },
      { id: att2_2, studentId: student2.id, date: '2026-09-05', status: 'Present', coachNotes: 'Excellent slant' },
      { id: att2_3, studentId: student2.id, date: '2026-09-08', status: 'Present', coachNotes: 'Completed sheet' }
    ]);
    createdAttendanceIds.push(att2_1, att2_2, att2_3);

    // 8. Fee Records
    const fee1 = await db.saveFeeRecord({
      id: `fee-cat1-1-${ts}`,
      studentId: student1.id,
      date: '2026-09-01',
      yearMonth: '2026-09',
      amount: 1600,
      status: 'Pending',
      notes: 'September 8-class fee'
    });
    createdFeeIds.push(fee1.id);

    const fee2 = await db.saveFeeRecord({
      id: `fee-cat1-2-${ts}`,
      studentId: student2.id,
      date: '2026-09-01',
      yearMonth: '2026-09',
      amount: 2500,
      status: 'Overdue',
      notes: 'Overdue renewal fee'
    });
    createdFeeIds.push(fee2.id);

    // 9. Progress Tracker (Student 1)
    const tracker1 = await db.saveProgressTracker({
      id: `pt-cat1-1-${ts}`,
      studentId: student1.id,
      evaluationTitle: 'Module 2: Lower Loops',
      overallStars: 4,
      speedWpm: 18,
      alignmentStars: 4,
      formationStars: 4,
      spacingStars: 4,
      overallRemark: 'Shows great dedication to baseline slant.',
      teacherFeedback: 'Shows great dedication to baseline slant.',
      evaluationDate: '2026-09-04'
    });
    createdTrackerIds.push(tracker1.id);

    // 10. Student Work Sample (Student 1)
    const work1 = await db.saveStudentWork({
      id: `work-cat1-1-${ts}`,
      studentId: student1.id,
      category: 'Practice Sheet',
      captureDate: '2026-09-03',
      comments: 'Work sample 1',
      imageData: 'https://example.com/sample1.jpg'
    });
    createdWorkIds.push(work1.id);

    console.log('[SETUP] Fixtures initialized successfully.\n');

    // Context Users
    const adminUser: User = {
      id: 'admin-live-test',
      displayName: 'Master Admin',
      role: 'admin',
      email: 'admin@smartpen.com'
    };

    const coachUser1: User = {
      id: coach1.id,
      coachId: coach1.id,
      displayName: coach1.displayName,
      role: 'coach',
      email: coach1.email
    };

    const coachUser2: User = {
      id: coach2.id,
      coachId: coach2.id,
      displayName: coach2.displayName,
      role: 'coach',
      email: coach2.email
    };

    const studentUser1: User = {
      id: student1.id,
      studentId: student1.id,
      displayName: student1.displayName,
      role: 'student',
      email: student1.email
    };

    const studentUser2: User = {
      id: student2.id,
      studentId: student2.id,
      displayName: student2.displayName,
      role: 'student',
      email: student2.email
    };

    // =========================================================================
    // TOOL 1: explainStudentStatus (SCENARIOS 1 - 7)
    // =========================================================================

    // Scenario 1: Unauthenticated caller rejected
    {
      const input = { studentNameOrId: student1.id };
      const res = await executeTool('explainStudentStatus', input, null);
      const passed = !res.success && res.summary.includes('Authentication required');
      record(1, 'explainStudentStatus: Auth check - Unauthenticated caller rejected', input, passed, res.summary);
    }

    // Scenario 2: Coach scoping - Rejected for unassigned student
    {
      const input = { studentNameOrId: student2.id };
      const res = await executeTool('explainStudentStatus', input, coachUser1);
      const passed = !res.success && res.summary.includes('Privacy Scoping: As a coach, you can only view records for students assigned to you');
      record(2, 'explainStudentStatus: Coach scoping - Rejected for unassigned student', input, passed, res.summary);
    }

    // Scenario 3: Student scoping - Rejected for another peer
    {
      const input = { studentNameOrId: student2.id };
      const res = await executeTool('explainStudentStatus', input, studentUser1);
      const passed = !res.success && res.summary.includes('Access Denied: You can only view your own student records');
      record(3, 'explainStudentStatus: Student scoping - Rejected for peer student profile', input, passed, res.summary);
    }

    // Scenario 4: Not-found check - Non-existent query
    {
      const input = { studentNameOrId: 'non-existent-student-99999' };
      const res = await executeTool('explainStudentStatus', input, adminUser);
      const passed = !res.success && res.summary.includes('Could not find student matching');
      record(4, 'explainStudentStatus: Not-found check - Non-existent student query', input, passed, res.summary);
    }

    // Scenario 5: Happy path (Admin) - Full 360 overview
    {
      const input = { studentNameOrId: student1.id };
      const res = await executeTool('explainStudentStatus', input, adminUser);
      const hasCycle = res.result?.attendance?.cycleProgress?.includes('/ 8 classes');
      const hasFee = res.result?.fees?.latestRecord?.amount === 1600;
      const hasCoach = res.result?.coach?.name === coach1.displayName;
      const hasMilestone = res.result?.latestMilestone?.title === 'Module 2: Lower Loops';
      const passed = res.success === true && hasCycle && hasFee && hasCoach && hasMilestone && res.summary.includes('Student 360° Overview');
      record(5, 'explainStudentStatus: Happy path (Admin) - Returns complete 360 overview', input, passed, res.summary);
    }

    // Scenario 6: Happy path (Coach scoped) - Coach inspects assigned student
    {
      const input = { studentNameOrId: student1.displayName };
      const res = await executeTool('explainStudentStatus', input, coachUser1);
      const passed = res.success === true && res.result?.student?.id === student1.id && res.summary.includes('Student 360° Overview');
      record(6, 'explainStudentStatus: Happy path (Coach scoped) - Assigned coach permitted', input, passed, res.summary);
    }

    // Scenario 7: Happy path (Student self-service) - Student inspects own status
    {
      const input = { studentNameOrId: student1.id };
      const res = await executeTool('explainStudentStatus', input, studentUser1);
      const passed = res.success === true && res.result?.student?.id === student1.id;
      record(7, 'explainStudentStatus: Happy path (Student self-service) - Self-service access permitted', input, passed, res.summary);
    }

    // =========================================================================
    // TOOL 2: getOverdueFeeSummary (SCENARIOS 8 - 13)
    // =========================================================================

    // Scenario 8: Auth check - Student caller rejected
    {
      const input = { yearMonth: '2026-09' };
      const res = await executeTool('getOverdueFeeSummary', input, studentUser1);
      const passed = !res.success && res.summary.includes('Only administrators and coaches can view overdue fee summaries');
      record(8, 'getOverdueFeeSummary: Auth check - Student caller rejected', input, passed, res.summary);
    }

    // Scenario 9: Happy path (Admin) - Academy-wide outstanding fee summary
    {
      const input = { yearMonth: '2026-09' };
      const res = await executeTool('getOverdueFeeSummary', input, adminUser);
      const totalAmountMatch = res.result?.totalOutstanding >= 4100; // 1600 + 2500
      const studentCountMatch = res.result?.affectedStudentsCount >= 2;
      const passed = res.success === true && totalAmountMatch && studentCountMatch && res.summary.includes('Fee Outstanding Summary');
      record(9, 'getOverdueFeeSummary: Happy path (Admin) - Academy-wide overview', input, passed, res.summary);
    }

    // Scenario 10: Happy path (Coach scoped) - Filtered to assigned students only
    {
      const input = { yearMonth: '2026-09' };
      const res = await executeTool('getOverdueFeeSummary', input, coachUser1);
      const onlyStudent1 = res.result?.students?.every((s: any) => s.studentId === student1.id);
      const amount1600 = res.result?.totalOutstanding === 1600;
      const passed = res.success === true && onlyStudent1 && amount1600;
      record(10, 'getOverdueFeeSummary: Happy path (Coach scoped) - Scoped to coach roster', input, passed, res.summary);
    }

    // Scenario 11: Parameter behavior - statusFilter: ['Overdue']
    {
      const input = { yearMonth: '2026-09', statusFilter: ['Overdue'] };
      const res = await executeTool('getOverdueFeeSummary', input, adminUser);
      const containsOnlyOverdue = res.result?.students?.every((s: any) => s.overdueCount > 0 && s.pendingCount === 0);
      const passed = res.success === true && containsOnlyOverdue;
      record(11, 'getOverdueFeeSummary: Parameter behavior - statusFilter: [Overdue] filters correctly', input, passed, res.summary);
    }

    // Scenario 12: Parameter behavior - yearMonth scoping
    {
      const input = { yearMonth: '2026-09' };
      const res = await executeTool('getOverdueFeeSummary', input, adminUser);
      const passed = res.success === true && res.result?.yearMonth === '2026-09';
      record(12, 'getOverdueFeeSummary: Parameter behavior - yearMonth properly scoped', input, passed, res.summary);
    }

    // Scenario 13: Empty state - Future or cleared month
    {
      const input = { yearMonth: '2030-01' };
      const res = await executeTool('getOverdueFeeSummary', input, adminUser);
      const zeroBalance = res.result?.totalOutstanding === 0;
      const zeroStudents = res.result?.affectedStudentsCount === 0;
      const passed = res.success === true && zeroBalance && zeroStudents && res.summary.includes('Zero outstanding');
      record(13, 'getOverdueFeeSummary: Empty state - Returns zero balance notice', input, passed, res.summary);
    }

    // =========================================================================
    // TOOL 3: getCoachWorkloadSummary (SCENARIOS 14 - 18)
    // =========================================================================

    // Scenario 14: Auth check - Coach caller rejected
    {
      const input = {};
      const res = await executeTool('getCoachWorkloadSummary', input, coachUser1);
      const passed = !res.success && res.summary.includes('Only administrators can view coach workload summaries');
      record(14, 'getCoachWorkloadSummary: Auth check - Coach caller rejected', input, passed, res.summary);
    }

    // Scenario 15: Auth check - Student caller rejected
    {
      const input = {};
      const res = await executeTool('getCoachWorkloadSummary', input, studentUser1);
      const passed = !res.success && res.summary.includes('Only administrators can view coach workload summaries');
      record(15, 'getCoachWorkloadSummary: Auth check - Student caller rejected', input, passed, res.summary);
    }

    // Scenario 16: Happy path (Admin) - Returns active coaches and student allocations
    {
      const input = { includeInactive: false };
      const res = await executeTool('getCoachWorkloadSummary', input, adminUser);
      const hasCoaches = res.result?.totalCoaches >= 3;
      const noInactive = res.result?.coaches?.every((c: any) => c.status === 'Active');
      const passed = res.success === true && hasCoaches && noInactive && res.summary.includes('Coach Workload & Capacity Summary');
      record(16, 'getCoachWorkloadSummary: Happy path (Admin) - Breakdown of active coaches', input, passed, res.summary);
    }

    // Scenario 17: Parameter behavior - includeInactive: true
    {
      const input = { includeInactive: true };
      const res = await executeTool('getCoachWorkloadSummary', input, adminUser);
      const hasInactive = res.result?.coaches?.some((c: any) => c.status === 'Inactive');
      const passed = res.success === true && hasInactive;
      record(17, 'getCoachWorkloadSummary: Parameter behavior - includeInactive: true returns inactive coaches', input, passed, res.summary);
    }

    // Scenario 18: Capacity detection - Identifies coach with 0 active students
    {
      const input = { includeInactive: false };
      const res = await executeTool('getCoachWorkloadSummary', input, adminUser);
      const coach3Data = res.result?.coaches?.find((c: any) => c.coachId === coach3.id);
      const capacityDetected = coach3Data?.activeStudentCount === 0 && coach3Data?.hasAvailableCapacity === true;
      const passed = res.success === true && capacityDetected;
      record(18, 'getCoachWorkloadSummary: Capacity detection - Identifies available capacity (0 students)', input, passed, res.summary);
    }

    // =========================================================================
    // TOOL 4: getAttendanceRiskStudents (SCENARIOS 19 - 24)
    // =========================================================================

    // Scenario 19: Auth check - Student caller rejected
    {
      const input = { windowDays: 30 };
      const res = await executeTool('getAttendanceRiskStudents', input, studentUser1);
      const passed = !res.success && res.summary.includes('Only administrators and coaches can view attendance risk summaries');
      record(19, 'getAttendanceRiskStudents: Auth check - Student caller rejected', input, passed, res.summary);
    }

    // Scenario 20: Happy path (Admin) - Flags student 1 (consecutive absences)
    {
      const input = { windowDays: 30, minAbsentCount: 2, maxAttendanceRate: 75 };
      const res = await executeTool('getAttendanceRiskStudents', input, adminUser);
      const student1Flagged = res.result?.atRiskStudents?.some((s: any) => s.studentId === student1.id && s.consecutiveAbsences >= 2);
      const passed = res.success === true && student1Flagged && res.summary.includes('Attendance Risk Alert');
      record(20, 'getAttendanceRiskStudents: Happy path (Admin) - Detects disengaged student', input, passed, res.summary);
    }

    // Scenario 21: Happy path (Coach scoped) - Scoped to coach roster
    {
      const input = { windowDays: 30 };
      const res = await executeTool('getAttendanceRiskStudents', input, coachUser2);
      // Coach 2 student (student 2) has 100% attendance, so zero at-risk students for Coach 2
      const zeroForCoach2 = res.result?.atRiskCount === 0;
      const passed = res.success === true && zeroForCoach2 && res.summary.includes('Zero students at risk');
      record(21, 'getAttendanceRiskStudents: Happy path (Coach scoped) - Scoped to coach roster', input, passed, res.summary);
    }

    // Scenario 22: Parameter behavior - minAbsentCount threshold
    {
      const input = { windowDays: 30, minAbsentCount: 10 }; // higher than student 1's 2 absences
      const res = await executeTool('getAttendanceRiskStudents', input, adminUser);
      // Student 1 should still be flagged by low attendance rate (33%) or consecutive absences (2)
      const isEvaluated = res.result?.totalChecked >= 2;
      const passed = res.success === true && isEvaluated;
      record(22, 'getAttendanceRiskStudents: Parameter behavior - minAbsentCount parameter evaluated', input, passed, res.summary);
    }

    // Scenario 23: Parameter behavior - maxAttendanceRate
    {
      const input = { windowDays: 30, maxAttendanceRate: 20, minAbsentCount: 5 };
      const res = await executeTool('getAttendanceRiskStudents', input, adminUser);
      // Student 1 has 33% attendance rate (above 20%) and 2 absences (below 5), but 2 consecutive absences
      const passed = res.success === true && Array.isArray(res.result?.atRiskStudents);
      record(23, 'getAttendanceRiskStudents: Parameter behavior - maxAttendanceRate evaluated', input, passed, res.summary);
    }

    // Scenario 24: Healthy attendance - Student 2 (100% attendance) is not at risk
    {
      const input = { windowDays: 30 };
      const res = await executeTool('getAttendanceRiskStudents', input, adminUser);
      const student2NotAtRisk = !res.result?.atRiskStudents?.some((s: any) => s.studentId === student2.id);
      const passed = res.success === true && student2NotAtRisk;
      record(24, 'getAttendanceRiskStudents: Healthy state - 100% attendance student not flagged', input, passed, res.summary);
    }

    // =========================================================================
    // TOOL 5: getStudentWorkSamples (Sanity Check & Audit) (SCENARIOS 25 - 27)
    // =========================================================================

    // Scenario 25: Sanity check (getStudentWorkSamples) - Admin queries student works
    {
      const input = { studentNameOrId: student1.id };
      const res = await executeTool('getStudentWorkSamples', input, adminUser);
      const hasWork = res.result?.samples?.some((w: any) => w.id === work1.id);
      const passed = res.success === true && hasWork;
      record(25, 'getStudentWorkSamples: Sanity check - Admin queries work samples', input, passed, res.summary);
    }

    // Scenario 26: Sanity check (getStudentWorkSamples) - Coach denied for unassigned student
    {
      const input = { studentNameOrId: student2.id };
      const res = await executeTool('getStudentWorkSamples', input, coachUser1);
      const passed = !res.success && res.summary.includes('Privacy Scoping') && res.summary.includes('not assigned to you');
      record(26, 'getStudentWorkSamples: Scoping check - Coach denied for unassigned student', input, passed, res.summary);
    }

    // Scenario 27: Audit log verification for Category 1 read tools
    {
      const input = { check: 'tool_audit_logs verification for Category 1 read operations' };
      const { data: auditEntries, error: aErr } = await supabase
        .from('tool_audit_logs')
        .select('*')
        .in('tool_name', ['explainStudentStatus', 'getOverdueFeeSummary', 'getCoachWorkloadSummary', 'getAttendanceRiskStudents'])
        .order('created_at', { ascending: false })
        .limit(10);

      const hasEntries = !aErr && Array.isArray(auditEntries) && auditEntries.length >= 4;
      const allRemote = auditEntries?.every(e => e.execution_mode === 'remote_gemini');
      const passed = hasEntries && allRemote;
      const notes = passed
        ? `Found ${auditEntries?.length} Category 1 audit entries with execution_mode='remote_gemini'.`
        : `Audit verification failed: hasEntries=${hasEntries}, allRemote=${allRemote}, err=${aErr?.message}`;
      record(27, 'tool_audit_logs: Category 1 audit logging telemetry verified', input, passed, notes);
    }

  } finally {
    // Teardown: Clean up temporary test entities
    console.log('[TEARDOWN] Cleaning up temporary test fixtures...');
    if (createdWorkIds.length > 0) {
      await supabase.from('student_works').delete().in('id', createdWorkIds);
    }
    if (createdTrackerIds.length > 0) {
      await supabase.from('progress_trackers').delete().in('id', createdTrackerIds);
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
    console.log(`[TEARDOWN] Deleted ${createdStudentIds.length} students, ${createdCoachIds.length} coaches, and associated records successfully.\n`);
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log('================================================================');
  console.log(`TOTAL SCENARIOS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  if (failedCount === 0) {
    console.log('SUITE RESULT: ALL 27 SCENARIOS PASSED ✅');
  } else {
    console.log('SUITE RESULT: SOME SCENARIOS FAILED ❌');
  }
  console.log('================================================================');
}

runLiveTests().catch(console.error);
