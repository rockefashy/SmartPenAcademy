import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const viewOwnTestimonialsDeclaration: FunctionDeclaration = {
  name: 'viewOwnTestimonials',
  description: 'View the parent feedback and testimonials you have submitted, along with their publication status.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const viewOwnTestimonialsTool: AgentTool = {
  name: 'viewOwnTestimonials',
  declaration: viewOwnTestimonialsDeclaration,
  allowedRoles: ['student'],
  selfServiceOnly: true,
  accessDeniedMessage: 'Access Denied: Only authenticated students can view their submitted testimonials.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(_args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    if (!user?.studentId) {
      return {
        result: null,
        summary: 'Access Denied: No student ID is linked to your account.',
        success: false
      };
    }

    const testimonials = await db.getTestimonials(user.studentId);
    const list = testimonials.map((t, idx) => `${idx + 1}. **${t.rating} Stars** [Status: ${t.status}]:\n   "${t.review}"`).join('\n\n');

    return {
      result: { count: testimonials.length, testimonials },
      summary: `🌟 **Your Submitted Testimonials (${testimonials.length})**:\n\n${testimonials.length === 0 ? 'You have not submitted any feedback yet. You can submit one by asking me!' : list}`,
      success: true
    };
  }
};
