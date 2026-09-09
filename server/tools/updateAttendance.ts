import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';
import { db } from '../supabaseDb.ts';

export const updateAttendanceDeclaration: FunctionDeclaration = {
  name: 'updateAttendance',
  description: 'Update or mark attendance (Present / Absent) for one or more students for a specific date (default today).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNames: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Names or IDs of students to update attendance for (e.g. ["Khwaish", "Aarav", "Ananya"]).'
      },
      status: {
        type: Type.STRING,
        description: 'Attendance status: "Present" or "Absent". Default is "Present".'
      },
      date: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format, or "today".'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional coach notes or topic covered.'
      }
    },
    required: ['studentNames']
  }
};

export const updateAttendanceTool: AgentTool = {
  name: 'updateAttendance',
  declaration: updateAttendanceDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and assigned coaches can update student attendance records.',
  rateLimit: { maxCalls: 15, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user, today } = context;

    const rawList = Array.isArray(args?.studentNames) ? args.studentNames : [args?.studentNames || 'all'];
    const targetDate = args?.date === 'today' || !args?.date ? today : args.date;
    const status = args?.status === 'Absent' ? 'Absent' : 'Present';
    const notes = args?.notes || (user?.role === 'coach' ? `Marked by Coach ${user.displayName}` : 'Marked via SmartPen AI Assistant');

    const updatedStudents: { id: string; name: string }[] = [];
    const recordsToSave: any[] = [];
    const notFound: string[] = [];
    const unauthorized: string[] = [];

    // If command says 'all', get eligible active students
    if (rawList.some((s: string) => typeof s === 'string' && (s.toLowerCase() === 'all' || s.toLowerCase() === 'all students'))) {
      let targetStudents = (await db.getAllStudents()).filter(s => s.status === 'Active');
      if (user?.role === 'coach') {
        targetStudents = targetStudents.filter(s => verifyToolStudentAccess(user, s));
      }
      targetStudents.forEach(st => {
        recordsToSave.push({
          studentId: st.id,
          date: targetDate,
          yearMonth: targetDate.substring(0, 7),
          status,
          notes
        });
        updatedStudents.push({ id: st.id, name: st.displayName });
      });
    } else {
      for (const item of rawList) {
        const student = await findStudent(String(item));
        if (student) {
          if (user?.role === 'coach' && !verifyToolStudentAccess(user, student)) {
            unauthorized.push(student.displayName);
            continue;
          }
          recordsToSave.push({
            studentId: student.id,
            date: targetDate,
            yearMonth: targetDate.substring(0, 7),
            status,
            notes
          });
          updatedStudents.push({ id: student.id, name: student.displayName });
        } else {
          notFound.push(String(item));
        }
      }
    }

    if (recordsToSave.length > 0) {
      await db.saveAttendanceBatch(recordsToSave);
    }

    const namesStr = updatedStudents.map(s => s.name).join(', ');
    let summary = `✓ Successfully marked attendance as **${status}** for ${updatedStudents.length} student(s): **${namesStr}** on **${targetDate}**.`;
    if (unauthorized.length > 0) {
      summary += `\n⚠️ Note: You are only permitted to update attendance for your assigned students (Skipped: ${unauthorized.join(', ')}).`;
    }
    if (notFound.length > 0) {
      summary += ` (Could not match: ${notFound.join(', ')})`;
    }

    return {
      result: { updatedCount: updatedStudents.length, students: updatedStudents, date: targetDate, status },
      summary,
      success: true
    };
  }
};
