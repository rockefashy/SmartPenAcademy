import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, validateWithSchema, toolLimitSchema, applyFilterOrLimit } from './helpers.ts';

export const getAdminTestimonialsDeclaration: FunctionDeclaration = {
  name: 'getAdminTestimonials',
  description: 'View parent feedback and testimonials across the academy with moderation status filters (Pending, Published, Featured) or by student.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description: 'Optional moderation filter: "Pending", "Published", "Featured", or "All". Default is "All".'
      },
      studentNameOrId: {
        type: Type.STRING,
        description: 'Optional name or ID of student to filter reviews by.'
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum reviews to return when results are within ceiling (default 20, max 20).'
      }
    }
  }
};

export const getAdminTestimonialsTool: AgentTool = {
  name: 'getAdminTestimonials',
  declaration: getAdminTestimonialsDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can inspect testimonials moderation queue.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
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

    const statusFilter = args?.status && args.status.toLowerCase() !== 'all' 
      ? (args.status.charAt(0).toUpperCase() + args.status.slice(1).toLowerCase())
      : undefined;

    let targetStudentId: string | undefined;
    if (args?.studentNameOrId) {
      const st = await findStudent(args.studentNameOrId);
      if (st) targetStudentId = st.id;
    }

    const allTestimonials = await db.getTestimonials(targetStudentId, statusFilter);

    const filteredResult = applyFilterOrLimit({
      items: allTestimonials,
      requestedLimit,
      entityLabel: 'testimonials',
      suggestedFilters: [
        'Filter by status: e.g. "Show pending testimonials" or "Show featured testimonials"',
        'Filter by student: e.g. "Show testimonials for Ananya"'
      ]
    });

    if (filteredResult.isOversized) {
      return filteredResult.toolResult;
    }

    const list = filteredResult.items.map((t, idx) => {
      const author = t.parentName ? `${t.parentName} (Parent of ${t.studentName})` : t.studentName;
      return `${idx + 1}. [**${t.status || 'Pending'}**] ⭐ **${t.rating}/5 Stars** by **${author}**:\n   "${t.review}"`;
    }).join('\n\n');

    const filterDesc = statusFilter ? `${statusFilter} ` : '';
    return {
      result: {
        count: filteredResult.items.length,
        totalCount: filteredResult.totalCount,
        testimonials: filteredResult.items
      },
      summary: `🌟 **Academy Testimonials & Moderation Queue (${filteredResult.totalCount} ${filterDesc}reviews)**:\n\n${filteredResult.items.length === 0 ? 'No matching testimonials found.' : list}`,
      success: true
    };
  }
};
