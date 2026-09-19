import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { db } from '../server/supabaseDb.ts';
import { ROLES } from '../src/types.ts';

const BASE_URL = 'http://127.0.0.1:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';

interface TestResult {
  suite: string;
  scenario: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function assertTest(
  suite: string,
  scenario: string,
  fn: () => Promise<void | any>
) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, scenario, passed: true, durationMs, details });
    console.log(`  ✅ [PASS] ${scenario} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ suite, scenario, passed: false, durationMs, error: err.message || String(err) });
    console.error(`  ❌ [FAIL] ${scenario} (${durationMs}ms) - Error: ${err.message || err}`);
  }
}

// Generate JWT tokens for test personas
function makeToken(payload: {
  id: string;
  email: string;
  role: string;
  studentId?: string;
  coachId?: string;
  firstName?: string;
  lastName?: string;
  tokenVersion?: number;
}) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      studentId: payload.studentId,
      coachId: payload.coachId,
      firstName: payload.firstName || 'Test',
      lastName: payload.lastName || 'User',
      tokenVersion: payload.tokenVersion ?? 1
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Dynamic Fee Status calculation matching Admin Dashboard & Parent Portal logic
function getDynamicFeeStatus(student: any): 'PAID' | 'DUE' {
  const attendedCount = student.attendanceHistory
    ? student.attendanceHistory.filter((a: any) => a.status === 'Present').length
    : (student.attendedClasses || 0);
  const cycleSize = student.classesPerCycle || 8;
  const completedCycles = Math.floor(attendedCount / cycleSize);
  const paidCyclesCount = student.feeHistory?.filter((f: any) => f.status === 'Paid').length || 0;
  return (completedCycles > 0 && paidCyclesCount < completedCycles) ? 'DUE' : 'PAID';
}

async function runAllSuites() {
  console.log('\n===============================================================');
  console.log('🚀 SMART PEN ACADEMY - END-TO-END AUTOMATED TEST SUITE');
  console.log(`🔗 Target Server: ${BASE_URL}`);
  console.log(`🗄️ Database: Local Supabase PostgreSQL (127.0.0.1:54322)`);
  console.log('===============================================================\n');

  let adminToken = makeToken({
    id: 'usr-admin-001',
    email: 'admin@smartpenacademy.com',
    role: ROLES.ADMIN,
    firstName: 'Admin',
    lastName: 'Coach'
  });
  let createdStudentId = '';
  let createdDemoBookingId = '';
  let coachUserToken = '';
  let studentUserToken = '';

  try {
    const { serverSupabase } = await import('../server/supabase.ts');
    await serverSupabase.from('rate_limits').delete().neq('key', '');
  } catch {}

  // -------------------------------------------------------------
  // SUITE 1: Public Web Portal & Visitor Experience
  // -------------------------------------------------------------
  console.log('👉 [SUITE 1] Public Web Portal & Visitor Experience');

  await assertTest('Suite 1: Public Web Portal', '1.1 Health & Readiness Probes (GET /api/health, /api/ready)', async () => {
    const resHealth = await fetch(`${BASE_URL}/api/health`);
    if (!resHealth.ok) throw new Error(`/api/health returned ${resHealth.status}`);
    const healthJson = await resHealth.json();
    if (healthJson.status !== 'healthy') throw new Error(`Health status is ${healthJson.status}`);

    const resReady = await fetch(`${BASE_URL}/api/ready`);
    if (!resReady.ok) throw new Error(`/api/ready returned ${resReady.status}`);
    const readyJson = await resReady.json();
    if (readyJson.status !== 'ready' || readyJson.checks?.database?.status !== 'connected') {
      throw new Error(`Database check failed in /api/ready: ${JSON.stringify(readyJson)}`);
    }
  });

  await assertTest('Suite 1: Public Web Portal', '1.2 Public Static & SSR Pre-rendered Routes Delivery', async () => {
    const routes = ['/', '/about', '/syllabus', '/workshops', '/testimonials', '/free-demo'];
    for (const route of routes) {
      const res = await fetch(`${BASE_URL}${route}`);
      if (!res.ok) throw new Error(`Route ${route} returned HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes('<html') && !text.includes('<!DOCTYPE html')) {
        throw new Error(`Route ${route} did not return HTML content`);
      }
    }
  });

  await assertTest('Suite 1: Public Web Portal', '1.3 Free Demo Class Booking - Validation & Persistence', async () => {
    // 1. Invalid contact number validation check (less than 10 digits)
    const invalidRes = await fetch(`${BASE_URL}/api/demo-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: 'E2E Validation Test',
        age: 8,
        grade: 'Grade 3',
        parentName: 'E2E Parent',
        contactNumber: '123', // Invalid: < 10 digits
        preferredDate: '2026-09-25',
        preferredTimeSlot: '04:00 PM'
      })
    });
    if (invalidRes.ok) throw new Error('Expected 400 validation failure for invalid mobile number');

    // 2. Valid booking submission
    const validRes = await fetch(`${BASE_URL}/api/demo-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName: 'E2E Demo Child',
        age: 8,
        grade: 'Grade 3',
        parentName: 'E2E Demo Parent',
        contactNumber: '9876543210',
        email: 'e2e_demo_parent@example.com',
        preferredDate: '2026-09-25',
        preferredTimeSlot: '04:00 PM',
        learningGoal: 'Improve speed and pencil grip'
      })
    });
    if (!validRes.ok) {
      const err = await validRes.json().catch(() => ({}));
      throw new Error(`Failed to create demo booking: ${JSON.stringify(err)}`);
    }
    const createdBooking = await validRes.json();
    if (!createdBooking.id) throw new Error('No ID returned for created demo booking');
    createdDemoBookingId = createdBooking.id;

    // Verify persisted in DB
    const bookings = await db.getDemoBookings();
    const found = bookings.find((b: any) => b.id === createdDemoBookingId);
    if (!found) throw new Error('Created demo booking not found in database');
    if (found.preferredDate !== '2026-09-25' || found.preferredTimeSlot !== '04:00 PM') {
      throw new Error(`Demo booking date/slot mismatch in DB: ${JSON.stringify(found)}`);
    }
  });

  await assertTest('Suite 1: Public Web Portal', '1.4 Public Testimonials API (GET /api/testimonials)', async () => {
    const res = await fetch(`${BASE_URL}/api/testimonials`);
    if (!res.ok) throw new Error(`GET /api/testimonials returned HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('Expected array of testimonials');
  });

  // -------------------------------------------------------------
  // SUITE 2: Authentication, Authorization & RBAC Guardrails
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 2] Authentication, Authorization & RBAC Guardrails');

  await assertTest('Suite 2: Authentication & RBAC', '2.1 Admin Authentication (POST /api/auth/login)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@smartpenacademy.com',
        password: 'Admin@SmartPen2026'
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Admin login failed: ${JSON.stringify(err)}`);
    }
    const data = await res.json();
    if (!data.token || data.user?.role !== ROLES.ADMIN) {
      throw new Error(`Admin token or role missing: ${JSON.stringify(data)}`);
    }
    adminToken = data.token;
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.2 Invalid Credentials Rejection', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@smartpenacademy.com',
        password: 'CompletelyWrongPassword123!'
      })
    });
    if (res.ok) throw new Error('Expected 401 for invalid password');
    if (res.status !== 401) throw new Error(`Expected 401 status, got ${res.status}`);
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.3 Unauthenticated Access Defense (401 Unauthorized)', async () => {
    const res = await fetch(`${BASE_URL}/api/students`);
    if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.4 Role-Based Authorization Guardrail (Student -> Admin route: 403 Forbidden)', async () => {
    studentUserToken = makeToken({
      id: 'usr-e2e-test-student',
      email: 'student_e2e@example.com',
      role: ROLES.STUDENT,
      studentId: 'std-e2e-test'
    });

    // Student attempts to call Admin enroll endpoint
    const resEnroll = await fetch(`${BASE_URL}/api/students/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentUserToken}`
      },
      body: JSON.stringify({})
    });
    if (resEnroll.status !== 403) throw new Error(`Expected 403 Forbidden on enroll, got ${resEnroll.status}`);

    // Student attempts to inspect admin alerts
    const resAlerts = await fetch(`${BASE_URL}/api/alerts`, {
      headers: { Authorization: `Bearer ${studentUserToken}` }
    });
    if (resAlerts.status !== 403) throw new Error(`Expected 403 Forbidden on /api/alerts, got ${resAlerts.status}`);

    // Student attempts to inspect audit logs
    const resAudit = await fetch(`${BASE_URL}/api/ai/audit-logs`, {
      headers: { Authorization: `Bearer ${studentUserToken}` }
    });
    if (resAudit.status !== 403) throw new Error(`Expected 403 Forbidden on /api/ai/audit-logs, got ${resAudit.status}`);
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.5 Unauthenticated Token Minting Backdoor Defense (404 Not Found)', async () => {
    // Attempting to invoke legacy /api/auth/supabase-session with arbitrary admin role must fail with 404
    const resBackdoor = await fetch(`${BASE_URL}/api/auth/supabase-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker_test@example.com',
        role: 'admin'
      })
    });
    if (resBackdoor.status !== 404) {
      throw new Error(`Expected 404 Not Found for purged supabase-session endpoint, got HTTP ${resBackdoor.status}`);
    }
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.6 Open Relay & PII Leak Email Endpoints Purged (404 Not Found)', async () => {
    // Attempting to invoke legacy test email open relay must return 404
    const resEmailTest = await fetch(`${BASE_URL}/api/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'victim@example.com',
        type: 'general'
      })
    });
    if (resEmailTest.status !== 404) {
      throw new Error(`Expected 404 Not Found for purged /api/email/test endpoint, got HTTP ${resEmailTest.status}`);
    }

    // Attempting to invoke status endpoint that previously leaked admin info must return 404
    const resEmailStatus = await fetch(`${BASE_URL}/api/email/status`);
    if (resEmailStatus.status !== 404) {
      throw new Error(`Expected 404 Not Found for purged /api/email/status endpoint, got HTTP ${resEmailStatus.status}`);
    }
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.7 Family Students Endpoint Authentication & Wildcard Defense (H1)', async () => {
    // 1. Unauthenticated call must be rejected with 401
    const resUnauth = await fetch(`${BASE_URL}/api/auth/family-students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '%' })
    });
    if (resUnauth.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated /api/auth/family-students, got HTTP ${resUnauth.status}`);
    }

    // 2. Authenticated with admin token querying % must return empty array without errors
    const resAdmin = await fetch(`${BASE_URL}/api/auth/family-students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ identifier: '%' })
    });
    if (resAdmin.status !== 200) {
      throw new Error(`Expected 200 OK for admin query on /api/auth/family-students, got HTTP ${resAdmin.status}`);
    }
    const dataAdmin = await resAdmin.json();
    if (!Array.isArray(dataAdmin.students) || dataAdmin.students.length > 0) {
      throw new Error(`Expected 0 students for wildcard % query, got ${dataAdmin.students?.length}`);
    }
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.8 Wildcard Login Injection Defense (H1)', async () => {
    // Attempting to login with identifier '%' must not authenticate or return user candidates
    const resWildcard = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '%',
        password: 'SomeRandomPassword123!'
      })
    });
    if (resWildcard.status !== 401 && resWildcard.status !== 400) {
      throw new Error(`Expected 400 or 401 for wildcard login attempt, got HTTP ${resWildcard.status}`);
    }
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.9 Selection Token Cannot Access Standard Protected Routes (H2)', async () => {
    // Mint a dummy selection token with type: STUDENT_SELECTION
    const fakeSelectionToken = jwt.sign(
      {
        id: 'usr-admin-001',
        type: 'STUDENT_SELECTION',
        userId: 'usr-admin-001'
      },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    const resProtected = await fetch(`${BASE_URL}/api/students`, {
      headers: {
        'Authorization': `Bearer ${fakeSelectionToken}`
      }
    });
    if (resProtected.status !== 401) {
      throw new Error(`Expected 401 Unauthorized when using STUDENT_SELECTION token on /api/students, got HTTP ${resProtected.status}`);
    }
  });

  await assertTest('Suite 2: Authentication & RBAC', '2.10 Forgot Password Anti-Enumeration & Uniform Response (H3)', async () => {
    // Querying with non-existent email must return 200 generic success without leaking absence
    const resNonExistent = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'definitely_non_existent_account_99999@example.com'
      })
    });
    if (resNonExistent.status !== 200) {
      throw new Error(`Expected 200 OK for anti-enumeration forgot-password, got HTTP ${resNonExistent.status}`);
    }
    const data = await resNonExistent.json();
    if (data.success !== true) {
      throw new Error(`Expected success: true in generic response, got ${JSON.stringify(data)}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 3: Admin Roster & Dynamic Student Enrollment
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 3] Admin Roster & Dynamic Student Enrollment');

  const testSuffix = Date.now();
  let enrollPayload: any;

  await assertTest('Suite 3: Student Enrollment', '3.1 Enroll Student with Custom Billing (classesPerCycle=9, feePerCycle=1800)', async () => {
    enrollPayload = {
      firstName: `E2E_${String(testSuffix).slice(-4)}`,
      lastName: `Aarush_${testSuffix}`,
      age: 11,
      gradeClass: 'Grade 6',
      dominantHand: 'Right',
      schoolName: 'Greenwood High',
      parentName: `Ramesh Aarush ${testSuffix}`,
      modeOfLearning: 'In-person',
      email: `e2e_aarush_${testSuffix}@smartpenacademy.com`,
      whatsappMobile: `9988${String(testSuffix).slice(-6)}`,
      enrollmentDate: '2026-09-17',
      status: 'Active',
      coachId: 'coach-1788802932861-r5pgx', // Coach Deepthy Rock
      preferredDays: ['MON', 'WED'],
      preferredSlot: '5:00 - 6:00 PM',
      scriptsRequired: ['Cursive Writing'],
      academicModules: ['Exam Speed & Layouts'],
      classesPerCycle: 9,
      feePerCycle: 1800,
      password: 'TestStudentPassword123!',
      notes: 'Automated E2E verification test student'
    };

    const res = await fetch(`${BASE_URL}/api/students/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(enrollPayload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Enrollment failed HTTP ${res.status}: ${JSON.stringify(err)}`);
    }

    const created = await res.json();
    const studentData = created.student || created;
    if (!studentData.id) throw new Error(`No student ID returned from enrollment: ${JSON.stringify(created)}`);
    createdStudentId = studentData.id;

    // Verify in local database
    const studentInDb = await db.getStudentById(createdStudentId);
    if (!studentInDb) throw new Error(`Student ${createdStudentId} not found in database`);
    if (studentInDb.classesPerCycle !== 9 || studentInDb.feePerCycle !== 1800) {
      throw new Error(`Dynamic billing cycle mismatch in DB: classesPerCycle=${studentInDb.classesPerCycle}, feePerCycle=${studentInDb.feePerCycle}`);
    }
    const initialFeeStatus = getDynamicFeeStatus(studentInDb);
    if (initialFeeStatus !== 'PAID') {
      throw new Error(`Initial feeStatus expected PAID, got ${initialFeeStatus}`);
    }
    if (((studentInDb as any).completedCycles || 0) !== 0) {
      throw new Error(`Initial completedCycles expected 0, got ${(studentInDb as any).completedCycles}`);
    }
  });

  await assertTest('Suite 3: Student Enrollment', '3.2 Fetch Enrolled Student (GET /api/students/:id)', async () => {
    const res = await fetch(`${BASE_URL}/api/students/${createdStudentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok) throw new Error(`GET /api/students/:id returned ${res.status}`);
    const student = await res.json();
    if (student.firstName !== enrollPayload.firstName || student.classesPerCycle !== 9 || student.feePerCycle !== 1800) {
      throw new Error(`API student payload mismatch: ${JSON.stringify(student)}`);
    }
  });

  await assertTest('Suite 3: Student Enrollment', '3.3 Update Student Profile (PUT /api/students/:id)', async () => {
    const res = await fetch(`${BASE_URL}/api/students/${createdStudentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        notes: 'Updated E2E notes - pencil pressure verified',
        preferredSlot: '6:00 - 7:00 PM'
      })
    });
    if (!res.ok) throw new Error(`PUT /api/students/:id returned ${res.status}`);
    const updated = await res.json();
    if (updated.notes !== 'Updated E2E notes - pencil pressure verified') {
      throw new Error(`Notes not updated: ${updated.notes}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 4: Attendance Tracking & Billing Cycle Progression
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 4] Attendance Tracking & Billing Cycle Progression');

  await assertTest('Suite 4: Attendance & Billing', '4.1 Progressive Attendance Marking (Classes 1 to 8: Remains PAID)', async () => {
    // Mark classes on distinct dates
    const dates = [
      '2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07',
      '2026-09-09', '2026-09-11', '2026-09-13', '2026-09-15'
    ];

    const records = dates.map(date => ({
      studentId: createdStudentId,
      date,
      status: 'Present',
      notes: `Class ${date}`
    }));

    const res = await fetch(`${BASE_URL}/api/attendance/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ records })
    });
    if (!res.ok) throw new Error(`Batch attendance returned ${res.status}`);

    // Verify student state
    const student = await db.getStudentById(createdStudentId);
    if (!student) throw new Error('Student not found');
    const attended = student.attendedClasses || (student.attendanceHistory || []).filter((a: any) => a.status === 'Present').length;
    if (attended !== 8) throw new Error(`Expected 8 attended classes, got ${attended}`);
    const feeStatus = getDynamicFeeStatus(student);
    if (feeStatus !== 'PAID') throw new Error(`Fee status should be PAID before cycle threshold, got ${feeStatus}`);
  });

  await assertTest('Suite 4: Attendance & Billing', '4.2 Cycle Threshold Reached (Class 9 triggers UNPAID/DUE)', async () => {
    // Mark 9th class (equal to classesPerCycle: 9)
    const res = await fetch(`${BASE_URL}/api/attendance/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        records: [{
          studentId: createdStudentId,
          date: '2026-09-17',
          status: 'Present',
          notes: 'Cycle completion class 9'
        }]
      })
    });
    if (!res.ok) throw new Error(`9th attendance returned ${res.status}`);

    // Verify student fee status transitioned
    const student = await db.getStudentById(createdStudentId);
    if (!student) throw new Error('Student not found');
    const feeStatus = getDynamicFeeStatus(student);
    if (feeStatus !== 'DUE') {
      throw new Error(`Cycle threshold of 9 classes did not trigger fee due condition. feeStatus=${feeStatus}`);
    }
  });

  await assertTest('Suite 4: Attendance & Billing', '4.3 Record Fee Payment for Cycle 1 (Transitions back to PAID, completedCycles=1)', async () => {
    const feePayload = {
      studentId: createdStudentId,
      amount: 1800,
      cycleNumber: 1,
      paymentMethod: 'GPay',
      referenceNumber: `UPI-E2E-TEST-${Date.now()}`,
      paymentDate: '2026-09-17',
      status: 'Paid',
      notes: 'Cycle 1 settlement via E2E test'
    };

    const res = await fetch(`${BASE_URL}/api/fees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(feePayload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Record fee payment failed: ${JSON.stringify(err)}`);
    }

    // Verify student state in DB
    const student = await db.getStudentById(createdStudentId);
    if (!student) throw new Error('Student not found');
    const feeStatusAfterPayment = getDynamicFeeStatus(student);
    if (feeStatusAfterPayment !== 'PAID') {
      throw new Error(`Expected feeStatus PAID after payment, got ${feeStatusAfterPayment}`);
    }
    const paidCyclesCount = student.feeHistory?.filter((f: any) => f.status === 'Paid').length || 0;
    if (paidCyclesCount < 1) {
      throw new Error(`Expected paidCyclesCount >= 1 after paying cycle 1, got ${paidCyclesCount}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 5: Coach Portal & Scoped Operations
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 5] Coach Portal & Scoped Operations');

  coachUserToken = makeToken({
    id: 'usr-coach-deepthy',
    email: 'deepthysrock@gmail.com',
    role: ROLES.COACH,
    coachId: 'coach-1788802932861-r5pgx',
    firstName: 'Deepthy',
    lastName: 'Rock'
  });

  await assertTest('Suite 5: Coach Portal', '5.1 Coach Roster Inspection (Assigned Student Access)', async () => {
    // Coach fetches their assigned student
    const res = await fetch(`${BASE_URL}/api/students/${createdStudentId}`, {
      headers: { Authorization: `Bearer ${coachUserToken}` }
    });
    if (!res.ok) throw new Error(`Coach unable to access assigned student: HTTP ${res.status}`);
    const student = await res.json();
    if (student.id !== createdStudentId) throw new Error('Student ID mismatch');
  });

  await assertTest('Suite 5: Coach Portal', '5.2 IDOR Prevention: Coach blocked from Unassigned Student (403 Forbidden)', async () => {
    // Another coach identity with a different coachId
    const otherCoachToken = makeToken({
      id: 'usr-coach-other',
      email: 'other_coach@example.com',
      role: ROLES.COACH,
      coachId: 'coach-unassigned-9999',
      firstName: 'Other',
      lastName: 'Coach'
    });

    const res = await fetch(`${BASE_URL}/api/students/${createdStudentId}`, {
      headers: { Authorization: `Bearer ${otherCoachToken}` }
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden for unassigned coach, got HTTP ${res.status}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 6: Parent Portal & Multi-Sibling Switching
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 6] Parent Portal & Multi-Sibling Switching');

  await assertTest('Suite 6: Parent Portal', '6.1 Multi-Child Sibling Resolution (Divya Karthik with Arjun & Mitra)', async () => {
    // Query family students by parent email
    const siblings = await db.getFamilyStudentsByEmailOrPhone('divya1520@gmail.com');
    if (!Array.isArray(siblings) || siblings.length < 2) {
      throw new Error(`Expected at least 2 siblings for divya1520@gmail.com, found ${siblings?.length}`);
    }
    const names = siblings.map(s => s.displayName || s.firstName);
    if (!names.some(n => n.includes('Arjun')) || !names.some(n => n.includes('Mitra'))) {
      throw new Error(`Expected Arjun and Mitra in siblings, found: ${names.join(', ')}`);
    }
  });

  await assertTest('Suite 6: Parent Portal', '6.2 Read-Only Boundary: Student cannot delete attendance or record fees (403 Forbidden)', async () => {
    const resDeleteAttendance = await fetch(`${BASE_URL}/api/attendance/${createdStudentId}/2026-09-01`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentUserToken}` }
    });
    if (resDeleteAttendance.status !== 403) {
      throw new Error(`Expected 403 on attendance deletion by student, got HTTP ${resDeleteAttendance.status}`);
    }

    const resPostFee = await fetch(`${BASE_URL}/api/fees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentUserToken}`
      },
      body: JSON.stringify({
        studentId: createdStudentId,
        amount: 1800,
        cycleNumber: 2
      })
    });
    if (resPostFee.status !== 403) {
      throw new Error(`Expected 403 on fee recording by student, got HTTP ${resPostFee.status}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 7: AI Agent Zero-LLM Fast-Path & Audit Logging
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 7] AI Agent Zero-LLM Fast-Path & Audit Logging');

  await assertTest('Suite 7: AI Agent', '7.1 Zero-LLM Fast-Path for Admin: Enroll Student Routing', async () => {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/api/ai/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'I want to enroll a new student' }]
      })
    });
    const duration = Date.now() - start;
    if (!res.ok) throw new Error(`AI chat returned HTTP ${res.status}`);
    const data = await res.json();
    if (!data.reply || !data.reply.toLowerCase().includes('student')) {
      throw new Error(`Unexpected reply: ${data.reply}`);
    }
    const navTool = (data.toolResults || []).find((t: any) => t.toolName === 'navigateToPage');
    if (!navTool || navTool.result?.target !== 'enroll') {
      throw new Error(`Expected navigateToPage target 'enroll', got: ${JSON.stringify(data.toolResults)}`);
    }
    if (duration > 600) {
      console.warn(`Fast-path duration was ${duration}ms (slightly elevated but functional)`);
    }
  });

  await assertTest('Suite 7: AI Agent', '7.2 Zero-LLM Fast-Path for Admin: Coach Registration Routing', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'register a new coach' }]
      })
    });
    if (!res.ok) throw new Error(`AI chat returned HTTP ${res.status}`);
    const data = await res.json();
    const navTool = (data.toolResults || []).find((t: any) => t.toolName === 'navigateToPage');
    if (!navTool || navTool.result?.target !== 'coachEnrollment') {
      throw new Error(`Expected navigateToPage target 'coachEnrollment', got: ${JSON.stringify(data.toolResults)}`);
    }
  });

  await assertTest('Suite 7: AI Agent', '7.3 Zero-LLM Fast-Path for Non-Admin: Access Restricted', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentUserToken}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'enroll a new student' }]
      })
    });
    if (!res.ok) throw new Error(`AI chat returned HTTP ${res.status}`);
    const data = await res.json();
    if (data.reply !== 'Restricted only to Admin.') {
      throw new Error(`Expected 'Restricted only to Admin.', got: '${data.reply}'`);
    }
    if ((data.toolResults || []).length > 0) {
      throw new Error(`Tool execution must not occur for unauthorized request: ${JSON.stringify(data.toolResults)}`);
    }
  });

  await assertTest('Suite 7: AI Agent', '7.4 Audit Logging Verification in PostgreSQL', async () => {
    // Query tool audit logs
    const auditLogs = await db.getToolAuditLogs(10);
    if (!Array.isArray(auditLogs)) {
      throw new Error('Expected array of audit logs from PostgreSQL');
    }
    if (auditLogs.length > 0) {
      const sample = auditLogs[0];
      if (!sample.id || !sample.toolName || !sample.createdAt) {
        throw new Error(`Invalid audit log schema: ${JSON.stringify(sample)}`);
      }
    }
  });

  // -------------------------------------------------------------
  // SUITE 8: Security & High Vulnerability Hardening (H4, H5, H6)
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 8] Security Hardening & High Fix Verifications (H4, H5, H6)');

  await assertTest('Suite 8: High Hardening', '8.1 Upload Anti-XSS: Reject SVG and Magic Byte Spoofing (H4)', async () => {
    const { saveBase64Image } = await import('../server/helpers/fileHelper.ts');
    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs');
    const tempDir = path.join(os.tmpdir(), 'spa-test-uploads');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // 1. Reject SVG payload
    let svgFailed = false;
    try {
      const svgBase64 = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
      await saveBase64Image(svgBase64, tempDir, 'test');
    } catch (err: any) {
      if (err.message.includes('Unsupported image type') || err.message.includes('Forbidden')) {
        svgFailed = true;
      }
    }
    if (!svgFailed) throw new Error('Expected SVG upload to be rejected');

    // 2. Reject MIME spoofing (declares png but contains ASCII script)
    let spoofFailed = false;
    try {
      const spoofBase64 = 'data:image/png;base64,' + Buffer.from('<html><script>alert("xss")</script></html>').toString('base64');
      await saveBase64Image(spoofBase64, tempDir, 'test');
    } catch (err: any) {
      if (err.message.includes('magic-byte validation') || err.message.includes('header does not match')) {
        spoofFailed = true;
      }
    }
    if (!spoofFailed) throw new Error('Expected spoofed PNG header to be rejected by magic byte validator');

    // 3. Accept valid PNG 1x1
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const savedPath = await saveBase64Image(validPng, tempDir, 'test');
    if (!savedPath || !savedPath.endsWith('.png')) {
      throw new Error(`Expected valid png upload to return .png path, got: ${savedPath}`);
    }
  });

  await assertTest('Suite 8: High Hardening', '8.2 Testimonials Ownership & Moderation Flow (H5)', async () => {
    // 1. Student attempting to post testimonial for unowned student ID
    const unownedRes = await fetch(`${BASE_URL}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentUserToken}`
      },
      body: JSON.stringify({
        studentId: 'unowned-student-id-9999',
        studentName: 'Unowned Student',
        parentName: 'Fake Parent',
        rating: 5,
        review: 'Should be rejected due to ownership mismatch',
        mediaConsent: true
      })
    });
    if (unownedRes.status !== 403) {
      throw new Error(`Expected 403 for unauthorized student testimonial, got: ${unownedRes.status}`);
    }

    // 2. Valid submission for owned student defaults to Pending
    const studentUserTokenForTestimonial = makeToken({
      id: 'usr-student-e2e',
      email: 'student_e2e@smartpenacademy.com',
      role: ROLES.STUDENT,
      studentId: createdStudentId
    });

    const validRes = await fetch(`${BASE_URL}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentUserTokenForTestimonial}`
      },
      body: JSON.stringify({
        studentId: createdStudentId,
        studentName: 'E2E Test Student',
        parentName: 'Verified Parent',
        rating: 5,
        review: 'SmartPen Academy completely revolutionized student handwriting in just 4 weeks!',
        mediaConsent: true
      })
    });
    if (!validRes.ok) {
      const errText = await validRes.text();
      throw new Error(`Failed to submit valid testimonial: ${validRes.status} ${errText}`);
    }
    const createdTestimonial = await validRes.json();
    if (createdTestimonial.status !== 'Pending') {
      throw new Error(`Non-admin testimonial submission must default to 'Pending', got '${createdTestimonial.status}'`);
    }
    if (createdTestimonial.mediaConsent !== true) {
      throw new Error(`Expected mediaConsent to persist true, got: ${createdTestimonial.mediaConsent}`);
    }

    // Clean up created testimonial
    try {
      await db.deleteTestimonial(createdTestimonial.id);
    } catch {}
  });

  await assertTest('Suite 8: High Hardening', '8.3 Accounting Integrity & Fee ID Hijack Defense (H6)', async () => {
    // 1. Fee creation ignores client-supplied ID and creates server UUID
    const feeRes = await fetch(`${BASE_URL}/api/fees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        id: 'attacker-client-supplied-id',
        studentId: createdStudentId,
        amount: 2500,
        status: 'Pending',
        yearMonth: '2026-09'
      })
    });
    if (!feeRes.ok) {
      const errText = await feeRes.text();
      throw new Error(`Failed to create test fee: ${feeRes.status} ${errText}`);
    }
    const feeData = await feeRes.json();
    if (feeData.id === 'attacker-client-supplied-id') {
      throw new Error('Security violation: Server accepted client-supplied ID on fee creation!');
    }
    if (!feeData.receiptNumber || !feeData.receiptNumber.startsWith('REC-')) {
      throw new Error(`Expected system-generated receipt number starting with REC-, got ${feeData.receiptNumber}`);
    }

    // 2. Receipt number mutation must fail
    const mutateRes = await fetch(`${BASE_URL}/api/fees/${feeData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        receiptNumber: 'REC-MUTATED-ATTACK'
      })
    });
    if (mutateRes.ok) {
      throw new Error('Security violation: Server allowed modifying immutable receipt_number!');
    }

    // Clean up fee
    try {
      const { serverSupabase } = await import('../server/supabase.ts');
      await serverSupabase.from('fees').delete().eq('id', feeData.id);
    } catch {}
  });

  // -------------------------------------------------------------
  // SUITE 9: AI Agent Guardrails & Outbound Phishing Defenses (H7, H9)
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 9] AI Agent Guardrails & Outbound Phishing Defenses (H7, H9)');

  await assertTest('Suite 9: AI Guardrails & Phishing', '9.1 Mutating Tools Confirmation Token Requirement & Replay Prevention', async () => {
    const { deactivateStudentTool } = await import('../server/tools/deactivateStudent.ts');
    const adminUser = { id: 'usr-admin-001', username: 'admin', role: ROLES.ADMIN };

    // 1. Calling with confirmed: true but without confirmationToken must fail
    const unconfirmedRes = await deactivateStudentTool.execute({
      studentNameOrId: createdStudentId,
      confirmed: true
    }, { user: adminUser as any, executionMode: 'direct_execution' });

    if (unconfirmedRes.success || !unconfirmedRes.summary.includes('confirmation token is required')) {
      throw new Error(`Expected confirmation token failure, got: ${unconfirmedRes.summary}`);
    }

    // 2. Draft execution generates valid confirmationToken
    const draftRes = await deactivateStudentTool.execute({
      studentNameOrId: createdStudentId,
      confirmed: false
    }, { user: adminUser as any, executionMode: 'direct_execution' });

    if (!draftRes.result?.confirmationToken) {
      throw new Error('Draft response did not contain confirmationToken');
    }
    const validToken = draftRes.result.confirmationToken;

    // 3. Execution with genuine token succeeds
    const confirmedRes = await deactivateStudentTool.execute({
      studentNameOrId: createdStudentId,
      confirmed: true,
      confirmationToken: validToken
    }, { user: adminUser as any, executionMode: 'direct_execution' });

    if (!confirmedRes.success) {
      throw new Error(`Execution with valid confirmation token failed: ${confirmedRes.summary}`);
    }

    // 4. Token replay must be rejected (single-use nonce consumed)
    const replayRes = await deactivateStudentTool.execute({
      studentNameOrId: createdStudentId,
      confirmed: true,
      confirmationToken: validToken
    }, { user: adminUser as any, executionMode: 'direct_execution' });

    if (replayRes.success || (!replayRes.summary.includes('Security') && !replayRes.summary.includes('confirmation token'))) {
      throw new Error('Security violation: Replaying consumed confirmation token was not rejected!');
    }

    // Re-activate student for subsequent tests / teardown
    const { serverSupabase } = await import('../server/supabase.ts');
    await serverSupabase.from('students').update({ status: 'Active' }).eq('id', createdStudentId);
  });

  await assertTest('Suite 9: AI Guardrails & Phishing', '9.2 Coach Fee Amount Modification & Waiver Restriction (H7)', async () => {
    const { updateFeeStatusTool } = await import('../server/tools/updateFeeStatus.ts');
    const coachUser = { id: 'usr-coach-001', username: 'coach', role: ROLES.COACH };

    // 1. Coach attempting to change fee amount
    const amountRes = await updateFeeStatusTool.execute({
      studentNameOrId: createdStudentId,
      newStatus: 'Pending',
      newAmount: 500
    }, { user: coachUser as any, executionMode: 'direct_execution' });

    if (amountRes.success || !amountRes.summary.includes('Coaches cannot waive fees or modify billing amounts')) {
      throw new Error(`Expected coach amount adjustment rejection, got: ${amountRes.summary}`);
    }

    // 2. Coach attempting to waive fee
    const waiveRes = await updateFeeStatusTool.execute({
      studentNameOrId: createdStudentId,
      newStatus: 'Waived'
    }, { user: coachUser as any, executionMode: 'direct_execution' });

    if (waiveRes.success || !waiveRes.summary.includes('Coaches cannot waive fees or modify billing amounts')) {
      throw new Error(`Expected coach fee waive rejection, got: ${waiveRes.summary}`);
    }
  });

  await assertTest('Suite 9: AI Guardrails & Phishing', '9.3 Role-Based Tool Availability & Admin Alignment (H7)', async () => {
    const { isToolAllowedForRole, toolRegistry } = await import('../server/tools/registry.ts');

    // Admin should have access to operational tools
    if (!isToolAllowedForRole(toolRegistry['deactivateStudent'], ROLES.ADMIN)) {
      throw new Error('Admin should have access to deactivateStudent');
    }
    // Admin should NOT have access to self-service student identity tools
    if (isToolAllowedForRole(toolRegistry['viewOwnWorkSamples'], ROLES.ADMIN)) {
      throw new Error('Admin bypass must NOT grant access to selfServiceOnly tool viewOwnWorkSamples');
    }
    // Coach should NOT have access to admin-only tools
    if (isToolAllowedForRole(toolRegistry['deactivateCoach'], ROLES.COACH)) {
      throw new Error('Coach should NOT have access to deactivateCoach');
    }
  });

  await assertTest('Suite 9: AI Guardrails & Phishing', '9.4 AI Agent Chat Payload Cap (H7)', async () => {
    const hugePayload = JSON.stringify({
      messages: [{ role: 'user', content: 'A'.repeat(1024 * 1024 + 100) }]
    });

    const res = await fetch(`${BASE_URL}/api/ai/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(hugePayload))
      },
      body: hugePayload
    });

    if (res.status !== 413) {
      throw new Error(`Expected 413 Payload Too Large, got status ${res.status}`);
    }
  });

  await assertTest('Suite 9: AI Guardrails & Phishing', '9.5 Outbound Trust & Phishing Prevention in Fee Reminders (H9)', async () => {
    const rogueGpayLink = 'https://phishing-scam-site.com/pay-me-now';
    const attackerEmail = 'hacker@phishing.test';

    const res = await fetch(`${BASE_URL}/api/reminders/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        studentId: createdStudentId,
        amount: 2500,
        month: 'April 2026',
        parentEmail: attackerEmail,
        gpayLink: rogueGpayLink
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to create reminder: ${err.error || res.status}`);
    }

    const json = await res.json();
    const reminder = json.reminder;

    // 1. Rogue link must be stripped and replaced with canonical UPI URI
    if (reminder.gpayLink === rogueGpayLink || !reminder.gpayLink.startsWith('upi://pay?pa=smartpen.academy@okaxis')) {
      throw new Error(`Security violation: Rogue gpayLink was preserved! Got: ${reminder.gpayLink}`);
    }

    // 2. Authoritative student email from DB must be used, not the attacker's email
    const student = await db.getStudentById(createdStudentId);
    if (reminder.parentEmail === attackerEmail && student?.email !== attackerEmail) {
      throw new Error(`Security violation: Attacker overridden parentEmail was saved!`);
    }
  });

  await assertTest('Suite 9: AI Guardrails & Phishing', '9.6 Email HTML Injection Sanitization (H9)', async () => {
    const { escapeHtml } = await import('../server/email.ts');

    const rawInput = '<script>alert("xss")</script>&<img src=x onerror=alert(1)>"\'';
    const escaped = escapeHtml(rawInput);

    if (escaped.includes('<script>') || escaped.includes('<img') || escaped.includes('"') || escaped.includes("'")) {
      throw new Error(`HTML injection was not properly escaped! Got: ${escaped}`);
    }
    if (!escaped.includes('&lt;script&gt;') || !escaped.includes('&amp;') || !escaped.includes('&quot;')) {
      throw new Error(`Expected standard HTML entity escaping, got: ${escaped}`);
    }
  });


  // -------------------------------------------------------------
  // TEARDOWN: Clean up test-generated records
  // -------------------------------------------------------------
  console.log('\n🧹 [TEARDOWN] Cleaning up test-generated entities...');
  try {
    if (createdStudentId) {
      const { serverSupabase } = await import('../server/supabase.ts');
      await serverSupabase.from('fees').delete().eq('student_id', createdStudentId);
      await serverSupabase.from('attendance').delete().eq('student_id', createdStudentId);
      await db.deleteStudent(createdStudentId);
      console.log(`  ✓ Cleaned up test student ${createdStudentId} (including attendance and fees)`);
    }
    if (createdDemoBookingId) {
      await db.deleteDemoBooking(createdDemoBookingId);
      console.log(`  ✓ Cleaned up test demo booking ${createdDemoBookingId}`);
    }
  } catch (teardownErr: any) {
    console.warn(`  ⚠️ Teardown notice: ${teardownErr?.message || teardownErr}`);
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n===============================================================');
  console.log(`📊 END-TO-END TEST SUITE SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('===============================================================');

  if (failed > 0) {
    console.error('\nFAILED SCENARIOS:');
    for (const r of results.filter(r => !r.passed)) {
      console.error(`❌ [${r.suite}] ${r.scenario}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SCENARIOS PASSED WITH ZERO FAILURES!\n');
    process.exit(0);
  }
}

runAllSuites().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
