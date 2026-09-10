import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess, validateWithSchema, toolLimitSchema, applyFilterOrLimit } from './helpers.ts';
import { db } from '../supabaseDb.ts';

export const getStudentWorkSamplesDeclaration: FunctionDeclaration = {
  name: 'getStudentWorkSamples',
  description: 'View handwriting work samples, homework uploads, and assessment images for a specific student or across the roster with category filtering.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Optional name or ID of the student. If omitted, queries across assigned/enrolled students.'
      },
      category: {
        type: Type.STRING,
        description: 'Optional category filter: "Assessment", "Classwork", "Homework", or "Milestone".'
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum samples to return when results are within ceiling (default 20, max 20).'
      }
    }
  }
};

export const getStudentWorkSamplesTool: AgentTool = {
  name: 'getStudentWorkSamples',
  declaration: getStudentWorkSamplesDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can view student work samples.',
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
    const categoryFilter = args?.category ? String(args.category).toLowerCase().trim() : null;

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
          summary: `Privacy Scoping: As a coach, you can only view work samples for students on your coaching roster. "${student.displayName}" is not assigned to you.`,
          success: false
        };
      }

      let works = await db.getStudentWorks(student.id);
      if (categoryFilter) {
        works = works.filter(w => (w.category || '').toLowerCase() === categoryFilter);
      }

      const filteredResult = applyFilterOrLimit({
        items: works,
        requestedLimit,
        entityLabel: `work samples for ${student.displayName}`,
        suggestedFilters: [
          'A category filter: e.g. "Assessment", "Homework", or "Classwork"'
        ]
      });

      if (filteredResult.isOversized) {
        return filteredResult.toolResult;
      }

      const list = filteredResult.items.map((w, idx) => 
        `${idx + 1}. **${w.category || 'Classwork'}** (${w.captureDate || 'Recent'}): ${w.comments || 'No remarks'}`
      ).join('\n');

      return {
        result: {
          studentName: student.displayName,
          studentId: student.id,
          count: filteredResult.items.length,
          totalCount: filteredResult.totalCount,
          samples: filteredResult.items
        },
        summary: `📸 **Work Samples for ${student.displayName} (${filteredResult.totalCount} total)**:\n${filteredResult.items.length === 0 ? 'No matching work samples found.' : list}`,
        success: true
      };
    }

    // All students mode (Roster-wide / Academy-wide)
    const eligibleStudents = user?.role === 'coach'
      ? await db.getStudentsByCoachId(user.coachId || user.id, user.coachId ? user.id : undefined)
      : await db.getAllStudents();

    const allWorks: Array<{ studentName: string; studentId: string; work: any }> = [];
    for (const st of eligibleStudents) {
      const stWorks = await db.getStudentWorks(st.id);
      for (const w of stWorks) {
        if (!categoryFilter || (w.category || '').toLowerCase() === categoryFilter) {
          allWorks.push({ studentName: st.displayName, studentId: st.id, work: w });
        }
      }
    }

    const filteredResult = applyFilterOrLimit({
      items: allWorks,
      requestedLimit,
      entityLabel: 'work samples found across roster',
      suggestedFilters: [
        'A specific student: e.g. "Show work samples for Arjun"',
        'A category filter: e.g. "Show Assessment samples" or "Show Homework samples"'
      ]
    });

    if (filteredResult.isOversized) {
      return filteredResult.toolResult;
    }

    const list = filteredResult.items.map((item, idx) => 
      `${idx + 1}. **${item.studentName}** - ${item.work.category || 'Classwork'} (${item.work.captureDate || 'Recent'}): ${item.work.comments || 'No remarks'}`
    ).join('\n');

    return {
      result: {
        count: filteredResult.items.length,
        totalCount: filteredResult.totalCount,
        samples: filteredResult.items
      },
      summary: `📸 **Handwriting Work Samples (${filteredResult.totalCount} samples)**:\n${filteredResult.items.length === 0 ? 'No work samples found matching your criteria.' : list}`,
      success: true
    };
  }
};
