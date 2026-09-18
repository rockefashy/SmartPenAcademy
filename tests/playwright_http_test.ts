/**
 * SmartPen Academy - Playwright HTTP API Automated Test Suite
 * 
 * Uses Playwright's native APIRequestContext (`playwright.request.newContext`)
 * to test live HTTP endpoints against http://127.0.0.1:3000.
 */

import 'dotenv/config';
import { request, APIRequestContext } from 'playwright';
import { db } from '../server/supabaseDb.ts';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

async function runPlaywrightHttpSuite() {
  console.log('===============================================================');
  console.log('🎭 SMART PEN ACADEMY - PLAYWRIGHT HTTP TEST SUITE');
  console.log(`🔗 Target: ${BASE_URL}`);
  console.log('===============================================================\n');

  const results: TestResult[] = [];
  const testRunId = Date.now();
  let createdStudentId: string | null = null;
  let createdDemoId: string | null = null;

  // Unauthenticated Playwright request context
  const publicContext = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  async function step(suite: string, name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
      await fn();
      const durationMs = Date.now() - start;
      results.push({ suite, name, passed: true, durationMs });
      console.log(`  ✅ [PASS] ${suite} - ${name} (${durationMs}ms)`);
    } catch (err: any) {
      const durationMs = Date.now() - start;
      results.push({ suite, name, passed: false, durationMs, error: err.message });
      console.error(`  ❌ [FAIL] ${suite} - ${name} (${durationMs}ms): ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // SUITE 1: Public Web & Health Probes
  // -------------------------------------------------------------
  console.log('👉 [SUITE 1] Public Endpoints & Health Probes');

  await step('Public', 'Health check (GET /api/health)', async () => {
    const res = await publicContext.get('/api/health');
    if (res.status() !== 200) throw new Error(`Expected 200, got ${res.status()}`);
    const body = await res.json();
    if (body.status !== 'healthy') throw new Error(`Expected status 'healthy', got ${body.status}`);
  });

  await step('Public', 'Readiness probe (GET /api/ready)', async () => {
    const res = await publicContext.get('/api/ready');
    if (res.status() !== 200) throw new Error(`Expected 200, got ${res.status()}`);
    const body = await res.json();
    if (body.status !== 'ready') throw new Error(`Expected status 'ready', got ${body.status}`);
  });

  await step('Public', 'Public Testimonials (GET /api/testimonials)', async () => {
    const res = await publicContext.get('/api/testimonials');
    if (res.status() !== 200) throw new Error(`Expected 200, got ${res.status()}`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error('Expected array of testimonials');
  });

  await step('Public', 'Free Demo Validation Failure (POST /api/demo-bookings with missing phone)', async () => {
    const res = await publicContext.post('/api/demo-bookings', {
      data: {
        studentName: 'Playwright Child',
        parentName: 'Playwright Parent',
        contactNumber: '123' // Invalid phone < 10 digits
      }
    });
    if (res.status() !== 400) throw new Error(`Expected 400 Bad Request, got ${res.status()}`);
  });

  await step('Public', 'Free Demo Class Booking (POST /api/demo-bookings)', async () => {
    const res = await publicContext.post('/api/demo-bookings', {
      data: {
        studentName: `PW Child ${testRunId}`,
        parentName: 'PW Parent',
        age: 9,
        grade: 'Grade 4',
        contactNumber: '9123456780',
        preferredDate: '2026-09-28',
        preferredTimeSlot: '05:00 PM',
        modeOfLearning: 'In-person'
      }
    });
    if (res.status() !== 201 && res.status() !== 200) {
      throw new Error(`Expected 200/201, got ${res.status()}`);
    }
    const body = await res.json();
    if (!body.id) throw new Error(`Expected booking id in response, got: ${JSON.stringify(body)}`);
    createdDemoId = body.id;
  });

  // -------------------------------------------------------------
  // SUITE 2: Authentication & RBAC
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 2] Authentication & RBAC Guardrails');

  let adminToken = '';
  let adminContext!: APIRequestContext;

  await step('Auth', 'Invalid credentials rejection (POST /api/auth/login)', async () => {
    const res = await publicContext.post('/api/auth/login', {
      data: {
        identifier: 'admin@smartpenacademy.com',
        password: 'CompletelyWrongPassword123!'
      }
    });
    if (res.status() !== 401) throw new Error(`Expected 401, got ${res.status()}`);
  });

  await step('Auth', 'Unauthenticated access blocked (GET /api/students -> 401)', async () => {
    const res = await publicContext.get('/api/students');
    if (res.status() !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status()}`);
  });

  await step('Auth', 'Admin login (POST /api/auth/login)', async () => {
    const res = await publicContext.post('/api/auth/login', {
      data: {
        identifier: 'admin@smartpenacademy.com',
        password: 'Admin@SmartPen2026'
      }
    });
    if (res.status() !== 200) {
      const errText = await res.text();
      throw new Error(`Admin login failed (${res.status()}): ${errText}`);
    }
    const body = await res.json();
    if (body.user?.role !== 'admin') throw new Error(`Expected role 'admin', got ${body.user?.role}`);
    adminToken = body.token || '';

    // Create authenticated context with Bearer token
    adminContext = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
  });

  // -------------------------------------------------------------
  // SUITE 3: Student Enrollment & Lifecycle
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 3] Student Enrollment & Lifecycle');

  const studentPayload = {
    firstName: `PW_${testRunId.toString().slice(-4)}`,
    lastName: 'Playwright',
    age: 10,
    gradeClass: 'Grade 5',
    dominantHand: 'Right',
    schoolName: 'Playwright Elementary',
    parentName: 'Playwright Guardian',
    email: `pw_student_${testRunId}@smartpenacademy.com`,
    whatsappMobile: `9888${testRunId.toString().slice(-6)}`,
    password: 'TestPassword123!',
    modeOfLearning: 'In-person',
    classesPerCycle: 8,
    feePerCycle: 1600,
    notes: 'Playwright automated HTTP test student'
  };

  await step('Students', 'Enroll new student (POST /api/students/enroll)', async () => {
    const res = await adminContext.post('/api/students/enroll', {
      data: studentPayload
    });
    if (res.status() !== 201 && res.status() !== 200) {
      const errText = await res.text();
      throw new Error(`Expected 200/201, got ${res.status()}: ${errText}`);
    }
    const body = await res.json();
    if (!body.student?.id) throw new Error('Missing student.id in response');
    createdStudentId = body.student.id;
  });

  await step('Students', 'Fetch enrolled student (GET /api/students/:id)', async () => {
    if (!createdStudentId) throw new Error('No student ID');
    const res = await adminContext.get(`/api/students/${createdStudentId}`);
    if (res.status() !== 200) throw new Error(`Expected 200, got ${res.status()}`);
    const body = await res.json();
    if (body.id !== createdStudentId) throw new Error(`Expected ID ${createdStudentId}, got ${body.id}`);
  });

  await step('Students', 'Update student profile (PUT /api/students/:id)', async () => {
    if (!createdStudentId) throw new Error('No student ID');
    const res = await adminContext.put(`/api/students/${createdStudentId}`, {
      data: {
        preferredSlot: '5:00 - 6:00 PM',
        notes: 'Updated via Playwright HTTP test'
      }
    });
    if (res.status() !== 200) throw new Error(`Expected 200, got ${res.status()}`);
    const body = await res.json();
    if (body.preferredSlot !== '5:00 - 6:00 PM') {
      throw new Error(`Expected updated slot, got ${body.preferredSlot}`);
    }
  });

  // -------------------------------------------------------------
  // SUITE 4: Attendance & Fee Payment
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 4] Attendance & Billing Progression');

  await step('Attendance', 'Batch save attendance (POST /api/attendance/batch)', async () => {
    if (!createdStudentId) throw new Error('No student ID');
    const res = await adminContext.post('/api/attendance/batch', {
      data: {
        records: [
          {
            studentId: createdStudentId,
            date: '2026-09-02',
            status: 'Present',
            classNumber: 1
          },
          {
            studentId: createdStudentId,
            date: '2026-09-05',
            status: 'Present',
            classNumber: 2
          }
        ]
      }
    });
    if (res.status() !== 200) throw new Error(`Expected 200, got ${res.status()}`);
  });

  await step('Fees', 'Record fee payment (POST /api/fees)', async () => {
    if (!createdStudentId) throw new Error('No student ID');
    const res = await adminContext.post('/api/fees', {
      data: {
        studentId: createdStudentId,
        amount: 1600,
        yearMonth: '2026-09',
        status: 'Paid',
        paymentMethod: 'GPAY'
      }
    });
    if (res.status() !== 200 && res.status() !== 201) {
      throw new Error(`Expected 200/201, got ${res.status()}`);
    }
    const body = await res.json();
    if (Number(body.amount) !== 1600) throw new Error(`Expected amount 1600, got ${body.amount}`);
  });

  // -------------------------------------------------------------
  // SUITE 5: Coaches & Teardown
  // -------------------------------------------------------------
  console.log('\n👉 [SUITE 5] Coaches Roster & Teardown');

  await step('Coaches', 'List active coaches (GET /api/coaches)', async () => {
    const res = await adminContext.get('/api/coaches');
    if (res.status() !== 200) throw new Error(`Expected 200, got ${res.status()}`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error('Expected array of coaches');
  });

  // Teardown test entities
  console.log('\n🧹 [TEARDOWN] Cleaning up test-generated entities...');
  if (createdStudentId) {
    try {
      const { serverSupabase } = await import('../server/supabase.ts');
      await serverSupabase.from('attendance').delete().eq('student_id', createdStudentId);
      await serverSupabase.from('fees').delete().eq('student_id', createdStudentId);
      await serverSupabase.from('students').delete().eq('id', createdStudentId);
      console.log(`  ✓ Cleaned up test student ${createdStudentId}`);
    } catch (e: any) {
      console.warn(`  Notice: cleanup error for student: ${e.message}`);
    }
  }

  if (createdDemoId) {
    try {
      const { serverSupabase } = await import('../server/supabase.ts');
      await serverSupabase.from('demo_bookings').delete().eq('id', createdDemoId);
      console.log(`  ✓ Cleaned up test demo booking ${createdDemoId}`);
    } catch (e: any) {
      console.warn(`  Notice: cleanup error for demo: ${e.message}`);
    }
  }

  // Cleanup Playwright contexts
  await publicContext.dispose();
  if (adminContext) {
    await adminContext.dispose();
  }

  // -------------------------------------------------------------
  // Final Report
  // -------------------------------------------------------------
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n===============================================================');
  console.log(`📊 PLAYWRIGHT HTTP RESULTS: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PLAYWRIGHT HTTP SCENARIOS PASSED WITH ZERO FAILURES!\n');
    process.exit(0);
  }
}

runPlaywrightHttpSuite().catch(err => {
  console.error('Fatal Playwright suite error:', err);
  process.exit(1);
});
