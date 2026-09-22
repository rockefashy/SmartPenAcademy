/**
 * SmartPen Academy - Supabase Database Facade
 * 
 * Aggregates and re-exports all domain-specific database repositories under `server/db/`.
 * Provides 100% backwards compatibility for existing callers importing `{ db } from './supabaseDb'`.
 */

import {
  StudentProfile,
  AttendanceRecord,
  FeeRecord,
  ProgressTracker,
  StudentWorkImage,
  ProgressReport,
  FeeReminder,
  CoachProfile,
  DemoBooking,
  AdminAlert,
  Testimonial,
  ToolAuditLog
} from '../src/types';

import { PaginationParams } from './db/client.ts';
import { StoredUser, authDb } from './db/auth.db.ts';
import { studentsDb, normalizeToDayArray } from './db/students.db.ts';
import { coachesDb } from './db/coaches.db.ts';
import { attendanceDb } from './db/attendance.db.ts';
import { feesDb } from './db/fees.db.ts';
import { progressDb } from './db/progress.db.ts';
import { demoBookingsDb } from './db/demoBookings.db.ts';
import { alertsDb } from './db/alerts.db.ts';
import { testimonialsDb } from './db/testimonials.db.ts';
import { auditDb } from './db/audit.db.ts';

// Type re-exports for existing callers
export type { PaginationParams, StoredUser };
export { normalizeToDayArray };

// Domain repository re-exports for direct consumption
export {
  authDb,
  studentsDb,
  coachesDb,
  attendanceDb,
  feesDb,
  progressDb,
  demoBookingsDb,
  alertsDb,
  testimonialsDb,
  auditDb
};

/**
 * Unified Facade preserving complete method-level and type-level backwards compatibility.
 */
