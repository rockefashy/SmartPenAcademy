import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';

export const navigateToPageDeclaration: FunctionDeclaration = {
  name: 'navigateToPage',
  description: 'Direct or navigate the user to a specific page or action in the application, such as student registration/enrollment, free demo class booking, GPAY coaching fee payment, parent portal, syllabus, or home.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: {
        type: Type.STRING,
        description: 'The destination target: "enroll" (Student Enrollment / Registration), "demo" (Book a Free Demo Class), "gpay" (GPAY Fee Payment to 8861751000), "parentPortal" (Parent / Student Portal), "about" (About Us & Founder), "syllabus" (Course Curriculum & Modules), "admin" (Admin Workspace).'
      },
      reason: {
        type: Type.STRING,
        description: 'Brief reason or message explaining where you are directing the user.'
      }
    },
    required: ['target']
  }
};

export const navigateToPageTool: AgentTool = {
  name: 'navigateToPage',
  declaration: navigateToPageDeclaration,
  rateLimit: { maxCalls: 60, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;
    const target = (args?.target || 'enroll').toLowerCase().trim();
    const reason = args?.reason || 'Directing to requested page';
    let pageTitle = 'Enrollment';
    let resolvedView = 'enroll';
    let actionDescription = 'Opening student registration form...';

    if (target.includes('demo') || target.includes('trial') || target.includes('free class')) {
      pageTitle = 'Free Demo Class Booking';
      resolvedView = 'demo';
      actionDescription = 'Opening Free Demo Class booking window...';
    } else if (target.includes('gpay') || target.includes('pay') || target.includes('fee') || target.includes('upi')) {
      pageTitle = 'Fee Payment / Google Pay (GPAY)';
      resolvedView = 'gpay';
      actionDescription = 'Opening GPAY payment to Coach Deepthy Rock (8861751000)...';
    } else if (target.includes('parent') || target.includes('portal') || target.includes('student')) {
      pageTitle = 'Student & Parent Portal';
      resolvedView = 'parentPortal';
      actionDescription = 'Navigating to Student & Parent Portal...';
    } else if (target.includes('about') || target.includes('coach') || target.includes('founder')) {
      pageTitle = 'About Us & Founder Deepthy Rock';
      resolvedView = 'about';
      actionDescription = 'Navigating to About Us page...';
    } else if (target.includes('syllabus') || target.includes('curriculum') || target.includes('module')) {
      pageTitle = 'Curriculum & Syllabus';
      resolvedView = 'syllabus';
      actionDescription = 'Navigating to Course Syllabus & Modules...';
    } else if (target.includes('admin') || target.includes('dashboard')) {
      if (user?.role !== 'admin') {
        return {
          result: null,
          summary: 'Access Denied: Only administrators can access the Admin Workspace.',
          success: false
        };
      }
      pageTitle = 'Administrator Workspace';
      resolvedView = 'admin';
      actionDescription = 'Navigating to Administrator Workspace...';
    } else {
      pageTitle = 'Student Enrollment';
      resolvedView = 'enroll';
      actionDescription = 'Navigating to Student Registration page...';
    }

    const navPayload = {
      target: resolvedView,
      pageTitle,
      gpayNumber: '8861751000',
      gpayLink: 'upi://pay?pa=8861751000@okbizaxis&pn=SmartPen%20Academy&am=1600&cu=INR',
      studentId: user?.studentId,
      reason
    };

    return {
      result: navPayload,
      summary: `🧭 **${pageTitle}**: ${actionDescription}`,
      success: true
    };
  }
};
