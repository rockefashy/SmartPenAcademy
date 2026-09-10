import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { patchTestimonialSchema } from '../schemas.ts';

export const moderateTestimonialDeclaration: FunctionDeclaration = {
  name: 'moderateTestimonial',
  description: 'Moderate, approve, or publish a parent testimonial or review for the website.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      testimonialIdOrStudentName: {
        type: Type.STRING,
        description: 'Testimonial ID or student name.'
      },
      status: {
        type: Type.STRING,
        description: '"Published", "Pending", or "Featured".'
      }
    },
    required: ['testimonialIdOrStudentName', 'status']
  }
};

export const moderateTestimonialTool: AgentTool = {
  name: 'moderateTestimonial',
  declaration: moderateTestimonialDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can moderate testimonials.',
  rateLimit: { maxCalls: 20, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const testimonials = await db.getTestimonials();
    const query = String(args?.testimonialIdOrStudentName || '').toLowerCase().trim();
    const t = testimonials.find(item => item.id === query || (item.studentName && item.studentName.toLowerCase().includes(query)));

    if (!t) {
      return {
        result: null,
        summary: `Could not find testimonial matching "${args?.testimonialIdOrStudentName}".`,
        success: false
      };
    }

    const targetStatus = args.status === 'Published' ? 'Published' : (args.status === 'Featured' ? 'Featured' : 'Pending');
    const parsed = patchTestimonialSchema.safeParse({ status: targetStatus });
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message}`,
        success: false
      };
    }

    const updated = await db.updateTestimonial(t.id, parsed.data as any);
    return {
      result: updated,
      summary: `✓ Testimonial by **${t.parentName || t.studentName}** is now **${targetStatus}**!`,
      success: true
    };
  }
};
