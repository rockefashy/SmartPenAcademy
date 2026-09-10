import { 
  StudentProfile, 
  AttendanceRecord, 
  FeeRecord, 
  ProgressTracker, 
  StudentWorkImage, 
  ProgressReport, 
  FeeReminder,
  User,
  CoachProfile,
  DemoBooking,
  AdminAlert,
  Testimonial,
  LoginResponse
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
  // Auth
  async login(credentials: { email?: string; username?: string; identifier?: string; password: string; role?: string }): Promise<LoginResponse> {
    const loginIdentifier = credentials.identifier || credentials.email || credentials.username || '';
    
    // Server JWT Auth (supports email, username, or phone + multi-account resolution + httpOnly cookie)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        identifier: loginIdentifier,
        email: loginIdentifier,
        password: credentials.password,
        role: credentials.role
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Authentication failed' }));
      throw new Error(err.error || 'Authentication failed');
    }
    return res.json();
  },

  async selectRole(payload: { selectionToken: string; selectedRole: string }): Promise<LoginResponse> {
    const res = await fetch('/api/auth/select-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Role selection failed' }));
      throw new Error(err.error || 'Role selection failed');
    }
    return res.json();
  },

  async selectStudent(payload: { selectionToken: string; selectedUserId: string }): Promise<{ token: string; user: User }> {
    const res = await fetch('/api/auth/select-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Student selection failed' }));
      throw new Error(err.error || 'Student selection failed');
    }
    return res.json();
  },

  async switchStudent(studentId: string): Promise<{ token: string; user: User }> {
    const res = await fetch('/api/auth/switch-student', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ studentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to switch student' }));
      throw new Error(err.error || 'Failed to switch student');
    }
    return res.json();
  },

  async changePassword(data: {
    email: string;
    currentPassword?: string;
    newPassword: string;
    targetStudentId?: string;
    targetUserId?: string;
    applyToAll?: boolean;
  }): Promise<{ success: boolean; message: string; loggedOut?: boolean }> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update password' }));
      throw new Error(err.error || 'Failed to update password');
    }
    return res.json();
  },

  async getFamilyStudents(identifier: string): Promise<{
    students: Array<{
      id: string;
      studentId: string;
      userId?: string;
      displayName: string;
      age?: number;
      gradeClass?: string;
      schoolName?: string;
    }>;
  }> {
    const res = await fetch('/api/auth/family-students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!res.ok) {
      return { students: [] };
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

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string; email?: string; resetToken?: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Account not found' }));
      throw new Error(err.error || 'Account not found');
    }
    return res.json();
  },

  async resetPasswordWithToken(data: { token: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Password reset failed' }));
      throw new Error(err.error || 'Password reset failed');
    }
    return res.json();
  },

  // Coaches API
  async getPublicCoaches(): Promise<Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    designation: string;
    specializations: string[];
    educationalQualification?: string;
    status: string;
  }>> {
    const res = await fetch('/api/coaches/public');
    if (!res.ok) throw new Error('Failed to fetch public coaches');
    return res.json();
  },

  async getCoaches(): Promise<CoachProfile[]> {
    const res = await fetch('/api/coaches', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch coaches');
    return res.json();
  },

  async updateMyProfile(data: {
    displayName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; message?: string; user?: any }> {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update profile' }));
      throw new Error(err.error || 'Failed to update profile');
    }
    return res.json();
  },

  async createCoach(data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email: string;
    phoneNumber: string;
    address?: string;
    dateOfJoining?: string;
    status?: 'Active' | 'Inactive';
    dateOfLeaving?: string;
    educationalQualification?: string;
    designation?: string;
    specializations?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    password?: string;
  }): Promise<CoachProfile> {
    const res = await fetch('/api/coaches', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create coach' }));
      throw new Error(err.error || 'Failed to create coach');
    }
    return res.json();
  },

  async updateCoach(id: string, updates: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    dateOfJoining?: string;
    status?: 'Active' | 'Inactive';
    dateOfLeaving?: string;
    educationalQualification?: string;
    designation?: string;
    specializations?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    password?: string;
  }): Promise<CoachProfile> {
    const res = await fetch(`/api/coaches/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update coach' }));
      throw new Error(err.error || 'Failed to update coach');
    }
    return res.json();
  },

  async deleteCoach(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/coaches/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete coach' }));
      throw new Error(err.error || 'Failed to delete coach');
    }
    return res.json();
  },

  async assignCoachToStudent(studentId: string, coachId: string | null): Promise<StudentProfile> {
    const res = await fetch(`/api/students/${studentId}/assign-coach`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ coachId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to assign coach' }));
      throw new Error(err.error || 'Failed to assign coach');
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

  async deleteStudent(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/students/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete student profile');
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

  async deleteAttendance(idOrStudentId: string, date?: string): Promise<{ success: boolean }> {
    const url = date 
      ? `/api/attendance/${encodeURIComponent(idOrStudentId)}/${encodeURIComponent(date)}`
      : `/api/attendance/${encodeURIComponent(idOrStudentId)}`;
    const res = await fetch(url, {
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

  async addFeeRecord(studentId: string, feeData: { period: string; amount: number; dueDate?: string; paidDate?: string; status?: 'Paid' | 'Pending' | 'Overdue'; paymentMethod?: string }): Promise<FeeRecord> {
    const status: 'Paid' | 'Pending' | 'Overdue' = feeData.status || 'Pending';
    const isPaid = status === 'Paid';
    const payload: Partial<FeeRecord> = {
      studentId,
      yearMonth: feeData.period,
      amount: feeData.amount,
      status,
      paidDate: feeData.paidDate || (isPaid ? new Date().toISOString().split('T')[0] : undefined),
      paymentMethod: feeData.paymentMethod || 'Cash / In-Person Reception',
    };
    return this.saveFee(payload);
  },

  exportStudentsCSV(students: StudentProfile[]): string {
    const headers = ['ID', 'Full Name', 'Parent Name', 'WhatsApp Mobile', 'Email', 'Grade', 'School', 'Dominant Hand', 'Grip Type', 'Batch Days', 'Time Slot', 'Status', 'Enrollment Date'];
    const rows = students.map((s) => [
      `"${s.id}"`,
      `"${s.displayName.replace(/"/g, '""')}"`,
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload student work');
    }
    return res.json();
  },

  async deleteStudentWork(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/student-works/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete student work');
    }
    return res.json();
  },

  async bulkDeleteStudentWorks(ids: string[]): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/student-works/bulk-delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to bulk delete student works');
    }
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
    parentName: string;
    age: string;
    contactNumber: string;
    preferredDate: string;
    preferredTimeSlot: string;
    modeOfLearning?: 'In-person' | 'Online';
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete demo booking');
    }
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
