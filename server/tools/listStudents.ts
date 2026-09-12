import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { validateWithSchema, toolLimitSchema, applyFilterOrLimit } from './helpers.ts';
import { db } from '../supabaseDb.ts';

export const listStudentsDeclaration: FunctionDeclaration = {
  name: 'listStudents',
  description: 'List enrolled students in SmartPen Academy with their status, schedule, and grade.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description: 'Filter by "Active", "Inactive", or "All".'
      },
      search: {
        type: Type.STRING,
        description: 'Optional search keyword (student name or grade).'
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum students to return when results are within ceiling (default 20, max 20).'
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

    // 1. Role Scoping
    const students = user?.role === 'coach'
      ? await db.getStudentsByCoachId(user.coachId || user.id, user.coachId ? user.id : undefined)
      : await db.getAllStudents();

    // 2. Explicit Filters
    const statusFilter = args?.status?.toLowerCase();
    let filtered = students;
    if (statusFilter && statusFilter !== 'all') {
      filtered = students.filter(s => (s.status || '').toLowerCase() === statusFilter);
    }
    if (args?.search) {
      const q = String(args.search).toLowerCase().trim();
      filtered = filtered.filter(s => 
        (s.firstName || '').toLowerCase().includes(q) || 
        (s.gradeClass || '').toLowerCase().includes(q)
      );
    }

    // 3. Shared Filter-or-Limit Evaluation
    const entityLabel = user?.role === 'coach' 
      ? 'students on your coaching roster' 
      : 'enrolled students across academy';

    const filteredResult = applyFilterOrLimit({
      items: filtered,
      requestedLimit,
      entityLabel,
      suggestedFilters: [
        'Filter by status: e.g. status="Active" or status="Inactive"',
        'Search by name or grade: e.g. search="Grade 4" or search="Aarav"'
      ]
    });

    if (filteredResult.isOversized) {
      return filteredResult.toolResult;
    }

    const listStr = filteredResult.items.map((s, idx) => 
      `${idx + 1}. **${s.firstName}** (${s.gradeClass}) - ${s.preferredDays} @ ${s.preferredSlot} [${s.status}]${s.coachName ? ` • Coach: ${s.coachName}` : ''}`
    ).join('\n');

    const title = user?.role === 'coach' 
      ? `Your Assigned Students (${filteredResult.items.length} of ${filteredResult.totalCount})` 
      : `Enrolled Students (${filteredResult.items.length} of ${filteredResult.totalCount})`;

    return {
      result: {
        count: filteredResult.items.length,
        totalCount: filteredResult.totalCount,
        students: filteredResult.items
      },
      summary: `📋 **${title}**:\n${filteredResult.items.length === 0 ? 'No students match your criteria.' : listStr}`,
      success: true
    };
  }
};
