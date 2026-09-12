import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { createTestimonialSchema } from '../schemas.ts';

export const submitTestimonialDeclaration: FunctionDeclaration = {
  name: 'submitTestimonial',
  description: 'Submit parent feedback, star rating, and student handwriting transformation review.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      rating: {
        type: Type.NUMBER,
        description: 'Star rating from 1 to 5.'
      },
      review: {
        type: Type.STRING,
        description: 'Detailed feedback or transformation testimonial.'
      },
      title: {
        type: Type.STRING,
        description: 'Optional headline for the review.'
      }
    },
    required: ['rating', 'review']
  }
};

export const submitTestimonialTool: AgentTool = {
  name: 'submitTestimonial',
  declaration: submitTestimonialDeclaration,
  allowedRoles: ['student'],
  selfServiceOnly: true,
  accessDeniedMessage: 'Access Denied: Only students and parents can submit testimonials.',
  rateLimit: { maxCalls: 5, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    if (!user?.studentId) {
      return {
        result: null,
        summary: 'Access Denied: No student profile linked to your account.',
        success: false
      };
    }

    const student = await db.getStudentById(user.studentId);
    if (!student) {
      return {
        result: null,
        summary: 'Could not locate student profile.',
        success: false
      };
    }

    const payload = {
      studentId: student.id,
      studentName: student.firstName,
      parentName: student.parentName || user.firstName || 'Parent',
      grade: student.gradeClass || '',
      schoolName: student.schoolName || '',
      rating: Number(args?.rating) || 5,
      title: args?.title || 'Parent Feedback',
      review: String(args?.review || '').trim(),
      status: 'Pending'
    };

    const parsed = createTestimonialSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid testimonial payload.'}`,
        success: false
      };
    }

    const saved = await db.saveTestimonial(parsed.data as any);

    return {
      result: saved,
      summary: `🎉 **Thank you for your feedback!** Your ${saved.rating}-star review for **${student.firstName}** has been submitted and is pending coach approval for the website!`,
      success: true
    };
  }
};
