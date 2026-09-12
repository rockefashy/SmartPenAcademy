import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess, validateWithSchema, toolLimitSchema, applyFilterOrLimit } from './helpers.ts';
import { db } from '../supabaseDb.ts';

export const getStudentProgressReportsDeclaration: FunctionDeclaration = {
  name: 'getStudentProgressReports',
  description: 'View periodic student progress evaluations, star ratings, and milestone achievements for a student or across the roster.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Optional name or ID of the student. If omitted, queries across assigned/enrolled students.'
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum reports to return when results are within ceiling (default 20, max 20).'
      }
    }
  }
};

export const getStudentProgressReportsTool: AgentTool = {
  name: 'getStudentProgressReports',
  declaration: getStudentProgressReportsDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can view student progress reports.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;

    // Validate optional limit using shared Zod schema
    const limitValidation = validateWithSchema(toolLimitSchema, args?.limit);
    if (!limitValidation.success) {
      return {
        result: limitValidation.error,
        summary: limitValidation.summary,
        success: false
      };
    }
    const requestedLimit = limitValidation.data;

    // Single student query mode
    if (args?.studentNameOrId) {
      const student = await findStudent(args.studentNameOrId);
      if (!student) {
        return {
          result: null,
          summary: `Could not find student matching "${args?.studentNameOrId}".`,
          success: false
        };
      }

      if (user?.role === 'coach' && !verifyToolStudentAccess(user, student)) {
        return {
          result: null,
          summary: `Privacy Scoping: As a coach, you can only view progress reports for assigned students. "${student.firstName}" is not assigned to your coaching roster.`,
          success: false
        };
      }

      const reports = await db.getProgressReports(student.id);

      const filteredResult = applyFilterOrLimit({
        items: reports,
        requestedLimit,
        entityLabel: `progress reports for ${student.firstName}`,
        suggestedFilters: [
          'A specific milestone review title or date'
        ]
      });

      if (filteredResult.isOversized) {
        return filteredResult.toolResult;
      }

      const list = filteredResult.items.map((r, idx) => 
        `${idx + 1}. ⭐ **${r.milestoneTitle || 'Milestone Review'}** (${r.reportDate}) - Rating: **${r.overallStars}/5 Stars**\n   Remarks: "${r.teacherFeedback || r.overallRemark || 'No feedback'}"`
      ).join('\n\n');

      return {
        result: {
          studentName: student.firstName,
          studentId: student.id,
          count: filteredResult.items.length,
          totalCount: filteredResult.totalCount,
          reports: filteredResult.items
        },
        summary: `📋 **Progress Reports for ${student.firstName} (${filteredResult.totalCount} total)**:\n\n${filteredResult.items.length === 0 ? 'No progress reports found for this student.' : list}`,
        success: true
      };
    }

    // All students mode (Roster-wide / Academy-wide)
    const eligibleStudents = user?.role === 'coach'
      ? await db.getStudentsByCoachId(user.coachId || user.id, user.coachId ? user.id : undefined)
      : await db.getAllStudents();

    const allReports: Array<{ studentName: string; studentId: string; report: any }> = [];
    for (const st of eligibleStudents) {
      const stReports = await db.getProgressReports(st.id);
      for (const r of stReports) {
        allReports.push({ studentName: st.firstName, studentId: st.id, report: r });
      }
    }

    const filteredResult = applyFilterOrLimit({
      items: allReports,
      requestedLimit,
      entityLabel: 'progress reports found across roster',
      suggestedFilters: [
        'A specific student: e.g. "Show progress reports for Aarav Mehta" or "Show reports for Arjun"'
      ]
    });

    if (filteredResult.isOversized) {
      return filteredResult.toolResult;
    }

    const list = filteredResult.items.map((item, idx) => 
      `${idx + 1}. **${item.studentName}** - ⭐ **${item.report.milestoneTitle || 'Milestone'}** (${item.report.reportDate}): **${item.report.overallStars}/5 Stars**`
    ).join('\n');

    return {
      result: {
        count: filteredResult.items.length,
        totalCount: filteredResult.totalCount,
        reports: filteredResult.items
      },
      summary: `📋 **Progress Reports (${filteredResult.totalCount} reports)**:\n${filteredResult.items.length === 0 ? 'No progress reports found.' : list}`,
      success: true
    };
  }
};
