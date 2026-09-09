import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const listStudentsDeclaration: FunctionDeclaration = {
  name: 'listStudents',
  description: 'List all enrolled students in SmartPen Academy with their status, schedule, and grade.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description: 'Filter by "Active", "Inactive", or "All".'
      },
      search: {
        type: Type.STRING,
        description: 'Optional search keyword.'
      }
    }
  }
};

export const listStudentsTool: AgentTool = {
  name: 'listStudents',
  declaration: listStudentsDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can view student rosters.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;

    let students = user?.role === 'coach'
      ? await db.getStudentsByCoachId(user.coachId || user.id, user.coachId ? user.id : undefined)
      : await db.getAllStudents();

    const statusFilter = args?.status?.toLowerCase();
    let filtered = students;
    if (statusFilter && statusFilter !== 'all') {
      filtered = students.filter(s => s.status.toLowerCase() === statusFilter);
    }
    if (args?.search) {
      const q = args.search.toLowerCase();
      filtered = filtered.filter(s => s.displayName.toLowerCase().includes(q) || s.gradeClass.toLowerCase().includes(q));
    }

    const listStr = filtered.map((s, idx) => `${idx + 1}. **${s.displayName}** (${s.gradeClass}) - ${s.preferredDays} @ ${s.preferredSlot} [${s.status}]${s.coachName ? ` • Coach: ${s.coachName}` : ''}`).join('\n');

    const title = user?.role === 'coach' ? `Your Assigned Students (${filtered.length})` : `Enrolled Students (${filtered.length})`;
    return {
      result: { count: filtered.length, students: filtered },
      summary: `📋 **${title}**:\n${filtered.length === 0 ? 'No students match your criteria.' : listStr}`,
      success: true
    };
  }
};
