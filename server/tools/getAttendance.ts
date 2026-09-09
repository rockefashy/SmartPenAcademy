import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { db } from '../supabaseDb.ts';
import { StudentProfile } from '../../src/types.ts';

export const getAttendanceDeclaration: FunctionDeclaration = {
  name: 'getAttendance',
  description: 'Get attendance history, present count, and total classes attended for a student or entire academy.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student to lookup. If blank, returns overall attendance summary.'
      },
      yearMonth: {
        type: Type.STRING,
        description: 'Optional period in YYYY-MM format.'
      }
    }
  }
};

export const getAttendanceTool: AgentTool = {
  name: 'getAttendance',
  declaration: getAttendanceDeclaration,
  allowedRoles: ['admin', 'coach', 'student'],
  accessDeniedMessage: 'Access Denied: Only authenticated users can view attendance history.',
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
      // If the student query explicitly targets someone else, reject with privacy error
      if (args?.studentNameOrId) {
        const requestedStudent = await findStudent(args.studentNameOrId);
        if (requestedStudent && requestedStudent.id !== user.studentId) {
          return {
            result: null,
            summary: 'Privacy Policy: Student accounts can only view their own attendance records.',
            success: false
          };
        }
      }
    } else if (args?.studentNameOrId) {
      student = await findStudent(args.studentNameOrId);
      if (student && user?.role === 'coach' && !verifyToolStudentAccess(user, student)) {
        return {
          result: null,
          summary: `Scoping Policy: As a coach, you can only view attendance for students assigned to you. "${student.displayName}" is not assigned to your roster.`,
          success: false
        };
      }
    }

    if (student) {
      const records = await db.getAttendanceByStudent(student.id);
      const presentCount = records.filter(r => r.status === 'Present').length;
      const absentCount = records.filter(r => r.status === 'Absent').length;
      const currentCycleProgress = presentCount % 8;

      return {
        result: {
          studentName: student.displayName,
          studentId: student.id,
          totalPresent: presentCount,
          totalAbsent: absentCount,
          currentCycleProgress: `${currentCycleProgress} / 8 classes completed in current cycle`,
          recentRecords: records.slice(-5)
        },
        summary: `📊 **${student.displayName}** has attended **${presentCount} classes** (${absentCount} absent). Current 8-class cycle: **${currentCycleProgress}/8 classes completed**.`,
        success: true
      };
    } else {
      if (user?.role === 'coach') {
        const coachKey = user.coachId || user.id;
        const coachAlt = user.coachId ? user.id : undefined;
        const myStudents = await db.getStudentsByCoachId(coachKey, coachAlt);
        const summaryData: string[] = [];
        for (const s of myStudents) {
          const studentRecs = await db.getAttendanceByStudent(s.id);
          const count = studentRecs.filter(r => r.status === 'Present').length;
          summaryData.push(`${s.displayName}: ${count} classes`);
        }
        return {
          result: { totalStudents: myStudents.length, summary: summaryData },
          summary: `📊 Attendance Summary for your ${myStudents.length} assigned student(s):\n${summaryData.length === 0 ? 'No students currently assigned.' : summaryData.map(s => `• ${s}`).join('\n')}`,
          success: true
        };
      }

      // Broad academy summary is admin-only
      if (user?.role !== 'admin') {
        return {
          result: null,
          summary: 'Access Denied: Only administrators can view academy-wide attendance summaries.',
          success: false
        };
      }

      const allStudents = await db.getAllStudents();
      const summaryData: string[] = [];
      for (const s of allStudents) {
        const studentRecs = await db.getAttendanceByStudent(s.id);
        const count = studentRecs.filter(r => r.status === 'Present').length;
        summaryData.push(`${s.displayName}: ${count} classes`);
      }
      return {
        result: { totalStudents: allStudents.length, summary: summaryData },
        summary: `📊 Attendance Summary for all ${allStudents.length} students:\n${summaryData.map(s => `• ${s}`).join('\n')}`,
        success: true
      };
    }
  }
};
