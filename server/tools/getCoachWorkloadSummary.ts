import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { validateWithSchema } from './helpers.ts';

export const getCoachWorkloadSummaryDeclaration: FunctionDeclaration = {
  name: 'getCoachWorkloadSummary',
  description: 'Get an academy-wide breakdown of coach workloads, assigned active student counts, and coaching capacity signals (Admin only).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      includeInactive: {
        type: Type.BOOLEAN,
        description: 'Whether to include inactive coaches in the workload summary (defaults to false).'
      }
    }
  }
};

const getCoachWorkloadSummarySchema = z.object({
  includeInactive: z.boolean().optional().default(false)
});

type GetCoachWorkloadSummaryInput = z.infer<typeof getCoachWorkloadSummarySchema>;

export const getCoachWorkloadSummaryTool: AgentTool = {
  name: 'getCoachWorkloadSummary',
  declaration: getCoachWorkloadSummaryDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can view coach workload summaries.',
  rateLimit: { maxCalls: 20, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;

    if (!user || user.role !== 'admin') {
      return {
        result: null,
        summary: 'Access Denied: Only administrators can view coach workload summaries.',
        success: false
      };
    }

    // 1. Validate parameters
    const validation = validateWithSchema<GetCoachWorkloadSummaryInput>(getCoachWorkloadSummarySchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for coach workload summary.',
        success: false
      };
    }

    const { includeInactive } = validation.data;

    // 2. Query coaches and students
    const allCoaches = await db.getAllCoaches();
    const allStudents = await db.getAllStudents();

    const targetCoaches = includeInactive
      ? allCoaches
      : allCoaches.filter(c => c.status === 'Active');

    // 3. Compute student assignments per coach
    const unassignedActiveStudents: Array<{ id: string; name: string }> = [];
    const coachStudentMap = new Map<string, {
      activeStudents: Array<{ id: string; name: string }>;
      inactiveStudentsCount: number;
    }>();

    for (const c of targetCoaches) {
      coachStudentMap.set(c.id, {
        activeStudents: [],
        inactiveStudentsCount: 0
      });
    }

    for (const s of allStudents) {
      if (s.status === 'Active') {
        if (!s.coachId || !coachStudentMap.has(s.coachId)) {
          unassignedActiveStudents.push({ id: s.id, name: s.firstName });
        } else {
          coachStudentMap.get(s.coachId)?.activeStudents.push({ id: s.id, name: s.firstName });
        }
      } else {
        if (s.coachId && coachStudentMap.has(s.coachId)) {
          const group = coachStudentMap.get(s.coachId);
          if (group) group.inactiveStudentsCount++;
        }
      }
    }

    const coachSummaries = targetCoaches.map(c => {
      const data = coachStudentMap.get(c.id) || { activeStudents: [], inactiveStudentsCount: 0 };
      return {
        coachId: c.id,
        firstName: c.firstName,
        designation: c.designation || 'Coach',
        specializations: c.specializations || [],
        status: c.status,
        activeStudentCount: data.activeStudents.length,
        inactiveStudentCount: data.inactiveStudentsCount,
        hasAvailableCapacity: data.activeStudents.length === 0,
        activeStudents: data.activeStudents
      };
    }).sort((a, b) => b.activeStudentCount - a.activeStudentCount);

    const coachesWithCapacity = coachSummaries.filter(c => c.activeStudentCount === 0);
    const totalAssignedActive = coachSummaries.reduce((sum, c) => sum + c.activeStudentCount, 0);

    const result = {
      totalCoaches: targetCoaches.length,
      activeCoachesCount: targetCoaches.filter(c => c.status === 'Active').length,
      totalAssignedActiveStudents: totalAssignedActive,
      unassignedActiveStudentsCount: unassignedActiveStudents.length,
      unassignedActiveStudents,
      coachesWithCapacityCount: coachesWithCapacity.length,
      coaches: coachSummaries
    };

    // 4. Build Human-Readable Markdown Summary
    const coachLines = coachSummaries.map(c => {
      const tag = c.status === 'Inactive' ? ' *(Inactive)*' : '';
      const capacityBadge = c.activeStudentCount === 0 ? ' • 🟢 *Available for new students*' : '';
      return `• **${c.firstName}** (${c.designation}${tag}): **${c.activeStudentCount} active student(s)**${capacityBadge}`;
    }).join('\n');

    const unassignedNotice = unassignedActiveStudents.length > 0
      ? `\n⚠️ **Unassigned Students**: **${unassignedActiveStudents.length} active student(s)** currently have no assigned coach.`
      : `\n✓ All active students are currently assigned to a coach.`;

    const summary = 
      `👥 **Coach Workload & Capacity Summary**\n\n` +
      `• **Coaches Listed**: ${targetCoaches.length} (${result.activeCoachesCount} active)\n` +
      `• **Total Assigned Active Students**: ${totalAssignedActive}\n` +
      `• **Coaches with Available Capacity**: ${coachesWithCapacity.length}\n` +
      `${unassignedNotice}\n\n` +
      `**Coach Allocation Breakdown**:\n` +
      `${coachLines}`;

    return {
      result,
      summary,
      success: true
    };
  }
};
