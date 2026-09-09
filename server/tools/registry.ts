import { FunctionDeclaration } from '@google/genai';
import { AgentTool } from './types.ts';
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

// Central Registry Map containing all 15 fully-migrated AgentTools
export const toolRegistry: Record<string, AgentTool> = {
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
};

/**
 * Single DRY filter for role-based tool availability.
 * - Public tools (!t.allowedRoles) are available to everyone.
 * - Admin has unrestricted access to all registered tools.
 * - Other roles receive only tools where their role is explicitly allowed.
 */
export function getToolsForRole(role?: string): FunctionDeclaration[] {
  return Object.values(toolRegistry)
    .filter(t => !t.allowedRoles || t.allowedRoles.length === 0 || Boolean(role && (role === 'admin' || t.allowedRoles.includes(role as any))))
    .map(t => t.declaration);
}

export const ALL_TOOLS = Object.values(toolRegistry).map(t => t.declaration);
export const PUBLIC_TOOLS = Object.values(toolRegistry)
  .filter(t => !t.allowedRoles || t.allowedRoles.length === 0)
  .map(t => t.declaration);
