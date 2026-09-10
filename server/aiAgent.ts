import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { db } from './supabaseDb.ts';
import { User, StudentProfile, AuditExecutionMode } from '../src/types';
import { sendFeeReminderEmail } from './email.ts';
import { landingProperties } from '../src/properties/landing.properties.ts';
import { ALL_TOOLS, PUBLIC_TOOLS, getToolsForRole, toolRegistry } from './tools/registry.ts';
export { ALL_TOOLS, PUBLIC_TOOLS, getToolsForRole, toolRegistry };
import { verifyToolStudentAccess, canCoachAccessStudent, findStudent } from './tools/helpers.ts';
export { verifyToolStudentAccess, canCoachAccessStudent, findStudent };

// ================= RATE LIMITING FOR MUTATING TOOLS (SUPABASE-BACKED ATOMIC RPC) =================
async function checkToolRateLimit(
  userId: string, 
  toolName: string, 
  maxCalls: number, 
  windowMs: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `tool:${userId}:${toolName}`;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  return await db.checkRateLimit(key, maxCalls, windowSeconds);
}

export interface ToolCallResult {
  toolName: string;
  args: any;
  result: any;
  summary: string;
  success: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
  toolResults?: ToolCallResult[];
}

export interface AIAgentRequest {
  messages: ChatMessage[];
  userContext: User | null;
  settings?: {
    apiKey?: string;
    apiUrl?: string;
    model?: string;
    temperature?: number;
  };
}

// AgentTool Execution Engine with Strict Ownership Validation, Rate-Limiting, and Centralized Audit Logging
export async function executeTool(
  name: string, 
  args: any, 
  userContext: User | null, 
  executionMode: AuditExecutionMode = 'remote_gemini'
): Promise<ToolCallResult> {
  const today = new Date().toISOString().split('T')[0];

  const logAudit = async (result: any, summary: string, success: boolean): Promise<ToolCallResult> => {
    // Redact sensitive password fields from arguments to prevent credential leakage
    const sanitizedArgs: Record<string, any> = {};
    if (args && typeof args === 'object') {
      for (const [key, value] of Object.entries(args)) {
        if (key.toLowerCase().includes('password')) {
          sanitizedArgs[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.startsWith('data:image/')) {
          sanitizedArgs[key] = value.substring(0, 40) + '...[BASE64_IMAGE_DATA]';
        } else {
          sanitizedArgs[key] = value;
        }
      }
    }

    try {
      await db.recordToolAuditLog({
        actorId: userContext?.id || 'anonymous',
        actorUsername: userContext?.username || 'anonymous',
        actorRole: userContext?.role || 'student',
        actorStudentId: userContext?.studentId,
        toolName: name,
        arguments: sanitizedArgs,
        result: result ? (typeof result === 'object' ? result : { data: result }) : null,
        summary,
        success,
        executionMode
      });
    } catch (auditErr) {
      console.error('[AUDIT LOG ERROR]', auditErr);
    }

    return {
      toolName: name,
      args: sanitizedArgs,
      result,
      summary,
      success
    };
  };

  // 1. Tool Lookup in AgentTool Registry
  const tool = toolRegistry[name];
  if (!tool) {
    return await logAudit(null, `Tool ${name} is not recognized.`, false);
  }

  // 2. Atomic PostgreSQL Rate Limiting via tool-declared threshold
  const rateLimit = tool.rateLimit || { maxCalls: 30, windowMs: 60 * 1000 };
  const rateCheck = await checkToolRateLimit(userContext?.id || 'anonymous', name, rateLimit.maxCalls, rateLimit.windowMs);
  if (!rateCheck.allowed) {
    return await logAudit(
      null,
      `Rate limit exceeded: Too many '${name}' calls requested in a short period. Please wait ${rateCheck.retryAfter} seconds before trying again.`,
      false
    );
  }

  // 3. Declarative Role-Based Access Control
  if (tool.allowedRoles && tool.allowedRoles.length > 0) {
    if (!userContext || !tool.allowedRoles.includes(userContext.role as any)) {
      return await logAudit(
        null,
        tool.accessDeniedMessage || `Access Denied: You do not have permission to execute '${name}'.`,
        false
      );
    }
  }

  // 4. Execution & Centralized Audit Logging
  try {
    const res = await tool.execute(args || {}, {
      user: userContext,
      executionMode,
      today
    });
    return await logAudit(res.result, res.summary, res.success !== false);
  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error);
    return await logAudit(null, `Error executing tool ${name}: ${error.message || error}`, false);
  }
}

