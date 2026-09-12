import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { verifyToolStudentAccess, validateWithSchema } from './helpers.ts';

export const bulkDeleteStudentWorksDeclaration: FunctionDeclaration = {
  name: 'bulkDeleteStudentWorks',
  description: 'Bulk delete up to 50 student handwriting work sample images and records. Requires explicit confirmation before executing.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentWorkIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Array of student work sample IDs to permanently delete (up to 50).'
      },
      reason: {
        type: Type.STRING,
        description: 'Optional deletion reason or cleanup remark.'
      },
      confirmed: {
        type: Type.BOOLEAN,
        description: 'Set to true ONLY if the user explicitly said "confirm", "yes", "proceed", or explicitly confirmed the bulk deletion. If false or omitted, the tool outputs a pending draft confirmation.'
      }
    },
    required: ['studentWorkIds']
  }
};

const bulkDeleteStudentWorksSchema = z.object({
  studentWorkIds: z.array(z.string().trim().min(1, 'Work ID cannot be empty'))
    .min(1, 'Please provide at least one studentWorkId.')
    .max(50, 'Cannot bulk delete more than 50 work samples at once.'),
  reason: z.string().trim().optional(),
  confirmed: z.boolean().optional().default(false)
});

type BulkDeleteStudentWorksInput = z.infer<typeof bulkDeleteStudentWorksSchema>;

export const bulkDeleteStudentWorksTool: AgentTool = {
  name: 'bulkDeleteStudentWorks',
  declaration: bulkDeleteStudentWorksDeclaration,
  allowedRoles: ['admin', 'coach'],
  accessDeniedMessage: 'Access Denied: Only administrators and assigned coaches can delete student work samples.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;

    // 1. Validate parameters
    const validation = validateWithSchema<BulkDeleteStudentWorksInput>(bulkDeleteStudentWorksSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid parameters for bulk deleting student work samples.',
        success: false
      };
    }

    const { studentWorkIds, reason, confirmed } = validation.data;

    // 2. Entity Resolution & Access Scoping
    const resolvedWorks: any[] = [];
    const studentIds = new Set<string>();

    for (const workId of studentWorkIds) {
      const work = await db.findStudentWorkById(workId);
      if (work) {
        // Coach scoping check
        if (user?.role === 'coach') {
          const student = await db.getStudentById(work.studentId);
          if (!student || !verifyToolStudentAccess(user, student)) {
            return {
              result: null,
              summary: `Privacy Scoping: As a coach, you can only delete work samples for your assigned students. Work sample "${workId}" does not belong to your assigned roster.`,
              success: false
            };
          }
        }
        resolvedWorks.push(work);
        studentIds.add(work.studentId);
      }
    }

    if (resolvedWorks.length === 0) {
      return {
        result: null,
        summary: `None of the requested ${studentWorkIds.length} work sample IDs were found in the database.`,
        success: false
      };
    }

    // Resolve student names for reporting
    const affectedStudents: string[] = [];
    for (const sId of studentIds) {
      const s = await db.getStudentById(sId);
      if (s?.firstName) affectedStudents.push(s.firstName);
    }
    const studentNamesStr = affectedStudents.length > 0 ? affectedStudents.join(', ') : `${studentIds.size} student(s)`;

    // 3. Draft Confirmation (confirmed !== true)
    if (!confirmed) {
      return {
        result: {
          draft: true,
          count: resolvedWorks.length,
          requestedIds: studentWorkIds,
          resolvedIds: resolvedWorks.map(w => w.id),
          affectedStudents,
          reason: reason || undefined
        },
        summary: `⚠️ **Confirmation Required: Bulk Delete Student Work Samples**\n\n` +
          `• **Samples to Delete**: ${resolvedWorks.length} work sample(s)\n` +
          `• **Affected Student(s)**: ${studentNamesStr}\n` +
          `${reason ? `• **Reason**: ${reason}\n` : ''}\n` +
          `**Operational Impact**:\n` +
          `1. Permanently deletes ${resolvedWorks.length} homework / handwriting upload record(s) and image files.\n` +
          `2. Student handwriting evaluation progress cannot be recovered.\n\n` +
          `To proceed, please reply: **"Confirm deletion of ${resolvedWorks.length} work samples"** or **"Yes, delete work samples"**.`,
        success: true
      };
    }

    // 4. Execution (confirmed === true)
    let deletedCount = 0;
    for (const work of resolvedWorks) {
      try {
        await db.deleteStudentWork(work.id);
        deletedCount++;
      } catch (err: any) {
        console.warn(`[bulkDeleteStudentWorks] Failed to delete work ${work.id}:`, err?.message || err);
      }
    }

    return {
      result: {
        deletedCount,
        requestedCount: studentWorkIds.length,
        affectedStudents
      },
      summary: `✓ Successfully deleted ${deletedCount} student work sample(s) for ${studentNamesStr}.`,
      success: true
    };
  }
};
