import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { validateWithSchema, toolLimitSchema, applyFilterOrLimit } from './helpers.ts';
import { db } from '../supabaseDb.ts';

export const listCoachesDeclaration: FunctionDeclaration = {
  name: 'listCoaches',
  description: 'List academy handwriting tutors and coaches, their designations, specializations, and status.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      activeOnly: {
        type: Type.BOOLEAN,
        description: 'Whether to only return active coaches (default true).'
      },
      specialization: {
        type: Type.STRING,
        description: 'Optional specialization filter (e.g. "Cursive", "Print", "Speed").'
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum coaches to return when results are within ceiling (default 20, max 20).'
      }
    }
  }
};

export const listCoachesTool: AgentTool = {
  name: 'listCoaches',
  declaration: listCoachesDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and coaches can view staff coaches.',
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

    const coaches = await db.getAllCoaches();
    const activeOnly = args?.activeOnly !== false;
    let filtered = activeOnly ? coaches.filter(c => c.status === 'Active') : coaches;

    if (args?.specialization) {
      const spec = String(args.specialization).toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.specializations || []).some(s => s.toLowerCase().includes(spec))
      );
    }

    const filteredResult = applyFilterOrLimit({
      items: filtered,
      requestedLimit,
      entityLabel: 'coaching staff members',
      suggestedFilters: [
        'Filter active only: e.g. activeOnly=true',
        'Filter by specialization: e.g. specialization="Cursive"'
      ]
    });

    if (filteredResult.isOversized) {
      return filteredResult.toolResult;
    }

    const list = filteredResult.items.map((c, idx) => {
      const specs = c.specializations && c.specializations.length > 0 ? ` [${c.specializations.join(', ')}]` : '';
      return `${idx + 1}. **${c.displayName}** - ${c.designation || 'Tutor'}${specs} (${c.status})`;
    }).join('\n');

    return {
      result: {
        count: filteredResult.items.length,
        totalCount: filteredResult.totalCount,
        coaches: filteredResult.items
      },
      summary: `👥 **SmartPen Academy Coaching Staff (${filteredResult.items.length} of ${filteredResult.totalCount} tutors)**:\n${filteredResult.items.length === 0 ? 'No coaches match the criteria.' : list}`,
      success: true
    };
  }
};
