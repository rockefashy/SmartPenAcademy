import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { db } from '../supabaseDb.ts';
import { StudentProfile } from '../../src/types.ts';

export const getFeeStatusDeclaration: FunctionDeclaration = {
  name: 'getFeeStatus',
  description: 'Check fee payment status, 8-class cycle receipts, due alerts, and GPAY payment link (8861751000).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of student to check fee status for.'
      }
    }
  }
};

export const getFeeStatusTool: AgentTool = {
  name: 'getFeeStatus',
  declaration: getFeeStatusDeclaration,
  allowedRoles: ['admin', 'coach', 'student'],
  accessDeniedMessage: 'Access Denied: Only authenticated users can view fee statuses.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    let student: StudentProfile | undefined;

    if (user?.role === 'student') {
      if (!user.studentId) {
        return {
          result: null,
          summary: 'Access Denied: No student ID linked to your student account.',
          success: false
        };
      }
      student = await db.getStudentById(user.studentId);
      if (args?.studentNameOrId) {
        const requestedStudent = await findStudent(args.studentNameOrId);
        if (requestedStudent && requestedStudent.id !== user.studentId) {
          return {
            result: null,
            summary: 'Privacy Policy: Student accounts can only view their own fee receipts and status.',
            success: false
          };
        }
      }
    } else if (args?.studentNameOrId) {
      student = await findStudent(args.studentNameOrId);
    }

    if (student) {
      if (user?.role === 'coach' && !verifyToolStudentAccess(user, student)) {
        return {
          result: null,
          summary: `Privacy Scoping: As a coach, you can only view fee status for students assigned to your coaching roster. "${student.displayName}" is not assigned to you.`,
          success: false
        };
      }

      const attendanceRecs = await db.getAttendanceByStudent(student.id);
      const presentCount = attendanceRecs.filter(r => r.status === 'Present').length;
      const fees = await db.getFeesByStudent(student.id);
      const completedCycles = Math.floor(presentCount / 8);
      const isFeeDue = completedCycles > 0 && fees.filter(f => f.status === 'Paid').length < completedCycles;

      const gpayLink = `upi://pay?pa=8861751000@okbizaxis&pn=SmartPen%20Academy&am=1600&cu=INR`;

      return {
        result: {
          studentName: student.displayName,
          studentId: student.id,
          classesAttended: presentCount,
          completedCycles,
          feeStatus: isFeeDue ? 'Fee Due (₹1,600)' : 'No pending Fee',
          paidReceiptsCount: fees.filter(f => f.status === 'Paid').length,
          gpayNumber: '8861751000',
          gpayLink
        },
        summary: `💳 **Fee Status for ${student.displayName}**:\n• Status: **${isFeeDue ? '⚠️ Fee Due (₹1,600)' : '✓ No pending Fee'}**\n• Classes Attended: ${presentCount} (${completedCycles} completed 8-class cycles)\n• Paid Receipts: ${fees.filter(f => f.status === 'Paid').length}\n• Direct GPAY Payment: **8861751000**`,
        success: true
      };
    } else {
      if (user?.role === 'coach') {
        const coachKey = user.coachId || user.id;
        const coachAlt = user.coachId ? user.id : undefined;
        const myStudents = await db.getStudentsByCoachId(coachKey, coachAlt);
        const dues: string[] = [];
        let dueCount = 0;
        for (const s of myStudents) {
          const attendanceRecs = await db.getAttendanceByStudent(s.id);
          const presentCount = attendanceRecs.filter(r => r.status === 'Present').length;
          const fees = await db.getFeesByStudent(s.id);
          const completedCycles = Math.floor(presentCount / 8);
          const isFeeDue = completedCycles > 0 && fees.filter(f => f.status === 'Paid').length < completedCycles;
          if (isFeeDue) dueCount++;
          dues.push(`• **${s.displayName}**: ${isFeeDue ? '⚠️ Fee Due (₹1,600)' : '✓ Paid up to date'} (${presentCount} classes, ${fees.filter(f => f.status === 'Paid').length} receipts)`);
        }
        return {
          result: { totalStudents: myStudents.length, dueCount, rosterFees: dues },
          summary: `💳 **Fee Status for Your Assigned Students (${myStudents.length} students, ${dueCount} with dues)**:\n${dues.length === 0 ? 'No students currently assigned.' : dues.join('\n')}`,
          success: true
        };
      }

      if (user?.role !== 'admin') {
        return {
          result: null,
          summary: 'Access Denied: Only administrators and coaches can view fee summaries.',
          success: false
        };
      }

      const alerts = (await db.getAlerts()).filter(a => a.type === 'fee_due' && !a.isRead);
      return {
        result: { pendingAlerts: alerts },
        summary: `💳 **Pending Fee Alerts (${alerts.length})**:\n${alerts.length === 0 ? '✓ No pending fee dues at this moment.' : alerts.map(a => `• **${a.title}**: ${a.message}`).join('\n')}`,
        success: true
      };
    }
  }
};
