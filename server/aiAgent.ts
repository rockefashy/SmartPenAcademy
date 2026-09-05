import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { db } from './supabaseDb.ts';
import { User, StudentProfile } from '../src/types';
import { sendFeeReminderEmail } from './email.ts';

// ================= RATE LIMITING FOR MUTATING TOOLS =================
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const toolRateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired tool rate limit buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of toolRateLimitStore.entries()) {
    if (bucket.resetTime < now) {
      toolRateLimitStore.delete(key);
    }
  }
}, 60000);

function checkToolRateLimit(userId: string, toolName: string, maxCalls: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const key = `${userId}:${toolName}`;
  const now = Date.now();
  let bucket = toolRateLimitStore.get(key);

  if (!bucket || bucket.resetTime < now) {
    toolRateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= maxCalls) {
    const retryAfter = Math.ceil((bucket.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
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

// Function Declarations for Gemini
const updateAttendanceTool: FunctionDeclaration = {
  name: 'updateAttendance',
  description: 'Update or mark attendance (Present / Absent) for one or more students for a specific date (default today).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNames: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Names or IDs of students to update attendance for (e.g. ["Khwaish", "Aarav", "Ananya"]).'
      },
      status: {
        type: Type.STRING,
        description: 'Attendance status: "Present" or "Absent". Default is "Present".'
      },
      date: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format, or "today".'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional coach notes or topic covered.'
      }
    },
    required: ['studentNames']
  }
};

const getAttendanceTool: FunctionDeclaration = {
  name: 'getAttendance',
  description: 'Get attendance history, present count, and total classes attended for a student or entire academy.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student to lookup. If blank, returns overall attendance summary.'
      },
      yearMonth: {
        type: Type.STRING,
        description: 'Optional period in YYYY-MM format.'
      }
    }
  }
};

const getFeeStatusTool: FunctionDeclaration = {
  name: 'getFeeStatus',
  description: 'Check fee payment status, 8-class cycle receipts, due alerts, and GPAY payment link (8861751000).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of student to check fee status for.'
      }
    }
  }
};

const recordFeePaymentTool: FunctionDeclaration = {
  name: 'recordFeePayment',
  description: 'Record an 8-class cycle coaching fee payment of ₹1,600 or custom amount and generate a receipt. If confirmed is false, returns a draft preview requiring user confirmation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of student making the fee payment.'
      },
      amount: {
        type: Type.NUMBER,
        description: 'Amount in INR (default 1600).'
      },
      cyclePeriod: {
        type: Type.STRING,
        description: 'Cycle label, e.g. "Classes 1 - 8", "Classes 9 - 16", or month e.g. "August 2026".'
      },
      paymentMethod: {
        type: Type.STRING,
        description: 'Payment method, e.g. "GPAY", "Cash", "Bank Transfer".'
      },
      confirmed: {
        type: Type.BOOLEAN,
        description: 'Set to true ONLY if the administrator explicitly said "confirm", "yes", "proceed", or explicitly confirmed the transaction. If false or omitted, the tool outputs a pending draft confirmation.'
      }
    },
    required: ['studentNameOrId']
  }
};

const sendFeeReminderTool: FunctionDeclaration = {
  name: 'sendFeeReminder',
  description: 'Send a fee payment reminder to a parent with Google Pay UPI link to 8861751000.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student whose parent should receive reminder.'
      },
      amount: {
        type: Type.NUMBER,
        description: 'Fee amount in INR (default 1600).'
      }
    },
    required: ['studentNameOrId']
  }
};

const getStudentProfileTool: FunctionDeclaration = {
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

const listStudentsTool: FunctionDeclaration = {
  name: 'listStudents',
  description: 'List all enrolled students in SmartPen Academy with their status, schedule, and grade.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description: 'Filter by "Active", "Inactive", or "All".'
      },
      search: {
        type: Type.STRING,
        description: 'Optional search keyword.'
      }
    }
  }
};

const getAdminAlertsTool: FunctionDeclaration = {
  name: 'getAdminAlerts',
  description: 'Get real-time admin alerts for 8-class fee dues, demo bookings, and registrations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      unreadOnly: {
        type: Type.BOOLEAN,
        description: 'Whether to only return unread alerts.'
      }
    }
  }
};