// Heuristic NLP fallback agent if Gemini is unavailable or key is not configured
export async function runLocalAgent(
  prompt: string,
  userContext: User | null,
  messages: ChatMessage[] = []
): Promise<{ reply: string; toolResults: ToolCallResult[] }> {
  const p = prompt.toLowerCase().trim();
  const toolResults: ToolCallResult[] = [];

  // Check previous assistant message to see if we are in a pending confirmation state
  const prevAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' || m.role === 'model');
  const prevContent = (prevAssistantMessage?.content || '').toLowerCase();
  const isAwaitingAttendanceConfirm = prevContent.includes('confirmation required before updating attendance') || prevContent.includes('confirm attendance');
  const isAwaitingFeeConfirm = prevContent.includes('confirmation required before recording payment') || prevContent.includes('confirm payment');

  const isExplicitConfirmationOnly = 
    p === 'confirm' ||
    p === 'yes' ||
    p === 'yes confirm' ||
    p === 'confirm payment' ||
    p === 'confirm attendance' ||
    p === 'yes, record' ||
    p === 'proceed' ||
    p === 'yes proceed' ||
    p.startsWith('yes, record fee') ||
    p.startsWith('yes, mark');

  // Handle follow-up confirmation for attendance
  if (isAwaitingAttendanceConfirm && isExplicitConfirmationOnly && (userContext?.role === 'admin' || userContext?.role === 'coach')) {
    // Parse the students, date, and status from the previous prompt/content
    const status = prevContent.includes('absent') ? 'Absent' : 'Present';
    let targetNames: string[] = [];

    const allStudents = await db.getAllStudents();
    allStudents.forEach(st => {
      if (prevContent.includes(st.displayName.toLowerCase())) {
        targetNames.push(st.displayName);
      }
    });

    if (prevContent.includes('all active students') || targetNames.length === 0) {
      targetNames = ['all'];
    }

    // Extract date from previous message or prompt
    let followUpDate = 'today';
    const prevDateMatchIso = (prevContent + ' ' + prompt).match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    const prevDateMatchSlash = (prevContent + ' ' + prompt).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (prevDateMatchIso) {
      const [, y, m, d] = prevDateMatchIso;
      followUpDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else if (prevDateMatchSlash) {
      const [, m, d, y] = prevDateMatchSlash;
      followUpDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const result = await executeTool('updateAttendance', {
      studentNames: targetNames,
      status,
      date: followUpDate
    }, userContext, 'local_agent');

    toolResults.push(result);
    return {
      reply: `${result.summary}\n\nAttendance has been successfully confirmed and recorded. Is there anything else you would like to manage?`,
      toolResults
    };
  }

  // Handle follow-up confirmation for fee payment
  if (isAwaitingFeeConfirm && isExplicitConfirmationOnly && (userContext?.role === 'admin' || userContext?.role === 'coach')) {
    let studentQuery = '';
    const allStudents = await db.getAllStudents();
    allStudents.forEach(st => {
      if (prevContent.includes(st.displayName.toLowerCase())) {
        studentQuery = st.displayName;
      }
    });

    const result = await executeTool('recordFeePayment', {
      studentNameOrId: studentQuery || 'Aarav Mehta',
      amount: 1600,
      confirmed: true
    }, userContext, 'local_agent');

    toolResults.push(result);
    return {
      reply: `${result.summary}\n\nPayment has been officially confirmed and the receipt is saved in the ledger.`,
      toolResults
    };
  }

  // Public Web Portal Knowledge Intents: Curriculum, About Us, Testimonials, Demo Booking
  if (p.includes('curriculum') || p.includes('syllabus') || p.includes('module') || p.includes('what do you teach') || p.includes('course') || p.includes('workshop') || p.includes('bootcamp')) {
    const result = await executeTool('getCurriculum', { topic: 'all' }, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  if (p.includes('about') || p.includes('who is') || p.includes('deepthy') || p.includes('founder') || p.includes('philosophy') || p.includes('academy info')) {
    const result = await executeTool('getAboutUs', {}, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  if (p.includes('testimonial') || p.includes('review') || p.includes('feedback') || p.includes('parent voice') || p.includes('rating') || p.includes('what parents say') || p.includes('experience')) {
    const result = await executeTool('getTestimonials', { limit: 5 }, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  // 1. Navigation intents: Enroll, Book a demo, GPAY payment, syllabus, about
  if ((userContext?.role !== 'admin' || p.includes('open enroll') || p.includes('go to enroll') || p.includes('navigate to enroll')) && (p.includes('enroll') || p.includes('register') || p.includes('join') || p.includes('admission') || p.includes('sign up'))) {
    const result = await executeTool('navigateToPage', { target: 'enroll', reason: 'Student Registration / Enrollment' }, userContext, 'local_agent');
    toolResults.push(result);
    return {
      reply: `I have opened the **Student Enrollment & Registration** page for you! You can fill in the student details, select script preferences (Print / Cursive), and secure your coaching batch.`,
      toolResults
    };
  }

  if (p.includes('book demo') || p.includes('free demo') || p.includes('book a demo') || p.includes('trial class') || (p.includes('demo') && (p.includes('book') || p.includes('schedule') || p.includes('slot')))) {
    const result = await executeTool('bookDemoClass', {}, userContext, 'local_agent');
    const navResult = await executeTool('navigateToPage', { target: 'demo', reason: 'Book Free Demo Class' }, userContext, 'local_agent');
    toolResults.push(result);
    toolResults.push(navResult);
    return {
      reply: `${result.summary}\n\nI have also opened the **Free Demo Class Booking** window for you!`,
      toolResults
    };
  }

  if (p.includes('gpay') || p.includes('google pay') || p.includes('pay fee') || p.includes('pay money') || p.includes('payment to coach') || p.includes('pay coach') || p.includes('upi')) {
    const result = await executeTool('navigateToPage', { target: 'gpay', reason: 'Google Pay Coaching Fee Payment' }, userContext, 'local_agent');
    toolResults.push(result);
    return {
      reply: `You can send the coaching fee directly via **Google Pay (GPAY)** to Head Coach Mrs. Deepthy Rock at **8861751000** (₹1,600 for 8 classes). I've generated the direct payment button below for you!`,
      toolResults
    };
  }

  // Attendance update pattern: e.g. "update attendance for student 1, 2, 3 for today" or "mark attendance for aryan as present"
  if (p.includes('attendance') && (p.includes('update') || p.includes('mark') || p.includes('present') || p.includes('absent') || p.includes('save') || p.includes('record') || p.includes('set'))) {
    if (userContext?.role !== 'admin' && userContext?.role !== 'coach') {
      return {
        reply: `⚠️ **Permission Denied**: Student and parent accounts cannot record or update attendance records. Only Head Coach / Administrator **Mrs. Deepthy Rock** has permission to officially mark attendance. You can view your current attendance count by asking *"What is my attendance?"*.`,
        toolResults: []
      };
    }

    // Extract names
    const status = p.includes('absent') ? 'Absent' : 'Present';
    let targetNames: string[] = [];
    let isAmbiguous = false;

    if (p.includes('all') || p.includes('everyone')) {
      targetNames = ['all'];
    } else {
      // Find students from database mentioned in prompt
      const allStudents = await db.getAllStudents();
      allStudents.forEach(st => {
        const firstName = st.displayName.toLowerCase().split(' ')[0];
        if (p.includes(firstName) || p.includes(st.displayName.toLowerCase()) || p.includes(st.id.toLowerCase())) {
          targetNames.push(st.displayName);
        }
      });

      // Match "student 1, 2, 3" or "student1,2,3"
      const numberMatches = p.match(/student\s*(\d+)/gi);
      if (numberMatches) {
        numberMatches.forEach(m => {
          const num = parseInt(m.replace(/\D/g, ''), 10) - 1;
          if (num >= 0 && num < allStudents.length) {
            targetNames.push(allStudents[num].displayName);
          }
        });
      }

      // If still empty but text has comma separated list
      if (targetNames.length === 0) {
        const afterFor = prompt.split(/for|to|students?/i)[1];
        if (afterFor) {
          const candidates = afterFor.split(/,|and|\bfor\b|\btoday\b/i).map(s => s.trim()).filter(Boolean);
          for (const c of candidates) {
            const found = await findStudent(c);
            if (found) targetNames.push(found.displayName);
          }
        }
      }
    }

    if (targetNames.length === 0) {
      isAmbiguous = true;
      targetNames = ['all']; // default if no specific name provided
    }

    // Confirmation Step: If targeting more than one student or if the match was ambiguous/broad, ask for confirmation first
    const isMultiOrAmbiguous = targetNames.length > 1 || targetNames.includes('all') || isAmbiguous;
    if (isMultiOrAmbiguous) {
      const studentListDisplay = targetNames.includes('all') ? 'All Active Students' : targetNames.join(', ');
      const todayStr = new Date().toISOString().split('T')[0];
      const activeCount = (await db.getAllStudents()).filter(s => s.status === 'Active').length;
      return {
        reply: `⚠️ **Confirmation Required Before Updating Attendance**\n\n• **Students**: ${studentListDisplay} (${targetNames.includes('all') ? activeCount : targetNames.length} students)\n• **Status**: **${status}**\n• **Date**: **${todayStr}**\n\nPlease reply **"Confirm attendance"** or **"Yes, proceed"** to officially mark and record these attendance records.`,
        toolResults: []
      };
    }

    // Extract date if specified in prompt, e.g. "on 9/9/2026", "9/9/2026", "2026-09-09"
    let targetDate = 'today';
    const dateMatchIso = prompt.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    const dateMatchSlash = prompt.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (dateMatchIso) {
      const [, y, m, d] = dateMatchIso;
      targetDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else if (dateMatchSlash) {
      const [, m, d, y] = dateMatchSlash;
      targetDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const result = await executeTool('updateAttendance', {
      studentNames: targetNames,
      status,
      date: targetDate
    }, userContext, 'local_agent');

    toolResults.push(result);
    return {
      reply: `${result.summary}\n\nIs there anything else you would like me to assist you with (e.g. fee receipt, progress reports, or student profiles)?`,
      toolResults
    };
  }

  // Attendance check
  if (p.includes('attendance') || p.includes('classes attended') || p.includes('class count')) {
    let studentQuery = '';
    const allStudents = await db.getAllStudents();
    allStudents.forEach(st => {
      if (p.includes(st.displayName.toLowerCase()) || p.includes(st.displayName.toLowerCase().split(' ')[0])) {
        studentQuery = st.displayName;
      }
    });
    const result = await executeTool('getAttendance', { studentNameOrId: studentQuery }, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  // Fee dues / fee alerts / fee status
  if (p.includes('fee') || p.includes('payment') || p.includes('gpay') || p.includes('dues') || p.includes('receipt')) {
    if (p.includes('pay') && p.includes('record')) {
      let studentQuery = '';
      const allStudents = await db.getAllStudents();
      allStudents.forEach(st => {
        if (p.includes(st.displayName.toLowerCase()) || p.includes(st.displayName.toLowerCase().split(' ')[0])) {
          studentQuery = st.displayName;
        }
      });

      // Local agent requires a separate follow-up message for confirmation (confirmed: false on initial request)
      const result = await executeTool('recordFeePayment', { 
        studentNameOrId: studentQuery || 'Aarav Mehta', 
        amount: 1600,
        confirmed: false
      }, userContext, 'local_agent');
      toolResults.push(result);
      return { reply: result.summary, toolResults };
    }

    if (p.includes('remind') || p.includes('send reminder')) {
      let studentQuery = '';
      const allStudents = await db.getAllStudents();
      allStudents.forEach(st => {
        if (p.includes(st.displayName.toLowerCase()) || p.includes(st.displayName.toLowerCase().split(' ')[0])) {
          studentQuery = st.displayName;
        }
      });
      const result = await executeTool('sendFeeReminder', { studentNameOrId: studentQuery || 'Khwaish Sharma' }, userContext, 'local_agent');
      toolResults.push(result);
      return { reply: result.summary, toolResults };
    }

    let studentQuery = '';
    const allStudents = await db.getAllStudents();
    allStudents.forEach(st => {
      if (p.includes(st.displayName.toLowerCase()) || p.includes(st.displayName.toLowerCase().split(' ')[0])) {
        studentQuery = st.displayName;
      }
    });
    const result = await executeTool('getFeeStatus', { studentNameOrId: studentQuery }, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  // Demo bookings
  if (p.includes('demo') || p.includes('trial') || p.includes('booking')) {
    const result = await executeTool('getDemoBookings', {}, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  // Alerts
  if (p.includes('alert') || p.includes('notification')) {
    const result = await executeTool('getAdminAlerts', {}, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  // Progress report
  if (p.includes('progress report') || p.includes('report card') || p.includes('evaluation')) {
    let studentQuery = '';
    const allStudents = await db.getAllStudents();
    allStudents.forEach(st => {
      if (p.includes(st.displayName.toLowerCase()) || p.includes(st.displayName.toLowerCase().split(' ')[0])) {
        studentQuery = st.displayName;
      }
    });

    if (p.includes('generate') || p.includes('create') || p.includes('make')) {
      const result = await executeTool('generateProgressReport', {
        studentNameOrId: studentQuery || 'Aarav Mehta',
        milestoneTitle: 'After 10 Classes',
        overallStars: 5
      }, userContext, 'local_agent');
      toolResults.push(result);
      return { reply: result.summary, toolResults };
    }
  }

  // List students
  if (p.includes('student') && (p.includes('list') || p.includes('all') || p.includes('show') || p.includes('enrolled'))) {
    const result = await executeTool('listStudents', {}, userContext, 'local_agent');
    toolResults.push(result);
    return { reply: result.summary, toolResults };
  }

  // Default greetings & help
  if (userContext?.role === 'admin') {
    return {
      reply: `Hello **${userContext.displayName || 'Admin'}**! I am your **SmartPen AI Assistant**. I can perform real-time actions across the academy:\n\n• **Mark attendance**: *"Update attendance for Student 1, 2, 3 for today"* or *"Mark Aryan and Ananya as Present"*\n• **Check Fee Dues & Alerts**: *"Check fee alerts"* or *"Send fee reminder to Khwaish"*\n• **Lookup Profiles**: *"Show student profile for Aarav"*\n• **Generate Progress Reports**: *"Generate progress report for Siddharth"*\n\nHow can I help you today?`,
      toolResults: []
    };
  } else if (userContext?.role === 'coach') {
    const designationSuffix = userContext.designation ? ` (${userContext.designation})` : '';
    return {
      reply: `Hello Coach **${userContext.displayName || 'Tutor'}**${designationSuffix}! Welcome to your coaching assistant. You have full management over your assigned students:\n\n• **Attendance**: *"Mark Aarav as Present today"* or *"Update attendance for my batch"*\n• **Fee Management**: *"Check fee status for my students"*, *"Send fee reminder to [Student]"*, or *"Record fee payment"*\n• **Progress Reports**: *"Generate progress report for my student"*\n• **Roster & Profiles**: *"Show my assigned students"* or *"Show profile for Ananya"*\n\nWhat would you like to work on?`,
      toolResults: []
    };
  } else if (userContext?.role === 'student') {
    return {
      reply: `Hello **${userContext.displayName || 'Student'}**! Welcome to your AI Handwriting Assistant. You can ask me:\n\n• *"What is my attendance record?"*\n• *"Do I have any pending fee?"*\n• *"What is my class schedule and milestone?"*\n• *"Show my skill ratings"*\n\nWhat would you like to review today?`,
      toolResults: []
    };
  } else {
    return {
      reply: `Welcome to SmartPen Academy AI! Please **sign in** with your administrator, coach, or student credentials to access real-time attendance management, student tracking, and progress analytics.`,
      toolResults: []
    };
  }
}

// Build dynamic role-tailored system instructions
function buildRoleSystemInstruction(userContext: User | null): string {
  const todayStr = new Date().toISOString().split('T')[0];
  const baseHeader = `You are SmartPen Academy's intelligent AI Assistant.
Current Date: ${todayStr}
Academy Info: SmartPen Academy, Founder & Principal Coach Mrs. Deepthy Rock. 
Fee policy: ₹1,600 for every 8 classes. Google Pay payment number: 8861751000 (UPI: 8861751000@okbizaxis).
Age Groups: 4 to 18 years (Preschool to Grade 12).
Locations & Mode: Bangalore Coaching Center & Live Interactive Online Classes Worldwide.

PUBLIC WEB PORTAL KNOWLEDGE BASE (Available to all users, parents, and visitors):
1. Curriculum Blueprint (7 Progressive Modules):
   - Module 1: Assessment & Foundation (Tripod grip, posture, wrist alignment)
   - Module 2: Letter Formation & Consistency (Uniform letter size, height, shape, slant)
   - Module 3: Spacing & Alignment & Word Formation (Letter/word spacing, baseline control, word joins)
   - Module 4: Sentence & Paragraph Writing (Margins, headings, underline tactics)
   - Module 5: Academic Excellence (Subject presentation, Math numericals/formulas, diagrams)
   - Module 6: Speed & Presentation Improvement (Timed drills, exam speed without losing neatness)
   - Module 7: Final Improvement & Confidence (Individual feedback, SmartPen Certification)
2. Specialized Bootcamps & Workshops:
   - Super-Speed Exam Writing Intensive (Grades 5-12, eliminates exam time crunch)
   - Little Scribblers: Grip & Fine Motor Foundation (Ages 4-6, color-coded 4-line stroke guidance)
   - Artistic Cursive & Calligraphy Masterclass (Ages 7-18, fluid loops, signature styling)
3. Founder: Mrs. Deepthy Rock, certified handwriting analyst with over a decade of pedagogical research in kinetic motor skills and exam psychology. Visible transformation guaranteed in as few as 10 classes.
4. Free Demo Class: Available all days with 1-on-1 personalized slots between 04:00 PM and 07:00 PM. Parents can book directly via chat (providing child name, age, parent name, contact number, preferred date & time) or via the booking window.
5. Parent Testimonials: Over 15,000 students coached with 98.4% exam presentation improvement and verified 5-star parent ratings.
6. Public Portal Tools: You can invoke getCurriculum, getAboutUs, getTestimonials, bookDemoClass, and navigateToPage for any user inquiry regarding public academy information.`;

  if (userContext?.role === 'admin') {
    return `${baseHeader}
Logged-in User Context (ADMINISTRATOR):
• Name: ${userContext.displayName}
• Role: admin
• Username: ${userContext.username}

Admin Guidelines:
1. You have full administrative capabilities. When the admin commands you to update attendance (e.g. 'Update attendance for Student 1, 2, 3 for today' or 'Mark Aryan as present'), you MUST call the updateAttendance tool with the student names, status, and date.
2. If the admin asks about fee dues, alerts, demo bookings, student profiles, or progress reports, call the corresponding tools.
3. FINANCIAL CONFIRMATION POLICY: For recordFeePayment, if the admin is requesting to record a payment for the first time without explicit prior confirmation, set confirmed: false to produce a safety draft. If the admin explicitly says "Confirm payment", "Yes, record", or "Proceed", set confirmed: true.
4. Keep your conversational response warm, clear, professional, and well formatted with markdown bullet points.`;
  }

  if (userContext?.role === 'coach') {
    return `${baseHeader}
Logged-in User Context (COACH / TUTOR):
• Name: ${userContext.displayName}
• Role: coach
• Designation: ${userContext.designation || 'Coach'}
• User ID: ${userContext.id}

Coach Guidelines:
1. PROTECTED ROSTER ACCESS: As a Coach, you have complete functional management over your ASSIGNED STUDENTS (identical to the administrator's powers over students). This includes marking attendance, viewing student profiles, generating milestone progress reports, checking fee status, dispatching fee reminders, and recording fee payments.
2. SCOPED ATTENDANCE & PROFILES: You can mark and update attendance and inspect student profiles for students assigned to you. Any attempt to query or update students outside your coaching roster will be prevented by the system.
3. FEE MANAGEMENT FOR ASSIGNED STUDENTS: You can check fee status, dispatch fee reminder emails with UPI links, and record fee payments for your assigned students.
4. FINANCIAL CONFIRMATION POLICY: For recordFeePayment, if the coach is requesting to record a payment for the first time without explicit prior confirmation, set confirmed: false to produce a safety draft. If the coach explicitly says "Confirm payment", "Yes, record", or "Proceed", set confirmed: true.
5. NON-STUDENT RESTRICTIONS: Prospective website trial bookings (unassigned leads) and academy-level alerts remain global administrator tools.
6. Keep your tone encouraging, instructional, concise, and focused on student handwriting mastery.`;
  }

  if (userContext?.role === 'student') {
    return `${baseHeader}
Logged-in User Context (STUDENT / PARENT):
• Name: ${userContext.displayName}
• Role: student
• Username: ${userContext.username}
• Student ID: ${userContext.studentId || 'N/A'}

Student / Parent Guidelines:
1. STRICT ROLE PERMISSION BOUNDARIES: The user is a student or parent. Students and parents have READ-ONLY access to their own attendance records, fee receipts, progress reports, and batch schedules.
2. ATTENDANCE & MUTATION POLICY: Parents and students CANNOT mark or update attendance, record fee payments, or modify academy records. If a parent or student asks to mark attendance (e.g. 'Mark me present', 'Update attendance for today'), POLITELY EXPLAIN that attendance can only be officially recorded and updated by Head Coach / Administrator Mrs. Deepthy Rock.
3. ENROLLMENT, DEMO BOOKING & GPAY NAVIGATION:
   • If the user asks to enroll or register (e.g., "I want to enroll", "Register child", "Admission"), you MUST call the \`navigateToPage\` tool with target: "enroll".
   • If the user asks to book a free demo class / trial (e.g., "Book a demo", "Schedule trial class"), you MUST call the \`navigateToPage\` tool with target: "demo".
   • If the user asks to pay fees, GPAY money to the coach, or make a payment (e.g., "How to pay", "GPAY money to coach", "Pay ₹1600 fee"), you MUST call the \`navigateToPage\` tool with target: "gpay" (Google Pay UPI: 8861751000).
   • If the user asks to see their student portal / attendance dashboard, call \`navigateToPage\` with target: "parentPortal".
4. PERSONAL DATA SCOPE: If the student asks about their attendance history or fee status, you can check their personal attendance and fee cycle status using their student profile.
5. LEARNING & COACHING: Help them with handwriting tips, posture advice, speed writing techniques, and course information.
6. Keep your tone encouraging, warm, respectful, and helpful.`;
  }

  return `${baseHeader}
Logged-in User Context: GUEST / VISITOR (Not logged in)

Guest Guidelines:
1. Enthusiastically welcome the prospective parent or student to SmartPen Academy.
2. Provide rich, accurate answers about our courses, 7-module curriculum, specialized workshops, fee policy (₹1,600 for 8 classes), and Founder Mrs. Deepthy Rock.
3. Call getCurriculum, getAboutUs, getTestimonials, and bookDemoClass whenever relevant.
4. When a visitor expresses interest in trial classes, invite them to book a Free Demo Class (slots between 4 PM and 7 PM) or call navigateToPage with target: "demo".
5. When a visitor wants to enroll, call navigateToPage with target: "enroll".
6. When a visitor asks how to pay coaching fees, call navigateToPage with target: "gpay".
7. Explain that private student attendance records, fee payment ledgers, and coach rosters require signing in with registered credentials.`;
}

// Master AI Agent Process Function with Instant Fast-Path and High-Speed Low-Latency Fallbacks
export async function handleAIAgentChat(reqBody: AIAgentRequest): Promise<{ reply: string; toolResults: ToolCallResult[] }> {
  const { messages, userContext, settings } = reqBody;
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const userPrompt = (lastUserMessage?.content || '').trim();
  const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
  const preferredModel = settings?.model || 'gemini-2.5-flash';

  // If no Gemini API key is configured or requested, run our robust high-accuracy local agent engine
  if (!apiKey) {
    return await runLocalAgent(userPrompt, userContext, messages);
  }

  // Model fallback chain prioritized by latency and speed
  const candidateModels = [
    preferredModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.7-flash'
  ].filter((v, i, a) => a.indexOf(v) === i); // unique

  const systemInstruction = buildRoleSystemInstruction(userContext);
  const activeTools = getToolsForRole(userContext?.role);

  // Construct conversation history for Gemini (keep history compact for fast inference)
  const contents: any[] = messages.slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  // Helper with 4.5-second timeout per model to prevent sluggish response hangs
  const fetchWithTimeout = async (modelName: string, timeoutMs: number = 4500) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Model ${modelName} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature: settings?.temperature ?? 0.7,
        tools: [{ functionDeclarations: activeTools }]
      }
    });

    return await Promise.race([generatePromise, timeoutPromise]);
  };

  for (const modelToTry of candidateModels) {
    try {
      const response = await fetchWithTimeout(modelToTry, 4500);

      const toolResults: ToolCallResult[] = [];
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          const toolResult = await executeTool(fc.name, fc.args, userContext, 'remote_gemini');
          toolResults.push(toolResult);
        }

        // Generate a conversational response incorporating the tool outputs
        const toolSummaries = toolResults.map(t => t.summary).join('\n\n');
        const finalReply = response.text ? `${response.text}\n\n${toolSummaries}` : toolSummaries;

        return {
          reply: finalReply,
          toolResults
        };
      }

      return {
        reply: response.text || "I've processed your request.",
        toolResults: []
      };
    } catch (error: any) {
      // If error or timeout occurs, silently try the next model or proceed to instant local agent
      continue;
    }
  }

  // If all remote models take too long or are rate-limited, provide immediate high-accuracy local resolution
  return await runLocalAgent(userPrompt, userContext, messages);
}
