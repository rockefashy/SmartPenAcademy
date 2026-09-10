import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { updateCoachSchema } from '../schemas.ts';

export const editCoachProfileDeclaration: FunctionDeclaration = {
  name: 'editCoachProfile',
  description: 'Update coach profile information, designation, qualifications, phone, address, or specializations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      coachNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the coach to update.'
      },
      designation: {
        type: Type.STRING,
        description: 'New designation (e.g. "Senior Handwriting Specialist").'
      },
      educationalQualification: {
        type: Type.STRING,
        description: 'Degree or certifications.'
      },
      phoneNumber: {
        type: Type.STRING,
        description: 'Updated phone number.'
      },
      address: {
        type: Type.STRING,
        description: 'Updated center or address.'
      },
      specializations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of specializations (e.g. ["Cursive", "Speed Writing"]).'
      }
    },
    required: ['coachNameOrId']
  }
};

export const editCoachProfileTool: AgentTool = {
  name: 'editCoachProfile',
  declaration: editCoachProfileDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can modify coach profile details.',
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const coaches = await db.getAllCoaches();
    const query = String(args?.coachNameOrId || '').toLowerCase().trim();
    const target = coaches.find(c => c.id === query || c.displayName.toLowerCase().includes(query) || (c.email && c.email.toLowerCase() === query));

    if (!target) {
      return {
        result: null,
        summary: `Could not find coach matching "${args?.coachNameOrId}".`,
        success: false
      };
    }

    const updates: any = {};
    if (args.designation) updates.designation = args.designation;
    if (args.educationalQualification) updates.educationalQualification = args.educationalQualification;
    if (args.phoneNumber) updates.phoneNumber = args.phoneNumber;
    if (args.address) updates.address = args.address;
    if (args.specializations) updates.specializations = args.specializations;

    const parsed = updateCoachSchema.safeParse(updates);
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid coach updates'}`,
        success: false
      };
    }

    const updated = await db.updateCoach(target.id, parsed.data);
    return {
      result: updated,
      summary: `✓ Successfully updated profile for Coach **${target.displayName}**!`,
      success: true
    };
  }
};
