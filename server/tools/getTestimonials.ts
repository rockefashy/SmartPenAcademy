import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const getTestimonialsDeclaration: FunctionDeclaration = {
  name: 'getTestimonials',
  description: 'Get verified parent testimonials, reviews, star ratings, and student handwriting transformation stories.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.INTEGER,
        description: 'Maximum number of reviews to return (default 5).'
      }
    }
  }
};

export const getTestimonialsTool: AgentTool = {
  name: 'getTestimonials',
  declaration: getTestimonialsDeclaration,
  rateLimit: { maxCalls: 60, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const limit = Number(args?.limit) || 5;
    let testimonials = await db.getTestimonials(undefined, 'Published');

    if (testimonials.length === 0) {
      return {
        result: { count: 0, testimonials: [] },
        summary: '🌟 **Verified Parent Voices & Success Stories**:\n\nNo parent reviews or testimonials have been published yet. Testimonials will appear here once submitted and published.',
        success: true
      };
    }

    const list = testimonials.slice(0, limit).map(t => {
      const stars = '⭐'.repeat(t.rating || 5);
      const author = t.parentName ? `${t.parentName} (Parent of ${t.studentName})` : t.studentName;
      const gradeInfo = t.grade ? ` [Grade ${t.grade}]` : '';
      return `• ${stars} **${author}**${gradeInfo}:\n  *"${t.review}"*`;
    }).join('\n\n');

    return {
      result: { count: testimonials.length, testimonials: testimonials.slice(0, limit) },
      summary: `🌟 **Verified Parent Testimonials (${testimonials.length} reviews)**:\n\n${list}\n\n💬 *Join over 15,000 students who transformed their handwriting with SmartPen Academy!*`,
      success: true
    };
  }
};
