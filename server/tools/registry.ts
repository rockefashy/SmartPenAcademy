import { FunctionDeclaration } from '@google/genai';
import { AgentTool } from './types.ts';

// 1. Core Original Tools
import { updateAttendanceTool } from './updateAttendance.ts';
import { getAttendanceTool } from './getAttendance.ts';
import { getFeeStatusTool } from './getFeeStatus.ts';
import { recordFeePaymentTool } from './recordFeePayment.ts';
import { sendFeeReminderTool } from './sendFeeReminder.ts';
import { getStudentProfileTool } from './getStudentProfile.ts';
import { listStudentsTool } from './listStudents.ts';
import { getAdminAlertsTool } from './getAdminAlerts.ts';
import { getDemoBookingsTool } from './getDemoBookings.ts';
import { generateProgressReportTool } from './generateProgressReport.ts';
import { getCurriculumTool } from './getCurriculum.ts';
import { getAboutUsTool } from './getAboutUs.ts';
import { getTestimonialsTool } from './getTestimonials.ts';
import { bookDemoClassTool } from './bookDemoClass.ts';
import { navigateToPageTool } from './navigateToPage.ts';

// 2. Category 3 Operational & Parity Tools (No-Gate Batch)
import { viewOwnWorkSamplesTool } from './viewOwnWorkSamples.ts';
import { viewOwnProgressReportsTool } from './viewOwnProgressReports.ts';
import { viewOwnTestimonialsTool } from './viewOwnTestimonials.ts';
import { submitTestimonialTool } from './submitTestimonial.ts';
import { switchActiveSiblingTool } from './switchActiveSibling.ts';
import { listCoachesTool } from './listCoaches.ts';
import { editCoachProfileTool } from './editCoachProfile.ts';
import { updateStudentProfileTool } from './updateStudentProfile.ts';
import { uploadStudentWorkTool } from './uploadStudentWork.ts';
import { saveProgressTrackerTool } from './saveProgressTracker.ts';
import { getAuditLogsTool } from './getAuditLogs.ts';
import { updateDemoBookingTool } from './updateDemoBooking.ts';
import { markAlertReadTool } from './markAlertRead.ts';
import { markAllAlertsReadTool } from './markAllAlertsRead.ts';
import { moderateTestimonialTool } from './moderateTestimonial.ts';
import { assignCoachToStudentTool } from './assignCoachToStudent.ts';
import { enrollStudentTool } from './enrollStudent.ts';
import { deactivateStudentTool } from './deactivateStudent.ts';
import { deactivateCoachTool } from './deactivateCoach.ts';
import { updateFeeStatusTool } from './updateFeeStatus.ts';
import { deleteAttendanceRecordTool } from './deleteAttendanceRecord.ts';
import { bulkDeleteStudentWorksTool } from './bulkDeleteStudentWorks.ts';
import { explainStudentStatusTool } from './explainStudentStatus.ts';
import { getOverdueFeeSummaryTool } from './getOverdueFeeSummary.ts';
import { getCoachWorkloadSummaryTool } from './getCoachWorkloadSummary.ts';
import { getAttendanceRiskStudentsTool } from './getAttendanceRiskStudents.ts';




// 3. Parameterized Staff Inspection Tools (Admin / Coach equivalents with Filter-or-Limit)
import { getStudentWorkSamplesTool } from './getStudentWorkSamples.ts';
import { getStudentProgressReportsTool } from './getStudentProgressReports.ts';
import { getAdminTestimonialsTool } from './getAdminTestimonials.ts';

// Central Registry Map containing all 33 AgentTools
export const toolRegistry: Record<string, AgentTool> = {
  // Core Tools
  updateAttendance: updateAttendanceTool,
  getAttendance: getAttendanceTool,
  getFeeStatus: getFeeStatusTool,
  recordFeePayment: recordFeePaymentTool,
  sendFeeReminder: sendFeeReminderTool,
  getStudentProfile: getStudentProfileTool,
  listStudents: listStudentsTool,
  getAdminAlerts: getAdminAlertsTool,
  getDemoBookings: getDemoBookingsTool,
  generateProgressReport: generateProgressReportTool,
  getCurriculum: getCurriculumTool,
  getAboutUs: getAboutUsTool,
  getTestimonials: getTestimonialsTool,
  bookDemoClass: bookDemoClassTool,
  navigateToPage: navigateToPageTool,

  // Category 3 (No-Gate) Self-Service Student Tools (Strictly Self-Service, no Admin bypass)
  viewOwnWorkSamples: viewOwnWorkSamplesTool,
  viewOwnProgressReports: viewOwnProgressReportsTool,
  viewOwnTestimonials: viewOwnTestimonialsTool,
  submitTestimonial: submitTestimonialTool,
  switchActiveSibling: switchActiveSiblingTool,

  // Staff & Administrative Operational Tools
  listCoaches: listCoachesTool,
  editCoachProfile: editCoachProfileTool,
  updateStudentProfile: updateStudentProfileTool,
  uploadStudentWork: uploadStudentWorkTool,
  saveProgressTracker: saveProgressTrackerTool,
  getAuditLogs: getAuditLogsTool,
  updateDemoBooking: updateDemoBookingTool,
  markAlertRead: markAlertReadTool,
  markAllAlertsRead: markAllAlertsReadTool,
  moderateTestimonial: moderateTestimonialTool,
  assignCoachToStudent: assignCoachToStudentTool,
  enrollStudent: enrollStudentTool,
  deactivateStudent: deactivateStudentTool,
  deactivateCoach: deactivateCoachTool,
  updateFeeStatus: updateFeeStatusTool,
  deleteAttendanceRecord: deleteAttendanceRecordTool,
  bulkDeleteStudentWorks: bulkDeleteStudentWorksTool,

  // Category 1 Inspection & Analytical Reporting Tools
  explainStudentStatus: explainStudentStatusTool,
  getOverdueFeeSummary: getOverdueFeeSummaryTool,
  getCoachWorkloadSummary: getCoachWorkloadSummaryTool,
  getAttendanceRiskStudents: getAttendanceRiskStudentsTool,

  // Parameterized Staff Inspection Tools
  getStudentWorkSamples: getStudentWorkSamplesTool,
  getStudentProgressReports: getStudentProgressReportsTool,
  getAdminTestimonials: getAdminTestimonialsTool,
};

/**
 * Single DRY filter for role-based tool availability.
 * - Public tools (!t.allowedRoles) are available to everyone.
 * - Self-service tools (t.selfServiceOnly) are restricted strictly to declared roles (no admin bypass).
 * - Admin has unrestricted access to all non-selfService tools.
 * - Other roles receive only tools where their role is explicitly allowed.
 */
export function getToolsForRole(role?: string): FunctionDeclaration[] {
  return Object.values(toolRegistry)
    .filter(t => {
      // Public tools (no allowedRoles defined)
      if (!t.allowedRoles || t.allowedRoles.length === 0) return true;
      if (!role) return false;

      // Self-service only tools (e.g. personal student identity tools): admin bypass does NOT apply
      if (t.selfServiceOnly) {
        return t.allowedRoles.includes(role as any);
      }

      // Admin has unrestricted access to all general/staff operational tools
      if (role === 'admin') return true;

      // Other roles must match declared allowedRoles
      return t.allowedRoles.includes(role as any);
    })
    .map(t => t.declaration);
}

export const ALL_TOOLS = Object.values(toolRegistry).map(t => t.declaration);
export const PUBLIC_TOOLS = Object.values(toolRegistry)
  .filter(t => !t.allowedRoles || t.allowedRoles.length === 0)
  .map(t => t.declaration);
