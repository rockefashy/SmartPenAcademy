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
  Testimonial
} from '../types';
import { supabaseAuthService } from './supabaseAuthService';

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('smartpen_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth (Supabase Auth first with server fallback)
  async login(credentials: { username: string; password: string; role?: string }): Promise<{ token: string; user: User }> {
    // 1. Try Supabase Auth if enabled
    if (supabaseAuthService.isEnabled()) {
      try {
        const result = await supabaseAuthService.signIn(credentials.username, credentials.password);
        if (result) {
          return result;
        }
      } catch (err: any) {
        console.warn('[API Auth] Supabase auth attempt:', err.message);
        // If it was an explicit invalid credential error from Supabase, propagate or fallback
        if (err.message && (err.message.includes('Invalid login credentials') || err.message.includes('Email not confirmed'))) {
          // Check backend fallback in case it's a mock/legacy user
        }
      }
    }

    // 2. Server JWT Auth Fallback
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Authentication failed');
    }
    return res.json();
  },

  async logout(): Promise<{ success: boolean }> {
    if (supabaseAuthService.isEnabled()) {
      await supabaseAuthService.signOut().catch(() => {});
    }
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    }).catch(() => ({ ok: true }));
    return { success: true };
  },

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string; email?: string }> {
    if (supabaseAuthService.isEnabled() && identifier.includes('@')) {
      try {
        await supabaseAuthService.resetPassword(identifier.trim());
        return {
          success: true,
          message: `Password reset link has been dispatched to ${identifier.trim()}`,
          email: identifier.trim()
        };
      } catch (e: any) {
        console.warn('[API Auth] Supabase password reset error:', e.message);
      }
    }

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Account not found');
    }
    return res.json();
  },

  // Students
  async getStudents(): Promise<StudentProfile[]> {
    const res = await fetch('/api/students', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch students');
    return res.json();
  },

  async getStudent(id: string): Promise<StudentProfile> {
    const res = await fetch(`/api/students/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Student not found');
    return res.json();
  },

  async enrollStudent(profileData: Partial<StudentProfile>): Promise<{ student: StudentProfile; credentials: any }> {
    const res = await fetch('/api/students/enroll', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to enroll student');
    }
    return res.json();
  },

  async updateStudent(id: string, updates: Partial<StudentProfile>): Promise<StudentProfile> {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update student profile');
    }
    return res.json();
  },

  // Attendance
  async getAttendanceByMonth(yearMonth: string): Promise<AttendanceRecord[]> {
    const res = await fetch(`/api/attendance/month/${yearMonth}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch attendance');
    return res.json();
  },

  async getAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]> {
    const res = await fetch(`/api/attendance/student/${studentId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch student attendance');
    return res.json();
  },

  async addAttendance(studentId: string, data: { date: string; status: 'Present' | 'Absent'; notes?: string }): Promise<AttendanceRecord> {
    const yearMonth = data.date.slice(0, 7);
    const res = await fetch('/api/attendance/batch', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        records: [
          {
            studentId,
            date: data.date,
            yearMonth,
            status: data.status,
            notes: data.notes || '',
          }
        ]
      }),
    });
    if (!res.ok) throw new Error('Failed to record attendance');
    return {
      id: `att_${Date.now()}`,
      studentId,
      date: data.date,
      yearMonth,
      status: data.status,
      notes: data.notes || '',
    };
  },

  async saveAttendanceBatch(records: Omit<AttendanceRecord, 'id'>[]): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/attendance/batch', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error('Failed to save attendance batch');
    return res.json();
  },

  async deleteAttendance(studentId: string, date: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/attendance/${studentId}/${date}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete attendance record');
    return res.json();
  },

  // Fees
  async getFeesByMonth(yearMonth: string): Promise<FeeRecord[]> {
    const res = await fetch(`/api/fees/month/${yearMonth}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch fees');
    return res.json();
  },

  async getFeesByStudent(studentId: string): Promise<FeeRecord[]> {
    const res = await fetch(`/api/fees/student/${studentId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch student fees');
    return res.json();
  },

  async saveFee(fee: Partial<FeeRecord>): Promise<FeeRecord> {
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(fee),
    });
    if (!res.ok) throw new Error('Failed to save fee record');
    return res.json();
  },

  async updateFee(id: string, updates: Partial<FeeRecord>): Promise<FeeRecord> {
    const res = await fetch(`/api/fees/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update fee record');
    }
    return res.json();
  },

  async deleteFee(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/fees/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete fee record');
    }
    return res.json();
  },

  async sendWhatsAppReminder(data: {
    studentId: string;
    parentPhone: string;
    parentName: string;
    studentName: string;
    amount: number;
    milestone: string;
    receiptNumber?: string;
  }): Promise<{ success: boolean; message: string; messageText: string; whatsappUrl: string; reminder: FeeReminder }> {
    const res = await fetch('/api/reminders/whatsapp', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to send WhatsApp reminder');
    }
    return res.json();
  },

  async addFeeRecord(studentId: string, feeData: { period: string; amount: number; dueDate?: string; paidDate?: string; status?: 'Paid' | 'Pending'; paymentMethod?: string }): Promise<FeeRecord> {
    const isPaid = feeData.status === 'Paid';
    const payload: Partial<FeeRecord> = {
      studentId,
      yearMonth: feeData.period,
      amount: feeData.amount,
      isPaid,
      paidDate: feeData.paidDate || (isPaid ? new Date().toISOString().split('T')[0] : undefined),
      paymentMethod: feeData.paymentMethod || 'Cash / In-Person Reception',
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
    };
    return this.saveFee(payload);
  },

  exportStudentsCSV(students: StudentProfile[]): string {
    const headers = ['ID', 'Full Name', 'Parent Name', 'WhatsApp Mobile', 'Email', 'Grade', 'School', 'Dominant Hand', 'Grip Type', 'Batch Days', 'Time Slot', 'Status', 'Enrollment Date'];
    const rows = students.map((s) => [
      `"${s.id}"`,
      `"${s.fullName.replace(/"/g, '""')}"`,
      `"${s.parentName.replace(/"/g, '""')}"`,
      `"${s.whatsappMobile}"`,
      `"${s.email}"`,
      `"${s.gradeClass}"`,
      `"${s.schoolName.replace(/"/g, '""')}"`,
      `"${s.dominantHand}"`,
      `"${s.gripClassification || 'Tripod'}"`,
      `"${s.preferredDays}"`,
      `"${s.preferredSlot}"`,
      `"${s.status}"`,
      `"${s.enrollmentDate}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  // Progress Trackers
  async getProgressTrackers(studentId: string): Promise<ProgressTracker[]> {
    const res = await fetch(`/api/progress-trackers/student/${studentId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch progress trackers');
    return res.json();
  },

  async saveProgressTracker(tracker: Partial<ProgressTracker>): Promise<ProgressTracker> {
    const res = await fetch('/api/progress-trackers', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(tracker),
    });
    if (!res.ok) throw new Error('Failed to save progress tracker');
    return res.json();
  },

  async deleteProgressTracker(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/progress-trackers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete progress tracker');
    return res.json();
  },

  // Student Works & Camera Uploads
  async getStudentWorks(studentId: string): Promise<StudentWorkImage[]> {
    const res = await fetch(`/api/student-works/student/${studentId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch student works');
    return res.json();
  },

  async uploadStudentWork(data: {
    studentId: string;
    imageData: string;
    captureDate: string;
    comments: string;
    category?: string;
  }): Promise<StudentWorkImage> {
    const res = await fetch('/api/student-works/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to upload student work');
    return res.json();
  },

  async deleteStudentWork(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/student-works/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete student work');
    return res.json();
  },

  // Progress Reports
  async getProgressReports(studentId: string): Promise<ProgressReport[]> {
    const res = await fetch(`/api/reports/student/${studentId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch progress reports');
    return res.json();
  },

  async generateProgressReport(reportData: Partial<ProgressReport>): Promise<ProgressReport> {
    const res = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(reportData),
    });
    if (!res.ok) throw new Error('Failed to generate progress report');
    return res.json();
  },

  async deleteProgressReport(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete progress report');
    return res.json();
  },

  async emailProgressReport(reportId: string, payload: { parentEmail: string; studentEmail?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/reports/${reportId}/email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to email progress report');
    return res.json();
  },

  // Fee Reminders
  async sendFeeReminder(data: {
    studentId: string;
    parentEmail: string;
    parentName: string;
    studentName: string;
    amount: number;
    month: string;
    gpayLink?: string;
  }): Promise<{ success: boolean; message: string; reminder: FeeReminder }> {
    const res = await fetch('/api/reminders/send', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send fee reminder');
    return res.json();
  },

  // Free Demo Class Bookings
  async getDemoBookings(): Promise<DemoBooking[]> {
    const res = await fetch('/api/demo-bookings', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch demo bookings');
    return res.json();
  },

  async createDemoBooking(data: {
    studentName: string;
    age: string;
    contactNumber: string;
    preferredSlot: string;
    notes?: string;
  }): Promise<DemoBooking> {
    const res = await fetch('/api/demo-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create demo booking' }));
      throw new Error(err.error || 'Failed to submit demo booking');
    }
    return res.json();
  },

  async updateDemoBooking(id: string, updates: Partial<DemoBooking>): Promise<DemoBooking> {
    const res = await fetch(`/api/demo-bookings/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update demo booking');
    return res.json();
  },

  async deleteDemoBooking(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/demo-bookings/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete demo booking');
    return res.json();
  },

  // Admin Alerts
  async getAlerts(): Promise<AdminAlert[]> {
    const res = await fetch('/api/alerts', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async markAlertRead(id: string): Promise<AdminAlert> {
    const res = await fetch(`/api/alerts/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark alert as read');
    return res.json();
  },

  async markAllAlertsRead(): Promise<{ success: boolean }> {
    const res = await fetch('/api/alerts/mark-all-read', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark all alerts as read');
    return res.json();
  },

  async deleteAlert(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete alert');
    return res.json();
  },

  // Testimonials
  async getTestimonials(studentId?: string, status?: string): Promise<Testimonial[]> {
    const params = new URLSearchParams();
    if (studentId) params.append('studentId', studentId);
    if (status) params.append('status', status);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/testimonials${queryStr}`);
    if (!res.ok) throw new Error('Failed to fetch testimonials');
    return res.json();
  },

  async getTestimonialsByStudent(studentId: string): Promise<Testimonial[]> {
    const res = await fetch(`/api/testimonials/student/${studentId}`);
    if (!res.ok) throw new Error('Failed to fetch student testimonials');
    return res.json();
  },

  async submitTestimonial(testimonyData: Partial<Testimonial>): Promise<Testimonial> {
    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testimonyData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit testimony');
    }
    return res.json();
  },

  async updateTestimonial(id: string, updates: Partial<Testimonial>): Promise<Testimonial> {
    const res = await fetch(`/api/testimonials/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update testimonial');
    return res.json();
  },

  async deleteTestimonial(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/testimonials/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete testimonial');
    return res.json();
  },

  // AI Agent Chat
  async sendAIChat(
    messages: { role: string; content: string }[],
    settings?: { apiKey?: string; apiUrl?: string; model?: string; temperature?: number }
  ): Promise<{ reply: string; toolResults: any[] }> {
    const res = await fetch('/api/ai/agent-chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ messages, settings })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to communicate with AI Assistant');
    }
    return res.json();
  },

  async testAIConfig(config: { apiKey?: string; model?: string; apiUrl?: string }): Promise<{ success: boolean; message: string; mode?: string }> {
    const res = await fetch('/api/ai/test-config', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to verify configuration');
    return res.json();
  },

  async getToolAuditLogs(limit: number = 50): Promise<any[]> {
    const res = await fetch(`/api/ai/audit-logs?limit=${limit}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch tool audit logs');
    return res.json();
  }
};