const getDemoBookingsTool: FunctionDeclaration = {
  name: 'getDemoBookings',
  description: 'List recent Free Demo Class trial bookings submitted by prospective parents.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const generateProgressReportTool: FunctionDeclaration = {
  name: 'generateProgressReport',
  description: 'Generate or draft a student progress report (e.g. After 10 Classes) with skill star ratings and coach remarks.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Name or ID of the student.'
      },
      milestoneTitle: {
        type: Type.STRING,
        description: 'e.g. "After 10 Classes" or "Level 1 Completion".'
      },
      overallStars: {
        type: Type.NUMBER,
        description: 'Rating out of 5 (1 to 5).'
      },
      feedback: {
        type: Type.STRING,
        description: 'Coach observation and guidance feedback.'
      }
    },
    required: ['studentNameOrId']
  }
};

const navigateToPageTool: FunctionDeclaration = {
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

export const ALL_TOOLS = [
  navigateToPageTool,
  updateAttendanceTool,
  getAttendanceTool,
  getFeeStatusTool,
  recordFeePaymentTool,
  sendFeeReminderTool,
  getStudentProfileTool,
  listStudentsTool,
  getAdminAlertsTool,
  getDemoBookingsTool,
  generateProgressReportTool
];

export function getToolsForRole(role?: string): FunctionDeclaration[] {
  if (role === 'admin') {
    return ALL_TOOLS;
  }
  if (role === 'coach') {
    // Coach tools: Scoped to their assigned students (Attendance, Profiles, Roster, Progress Reports)
    return [
      navigateToPageTool,
      updateAttendanceTool,
      getAttendanceTool,
      getStudentProfileTool,
      listStudentsTool,
      generateProgressReportTool
    ];
  }
  if (role === 'student') {
    // Read-only tools scoped to own profile + navigation tools for enrollment, demo, and GPAY payment
    return [navigateToPageTool, getAttendanceTool, getFeeStatusTool, getStudentProfileTool];
  }
  // Public / Guest tools
  return [navigateToPageTool, getDemoBookingsTool];
}

// Helper to find student by fuzzy name or ID
async function findStudent(query: string): Promise<StudentProfile | undefined> {
  const students = await db.getAllStudents();
  const cleanQ = query.toLowerCase().trim().replace(/^(student|std|the student)\s+/i, '');
  
  // Exact ID
  let match = students.find(s => s.id.toLowerCase() === cleanQ);
  if (match) return match;

  // Exact Name
  match = students.find(s => s.displayName.toLowerCase() === cleanQ);
  if (match) return match;

  // Partial Name Match
  match = students.find(s => s.displayName.toLowerCase().includes(cleanQ) || cleanQ.includes(s.displayName.toLowerCase()));
  if (match) return match;

  // First name match
  match = students.find(s => {
    const firstName = s.displayName.toLowerCase().split(' ')[0];
    return cleanQ.includes(firstName) || firstName.includes(cleanQ);
  });
  if (match) return match;

  // Match by student 1, student 2 (1-based index)
  const indexMatch = query.match(/student\s*(\d+)/i);
  if (indexMatch) {
    const idx = parseInt(indexMatch[1], 10) - 1;
    if (idx >= 0 && idx < students.length) {
      return students[idx];
    }
  }

  return undefined;
}

// Tool Execution Engine with Strict Ownership Validation, Draft-Confirm Gate, and Audit Logging
export async function executeTool(
  name: string, 
  args: any, 
  userContext: User | null, 
  executionMode: 'remote_gemini' | 'local_agent' | 'direct_api' = 'remote_gemini'
): Promise<ToolCallResult> {
  const today = new Date().toISOString().split('T')[0];

  const logAudit = async (result: any, summary: string, success: boolean): Promise<ToolCallResult> => {
    try {
      await db.recordToolAuditLog({
        actorId: userContext?.id || 'anonymous',
        actorUsername: userContext?.username || 'anonymous',
        actorRole: userContext?.role || 'student',
        actorStudentId: userContext?.studentId,
        toolName: name,
        arguments: args || {},
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
      args,
      result,
      summary,
      success
    };
  };

  try {
    switch (name) {
      case 'updateAttendance': {
        if (userContext?.role !== 'admin' && userContext?.role !== 'coach') {
          return await logAudit(null, 'Access Denied: Only administrators and assigned coaches can update student attendance records.', false);
        }

        const rateCheck = checkToolRateLimit(userContext?.id || 'admin', 'updateAttendance', 15, 60 * 1000);
        if (!rateCheck.allowed) {
          return await logAudit(null, `Rate limit exceeded: Too many attendance updates requested in a short period. Please wait ${rateCheck.retryAfter} seconds before updating attendance again.`, false);
        }

        const rawList = Array.isArray(args.studentNames) ? args.studentNames : [args.studentNames || 'all'];
        const targetDate = args.date === 'today' || !args.date ? today : args.date;
        const status = args.status === 'Absent' ? 'Absent' : 'Present';
        const notes = args.notes || (userContext.role === 'coach' ? `Marked by Coach ${userContext.displayName}` : 'Marked via SmartPen AI Assistant');

        const updatedStudents: { id: string; name: string }[] = [];
        const recordsToSave: any[] = [];
        const notFound: string[] = [];
        const unauthorized: string[] = [];

        // If command says 'all', get eligible active students
        if (rawList.some((s: string) => s.toLowerCase() === 'all' || s.toLowerCase() === 'all students')) {
          let targetStudents = (await db.getAllStudents()).filter(s => s.status === 'Active');
          if (userContext.role === 'coach') {
            targetStudents = targetStudents.filter(s => s.coachId === userContext.id);
          }
          targetStudents.forEach(st => {
            recordsToSave.push({
              studentId: st.id,
              date: targetDate,
              yearMonth: targetDate.substring(0, 7),
              status,
              notes
            });
            updatedStudents.push({ id: st.id, name: st.displayName });
          });
        } else {
          for (const item of rawList) {
            const student = await findStudent(String(item));
            if (student) {
              if (userContext.role === 'coach' && student.coachId !== userContext.id) {
                unauthorized.push(student.displayName);
                continue;
              }
              recordsToSave.push({
                studentId: student.id,
                date: targetDate,
                yearMonth: targetDate.substring(0, 7),
                status,
                notes
              });
              updatedStudents.push({ id: student.id, name: student.displayName });
            } else {
              notFound.push(String(item));
            }
          }
        }

        if (recordsToSave.length > 0) {
          await db.saveAttendanceBatch(recordsToSave);
        }

        const namesStr = updatedStudents.map(s => s.name).join(', ');
        let summary = `✓ Successfully marked attendance as **${status}** for ${updatedStudents.length} student(s): **${namesStr}** on **${targetDate}**.`;
        if (unauthorized.length > 0) {
          summary += `\n⚠️ Note: You are only permitted to update attendance for your assigned students (Skipped: ${unauthorized.join(', ')}).`;
        }
        if (notFound.length > 0) {
          summary += ` (Could not match: ${notFound.join(', ')})`;
        }

        return await logAudit({ updatedCount: updatedStudents.length, students: updatedStudents, date: targetDate, status }, summary, true);
      }

      case 'getAttendance': {
        // Strict Ownership Enforcement: If role is student, only allow access to their own studentId
        let student: StudentProfile | undefined;
        if (userContext?.role === 'student') {
          if (!userContext.studentId) {
            return await logAudit(null, 'Access Denied: No student ID linked to your student account.', false);
          }
          student = await db.getStudentById(userContext.studentId);
          // If the student query explicitly targets someone else, reject with privacy error
          if (args.studentNameOrId) {
            const requestedStudent = await findStudent(args.studentNameOrId);
            if (requestedStudent && requestedStudent.id !== userContext.studentId) {
              return await logAudit(null, 'Privacy Policy: Student accounts can only view their own attendance records.', false);
            }
          }
        } else if (args.studentNameOrId) {
          student = await findStudent(args.studentNameOrId);
          if (student && userContext?.role === 'coach' && student.coachId !== userContext.id) {
            return await logAudit(null, `Scoping Policy: As a coach, you can only view attendance for students assigned to you. "${student.displayName}" is not assigned to your roster.`, false);
          }
        }

        if (student) {
          const records = await db.getAttendanceByStudent(student.id);
          const presentCount = records.filter(r => r.status === 'Present').length;
          const absentCount = records.filter(r => r.status === 'Absent').length;
          const currentCycleProgress = presentCount % 8;

          return await logAudit({
            studentName: student.displayName,
            studentId: student.id,
            totalPresent: presentCount,
            totalAbsent: absentCount,
            currentCycleProgress: `${currentCycleProgress} / 8 classes completed in current cycle`,
            recentRecords: records.slice(-5)
          }, `📊 **${student.displayName}** has attended **${presentCount} classes** (${absentCount} absent). Current 8-class cycle: **${currentCycleProgress}/8 classes completed**.`, true);
        } else {
          if (userContext?.role === 'coach') {
            const myStudents = await db.getStudentsByCoachId(userContext.id);
            const summaryData: string[] = [];
            for (const s of myStudents) {
              const studentRecs = await db.getAttendanceByStudent(s.id);
              const count = studentRecs.filter(r => r.status === 'Present').length;
              summaryData.push(`${s.displayName}: ${count} classes`);
            }
            return await logAudit({ totalStudents: myStudents.length, summary: summaryData }, `📊 Attendance Summary for your ${myStudents.length} assigned student(s):\n${summaryData.length === 0 ? 'No students currently assigned.' : summaryData.map(s => `• ${s}`).join('\n')}`, true);
          }

          // Broad academy summary is admin-only
          if (userContext?.role !== 'admin') {
            return await logAudit(null, 'Access Denied: Only administrators can view academy-wide attendance summaries.', false);
          }
          const allStudents = await db.getAllStudents();
          const summaryData: string[] = [];
          for (const s of allStudents) {
            const studentRecs = await db.getAttendanceByStudent(s.id);
            const count = studentRecs.filter(r => r.status === 'Present').length;
            summaryData.push(`${s.displayName}: ${count} classes`);
          }
          return await logAudit({ totalStudents: allStudents.length, summary: summaryData }, `📊 Attendance Summary for all ${allStudents.length} students:\n${summaryData.map(s => `• ${s}`).join('\n')}`, true);
        }
      }

      case 'getFeeStatus': {
        // Strict Ownership Enforcement
        let student: StudentProfile | undefined;
        if (userContext?.role === 'student') {
          if (!userContext.studentId) {
            return await logAudit(null, 'Access Denied: No student ID linked to your student account.', false);
          }
          student = await db.getStudentById(userContext.studentId);
          if (args.studentNameOrId) {
            const requestedStudent = await findStudent(args.studentNameOrId);
            if (requestedStudent && requestedStudent.id !== userContext.studentId) {
              return await logAudit(null, 'Privacy Policy: Student accounts can only view their own fee receipts and status.', false);
            }
          }
        } else if (args.studentNameOrId) {
          student = await findStudent(args.studentNameOrId);
        }

        if (student) {
          const attendanceRecs = await db.getAttendanceByStudent(student.id);
          const presentCount = attendanceRecs.filter(r => r.status === 'Present').length;
          const fees = await db.getFeesByStudent(student.id);
          const completedCycles = Math.floor(presentCount / 8);
          const isFeeDue = completedCycles > 0 && fees.filter(f => f.isPaid).length < completedCycles;

          const gpayLink = `upi://pay?pa=8861751000@okbizaxis&pn=SmartPen%20Academy&am=1600&cu=INR`;

          return await logAudit({
            studentName: student.displayName,
            studentId: student.id,
            classesAttended: presentCount,
            completedCycles,
            feeStatus: isFeeDue ? 'Fee Due (₹1,600)' : 'No pending Fee',
            paidReceiptsCount: fees.filter(f => f.isPaid).length,
            gpayNumber: '8861751000',
            gpayLink
          }, `💳 **Fee Status for ${student.displayName}**:\n• Status: **${isFeeDue ? '⚠️ Fee Due (₹1,600)' : '✓ No pending Fee'}**\n• Classes Attended: ${presentCount} (${completedCycles} completed 8-class cycles)\n• Paid Receipts: ${fees.filter(f => f.isPaid).length}\n• Direct GPAY Payment: **8861751000**`, true);
        } else {
          if (userContext?.role !== 'admin') {
            return await logAudit(null, 'Access Denied: Only administrators can view academy fee alerts.', false);
          }
          const alerts = (await db.getAlerts()).filter(a => a.type === 'fee_due' && !a.isRead);
          return await logAudit({ pendingAlerts: alerts }, `💳 **Pending Fee Alerts (${alerts.length})**:\n${alerts.length === 0 ? '✓ No pending fee dues at this moment.' : alerts.map(a => `• **${a.title}**: ${a.message}`).join('\n')}`, true);
        }
      }

      case 'recordFeePayment': {
        if (userContext?.role !== 'admin') {
          return await logAudit(null, 'Access Denied: Only administrators can record coaching fee payments.', false);
        }

        const rateCheck = checkToolRateLimit(userContext?.id || 'admin', 'recordFeePayment', 10, 60 * 1000);
        if (!rateCheck.allowed) {
          return await logAudit(null, `Rate limit exceeded: Too many fee payment records requested in a short period. Please wait ${rateCheck.retryAfter} seconds before recording more payments.`, false);
        }

        const student = await findStudent(args.studentNameOrId);
        if (!student) {
          return await logAudit(null, `Could not find student matching "${args.studentNameOrId}".`, false);
        }

        const amount = Number(args.amount) || 1600;
        const cyclePeriod = args.cyclePeriod || 'Classes 1 - 8';
        const isConfirmed = args.confirmed === true;

        // Two-step confirmation gate for irreversible financial mutations
        if (!isConfirmed) {
          return await logAudit({
            draft: true,
            studentName: student.displayName,
            studentId: student.id,
            amount,
            cyclePeriod,
            paymentMethod: args.paymentMethod || 'GPAY (8861751000)'
          }, `⚠️ **Confirmation Required Before Recording Payment**\n\n• **Student**: ${student.displayName} (ID: ${student.id})\n• **Amount**: ₹${amount}\n• **Cycle**: ${cyclePeriod}\n• **Method**: ${args.paymentMethod || 'GPAY (8861751000)'}\n\nPlease reply **"Confirm payment"** or **"Yes, record fee for ${student.displayName}"** to finalize this financial transaction.`, true);
        }

        const receiptNo = `REC-${Date.now().toString().slice(-4)}`;

        const feeRecord = await db.saveFeeRecord({
          studentId: student.id,
          yearMonth: cyclePeriod,
          amount,
          isPaid: true,
          status: 'Paid',
          paidDate: today,
          paymentMethod: args.paymentMethod || 'GPAY (8861751000)',
          receiptNumber: receiptNo,
          receiptNo
        });

        return await logAudit(feeRecord, `✓ **Payment Confirmed & Recorded**: ₹${amount} for **${student.displayName}** (${cyclePeriod}). Receipt Number: **${receiptNo}** (${args.paymentMethod || 'GPAY'}).`, true);
      }

      case 'sendFeeReminder': {
        if (userContext?.role !== 'admin') {
          return await logAudit(null, 'Access Denied: Only administrators can dispatch fee reminders.', false);
        }

        const rateCheck = checkToolRateLimit(userContext?.id || 'admin', 'sendFeeReminder', 10, 60 * 1000);
        if (!rateCheck.allowed) {
          return await logAudit(null, `Rate limit exceeded: Too many fee reminders requested in a short period. Please wait ${rateCheck.retryAfter} seconds before sending more reminders.`, false);
        }

        const student = await findStudent(args.studentNameOrId);
        if (!student) {
          return await logAudit(null, `Could not find student matching "${args.studentNameOrId}".`, false);
        }

        const amount = Number(args.amount) || 1600;
        const gpayLink = `upi://pay?pa=8861751000@okbizaxis&pn=SmartPen%20Academy&am=${amount}&cu=INR`;

        const reminder = await db.saveFeeReminder({
          studentId: student.id,
          parentEmail: student.email,
          parentName: student.parentName,
          studentName: student.displayName,
          amount,
          month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          gpayLink,
          status: 'Sent'
        });

        if (student.email) {
          sendFeeReminderEmail({
            toEmail: student.email,
            parentName: student.parentName,
            studentName: student.displayName,
            amount,
            gpayLink
          }).catch(err => {
            console.error('[Resend Background Error] AI agent fee reminder email dispatch:', err);
          });
        }

        return await logAudit(reminder, `📲 Dispatched Fee Reminder of **₹${amount}** to **${student.parentName}** (${student.email}) for student **${student.displayName}** with Google Pay UPI link to **8861751000**.`, true);
      }

      case 'getStudentProfile': {
        let query = args.studentNameOrId;
        if (userContext?.role === 'student') {
          if (!userContext.studentId) {
            return await logAudit(null, 'Access Denied: No student profile linked to your account.', false);
          }
          // Student can only request their own profile
          if (query) {
            const requestedStudent = await findStudent(query);
            if (requestedStudent && requestedStudent.id !== userContext.studentId) {
              return await logAudit(null, 'Privacy Policy: You can only view your own student profile details.', false);
            }
          }
          query = userContext.studentId;
        }

        const student = await findStudent(query);
        if (!student) {
          return await logAudit(null, `No student profile found matching "${query}".`, false);
        }

        if (userContext?.role === 'coach' && student.coachId !== userContext.id) {
          return await logAudit(null, `Privacy Scoping: Coach access is restricted to assigned students. "${student.displayName}" is not assigned to your coaching roster.`, false);
        }

        return await logAudit(student, `📋 **Student Profile: ${student.displayName}** (${student.status})\n• **Coach**: ${student.coachName || 'Unassigned'}\n• **Grade & School**: ${student.gradeClass} at ${student.schoolName}\n• **Hand / Script**: ${student.dominantHand} Hand • ${student.scriptsRequired.join(', ')}\n• **Batch Schedule**: ${student.preferredDays} at **${student.preferredSlot}**\n• **Parent Contact**: ${student.parentName} (${student.whatsappMobile}, ${student.email})\n• **Baseline Speed**: ${student.baselineSpeedWpm || 16} WPM`, true);
      }

      case 'listStudents': {
        if (userContext?.role !== 'admin' && userContext?.role !== 'coach') {
          return await logAudit(null, 'Access Denied: Only administrators and coaches can view student rosters.', false);
        }

        let students = userContext.role === 'coach' 
          ? await db.getStudentsByCoachId(userContext.id)
          : await db.getAllStudents();

        const statusFilter = args.status?.toLowerCase();
        let filtered = students;
        if (statusFilter && statusFilter !== 'all') {
          filtered = students.filter(s => s.status.toLowerCase() === statusFilter);
        }
        if (args.search) {
          const q = args.search.toLowerCase();
          filtered = filtered.filter(s => s.displayName.toLowerCase().includes(q) || s.gradeClass.toLowerCase().includes(q));
        }

        const listStr = filtered.map((s, idx) => `${idx + 1}. **${s.displayName}** (${s.gradeClass}) - ${s.preferredDays} @ ${s.preferredSlot} [${s.status}]${s.coachName ? ` • Coach: ${s.coachName}` : ''}`).join('\n');

        const title = userContext.role === 'coach' ? `Your Assigned Students (${filtered.length})` : `Enrolled Students (${filtered.length})`;
        return await logAudit({ count: filtered.length, students: filtered }, `📋 **${title}**:\n${filtered.length === 0 ? 'No students match your criteria.' : listStr}`, true);
      }

      case 'getAdminAlerts': {
        if (userContext?.role !== 'admin') {
          return await logAudit(null, 'Access Denied: Only administrators can view operational alerts.', false);
        }

        const alerts = await db.getAlerts();
        const unread = alerts.filter(a => !a.isRead);
        const targetList = args.unreadOnly ? unread : alerts;

        return await logAudit({ total: alerts.length, unreadCount: unread.length, alerts: targetList }, `🔔 **System Alerts (${unread.length} unread / ${alerts.length} total)**:\n${targetList.length === 0 ? '✓ All alerts are cleared!' : targetList.map(a => `• **${a.title}**: ${a.message}`).join('\n')}`, true);
      }

      case 'getDemoBookings': {
        if (userContext?.role !== 'admin') {
          return await logAudit(null, 'Access Denied: Only administrators can access prospective trial bookings.', false);
        }

        const bookings = await db.getDemoBookings();
        return await logAudit({ count: bookings.length, bookings }, `📅 **Free Demo Class Bookings (${bookings.length})**:\n${bookings.length === 0 ? 'No trial bookings yet.' : bookings.map(b => `• **${b.studentName}** (Age ${b.age}) - Date: ${b.preferredDate} (${b.preferredTimeSlot}) - Contact: ${b.contactNumber} [${b.status}]`).join('\n')}`, true);
      }

      case 'generateProgressReport': {
        if (userContext?.role !== 'admin' && userContext?.role !== 'coach') {
          return await logAudit(null, 'Access Denied: Only administrators and assigned coaches can create progress reports.', false);
        }

        const rateCheck = checkToolRateLimit(userContext?.id || 'admin', 'generateProgressReport', 10, 60 * 1000);
        if (!rateCheck.allowed) {
          return await logAudit(null, `Rate limit exceeded: Too many progress reports generated in a short period. Please wait ${rateCheck.retryAfter} seconds before generating more reports.`, false);
        }

        const student = await findStudent(args.studentNameOrId);
        if (!student) {
          return await logAudit(null, `Could not find student matching "${args.studentNameOrId}".`, false);
        }

        if (userContext.role === 'coach' && student.coachId !== userContext.id) {
          return await logAudit(null, `Scoping Policy: You can only generate progress reports for students assigned to you. "${student.displayName}" is not assigned to your coaching roster.`, false);
        }

        const stars = Number(args.overallStars) || 5;
        const report = await db.saveProgressReport({
          studentId: student.id,
          reportDate: today,
          reportTitle: 'Progress Report',
          milestoneTitle: args.milestoneTitle || 'After 10 Classes',
          completedClasses: 10,
          totalClasses: 10,
          skills: [
            { skillKey: 'letterFormation', skillName: 'Letter Formation & Geometry', beforeStars: 2, afterStars: stars, progressNote: 'Excellent improvement in loop control' },
            { skillKey: 'lineAlignment', skillName: 'Line Alignment & Margin Balance', beforeStars: 2, afterStars: Math.max(3, stars), progressNote: 'Consistently touches baseline' },
            { skillKey: 'spacingControl', skillName: 'Word Spacing & Flow', beforeStars: 2, afterStars: stars, progressNote: 'Proper uniform finger spacing' },
            { skillKey: 'speedWpm', skillName: 'Writing Speed & Exam Fluency', beforeStars: 2, afterStars: Math.max(3, stars - 1), progressNote: 'Achieved +12 WPM increase' },
            { skillKey: 'pencilGrip', skillName: 'Dynamic Tripod Grip & Posture', beforeStars: 2, afterStars: stars, progressNote: 'Relaxed hand posture with zero fatigue' }
          ],
          overallStars: stars,
          overallRemark: 'Outstanding handwriting transformation!',
          teacherFeedback: args.feedback || 'Shows high dedication during coaching sessions. Keep up the daily practice!',
          nextSteps: ['Continue 10-minute daily speed drills', 'Maintain relaxed tripod pencil grip'],
          savedToFolder: '/progress_reports/'
        });

        return await logAudit(report, `⭐ Generated Progress Report (**${report.milestoneTitle}**) for **${student.displayName}** with **${stars} Stars** rating!`, true);
      }

      case 'navigateToPage': {
        const target = (args.target || 'enroll').toLowerCase().trim();
        const reason = args.reason || 'Directing to requested page';
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
          if (userContext?.role !== 'admin') {
            return await logAudit(null, 'Access Denied: Only administrators can access the Admin Workspace.', false);
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
          studentId: userContext?.studentId,
          reason
        };

        return await logAudit(
          navPayload,
          `🧭 **${pageTitle}**: ${actionDescription}`,
          true
        );
      }

      default:
        return await logAudit(null, `Tool ${name} is not recognized.`, false);
    }
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
  if (isAwaitingAttendanceConfirm && isExplicitConfirmationOnly && userContext?.role === 'admin') {
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

    const result = await executeTool('updateAttendance', {
      studentNames: targetNames,
      status,
      date: 'today'
    }, userContext, 'local_agent');

    toolResults.push(result);
    return {
      reply: `${result.summary}\n\nAttendance has been successfully confirmed and recorded. Is there anything else you would like to manage?`,
      toolResults
    };
  }

  // Handle follow-up confirmation for fee payment
  if (isAwaitingFeeConfirm && isExplicitConfirmationOnly && userContext?.role === 'admin') {
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

  // 1. Navigation intents: Enroll, Book a demo, GPAY payment, syllabus, about
  if (p.includes('enroll') || p.includes('register') || p.includes('join') || p.includes('admission') || p.includes('sign up')) {
    const result = await executeTool('navigateToPage', { target: 'enroll', reason: 'Student Registration / Enrollment' }, userContext, 'local_agent');
    toolResults.push(result);
    return {
      reply: `I have opened the **Student Enrollment & Registration** page for you! You can fill in the student details, select script preferences (Print / Cursive), and secure your coaching batch.`,
      toolResults
    };
  }

  if (p.includes('book demo') || p.includes('free demo') || p.includes('book a demo') || p.includes('trial class') || (p.includes('demo') && (p.includes('book') || p.includes('schedule') || p.includes('slot')))) {
    const result = await executeTool('navigateToPage', { target: 'demo', reason: 'Book Free Demo Class' }, userContext, 'local_agent');
    toolResults.push(result);
    return {
      reply: `I have launched the **Free Demo Class Booking** window for you! You can pick your preferred date and time slot (4:00 PM – 7:00 PM) to experience Mrs. Deepthy Rock's personalized coaching.`,
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
  if (p.includes('attendance') && (p.includes('update') || p.includes('mark') || p.includes('present') || p.includes('absent') || p.includes('save') || p.includes('record'))) {
    if (userContext?.role !== 'admin') {
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

    const result = await executeTool('updateAttendance', {
      studentNames: targetNames,
      status,
      date: 'today'
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
      reply: `Hello Coach **${userContext.displayName || 'Tutor'}**${designationSuffix}! Welcome to your coaching assistant. You can manage your assigned students:\n\n• **Mark attendance**: *"Mark Aarav as Present today"*\n• **View assigned roster**: *"Show my assigned students"*\n• **Generate progress report**: *"Create progress report for my student"*\n• **Lookup student profile**: *"Show profile for Ananya"*\n\nWhat would you like to work on?`,
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
Academy Info: SmartPen Academy, Founder & Head Coach Mrs. Deepthy Rock. Fee policy: ₹1,600 for every 8 classes. Google Pay payment number: 8861751000.`;

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
1. SCOPED COACHING ACCESS: As a Coach, you have permission to manage attendance, student profiles, and progress reports EXCLUSIVELY FOR YOUR ASSIGNED STUDENTS.
2. ATTENDANCE: You can mark and update attendance for students assigned to you. If you attempt to update or view a student not assigned to your coaching roster, the system will prevent it.
3. PROGRESS REPORTS: You can generate and review milestone progress reports for your assigned students.
4. FINANCIAL & ENROLLMENT BOUNDARIES: Coaches DO NOT manage academy fees, ledger records, or institute-level configurations. Those remain the exclusive responsibility of Administrator Mrs. Deepthy Rock.
5. Keep your tone encouraging, instructional, concise, and focused on student handwriting mastery.`;
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
Logged-in User Context: Guest (Not logged in)

Guest Guidelines:
1. Provide information about SmartPen Academy's courses (Print Mastery, Cursive Fluency, Speed Writing, Exam Prep), batch timings, and fee policy (₹1,600 per 8 classes).
2. ENROLLMENT, DEMO BOOKING & GPAY NAVIGATION:
   • If a guest asks to enroll or register, call \`navigateToPage\` with target: "enroll".
   • If a guest wants to book a free demo class / trial, call \`navigateToPage\` with target: "demo".
   • If a guest asks to GPAY or pay fees to coach, call \`navigateToPage\` with target: "gpay".
3. Guests cannot view private student records or modify attendance. Encourage users to sign in with their credentials to access student portal records or administrative controls.`;
}

// Master AI Agent Process Function with Instant Fast-Path and High-Speed Low-Latency Fallbacks
export async function handleAIAgentChat(reqBody: AIAgentRequest): Promise<{ reply: string; toolResults: ToolCallResult[] }> {
  const { messages, userContext, settings } = reqBody;
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const userPrompt = (lastUserMessage?.content || '').trim();
  const p = userPrompt.toLowerCase();

  // =========================================================================
  // 🚀 FAST-PATH OPTIMIZATION: Instant (< 30ms) Zero-Latency Direct Execution
  // If the user triggered an unambiguous navigation or common action, execute
  // immediately without stalling for a cloud LLM roundtrip.
  // =========================================================================
  const isDirectNavOrAction = 
    // Enrollment / Register
    p.includes('enroll') || p.includes('register') || p.includes('join') || p.includes('admission') ||
    // Book Demo / Trial
    p.includes('book demo') || p.includes('free demo') || p.includes('book a demo') || p.includes('trial class') ||
    // GPAY / Fee payment link
    p.includes('gpay') || p.includes('google pay') || p.includes('pay fee') || p.includes('pay money') || p.includes('pay coach') || p.includes('upi') ||
    // Attendance quick action
    (p.includes('attendance') && (p.includes('update') || p.includes('mark') || p.includes('present') || p.includes('absent')));

  if (isDirectNavOrAction) {
    return await runLocalAgent(userPrompt, userContext, messages);
  }

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
