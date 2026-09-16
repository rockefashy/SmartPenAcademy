import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { db } from './supabaseDb.ts';
import { User, StudentProfile, ROLES, AuditExecutionMode } from '../src/types';
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

// Build dynamic role-tailored system instructions
function buildRoleSystemInstruction(userContext: User | null): string {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  const baseHeader = `You are SmartPen Academy's intelligent AI Assistant.You work within the defined limits of this portal. 
Current Date & Day: ${dayOfWeek}, ${todayStr}
Academy Info: SmartPen Academy, Founder & Principal Coach Mrs. Deepthy Rock. 
Fee policy: ₹1,600 for every 8 classes. 
Payment : Google Pay payment number: 8861751000 
Age Groups: 4 to 18 years (Preschool to Grade 12).
Locations & Mode: Bangalore Coaching Center & Live Interactive Online Classes Worldwide.

PUBLIC WEB PORTAL KNOWLEDGE BASE (Available to all users, non logged in users, and visitors):
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
3. Founder: Mrs. Deepthy Rock, certified handwriting analyst. Visible transformation guaranteed in as few as 10 classes.
4. Free Demo Class: Available all days with 1-on-1 personalized slots between 04:00 PM and 07:00 PM. Parents can book directly via chat (providing child name, age, parent name, contact number, preferred date & time) or via the booking window.
5. Parent Testimonials: Verified 5 star rated Parents Testimonials are available in the portal. 
6. Public Portal Tools: You can invoke getCurriculum, getAboutUs, getTestimonials, bookDemoClass, and navigateToPage for any user inquiry regarding public academy information.;
7. Authentication, Credentials & Portal Access:
   - Primary & Only Active Login Method: Portal login is STRICTLY by Registered Email Address and password.
   - Prohibited / Non-Existent Login Methods: Login via mobile number, Student ID (e.g., 'SPA-XXXX' or UUID), or SMS OTP token is NOT supported. (If asked specifically about mobile number login, inform the user that login is currently by registered email, and mobile number login is planned for a future enhancement).
   - Credential Delivery: Initial portal credentials (Login Email and initial password) are dispatched exclusively to the registered parent email address upon student registration/enrollment.
   - Forgotten Passwords: Users can retrieve or reset their password by clicking the "Forgot Password?" link on the Sign In window; a secure reset link will be sent to their registered email address.
   - Action for Credential Inquiries: When a visitor, parent, or student asks for help with credentials, how to sign in, or how to access their account, explain that their Login ID is their registered Email Address and password, and invoke navigateToPage with target: "login".`;

  if (userContext?.role === ROLES.ADMIN) {
    return `${baseHeader}
Logged-in User Context (ADMINISTRATOR):
• Name: ${userContext.firstName}
• Role: admin
• Username: ${userContext.username}

Admin Guidelines:
You have full administrative capabilities. 
1. When the admin commands you to update attendance (e.g. 'Update attendance for Student 1, 2, 3 for today' or 'Mark a student as present'), you MUST call the updateAttendance tool with the student names, status, and date.
2. If the admin asks about fee dues, alerts, demo bookings, student profiles, schedules, or progress reports, call the corresponding tools.
3. When asked about classes or schedule today, call listStudents to check active students, inspect their batch schedule (preferredDays and preferredSlot) for ${dayOfWeek}, and report the schedule in natural language.
4. FINANCIAL CONFIRMATION POLICY: For recordFeePayment, if the admin is requesting to record a payment for the first time without explicit prior confirmation, set confirmed: false to produce a safety draft. If the admin explicitly says "Confirm payment", "Yes, record", or "Proceed", set confirmed: true.
5. ENROLLMENT CAPABILITY: You have access to the enrollStudent tool and can open the enrollment workspace by calling navigateToPage with target: "enroll".
6. Keep your conversational response warm, clear, professional, and well formatted with markdown bullet points.`;
  }

  if (userContext?.role === ROLES.COACH) {
    return `${baseHeader}
Logged-in User Context (COACH / TUTOR):
• Name: ${userContext.firstName}
• Role: coach
• Designation: ${userContext.designation || 'Coach'}
• User ID: ${userContext.id}

Coach Guidelines:
You have restricted administrative capabilities over your ASSIGNED STUDENTS. 
1. PROTECTED ROSTER & DAILY SCHEDULE: As a Coach, you have complete functional management over your ASSIGNED STUDENTS. You have tools including listStudents and getStudentProfile. When asked about today's classes or your coaching schedule (e.g. "Do I have classes today?"), invoke listStudents to retrieve your assigned students, inspect their batch schedule (preferredDays and preferredSlot) against today (${dayOfWeek}), and answer clearly in natural language.
2. SCOPED ATTENDANCE & PROFILES: You can mark and update attendance and inspect student profiles for students assigned to you. Any attempt to query or update students outside your coaching roster will be prevented by the system.
3. FEE MANAGEMENT FOR ASSIGNED STUDENTS: You can check fee status, dispatch fee reminder emails with UPI links, and record fee payments for your assigned students.
4. FINANCIAL CONFIRMATION POLICY: For recordFeePayment, if the coach is requesting to record a payment for the first time without explicit prior confirmation, set confirmed: false to produce a safety draft. If the coach explicitly says "Confirm payment", "Yes, record", or "Proceed", set confirmed: true.
5. NON-STUDENT RESTRICTIONS: Prospective website trial bookings (unassigned leads) and academy-level alerts remain global administrator tools.
6. Keep your tone encouraging, instructional, concise, and focused on student handwriting mastery.`;
  }

  if (userContext?.role === ROLES.STUDENT) {
    return `${baseHeader}
Logged-in User Context (STUDENT / PARENT):
• Name: ${userContext.firstName}
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
4. PERSONAL DATA SCOPE: If the student asks about their attendance history, class schedule, or fee status, you can check their personal attendance and fee cycle status using their student profile.
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
5. Student enrollment is managed exclusively by Academy Administrator Mrs. Deepthy Rock. When a visitor or prospective parent asks to enroll or register (e.g., "I want to enroll", "How to enroll"), explain that admissions and registrations are handled directly by the administrator after an initial demo and assessment. Invite them to book a Free Demo Class (call navigateToPage with target: "demo") or call bookDemoClass.
6. When a visitor asks how to pay coaching fees, call navigateToPage with target: "gpay".
7. Explain that private student attendance records, fee payment ledgers, and coach rosters require signing in with registered credentials.`;
}

// Master AI Agent Process Function - Direct LLM Reasoning with Tools and Natural Language Response
export async function handleAIAgentChat(reqBody: AIAgentRequest): Promise<{ reply: string; toolResults: ToolCallResult[] }> {
  const { messages, userContext, settings } = reqBody;
  const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
  const preferredModel = settings?.model || 'gemini-3.8-flash';

  if (!apiKey) {
    return {
      reply: "⚠️ The AI assistant is currently offline because the Gemini API key is not configured.",
      toolResults: []
    };
  }

  // Resilient model fallback chain with Gemini 3.8 Flash and Gemini 3.7 Flash as primary
  const candidateModels = [
    preferredModel,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ].filter((v, i, a) => a.indexOf(v) === i);

  const systemInstruction = buildRoleSystemInstruction(userContext);
  const activeTools = getToolsForRole(userContext?.role);

  // Construct conversation history for Gemini
  const contents: any[] = messages.slice(-10).map(m => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
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

  // Generous timeout (45 seconds) to give the LLM ample time for tool execution and response generation
  const fetchWithTimeout = async (
    modelName: string,
    callContents: any[],
    includeTools: boolean = true,
    timeoutMs: number = 45000
  ) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Model ${modelName} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const isThinkingModel = modelName.includes('3.') || modelName.includes('2.5');

    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents: callContents,
      config: {
        systemInstruction,
        temperature: settings?.temperature ?? 0.7,
        ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        ...(includeTools ? { tools: [{ functionDeclarations: activeTools }] } : {})
      }
    });

    return await Promise.race([generatePromise, timeoutPromise]);
  };

  let lastError: any = null;

  for (const modelToTry of candidateModels) {
    try {
      const response = await fetchWithTimeout(modelToTry, contents, true, 45000);

      const toolResults: ToolCallResult[] = [];
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const functionResponses: any[] = [];
        for (const fc of functionCalls) {
          const toolResult = await executeTool(fc.name, fc.args, userContext, 'remote_gemini');
          toolResults.push(toolResult);
          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: { result: toolResult.result || toolResult.summary },
              ...(fc.id ? { id: fc.id } : {})
            }
          });
        }

        // Pass model candidate content (including thoughtSignature) and tool responses back to Gemini
        try {
          const modelCandidateContent = response.candidates?.[0]?.content || {
            role: 'model',
            parts: functionCalls.map(fc => ({ functionCall: fc }))
          };

          const followUpContents = [
            ...contents,
            modelCandidateContent,
            {
              role: 'user',
              parts: functionResponses
            }
          ];

          // Call without tools so the model synthesizes the final conversational response
          const followUpResponse = await fetchWithTimeout(modelToTry, followUpContents, false, 45000);
          const followUpText = followUpResponse.text?.trim();
          if (followUpText) {
            return {
              reply: followUpText,
              toolResults
            };
          }
        } catch (followUpErr: any) {
          console.warn(`[AI_AGENT] Follow-up response synthesis with ${modelToTry} encountered error:`, followUpErr?.message || followUpErr);
        }

        // Graceful fallback to verified tool execution summaries if second conversational turn fails/throttles
        const toolSummaries = toolResults.map(t => t.summary).filter(Boolean).join('\n\n');
        return {
          reply: toolSummaries || "Your request was processed successfully.",
          toolResults
        };
      }

      return {
        reply: response.text || "I have processed your request.",
        toolResults: []
      };
    } catch (error: any) {
      lastError = error;
      const errMsg = error?.message || String(error);
      console.warn(`[AI_AGENT] Model ${modelToTry} failed:`, errMsg);

      // If transient 503 high demand spike, perform a single brief backoff retry before falling through
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
        try {
          console.info(`[AI_AGENT] Retrying ${modelToTry} after 1.5s backoff for transient 503...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          const retryResponse = await fetchWithTimeout(modelToTry, contents, true, 45000);
          if (retryResponse.text) {
            return {
              reply: retryResponse.text,
              toolResults: []
            };
          }
        } catch (retryErr: any) {
          console.warn(`[AI_AGENT] Retry for ${modelToTry} also failed:`, retryErr?.message || retryErr);
          lastError = retryErr;
        }
      }
      continue;
    }
  }

  // Parse error into human-friendly response rather than raw JSON
  const rawErr = lastError?.message || String(lastError || 'Unable to connect');
  let userFriendly = rawErr;
  if (rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED') || rawErr.includes('quota')) {
    userFriendly = "The AI service is temporarily experiencing high traffic or quota limits. Please try again in a few seconds.";
  } else if (rawErr.includes('503') || rawErr.includes('UNAVAILABLE') || rawErr.includes('high demand')) {
    userFriendly = "Google Gemini is temporarily experiencing high demand spikes on their servers. Please try sending your message again in a few moments.";
  } else if (rawErr.includes('403') || rawErr.includes('PERMISSION_DENIED') || rawErr.includes('denied access')) {
    userFriendly = "The AI service API key or project access is restricted by Google. Please check your Gemini API key in settings or the Google Cloud console.";
  } else if (rawErr.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawErr);
      userFriendly = parsed.error?.message || rawErr;
    } catch {
      userFriendly = rawErr;
    }
  }

  return {
    reply: `⚠️ ${userFriendly}`,
    toolResults: []
  };
}
