import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess, validateWithSchema, toolLimitSchema, yearMonthSchema, applyFilterOrLimit } from './helpers.ts';
import { db } from '../supabaseDb.ts';
import { StudentProfile } from '../../src/types.ts';

export const getAttendanceDeclaration: FunctionDeclaration = {
  name: 'getAttendance',
  description: 'Get attendance history, present count, and total classes attended for a student or entire academy with optional month filtering.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student to lookup. If blank, returns overall attendance summary across roster.'
      },
      yearMonth: {
        type: Type.STRING,
        description: 'Optional calendar month period in YYYY-MM format (e.g., "2026-09").'
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum records or students to return when results are within ceiling (default 20, max 20).'
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

    // 1. Validate optional limit
    const limitValidation = validateWithSchema(toolLimitSchema, args?.limit);
    if (!limitValidation.success) {
      return {
        result: limitValidation.error,
        summary: limitValidation.summary,
        success: false
      };
    }
    const requestedLimit = limitValidation.data;

    // 2. Validate optional yearMonth (YYYY-MM)
    const ymValidation = validateWithSchema(yearMonthSchema, args?.yearMonth);
    if (!ymValidation.success) {
      return {
        result: ymValidation.error,
        summary: ymValidation.summary,
        success: false
      };
    }
    const targetYearMonth: string | undefined = ymValidation.data;

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

    // Single student attendance lookup
    if (student) {
      let records = await db.getAttendanceByStudent(student.id);

      // Apply calendar month filter if provided
      if (typeof targetYearMonth === 'string' && targetYearMonth) {
        const ym = targetYearMonth;
        records = records.filter(r => (r.date || '').startsWith(ym));
      }

      const filteredResult = applyFilterOrLimit({
        items: records,
        requestedLimit,
        entityLabel: `attendance records for ${student.displayName}`,
        suggestedFilters: [
          'Filter by month: e.g. yearMonth="2026-09"'
        ]
      });

      if (filteredResult.isOversized) {
        return filteredResult.toolResult;
      }

      const presentCount = filteredResult.items.filter(r => r.status === 'Present').length;
      const absentCount = filteredResult.items.filter(r => r.status === 'Absent').length;
      const currentCycleProgress = presentCount % 8;
      const monthLabel = targetYearMonth ? ` in ${targetYearMonth}` : '';

      return {
        result: {
          studentName: student.displayName,
          studentId: student.id,
          period: targetYearMonth || 'all-time',
          totalPresent: presentCount,
          totalAbsent: absentCount,
          currentCycleProgress: `${currentCycleProgress} / 8 classes completed in current cycle`,
          recordsCount: filteredResult.items.length,
          totalCount: filteredResult.totalCount,
          records: filteredResult.items
        },
        summary: `📊 **${student.displayName}** has attended **${presentCount} classes** (${absentCount} absent)${monthLabel}. Current 8-class cycle: **${currentCycleProgress}/8 classes completed**. Total records returned: ${filteredResult.items.length}.`,
        success: true
      };
    }

    // Broad summary mode (Coach roster or Admin academy)
    if (user?.role === 'coach') {
      const coachKey = user.coachId || user.id;
      const coachAlt = user.coachId ? user.id : undefined;
      const myStudents = await db.getStudentsByCoachId(coachKey, coachAlt);

      const filteredResult = applyFilterOrLimit({
        items: myStudents,
        requestedLimit,
        entityLabel: 'assigned students on your coaching roster',
        suggestedFilters: [
          'A specific student: e.g. "Show attendance for Arjun"',
          'Filter by month: e.g. yearMonth="2026-09"'
        ]
      });

      if (filteredResult.isOversized) {
        return filteredResult.toolResult;
      }

      const summaryData: string[] = [];
      for (const s of filteredResult.items) {
        let studentRecs = await db.getAttendanceByStudent(s.id);
        if (typeof targetYearMonth === 'string' && targetYearMonth) {
          const ym = targetYearMonth;
          studentRecs = studentRecs.filter(r => (r.date || '').startsWith(ym));
        }
        const count = studentRecs.filter(r => r.status === 'Present').length;
        summaryData.push(`${s.displayName}: ${count} classes`);
      }

      const monthLabel = targetYearMonth ? ` for ${targetYearMonth}` : '';
      return {
        result: {
          totalStudents: filteredResult.items.length,
          period: targetYearMonth || 'all-time',
          summary: summaryData
        },
        summary: `📊 Attendance Summary for your ${filteredResult.items.length} assigned student(s)${monthLabel}:\n${summaryData.length === 0 ? 'No students currently assigned.' : summaryData.map(s => `• ${s}`).join('\n')}`,
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

    const filteredResult = applyFilterOrLimit({
      items: allStudents,
      requestedLimit,
      entityLabel: 'enrolled students across academy',
      suggestedFilters: [
        'A specific student: e.g. "Show attendance for Arjun"',
        'Filter by month: e.g. yearMonth="2026-09"'
      ]
    });

    if (filteredResult.isOversized) {
      return filteredResult.toolResult;
    }

    const summaryData: string[] = [];
    for (const s of filteredResult.items) {
      let studentRecs = await db.getAttendanceByStudent(s.id);
      if (targetYearMonth) {
        studentRecs = studentRecs.filter(r => (r.date || '').startsWith(targetYearMonth));
      }
      const count = studentRecs.filter(r => r.status === 'Present').length;
      summaryData.push(`${s.displayName}: ${count} classes`);
    }

    const monthLabel = targetYearMonth ? ` for ${targetYearMonth}` : '';
    return {
      result: {
        totalStudents: filteredResult.items.length,
        period: targetYearMonth || 'all-time',
        summary: summaryData
      },
      summary: `📊 Attendance Summary for ${filteredResult.items.length} students${monthLabel}:\n${summaryData.map(s => `• ${s}`).join('\n')}`,
      success: true
    };
  }
};
