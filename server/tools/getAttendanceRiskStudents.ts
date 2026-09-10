import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { validateWithSchema } from './helpers.ts';

export const getAttendanceRiskStudentsDeclaration: FunctionDeclaration = {
  name: 'getAttendanceRiskStudents',
  description: 'Identify and summarize students showing attendance risks, disengagement, consecutive absences, or low attendance rates (Admin and Coach).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      windowDays: {
        type: Type.INTEGER,
        description: 'Number of past days to evaluate attendance history for (default 30, min 7, max 180).'
      },
      minAbsentCount: {
        type: Type.INTEGER,
        description: 'Minimum absences in window to flag as risk (default 2).'
      },
      maxAttendanceRate: {
        type: Type.INTEGER,
        description: 'Maximum attendance percentage to flag as risk (default 75, e.g. <= 75%).'
      }
    }
  }
};

const getAttendanceRiskStudentsSchema = z.object({
  windowDays: z.coerce.number().int().min(7).max(180).optional().default(30),
  minAbsentCount: z.coerce.number().int().min(1).max(20).optional().default(2),
  maxAttendanceRate: z.coerce.number().int().min(10).max(100).optional().default(75)
});

type GetAttendanceRiskStudentsInput = z.infer<typeof getAttendanceRiskStudentsSchema>;

export const getAttendanceRiskStudentsTool: AgentTool = {
  name: 'getAttendanceRiskStudents',
  declaration: getAttendanceRiskStudentsDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can view attendance risk summaries.',
  rateLimit: { maxCalls: 15, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user, today } = context;

    if (!user || (user.role !== 'admin' && user.role !== 'coach')) {
      return {
        result: null,
        summary: 'Access Denied: Only administrators and coaches can view attendance risk summaries.',
        success: false
      };
    }

    // 1. Validate parameters
    const validation = validateWithSchema<GetAttendanceRiskStudentsInput>(getAttendanceRiskStudentsSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for attendance risk assessment.',
        success: false
      };
    }

    const { windowDays, minAbsentCount, maxAttendanceRate } = validation.data;

    // 2. Compute lookback window cutoff date
    const referenceDate = today ? new Date(today) : new Date();
    const cutoffDateObj = new Date(referenceDate.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const cutoffDate = cutoffDateObj.toISOString().split('T')[0];

    // 3. Resolve active students with role-based scoping
    let targetStudents: any[] = [];
    if (user.role === 'coach') {
      const coachKey = user.coachId || user.id;
      const coachAlt = user.coachId ? user.id : undefined;
      const roster = await db.getStudentsByCoachId(coachKey, coachAlt);
      targetStudents = roster.filter(s => s.status === 'Active');
    } else {
      const allStudents = await db.getAllStudents();
      targetStudents = allStudents.filter(s => s.status === 'Active');
    }

    if (targetStudents.length === 0) {
      return {
        result: {
          windowDays,
          cutoffDate,
          totalChecked: 0,
          atRiskCount: 0,
          atRiskStudents: []
        },
        summary: `📋 **Attendance Risk Assessment (Last ${windowDays} Days)**\n\nNo active students found in your roster to evaluate.`,
        success: true
      };
    }

    // 4. Evaluate attendance patterns per student
    const atRiskList: any[] = [];

    for (const student of targetStudents) {
      const allAttendance = await db.getAttendanceByStudent(student.id);
      const windowRecords = allAttendance.filter(r => r.date && r.date >= cutoffDate);

      if (windowRecords.length === 0) {
        continue;
      }

      const attendedCount = windowRecords.filter(r => r.status === 'Present').length;
      const absentCount = windowRecords.filter(r => r.status === 'Absent').length;
      const attendanceRate = Math.round((attendedCount / windowRecords.length) * 100);

      // Compute consecutive absences backwards from most recent session
      const sortedDesc = [...windowRecords].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      let consecutiveAbsences = 0;
      for (const rec of sortedDesc) {
        if (rec.status === 'Absent') {
          consecutiveAbsences++;
        } else {
          break;
        }
      }

      const riskFactors: string[] = [];
      if (absentCount >= minAbsentCount) {
        riskFactors.push(`${absentCount} absences in last ${windowDays} days`);
      }
      if (attendanceRate <= maxAttendanceRate) {
        riskFactors.push(`Low attendance rate (${attendanceRate}%)`);
      }
      if (consecutiveAbsences >= 2) {
        riskFactors.push(`${consecutiveAbsences} consecutive absences`);
      }

      if (riskFactors.length > 0) {
        const riskLevel = (consecutiveAbsences >= 2 || attendanceRate < 50) ? 'High' : 'Medium';
        atRiskList.push({
          studentId: student.id,
          studentName: student.displayName,
          grade: student.gradeClass || 'N/A',
          parentPhone: student.whatsappMobile || 'N/A',
          totalSessionsInWindow: windowRecords.length,
          attendedCount,
          absentCount,
          attendanceRate: `${attendanceRate}%`,
          consecutiveAbsences,
          riskLevel,
          riskFactors
        });
      }
    }

    // Sort by risk severity (High first, then lowest attendance rate)
    atRiskList.sort((a, b) => {
      if (a.riskLevel === 'High' && b.riskLevel !== 'High') return -1;
      if (b.riskLevel === 'High' && a.riskLevel !== 'High') return 1;
      return parseInt(a.attendanceRate) - parseInt(b.attendanceRate);
    });

    const result = {
      windowDays,
      cutoffDate,
      scope: user.role === 'coach' ? 'Assigned Roster' : 'Academy-Wide',
      totalChecked: targetStudents.length,
      atRiskCount: atRiskList.length,
      atRiskStudents: atRiskList
    };

    // 5. Build Human-Readable Markdown Summary
    if (atRiskList.length === 0) {
      return {
        result,
        summary: `✓ **Attendance Risk Assessment (Last ${windowDays} Days)**\n\nAll ${targetStudents.length} active student(s) in ${result.scope.toLowerCase()} have healthy attendance (above ${maxAttendanceRate}% rate and fewer than ${minAbsentCount} absences). Zero students at risk.`,
        success: true
      };
    }

    const studentLines = atRiskList.slice(0, 10).map(s => {
      const badge = s.riskLevel === 'High' ? '🔴 High Risk' : '🟡 Medium Risk';
      return `• **${s.studentName}** (${s.grade}) • **${badge}**\n  - Attendance Rate: ${s.attendanceRate} (${s.attendedCount}/${s.totalSessionsInWindow} sessions)\n  - Flags: ${s.riskFactors.join(', ')}`;
    }).join('\n');

    const moreNote = atRiskList.length > 10 
      ? `\n*...and ${atRiskList.length - 10} more student(s).*` 
      : '';

    const summary = 
      `⚠️ **Attendance Risk Alert: ${atRiskList.length} Student(s) at Risk (${result.scope})**\n` +
      `*Lookback Window: Last ${windowDays} Days (since ${cutoffDate})*\n\n` +
      `${studentLines}${moreNote}\n\n` +
      `*Recommendation*: Contact parents or review 8-class coaching schedule to prevent dropout.`;

    return {
      result,
      summary,
      success: true
    };
  }
};
