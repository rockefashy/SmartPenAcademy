import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { findStudent, verifyToolStudentAccess } from './helpers.ts';

export const getStudentProfileDeclaration: FunctionDeclaration = {
  name: 'getStudentProfile',
  description: 'Lookup a student profile, including age, grade, batch days, time slot, parent details, and diagnostic observations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name, ID, or username of the student.'
      }
    },
    required: ['studentNameOrId']
  }
};

export const getStudentProfileTool: AgentTool = {
  name: 'getStudentProfile',
  declaration: getStudentProfileDeclaration,
  allowedRoles: ['admin', 'coach', 'student'],
  accessDeniedMessage: 'Access Denied: Only administrators, coaches, and students can view student profiles.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    let query = args?.studentNameOrId;

    if (user?.role === 'student') {
      if (!user.studentId) {
        return {
          result: null,
          summary: 'Access Denied: No student profile linked to your account.',
          success: false
        };
      }
      // Student can only request their own profile
      if (query) {
        const requestedStudent = await findStudent(query);
        if (requestedStudent && requestedStudent.id !== user.studentId) {
          return {
            result: null,
            summary: 'Privacy Policy: You can only view your own student profile details.',
            success: false
          };
        }
      }
      query = user.studentId;
    }

    const student = await findStudent(query);
    if (!student) {
      return {
        result: null,
        summary: `No student profile found matching "${query}".`,
        success: false
      };
    }

    if (user?.role === 'coach' && !verifyToolStudentAccess(user, student)) {
      return {
        result: null,
        summary: `Privacy Scoping: Coach access is restricted to assigned students. "${student.displayName}" is not assigned to your coaching roster.`,
        success: false
      };
    }

    const summary = `📋 **Student Profile: ${student.displayName}** (${student.status})\n• **Coach**: ${student.coachName || 'Unassigned'}\n• **Grade & School**: ${student.gradeClass} at ${student.schoolName}\n• **Hand / Script**: ${student.dominantHand} Hand • ${student.scriptsRequired.join(', ')}\n• **Batch Schedule**: ${student.preferredDays} at **${student.preferredSlot}**\n• **Parent Contact**: ${student.parentName} (${student.whatsappMobile}, ${student.email})\n• **Baseline Speed**: ${student.baselineSpeedWpm || 16} WPM`;

    return {
      result: student,
      summary,
      success: true
    };
  }
};