export class SupabaseDatabase {
  // ================= USERS & AUTH =================
  findUsersByIdentifier(loginIdentifier: string): Promise<StoredUser[]> {
    return authDb.findUsersByIdentifier(loginIdentifier);
  }
  findUserById(id: string): Promise<StoredUser | null> {
    return authDb.findUserById(id);
  }
  findUserByEmailOrUsername(identifier: string): Promise<StoredUser | null> {
    return authDb.findUserByEmailOrUsername(identifier);
  }
  findUserByUsername(username: string): Promise<StoredUser | null> {
    return authDb.findUserByUsername(username);
  }
  findUserByStudentId(studentId: string): Promise<StoredUser | null> {
    return authDb.findUserByStudentId(studentId);
  }
  getAdminUser(): Promise<StoredUser | null> {
    return authDb.getAdminUser();
  }
  getAdminEmail(): Promise<string | null> {
    return authDb.getAdminEmail();
  }
  changeUserPassword(
    email: string,
    currentPassword?: string,
    newPassword?: string,
    options?: { targetStudentId?: string; targetUserId?: string; applyToAll?: boolean }
  ): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    return authDb.changeUserPassword(email, currentPassword, newPassword, options);
  }
  createPasswordResetToken(email: string): Promise<{ token: string } | { error: string }> {
    return authDb.createPasswordResetToken(email);
  }
  getUserByResetToken(token: string): Promise<{ email: string } | null> {
    return authDb.getUserByResetToken(token);
  }
  resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; email?: string; error?: string }> {
    return authDb.resetPasswordWithToken(token, newPassword);
  }

  updateUserSelfProfile(userId: string, allowedUpdates: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; user?: StoredUser; error?: string }> {
    return authDb.updateUserSelfProfile(userId, allowedUpdates);
  }
  findUserTokenVersion(userId: string): Promise<number | null> {
    return authDb.findUserTokenVersion(userId);
  }
  checkRateLimit(
    key: string,
    maxCalls: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    return authDb.checkRateLimit(key, maxCalls, windowSeconds);
  }

  // ================= STUDENTS =================
  getSiblingStudentsForUser(user: { id?: string; email?: string; phoneNumber?: string; studentId?: string }): Promise<StudentProfile[]> {
    return studentsDb.getSiblingStudentsForUser(user);
  }
  getFamilyStudentsByEmailOrPhone(identifier: string): Promise<StudentProfile[]> {
    return studentsDb.getFamilyStudentsByEmailOrPhone(identifier);
  }
  getAllStudents(options?: PaginationParams & { searchQuery?: string }): Promise<StudentProfile[]> {
    return studentsDb.getAllStudents(options);
  }
  getStudentsCount(): Promise<number> {
    return studentsDb.getStudentsCount();
  }
  getStudentsByCoachId(coachId: string, alternateId?: string, options?: PaginationParams): Promise<StudentProfile[]> {
    return studentsDb.getStudentsByCoachId(coachId, alternateId, options);
  }
  getStudentsCountByCoachId(coachId: string, alternateId?: string): Promise<number> {
    return studentsDb.getStudentsCountByCoachId(coachId, alternateId);
  }
  getStudentById(id: string): Promise<StudentProfile | null> {
    return studentsDb.getStudentById(id);
  }
  checkStudentDuplicate(
    param1: string | { firstName?: string; lastName?: string; phoneNumber?: string; email?: string; age?: number },
    param2?: number | string,
    param3?: string,
    param4?: string
  ): Promise<boolean> {
    return studentsDb.checkStudentDuplicate(param1, param2, param3, param4);
  }
  createStudent(student: any): Promise<StudentProfile> {
    return studentsDb.createStudent(student);
  }
  updateStudent(id: string, updates: Partial<StudentProfile>): Promise<StudentProfile | null> {
    return studentsDb.updateStudent(id, updates);
  }
  deleteStudent(id: string): Promise<boolean> {
    return studentsDb.deleteStudent(id);
  }

  // ================= COACHES =================
  getAllCoaches(): Promise<CoachProfile[]> {
    return coachesDb.getAllCoaches();
  }
  getCoachById(id: string): Promise<CoachProfile | null> {
    return coachesDb.getCoachById(id);
  }
  createCoach(data: {
    firstName?: string;
    lastName?: string;
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
    return coachesDb.createCoach(data);
  }
  updateCoach(id: string, updates: {
    firstName?: string;
    lastName?: string;
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
    return coachesDb.updateCoach(id, updates);
  }
  deleteCoach(id: string): Promise<boolean> {
    return coachesDb.deleteCoach(id);
  }
  assignCoachToStudent(
    studentId: string,
    coachId: string | null
  ): Promise<(StudentProfile & { assignmentChanged: boolean }) | null> {
    return studentsDb.assignCoachToStudent(studentId, coachId);
  }

  // ================= ATTENDANCE =================
  getAttendanceByMonth(
    yearMonth: string,
    options?: PaginationParams & { studentIds?: string[] }
  ): Promise<AttendanceRecord[]> {
    return attendanceDb.getAttendanceByMonth(yearMonth, options);
  }
  getAttendanceByStudent(studentId: string, options?: PaginationParams): Promise<AttendanceRecord[]> {
    return attendanceDb.getAttendanceByStudent(studentId, options);
  }
  saveAttendanceBatch(records: AttendanceRecord[]): Promise<AttendanceRecord[]> {
    return attendanceDb.saveAttendanceBatch(records);
  }
  findAttendanceById(id: string): Promise<AttendanceRecord | null> {
    return attendanceDb.findAttendanceById(id);
  }
  deleteAttendance(id: string): Promise<void> {
    return attendanceDb.deleteAttendance(id);
  }
  getAttendanceCountByMonth(yearMonth: string, studentIds?: string[]): Promise<number> {
    return attendanceDb.getAttendanceCountByMonth(yearMonth, studentIds);
  }
  getAttendanceCountByStudent(studentId: string): Promise<number> {
    return attendanceDb.getAttendanceCountByStudent(studentId);
  }

  // ================= FEES =================
  getFeesByMonth(
    yearMonth: string,
    options?: PaginationParams & { studentIds?: string[] }
  ): Promise<FeeRecord[]> {
    return feesDb.getFeesByMonth(yearMonth, options);
  }
  getFeesByStudent(studentId: string, options?: PaginationParams): Promise<FeeRecord[]> {
    return feesDb.getFeesByStudent(studentId, options);
  }
  findFeeById(id: string): Promise<FeeRecord | null> {
    return feesDb.findFeeById(id);
  }
  saveFeeRecord(fee: Partial<FeeRecord>): Promise<FeeRecord> {
    return feesDb.saveFeeRecord(fee);
  }
  updateFeeRecord(id: string, updates: Partial<FeeRecord>): Promise<FeeRecord | null> {
    return feesDb.updateFeeRecord(id, updates);
  }
  deleteFeeRecord(id: string): Promise<boolean> {
    return feesDb.deleteFeeRecord(id);
  }
  voidFeeRecord(id: string, reason?: string): Promise<FeeRecord | null> {
    return feesDb.voidFeeRecord(id, reason);
  }
  saveFeeReminder(reminder: Partial<FeeReminder>): Promise<FeeReminder> {
    return feesDb.saveFeeReminder(reminder);
  }
  getFeesCountByMonth(yearMonth: string, studentIds?: string[]): Promise<number> {
    return feesDb.getFeesCountByMonth(yearMonth, studentIds);
  }
  getFeesCountByStudent(studentId: string): Promise<number> {
    return feesDb.getFeesCountByStudent(studentId);
  }

  // ================= PROGRESS & WORKS =================
  getProgressTrackersByStudent(studentId: string): Promise<ProgressTracker[]> {
    return progressDb.getProgressTrackersByStudent(studentId);
  }
  saveProgressTracker(tracker: Partial<ProgressTracker>): Promise<ProgressTracker> {
    return progressDb.saveProgressTracker(tracker);
  }
  findProgressTrackerById(id: string): Promise<ProgressTracker | null> {
    return progressDb.findProgressTrackerById(id);
  }
  deleteProgressTracker(id: string): Promise<void> {
    return progressDb.deleteProgressTracker(id);
  }
  getStudentWorks(studentId: string): Promise<StudentWorkImage[]> {
    return progressDb.getStudentWorks(studentId);
  }
  saveStudentWork(work: Partial<StudentWorkImage>): Promise<StudentWorkImage> {
    return progressDb.saveStudentWork(work);
  }
  findStudentWorkById(id: string): Promise<StudentWorkImage | null> {
    return progressDb.findStudentWorkById(id);
  }
  deleteStudentWork(id: string): Promise<void> {
    return progressDb.deleteStudentWork(id);
  }
  getProgressReports(studentId: string): Promise<ProgressReport[]> {
    return progressDb.getProgressReports(studentId);
  }
  saveProgressReport(report: Partial<ProgressReport>): Promise<ProgressReport> {
    return progressDb.saveProgressReport(report);
  }
  findProgressReportById(id: string): Promise<ProgressReport | null> {
    return progressDb.findProgressReportById(id);
  }
  deleteProgressReport(id: string): Promise<void> {
    return progressDb.deleteProgressReport(id);
  }

  // ================= DEMO BOOKINGS =================
  getDemoBookings(): Promise<DemoBooking[]> {
    return demoBookingsDb.getDemoBookings();
  }
  createDemoBooking(booking: any): Promise<{ booking: DemoBooking; alert: AdminAlert }> {
    return demoBookingsDb.createDemoBooking(booking);
  }
  updateDemoBooking(id: string, updates: Partial<DemoBooking>): Promise<DemoBooking | null> {
    return demoBookingsDb.updateDemoBooking(id, updates);
  }
  deleteDemoBooking(id: string): Promise<void> {
    return demoBookingsDb.deleteDemoBooking(id);
  }

  // ================= ADMIN ALERTS =================
  getAlerts(): Promise<AdminAlert[]> {
    return alertsDb.getAlerts();
  }
  markAlertAsRead(id: string): Promise<AdminAlert | null> {
    return alertsDb.markAlertAsRead(id);
  }
  markAllAlertsAsRead(): Promise<void> {
    return alertsDb.markAllAlertsAsRead();
  }
  deleteAlert(id: string): Promise<void> {
    return alertsDb.deleteAlert(id);
  }

  // ================= TESTIMONIALS =================
  getTestimonials(studentId?: string, status?: string | string[]): Promise<Testimonial[]> {
    return testimonialsDb.getTestimonials(studentId, status);
  }
  saveTestimonial(testimonial: Partial<Testimonial>): Promise<Testimonial> {
    return testimonialsDb.saveTestimonial(testimonial);
  }
  updateTestimonial(id: string, updates: Partial<Testimonial>): Promise<Testimonial | null> {
    return testimonialsDb.updateTestimonial(id, updates);
  }
  deleteTestimonial(id: string): Promise<void> {
    return testimonialsDb.deleteTestimonial(id);
  }

  // ================= TOOL AUDIT LOGS =================
  recordToolAuditLog(log: any): Promise<ToolAuditLog> {
    return auditDb.recordToolAuditLog(log);
  }
  getToolAuditLogs(options?: { page?: number; limit?: number } | number): Promise<ToolAuditLog[]> {
    return auditDb.getToolAuditLogs(options);
  }
  getToolAuditLogsCount(): Promise<number> {
    return auditDb.getToolAuditLogsCount();
  }
}

export const db = new SupabaseDatabase();
