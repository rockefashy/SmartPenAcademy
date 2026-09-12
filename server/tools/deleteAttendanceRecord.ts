import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, validateWithSchema } from './helpers.ts';
import { serverSupabase } from '../supabase.ts';

export const deleteAttendanceRecordDeclaration: FunctionDeclaration = {
  name: 'deleteAttendanceRecord',
  description: 'Delete a student attendance record for a specific class date or by attendance ID. Requires explicit confirmation before executing.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      attendanceId: {
        type: Type.STRING,
        description: 'Exact ID of the attendance record to delete (optional if studentNameOrId and date provided).'
      },
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student.'
      },
      date: {
        type: Type.STRING,
        description: 'Date of the class attendance in YYYY-MM-DD format (e.g. "2026-09-08").'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional reason for deleting this attendance record.'
      },
      confirmed: {
        type: Type.BOOLEAN,
        description: 'Set to true ONLY if the administrator explicitly said "confirm", "yes", "proceed", or explicitly confirmed the attendance deletion. If false or omitted, the tool outputs a pending draft confirmation.'
      }
    }
  }
};

const deleteAttendanceRecordSchema = z.object({
  attendanceId: z.string().trim().optional(),
  studentNameOrId: z.string().trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format (e.g. "2026-09-08")').optional(),
  notes: z.string().trim().optional(),
  confirmed: z.boolean().optional().default(false)
});

type DeleteAttendanceRecordInput = z.infer<typeof deleteAttendanceRecordSchema>;

export const deleteAttendanceRecordTool: AgentTool = {
  name: 'deleteAttendanceRecord',
  declaration: deleteAttendanceRecordDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can delete attendance records.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    // 1. Validate parameters
    const validation = validateWithSchema<DeleteAttendanceRecordInput>(deleteAttendanceRecordSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for deleting attendance.',
        success: false
      };
    }

    const { attendanceId, studentNameOrId, date, notes, confirmed } = validation.data;

    if (!attendanceId && (!studentNameOrId || !date)) {
      return {
        result: null,
        summary: 'Validation Error: Please provide either "attendanceId" OR both "studentNameOrId" and "date".',
        success: false
      };
    }

    // 2. Entity Resolution
    let record: any = null;
    let student: any = null;

    if (!serverSupabase) {
      return {
        result: null,
        summary: 'Database Error: Supabase client is not available.',
        success: false
      };
    }

    if (attendanceId) {
      const { data, error } = await serverSupabase
        .from('attendance')
        .select('*')
        .eq('id', attendanceId)
        .maybeSingle();

      if (error || !data) {
        return {
          result: null,
          summary: `Could not find attendance record matching ID "${attendanceId}".`,
          success: false
        };
      }
      record = data;
      student = await db.getStudentById(record.student_id);
    } else if (studentNameOrId && date) {
      student = await findStudent(studentNameOrId);
      if (!student) {
        return {
          result: null,
          summary: `Could not find student matching "${studentNameOrId}".`,
          success: false
        };
      }

      const { data, error } = await serverSupabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('date', date)
        .maybeSingle();

      if (error || !data) {
        return {
          result: null,
          summary: `No attendance record found for "${student.firstName}" on date "${date}".`,
          success: false
        };
      }
      record = data;
    }

    const studentName = student?.firstName || `Student (${record.student_id})`;

    // 3. Draft Confirmation (confirmed !== true)
    if (!confirmed) {
      return {
        result: {
          draft: true,
          attendanceId: record.id,
          studentId: record.student_id,
          studentName,
          date: record.date,
          status: record.status,
          classNumber: record.class_number || 'N/A',
          notes: notes || undefined
        },
        summary: `⚠️ **Confirmation Required: Delete Attendance Record**\n\n` +
          `• **Student**: ${studentName} (ID: ${record.student_id})\n` +
          `• **Class Date**: ${record.date}\n` +
          `• **Attendance Status**: ${record.status}${record.class_number ? ` (Class #${record.class_number})` : ''}\n\n` +
          `**Operational Impact**:\n` +
          `1. This class session will be permanently erased from the student's attendance history.\n` +
          `2. Student attended class count will decrease accordingly.\n` +
          `3. 8-class billing cycle tracking and fee renewal alerts may be affected.\n\n` +
          `To proceed, please reply: **"Confirm deletion of attendance record for ${studentName} on ${record.date}"** or **"Yes, delete attendance"**.`,
        success: true
      };
    }

    // 4. Execution (confirmed === true)
    try {
      await db.deleteAttendance(record.id);

      return {
        result: {
          attendanceId: record.id,
          studentId: record.student_id,
          studentName,
          date: record.date,
          deleted: true
        },
        summary: `✓ Attendance record for **${studentName}** on **${record.date}** has been successfully deleted.`,
        success: true
      };
    } catch (err: any) {
      return {
        result: null,
        summary: `Attendance Deletion Error: ${err.message || 'Failed to delete attendance record.'}`,
        success: false
      };
    }
  }
};
