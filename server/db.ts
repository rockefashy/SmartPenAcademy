import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { 
  StudentProfile, 
  AttendanceRecord, 
  FeeRecord, 
  ProgressTracker, 
  StudentWorkImage, 
  ProgressReport, 
  FeeReminder,
  User,
  DemoBooking,
  AdminAlert,
  Testimonial,
  ToolAuditLog
} from '../src/types';
import { 
  syncDemoBookingToSupabase,
  deleteDemoBookingFromSupabase,
  syncAlertToSupabase,
  deleteAlertFromSupabase,
  syncStudentToSupabase,
  deleteStudentFromSupabase,
  syncUserToSupabase,
  syncAttendanceToSupabase,
  deleteAttendanceFromSupabase,
  syncFeeToSupabase,
  deleteFeeFromSupabase,
  syncProgressTrackerToSupabase,
  deleteProgressTrackerFromSupabase,
  syncStudentWorkToSupabase,
  deleteStudentWorkFromSupabase,
  syncProgressReportToSupabase,
  deleteProgressReportFromSupabase,
  syncTestimonialToSupabase,
  deleteTestimonialFromSupabase,
  syncFeeReminderToSupabase,
  syncAuditLogToSupabase,
  loadStateFromSupabase
} from './supabaseSync.ts';

interface DatabaseState {
  users: (User & { passwordHash: string; rawPassword?: string })[];
  students: StudentProfile[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  progressTrackers: ProgressTracker[];
  studentWorks: StudentWorkImage[];
  progressReports: ProgressReport[];
  feeReminders: FeeReminder[];
  demoBookings: DemoBooking[];
  alerts: AdminAlert[];
  testimonials?: Testimonial[];
  toolAuditLogs?: ToolAuditLog[];
}

// Initial Realistic Seed Data: Principal Admin User
const initialSeedData = (): DatabaseState => {
  const adminPasswordHash = bcrypt.hashSync('password123', 8);

  const initialUsers: (User & { passwordHash: string; rawPassword?: string })[] = [
    {
      id: 'usr-admin',
      username: 'admin',
      role: 'admin',
      passwordHash: adminPasswordHash,
      rawPassword: 'password123',
      fullName: 'Mrs. Deepthy Rock (Principal Coach)',
      email: 'rockefashy@gmail.com'
    }
  ];

  return {
    users: initialUsers,
    students: [],
    attendance: [],
    fees: [],
    progressTrackers: [],
    studentWorks: [],
    progressReports: [],
    feeReminders: [],
    demoBookings: [],
    alerts: [],
    testimonials: [],
    toolAuditLogs: []
  };
};

// Database Singleton operating directly on Supabase with synchronized in-memory caching
class Database {
  private state: DatabaseState;

  constructor() {
    this.ensureMediaDirectories();
    this.state = initialSeedData();
    this.initSupabaseState();
  }

