import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult, ROLES } from './types.ts';
import { db } from '../supabaseDb.ts';
import { createTestimonialSchema } from '../schemas.ts';

export const submitTestimonialDeclaration: FunctionDeclaration = {
  name: 'submitTestimonial',
  description: 'Submit parent feedback, star rating, and student handwriting transformation review. Can be submitted by admin, coach, parent, or student.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentId: {
        type: Type.STRING,
        description: 'Student ID for whom the testimonial is being submitted (required for admin/coach, optional for parents/students).'
      },
      studentName: {
        type: Type.STRING,
        description: 'Student name for whom the testimonial is being submitted.'
      },
      parentName: {
        type: Type.STRING,
        description: 'Name of the parent providing the review.'
      },
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
  allowedRoles: [ROLES.ADMIN, ROLES.STUDENT],
  selfServiceOnly: false,
  accessDeniedMessage: 'Access Denied: Testimonials can only be submitted by admin, parent, or student.',
  rateLimit: { maxCalls: 5, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    if (!user || !['admin', 'student'].includes(user.role)) {
      return {
        result: null,
        summary: 'Access Denied: Testimonials can only be submitted by admin, parent, or student.',
        success: false
      };
    }

    let targetStudentId = args?.studentId || (user?.role === ROLES.STUDENT ? user.studentId : undefined);
    let student = targetStudentId ? await db.getStudentById(targetStudentId) : null;

    if (!student && args?.studentName) {
      const allStudents = await db.getAllStudents();
      student = allStudents.find(s => 
        s.firstName.toLowerCase() === args.studentName.trim().toLowerCase() ||
        `${s.firstName} ${s.lastName || ''}`.trim().toLowerCase() === args.studentName.trim().toLowerCase()
      ) || null;
      if (student) {
        targetStudentId = student.id;
      }
    }

    if (!student) {
      return {
        result: null,
        summary: targetStudentId 
          ? `Could not locate student profile with ID "${targetStudentId}".`
          : 'Please specify the studentId or studentName for whom this testimonial is being submitted.',
        success: false
      };
    }

    const payload = {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName || ''}`.trim(),
      parentName: args?.parentName || student.parentName || user.firstName || 'Parent',
      grade: student.gradeClass || '',
      schoolName: student.schoolName || '',
      rating: Number(args?.rating) || 5,
      title: args?.title || 'Parent Feedback',
      review: String(args?.review || '').trim(),
      status: 'Published'
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
      summary: `🎉 **Thank you for your feedback!** The ${saved.rating}-star review for **${student.firstName}** has been recorded successfully!`,
      success: true
    };
  }
};
