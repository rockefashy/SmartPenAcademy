import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { validateWithSchema } from './helpers.ts';

export const getOverdueFeeSummaryDeclaration: FunctionDeclaration = {
  name: 'getOverdueFeeSummary',
  description: 'Get a summary of students with overdue or pending fees and total outstanding amount across the academy (for admin) or assigned roster (for coach).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      yearMonth: {
        type: Type.STRING,
        description: 'Optional billing month in YYYY-MM format (defaults to current month, e.g. "2026-09").'
      },
      statusFilter: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Optional list of statuses to include (e.g. ["Overdue", "Pending"]). Default is both.'
      }
    }
  }
};

const getOverdueFeeSummarySchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'yearMonth must be in YYYY-MM format (e.g. "2026-09")').optional(),
  statusFilter: z.array(z.enum(['Pending', 'Overdue', 'Waived', 'Paid'])).optional().default(['Overdue', 'Pending'])
});

type GetOverdueFeeSummaryInput = z.infer<typeof getOverdueFeeSummarySchema>;

export const getOverdueFeeSummaryTool: AgentTool = {
  name: 'getOverdueFeeSummary',
  declaration: getOverdueFeeSummaryDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can view overdue fee summaries.',
  rateLimit: { maxCalls: 20, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user, today } = context;

    if (!user || (user.role !== 'admin' && user.role !== 'coach')) {
      return {
        result: null,
        summary: 'Access Denied: Only administrators and coaches can view overdue fee summaries.',
        success: false
      };
    }

    // 1. Validate parameters
    const validation = validateWithSchema<GetOverdueFeeSummaryInput>(getOverdueFeeSummarySchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for fee summary.',
        success: false
      };
    }

    const currentYearMonth = (today || new Date().toISOString().split('T')[0]).substring(0, 7);
    const targetMonth = validation.data.yearMonth || currentYearMonth;
    const filterStatuses = new Set(validation.data.statusFilter);

    // 2. Query fees with role-based scoping
    let fees: any[] = [];
    const studentNameMap = new Map<string, string>();

    if (user.role === 'coach') {
      const coachKey = user.coachId || user.id;
      const coachAlt = user.coachId ? user.id : undefined;
      const assignedStudents = await db.getStudentsByCoachId(coachKey, coachAlt);

      if (assignedStudents.length === 0) {
        return {
          result: {
            yearMonth: targetMonth,
            totalOutstanding: 0,
            affectedStudentsCount: 0,
            students: []
          },
          summary: `📊 **Fee Outstanding Summary (${targetMonth})**\n\nYou currently have no assigned students in your roster.`,
          success: true
        };
      }

      for (const s of assignedStudents) {
        studentNameMap.set(s.id, s.firstName);
      }

      const studentIds = assignedStudents.map(s => s.id);
      fees = await db.getFeesByMonth(targetMonth, { studentIds });
    } else {
      // Admin: query all fees for month
      fees = await db.getFeesByMonth(targetMonth);
      const allStudents = await db.getAllStudents();
      for (const s of allStudents) {
        studentNameMap.set(s.id, s.firstName);
      }
    }

    // 3. Filter and aggregate by student
    const matchedFees = fees.filter(f => filterStatuses.has(f.status));

    const studentGrouping = new Map<string, {
      studentId: string;
      studentName: string;
      overdueCount: number;
      pendingCount: number;
      totalAmount: number;
      records: Array<{ id: string; period: string; status: string; amount: number }>;
    }>();

    let totalOutstanding = 0;

    for (const f of matchedFees) {
      const sid = f.studentId;
      const amount = Number(f.amount) || 0;
      totalOutstanding += amount;

      let group = studentGrouping.get(sid);
      if (!group) {
        const studentName = studentNameMap.get(sid) || `Student (${sid})`;
        group = {
          studentId: sid,
          studentName,
          overdueCount: 0,
          pendingCount: 0,
          totalAmount: 0,
          records: []
        };
        studentGrouping.set(sid, group);
      }

      if (f.status === 'Overdue') {
        group.overdueCount++;
      } else if (f.status === 'Pending') {
        group.pendingCount++;
      }

      group.totalAmount += amount;
      group.records.push({
        id: f.id,
        period: f.yearMonth || f.date || targetMonth,
        status: f.status,
        amount
      });
    }

    const studentsList = Array.from(studentGrouping.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const result = {
      yearMonth: targetMonth,
      totalOutstanding,
      affectedStudentsCount: studentsList.length,
      scope: user.role === 'coach' ? 'Assigned Roster' : 'Academy-Wide',
      students: studentsList
    };

    // 4. Build Human-Readable Summary
    if (studentsList.length === 0) {
      return {
        result,
        summary: `✓ **Fee Outstanding Summary (${targetMonth})**\n\nAll fees are up to date. Zero outstanding or overdue records found for ${result.scope.toLowerCase()}.`,
        success: true
      };
    }

    const studentLines = studentsList.slice(0, 10).map(s => {
      const breakdown = [];
      if (s.overdueCount > 0) breakdown.push(`${s.overdueCount} overdue`);
      if (s.pendingCount > 0) breakdown.push(`${s.pendingCount} pending`);
      return `• **${s.studentName}**: ₹${s.totalAmount} (${breakdown.join(', ')})`;
    }).join('\n');

    const moreNote = studentsList.length > 10 
      ? `\n*...and ${studentsList.length - 10} more student(s).*` 
      : '';

    const summary = 
      `💳 **Fee Outstanding Summary: ${targetMonth} (${result.scope})**\n\n` +
      `• **Total Outstanding Balance**: **₹${totalOutstanding.toLocaleString('en-IN')}**\n` +
      `• **Students with Dues**: **${studentsList.length} student(s)**\n\n` +
      `**Top Outstanding Accounts**:\n` +
      `${studentLines}${moreNote}`;

    return {
      result,
      summary,
      success: true
    };
  }
};