  private ensureMediaDirectories() {
    const uploadsDirs = [
      path.join(process.cwd(), 'public', 'student_works'),
      path.join(process.cwd(), 'public', 'progress_reports'),
      path.join(process.cwd(), 'public', 'app_images'),
      path.join(process.cwd(), 'public', 'testimonials')
    ];
    uploadsDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private async initSupabaseState() {
    try {
      const hydrated = await loadStateFromSupabase();
      if (hydrated) {
        // Merge users while preserving admin passwordHash
        const existingUsers = [...this.state.users];
        for (const u of hydrated.users) {
          const exists = existingUsers.find(e => e.id === u.id || e.email === u.email);
          if (!exists) {
            existingUsers.push({
              ...u,
              passwordHash: bcrypt.hashSync('password123', 8),
              rawPassword: 'password123'
            });
          }
        }

        this.state = {
          users: existingUsers,
          students: hydrated.students || [],
          attendance: hydrated.attendance || [],
          fees: hydrated.fees || [],
          progressTrackers: hydrated.progressTrackers || [],
          studentWorks: hydrated.studentWorks || [],
          progressReports: hydrated.progressReports || [],
          testimonials: hydrated.testimonials || [],
          feeReminders: hydrated.feeReminders || [],
          demoBookings: hydrated.demoBookings || [],
          alerts: hydrated.alerts || [],
          toolAuditLogs: hydrated.toolAuditLogs || []
        };
        this.checkAndGenerateFeeAlerts();
        console.log('[Database] In-memory database initialized directly from Supabase.');
      }
    } catch (e: any) {
      console.warn('[Database] Supabase initial load notice:', e.message);
    }
  }

  // Users & Auth
  findUserByUsername(username: string) {
    return this.state.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  }

  findUserByEmailOrUsername(query: string) {
    const q = query.toLowerCase().trim();
    return this.state.users.find(u => u.username.toLowerCase() === q || u.email.toLowerCase() === q);
  }

  upsertUserFromSupabase(userData: {
    id?: string;
    email: string;
    fullName?: string;
    role?: 'admin' | 'student';
    studentId?: string;
    username?: string;
  }) {
    const email = userData.email.toLowerCase().trim();
    let existing = this.state.users.find(u => 
      u.email.toLowerCase() === email || 
      (userData.id && u.id === userData.id) ||
      (userData.username && u.username.toLowerCase() === userData.username.toLowerCase().trim())
    );

    if (existing) {
      if (userData.fullName && (!existing.fullName || existing.fullName === 'User')) {
        existing.fullName = userData.fullName;
      }
      if (userData.role) existing.role = userData.role;
      if (userData.studentId && !existing.studentId) existing.studentId = userData.studentId;
      return existing;
    }

    const username = userData.username || email.split('@')[0] || `user_${Date.now()}`;
    const role = userData.role || (email.includes('admin') ? 'admin' : 'student');
    const newUser: User & { passwordHash: string; rawPassword?: string } = {
      id: userData.id || `usr-sb-${Date.now()}`,
      username: username,
      role: role,
      studentId: userData.studentId,
      passwordHash: bcrypt.hashSync('password123', 8),
      rawPassword: 'password123',
      fullName: userData.fullName || username,
      email: email
    };

    this.state.users.push(newUser);
    syncUserToSupabase(newUser);
    return newUser;
  }

  createUser(user: User & { passwordHash: string; rawPassword?: string }) {
    this.state.users.push(user);
    syncUserToSupabase(user);
    return user;
  }

  // Students
  getAllStudents() {
    // Sort active students first, then by fullName
    return [...this.state.students].sort((a, b) => {
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (a.status !== 'Active' && b.status === 'Active') return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }

  getStudentById(id: string) {
    return this.state.students.find(s => s.id === id);
  }

  createStudent(profile: StudentProfile) {
    this.state.students.push(profile);
    
    // Also create matching user account
    const password = profile.password || 'password123';
    const passwordHash = bcrypt.hashSync(password, 8);
    
    const newUser = {
      id: `usr-${profile.id}`,
      username: profile.username,
      role: 'student' as const,
      studentId: profile.id,
      passwordHash,
      rawPassword: password,
      fullName: profile.fullName,
      email: profile.email
    };
    this.state.users.push(newUser);

    syncStudentToSupabase(profile);
    syncUserToSupabase(newUser);
    return profile;
  }

  updateStudent(id: string, updates: Partial<StudentProfile>) {
    const idx = this.state.students.findIndex(s => s.id === id);
    if (idx === -1) return null;

    this.state.students[idx] = {
      ...this.state.students[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Update matching user if username, password, or email updated
    const userIdx = this.state.users.findIndex(u => u.studentId === id);
    if (userIdx !== -1) {
      if (updates.username) this.state.users[userIdx].username = updates.username;
      if (updates.email) this.state.users[userIdx].email = updates.email;
      if (updates.fullName) this.state.users[userIdx].fullName = updates.fullName;
      if (updates.password) {
        this.state.users[userIdx].rawPassword = updates.password;
        this.state.users[userIdx].passwordHash = bcrypt.hashSync(updates.password, 8);
      }
      syncUserToSupabase(this.state.users[userIdx]);
    }

    syncStudentToSupabase(this.state.students[idx]);
    return this.state.students[idx];
  }

  deleteStudent(id: string) {
    this.state.students = this.state.students.filter(s => s.id !== id);
    this.state.users = this.state.users.filter(u => u.studentId !== id);
    this.state.attendance = this.state.attendance.filter(a => a.studentId !== id);
    this.state.fees = this.state.fees.filter(f => f.studentId !== id);
    this.state.progressReports = this.state.progressReports.filter(r => r.studentId !== id);
    this.state.progressTrackers = this.state.progressTrackers.filter(t => t.studentId !== id);
    this.state.studentWorks = this.state.studentWorks.filter(w => w.studentId !== id);
    deleteStudentFromSupabase(id);
    return true;
  }

  // Attendance
  getAttendanceByMonth(yearMonth: string) {
    return this.state.attendance.filter(a => a.yearMonth === yearMonth);
  }

  getAttendanceByStudent(studentId: string) {
    return this.state.attendance.filter(a => a.studentId === studentId);
  }

  saveAttendanceBatch(records: Omit<AttendanceRecord, 'id'>[]) {
    records.forEach(rec => {
      const existingIdx = this.state.attendance.findIndex(
        a => a.studentId === rec.studentId && a.date === rec.date
      );
      if (existingIdx !== -1) {
        this.state.attendance[existingIdx] = { ...this.state.attendance[existingIdx], ...rec };
        syncAttendanceToSupabase(this.state.attendance[existingIdx]);
      } else {
        const newAtt: AttendanceRecord = {
          ...rec,
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
        this.state.attendance.push(newAtt);
        syncAttendanceToSupabase(newAtt);
      }
    });
    this.checkAndGenerateFeeAlerts();
    return true;
  }

  deleteAttendance(studentId: string, date: string) {
    this.state.attendance = this.state.attendance.filter(
      a => !(a.studentId === studentId && a.date === date)
    );
    this.checkAndGenerateFeeAlerts();
    deleteAttendanceFromSupabase(studentId, date);
    return true;
  }

  // Fees (₹1,600 per 8-class cycle)
  getFeesByMonth(yearMonth: string) {
    return this.state.fees.filter(f => f.yearMonth === yearMonth);
  }

  getFeesByStudent(studentId: string) {
    return this.state.fees
      .filter(f => f.studentId === studentId)
      .sort((a, b) => new Date(b.date || b.paidDate || '2026-01-01').getTime() - new Date(a.date || a.paidDate || '2026-01-01').getTime());
  }

  saveFeeRecord(fee: Omit<FeeRecord, 'id'> & { id?: string }) {
    const isPaid = fee.isPaid ?? (fee.status === 'Paid');
    const status = fee.status || (isPaid ? 'Paid' : 'Pending');
    const milestone = fee.milestone || fee.yearMonth || 'August 2026';
    const date = fee.date || fee.paidDate || new Date().toISOString().split('T')[0];
    const receiptNumber = fee.receiptNumber || fee.receiptNo || (isPaid ? `REC-${Date.now().toString().slice(-6)}` : undefined);

    let savedRecord: FeeRecord;

    if (fee.id) {
      const existingIdx = this.state.fees.findIndex(f => f.id === fee.id);
      if (existingIdx !== -1) {
        this.state.fees[existingIdx] = {
          ...this.state.fees[existingIdx],
          ...fee,
          date,
          yearMonth: milestone,
          milestone,
          isPaid,
          status,
          receiptNumber,
          receiptNo: receiptNumber,
          updatedAt: new Date().toISOString()
        };
        savedRecord = this.state.fees[existingIdx];
      } else {
        const newRec: FeeRecord = {
          ...fee,
          id: fee.id,
          date,
          yearMonth: milestone,
          milestone,
          isPaid,
          status,
          receiptNumber,
          receiptNo: receiptNumber,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.state.fees.push(newRec);
        savedRecord = newRec;
      }
    } else {
      const newRec: FeeRecord = {
        ...fee,
        id: `fee-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        date,
        yearMonth: milestone,
        milestone,
        isPaid,
        status,
        receiptNumber,
        receiptNo: receiptNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.fees.push(newRec);
      savedRecord = newRec;
    }

    // If marked paid, mark matching fee alerts as read
    if (savedRecord.isPaid) {
      if (!this.state.alerts) this.state.alerts = [];
      this.state.alerts.forEach(a => {
        if (a.type === 'fee_due' && a.studentId === savedRecord.studentId) {
          if (!a.metadata?.cycleLabel || a.metadata.cycleLabel === savedRecord.yearMonth || a.metadata.cycleLabel === savedRecord.milestone) {
            a.isRead = true;
          }
        }
      });
    }

    this.checkAndGenerateFeeAlerts();
    syncFeeToSupabase(savedRecord);
    return savedRecord;
  }

  updateFeeRecord(id: string, updates: Partial<FeeRecord>) {
    const idx = this.state.fees.findIndex(f => f.id === id);
    if (idx === -1) return null;

    const isPaid = updates.isPaid !== undefined 
      ? updates.isPaid 
      : (updates.status ? updates.status === 'Paid' : this.state.fees[idx].isPaid);
    const status = updates.status || (isPaid ? 'Paid' : 'Pending');
    const milestone = updates.milestone || updates.yearMonth || this.state.fees[idx].milestone || this.state.fees[idx].yearMonth;
    const receiptNumber = updates.receiptNumber || updates.receiptNo || this.state.fees[idx].receiptNumber || this.state.fees[idx].receiptNo;

    this.state.fees[idx] = {
      ...this.state.fees[idx],
      ...updates,
      milestone,
      yearMonth: milestone,
      isPaid,
      status,
      receiptNumber,
      receiptNo: receiptNumber,
      paidDate: isPaid ? (updates.paidDate || this.state.fees[idx].paidDate || updates.date || new Date().toISOString().split('T')[0]) : undefined,
      updatedAt: new Date().toISOString()
    };

    if (isPaid) {
      if (!this.state.alerts) this.state.alerts = [];
      this.state.alerts.forEach(a => {
        if (a.type === 'fee_due' && a.studentId === this.state.fees[idx].studentId) {
          a.isRead = true;
        }
      });
    }

    this.checkAndGenerateFeeAlerts();
    syncFeeToSupabase(this.state.fees[idx]);
    return this.state.fees[idx];
  }

  deleteFeeRecord(id: string) {
    const initialLen = this.state.fees.length;
    this.state.fees = this.state.fees.filter(f => String(f.id) !== String(id));
    this.checkAndGenerateFeeAlerts();
    deleteFeeFromSupabase(id);
    return this.state.fees.length < initialLen;
  }

  // Fee Due Alert Generator (Fires when 8 classes attendance are completed and no fee receipt is made)
  checkAndGenerateFeeAlerts() {
    if (!this.state.alerts) this.state.alerts = [];
    if (!this.state.students || !this.state.attendance) return;

    this.state.students.forEach(student => {
      // Get all 'Present' classes sorted chronologically
      const presentRecords = this.state.attendance
        .filter(a => a.studentId === student.id && a.status === 'Present')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const attendedCount = presentRecords.length;
      if (attendedCount < 8) return;

      const completedCycles = Math.floor(attendedCount / 8);
      const studentFees = this.state.fees.filter(f => f.studentId === student.id);

      for (let k = 1; k <= completedCycles; k++) {
        const cycleLabel = `Classes ${(k - 1) * 8 + 1} - ${k * 8}`;
        const eighthClassRecord = presentRecords[k * 8 - 1];
        const eighthClassDate = eighthClassRecord ? eighthClassRecord.date : '';

        // Check if there is a paid fee record for this cycle (or k-th paid record)
        const hasPaidReceipt = studentFees.some(f => f.isPaid && f.yearMonth === cycleLabel) ||
          (studentFees.filter(f => f.isPaid).length >= k);

        const alertId = `alt-fee-${student.id}-c${k}`;
        const existingAlertIdx = this.state.alerts.findIndex(
          a => a.id === alertId || (a.type === 'fee_due' && a.studentId === student.id && a.metadata?.cycle === k)
        );

        if (!hasPaidReceipt) {
          if (existingAlertIdx === -1) {
            const feeAlert: AdminAlert = {
              id: alertId,
              type: 'fee_due',
              title: `Fee Due: 8 Classes Completed (₹1,600)`,
              message: `${student.fullName} has completed 8 classes in sequence (${cycleLabel})${eighthClassDate ? ` on ${eighthClassDate}` : ''}. No fee receipt of ₹1,600 has been recorded. Please issue receipt.`,
              studentId: student.id,
              isRead: false,
              createdAt: eighthClassDate ? new Date(eighthClassDate + 'T18:00:00.000Z').toISOString() : new Date().toISOString(),
              metadata: {
                studentId: student.id,
                studentName: student.fullName,
                parentName: student.parentName,
                whatsappMobile: student.whatsappMobile,
                cycle: k,
                cycleLabel,
                amount: 1600,
                completedOn: eighthClassDate,
                attendedCount
              }
            };
            this.state.alerts.unshift(feeAlert);
            syncAlertToSupabase(feeAlert);
          }
        } else {
          // If paid, mark alert read if still unread
          if (existingAlertIdx !== -1 && !this.state.alerts[existingAlertIdx].isRead) {
            this.state.alerts[existingAlertIdx].isRead = true;
            syncAlertToSupabase(this.state.alerts[existingAlertIdx]);
          }
        }
      }
    });
  }

  // Progress Trackers
  getProgressTrackersByStudent(studentId: string) {
    return this.state.progressTrackers.filter(p => p.studentId === studentId);
  }

  saveProgressTracker(tracker: Omit<ProgressTracker, 'id' | 'createdAt'> & { id?: string }) {
    if (tracker.id) {
      const idx = this.state.progressTrackers.findIndex(p => p.id === tracker.id);
      if (idx !== -1) {
        this.state.progressTrackers[idx] = {
          ...this.state.progressTrackers[idx],
          ...tracker
        };
        syncProgressTrackerToSupabase(this.state.progressTrackers[idx]);
        return this.state.progressTrackers[idx];
      }
    }
    const newTracker: ProgressTracker = {
      ...tracker,
      id: tracker.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.state.progressTrackers.push(newTracker);
    syncProgressTrackerToSupabase(newTracker);
    return newTracker;
  }

  deleteProgressTracker(id: string) {
    this.state.progressTrackers = this.state.progressTrackers.filter(p => p.id !== id);
    deleteProgressTrackerFromSupabase(id);
    return true;
  }

  // Student Works (Camera captures & samples)
  getStudentWorks(studentId: string) {
    return this.state.studentWorks.filter(w => w.studentId === studentId);
  }

  saveStudentWork(work: Omit<StudentWorkImage, 'id' | 'createdAt'>) {
    const newWork: StudentWorkImage = {
      ...work,
      id: `work-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.state.studentWorks.push(newWork);
    syncStudentWorkToSupabase(newWork);
    return newWork;
  }

  deleteStudentWork(id: string) {
    this.state.studentWorks = this.state.studentWorks.filter(w => w.id !== id);
    deleteStudentWorkFromSupabase(id);
    return true;
  }

  // Progress Reports
  getProgressReports(studentId: string) {
    return this.state.progressReports.filter(r => r.studentId === studentId);
  }

  saveProgressReport(report: Omit<ProgressReport, 'id' | 'createdAt'> & { id?: string }) {
    if (report.id) {
      const idx = this.state.progressReports.findIndex(r => r.id === report.id);
      if (idx !== -1) {
        this.state.progressReports[idx] = {
          ...this.state.progressReports[idx],
          ...report
        };
        syncProgressReportToSupabase(this.state.progressReports[idx]);
        return this.state.progressReports[idx];
      }
    }
    const newReport: ProgressReport = {
      ...report,
      id: report.id || `rep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.state.progressReports.push(newReport);
    syncProgressReportToSupabase(newReport);
    return newReport;
  }

  deleteProgressReport(id: string) {
    this.state.progressReports = this.state.progressReports.filter(r => r.id !== id);
    deleteProgressReportFromSupabase(id);
    return true;
  }

  // Fee Reminders
  saveFeeReminder(reminder: Omit<FeeReminder, 'id' | 'sentDate'>) {
    const newRem: FeeReminder = {
      ...reminder,
      id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sentDate: new Date().toISOString()
    };
    this.state.feeReminders.push(newRem);
    syncFeeReminderToSupabase(newRem);
    return newRem;
  }

  getFeeReminders(studentId: string) {
    return this.state.feeReminders.filter(r => r.studentId === studentId);
  }

  // Demo Bookings
  getDemoBookings() {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    return [...this.state.demoBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createDemoBooking(bookingData: { studentName: string; age: string; contactNumber: string; preferredSlot: string; notes?: string }) {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    if (!this.state.alerts) this.state.alerts = [];

    const newBooking: DemoBooking = {
      id: `demo-${Date.now()}`,
      studentName: bookingData.studentName,
      age: bookingData.age,
      contactNumber: bookingData.contactNumber,
      preferredSlot: bookingData.preferredSlot,
      status: 'New',
      notes: bookingData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.demoBookings.unshift(newBooking);

    // Create Admin Alert
    const newAlert: AdminAlert = {
      id: `alt-${Date.now()}`,
      type: 'demo_booking',
      title: 'New Free Demo Class Booking',
      message: `${newBooking.studentName} (${newBooking.age}) booked preferred slot: ${newBooking.preferredSlot}. Phone: ${newBooking.contactNumber}`,
      demoBookingId: newBooking.id,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.state.alerts.unshift(newAlert);

    syncDemoBookingToSupabase(newBooking);
    syncAlertToSupabase(newAlert);
    return { booking: newBooking, alert: newAlert };
  }

  updateDemoBooking(id: string, updates: Partial<DemoBooking>) {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    const idx = this.state.demoBookings.findIndex(b => b.id === id);
    if (idx === -1) return null;

    this.state.demoBookings[idx] = {
      ...this.state.demoBookings[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    syncDemoBookingToSupabase(this.state.demoBookings[idx]);
    return this.state.demoBookings[idx];
  }

  deleteDemoBooking(id: string) {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    this.state.demoBookings = this.state.demoBookings.filter(b => b.id !== id);
    if (this.state.alerts) {
      this.state.alerts = this.state.alerts.filter(a => a.demoBookingId !== id);
    }
    deleteDemoBookingFromSupabase(id);
    deleteAlertFromSupabase(`alt-${id}`);
    return true;
  }

  // Alerts
  getAlerts() {
    if (!this.state.alerts) this.state.alerts = [];
    this.checkAndGenerateFeeAlerts();
    return [...this.state.alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  markAlertAsRead(id: string) {
    if (!this.state.alerts) this.state.alerts = [];
    const alert = this.state.alerts.find(a => a.id === id);
    if (alert) {
      alert.isRead = true;
      syncAlertToSupabase(alert);
      return alert;
    }
    return null;
  }

  markAllAlertsAsRead() {
    if (!this.state.alerts) this.state.alerts = [];
    this.state.alerts.forEach(a => { 
      a.isRead = true; 
      syncAlertToSupabase(a);
    });
    return true;
  }

  deleteAlert(id: string) {
    if (!this.state.alerts) this.state.alerts = [];
    this.state.alerts = this.state.alerts.filter(a => a.id !== id);
    deleteAlertFromSupabase(id);
    return true;
  }

  // Testimonials
  getTestimonials(studentId?: string, status?: string) {
    if (!this.state.testimonials) this.state.testimonials = [];
    let list = [...this.state.testimonials];
    if (studentId) {
      list = list.filter(t => t.studentId === studentId);
    }
    if (status) {
      list = list.filter(t => t.status === status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTestimonialById(id: string) {
    if (!this.state.testimonials) this.state.testimonials = [];
    return this.state.testimonials.find(t => t.id === id);
  }

  saveTestimonial(testimonyData: Omit<Testimonial, 'id' | 'createdAt'> & { id?: string }) {
    if (!this.state.testimonials) this.state.testimonials = [];
    if (!this.state.alerts) this.state.alerts = [];

    const newTestimonial: Testimonial = {
      ...testimonyData,
      id: testimonyData.id || `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: testimonyData.status || 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.state.testimonials.unshift(newTestimonial);

    // Create an Admin Alert
    const newAlert: AdminAlert = {
      id: `alt-${Date.now()}`,
      type: 'testimony',
      title: 'New Parent Testimony Added',
      message: `${newTestimonial.parentName} submitted a ${newTestimonial.rating}-star review for student ${newTestimonial.studentName}: "${newTestimonial.title || newTestimonial.review.substring(0, 40)}..."`,
      studentId: newTestimonial.studentId,
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: { testimonialId: newTestimonial.id, rating: newTestimonial.rating }
    };
    this.state.alerts.unshift(newAlert);

    syncTestimonialToSupabase(newTestimonial);
    syncAlertToSupabase(newAlert);
    return newTestimonial;
  }

  updateTestimonial(id: string, updates: Partial<Testimonial>) {
    if (!this.state.testimonials) this.state.testimonials = [];
    const idx = this.state.testimonials.findIndex(t => t.id === id);
    if (idx === -1) return null;

    this.state.testimonials[idx] = {
      ...this.state.testimonials[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    syncTestimonialToSupabase(this.state.testimonials[idx]);
    return this.state.testimonials[idx];
  }

  deleteTestimonial(id: string) {
    if (!this.state.testimonials) this.state.testimonials = [];
    this.state.testimonials = this.state.testimonials.filter(t => t.id !== id);
    deleteTestimonialFromSupabase(id);
    return true;
  }

  // Tool Audit Logging
  recordToolAuditLog(log: Omit<ToolAuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): ToolAuditLog {
    if (!this.state.toolAuditLogs) this.state.toolAuditLogs = [];

    const newLog: ToolAuditLog = {
      ...log,
      id: log.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || new Date().toISOString()
    };

    this.state.toolAuditLogs.unshift(newLog);
    // Keep max 1000 logs in storage
    if (this.state.toolAuditLogs.length > 1000) {
      this.state.toolAuditLogs = this.state.toolAuditLogs.slice(0, 1000);
    }
    syncAuditLogToSupabase(newLog);
    return newLog;
  }

  getToolAuditLogs(limit: number = 50, actorId?: string): ToolAuditLog[] {
    if (!this.state.toolAuditLogs) this.state.toolAuditLogs = [];
    let logs = [...this.state.toolAuditLogs];
    if (actorId) {
      logs = logs.filter(l => l.actorId === actorId || l.actorStudentId === actorId);
    }
    return logs.slice(0, limit);
  }

  getState(): DatabaseState {
    return this.state;
  }
}

export const db = new Database();
