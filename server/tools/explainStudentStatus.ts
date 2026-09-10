import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { findStudent, verifyToolStudentAccess, validateWithSchema } from './helpers.ts';

export const explainStudentStatusDeclaration: FunctionDeclaration = {
  name: 'explainStudentStatus',
  description: 'Get a complete 360° overview of a single student including enrollment details, assigned coach, 8-class attendance cycle progress, fee payment standing, and latest handwriting milestone grade.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentNameOrId: {
        type: Type.STRING,
        description: 'Full name, partial name, or exact ID of the student to inspect.'
      }
    },
    required: ['studentNameOrId']
  }
};

const explainStudentStatusSchema = z.object({
  studentNameOrId: z.string({ message: 'Student identifier is required.' }).trim().min(1, 'Student identifier is required.')
});

type ExplainStudentStatusInput = z.infer<typeof explainStudentStatusSchema>;

export const explainStudentStatusTool: AgentTool = {
  name: 'explainStudentStatus',
  declaration: explainStudentStatusDeclaration,
  allowedRoles: ['admin', 'coach', 'student'],
  accessDeniedMessage: 'Access Denied: Authentication required to view student records.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(args: any, context: AgentToolContext): Promise<AgentToolResult> {
    const { user } = context;

    if (!user) {
      return {
        result: null,
        summary: 'Access Denied: Authentication required to view student records.',
        success: false
      };
    }

    // 1. Validate parameters
    const validation = validateWithSchema<ExplainStudentStatusInput>(explainStudentStatusSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Student identifier is required.',
        success: false
      };
    }

    const { studentNameOrId } = validation.data;

    // 2. Entity Resolution & Ambiguity Check
    const allStudents = await db.getAllStudents();
    const cleanQ = studentNameOrId.toLowerCase().trim();

    // Check exact matches first (ID or full name)
    const exactMatches = allStudents.filter(s => 
      s.id.toLowerCase() === cleanQ || 
      s.displayName.toLowerCase() === cleanQ
    );

    let student = exactMatches[0];

    if (!student) {
      // Partial matches
      const partialMatches = allStudents.filter(s => 
        s.displayName.toLowerCase().includes(cleanQ) || 
        cleanQ.includes(s.displayName.toLowerCase())
      );

      if (partialMatches.length > 1) {
        return {
          result: null,
          summary: `Multiple students matched "${studentNameOrId}": ${partialMatches.map(s => `"${s.displayName}" (ID: ${s.id})`).join(', ')}. Please specify the exact student ID or full name.`,
          success: false
        };
      }

      student = partialMatches[0];
    }

    if (!student) {
      // Fallback lookup via helper
      student = await findStudent(studentNameOrId);
    }

    if (!student) {
      return {
        result: null,
        summary: `Could not find student matching "${studentNameOrId}".`,
        success: false
      };
    }

    // 3. Authorization & Scoping
    if (!verifyToolStudentAccess(user, student)) {
      if (user.role === 'coach') {
        return {
          result: null,
          summary: `Privacy Scoping: As a coach, you can only view records for students assigned to you. "${student.displayName}" is not in your roster.`,
          success: false
        };
      }
      if (user.role === 'student') {
        return {
          result: null,
          summary: 'Access Denied: You can only view your own student records.',
          success: false
        };
      }
      return {
        result: null,
        summary: 'Access Denied: Authentication required to view student records.',
        success: false
      };
    }

    // 4. Data Aggregation using existing read-only DB queries
    // A. Attendance Records
    const attendance = await db.getAttendanceByStudent(student.id);
    const totalSessions = attendance.length;
    const attendedCount = attendance.filter(a => a.status === 'Present').length;
    const absentCount = attendance.filter(a => a.status === 'Absent').length;
    const attendanceRate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;
    const cycleProgress = attendedCount % 8;
    const completedCycles = Math.floor(attendedCount / 8);

    // B. Fees & Ledger
    const fees = await db.getFeesByStudent(student.id);
    const sortedFees = [...fees].sort((a, b) => (b.date || b.paidDate || '').localeCompare(a.date || a.paidDate || ''));
    const latestFee = sortedFees[0] || null;
    const pendingFees = fees.filter(f => f.status === 'Pending' || f.status === 'Overdue');
    const totalOutstanding = pendingFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    let feeStatusSummary = 'Up to date';
    if (pendingFees.length > 0) {
      feeStatusSummary = `Pending (₹${totalOutstanding} due across ${pendingFees.length} record(s))`;
    } else if (latestFee?.status === 'Waived') {
      feeStatusSummary = 'Fee Waived';
    } else if (latestFee?.status === 'Paid') {
      feeStatusSummary = 'Paid';
    } else if (fees.length === 0) {
      feeStatusSummary = 'No fee records raised';
    }

    // C. Assigned Coach
    let coachInfo = {
      assigned: false,
      name: 'Unassigned',
      designation: 'N/A',
      status: 'N/A'
    };
    if (student.coachId) {
      const coach = await db.getCoachById(student.coachId);
      if (coach) {
        coachInfo = {
          assigned: true,
          name: coach.displayName,
          designation: coach.designation || 'Coach',
          status: coach.status || 'Active'
        };
      } else {
        coachInfo = {
          assigned: true,
          name: `Coach (${student.coachId})`,
          designation: 'Coach',
          status: 'Active'
        };
      }
    }

    // D. Latest Handwriting Milestone
    const trackers = await db.getProgressTrackersByStudent(student.id);
    const sortedTrackers = [...trackers].sort((a, b) => (b.evaluationDate || '').localeCompare(a.evaluationDate || ''));
    const latestTracker = sortedTrackers[0] || null;

    const latestMilestone = latestTracker ? {
      title: latestTracker.evaluationTitle || 'Milestone Evaluation',
      overallStars: latestTracker.overallStars ?? null,
      speedWpm: latestTracker.speedWpm ?? null,
      alignmentStars: latestTracker.alignmentStars ?? null,
      formationStars: latestTracker.formationStars ?? null,
      spacingStars: latestTracker.spacingStars ?? null,
      feedback: latestTracker.teacherFeedback || latestTracker.overallRemark || 'In progress',
      evaluatedAt: latestTracker.evaluationDate || null
    } : null;

    // 5. Build Result Object
    const result = {
      student: {
        id: student.id,
        displayName: student.displayName,
        grade: student.gradeClass || 'N/A',
        schoolName: student.schoolName || 'N/A',
        status: student.status,
        modeOfLearning: student.modeOfLearning || 'N/A',
        dominantHand: student.dominantHand || 'N/A',
        parentName: student.parentName,
        age: student.age || null
      },
      coach: coachInfo,
      attendance: {
        totalSessions,
        attended: attendedCount,
        absent: absentCount,
        attendanceRate: `${attendanceRate}%`,
        cycleProgress: `${cycleProgress} / 8 classes completed in Cycle #${completedCycles + 1}`,
        completedCycles
      },
      fees: {
        currentStatus: feeStatusSummary,
        latestRecord: latestFee ? {
          id: latestFee.id,
          period: latestFee.yearMonth || latestFee.milestone || latestFee.date || 'N/A',
          amount: latestFee.amount,
          status: latestFee.status,
          receiptNumber: latestFee.receiptNumber || 'N/A'
        } : null,
        totalOutstanding,
        hasPendingDue: pendingFees.length > 0
      },
      latestMilestone
    };

    // 6. Build Human-Readable Markdown Summary
    const coachLine = coachInfo.assigned 
      ? `• **Assigned Coach**: ${coachInfo.name} (${coachInfo.designation}, Status: ${coachInfo.status})`
      : `• **Assigned Coach**: *Unassigned (No coach currently allocated)*`;

    const milestoneSection = latestMilestone
      ? `📝 **Latest Handwriting Milestone**:\n` +
        `• **Evaluation**: ${latestMilestone.title}${latestMilestone.overallStars ? ` (${latestMilestone.overallStars}/5 ⭐)` : ''}${latestMilestone.speedWpm ? ` • Speed: ${latestMilestone.speedWpm} WPM` : ''}\n` +
        `• **Coach Feedback**: "${latestMilestone.feedback}"`
      : `📝 **Latest Handwriting Milestone**: No milestone evaluation recorded yet.`;

    const feeDetails = latestFee
      ? `• **Status**: ${feeStatusSummary}\n• **Latest Receipt**: #${latestFee.receiptNumber || latestFee.id} (₹${latestFee.amount} • ${latestFee.yearMonth || latestFee.date})`
      : `• **Status**: ${feeStatusSummary}`;

    const summary = 
      `📊 **Student 360° Overview: ${student.displayName} (${student.gradeClass || 'N/A'})**\n\n` +
      `• **Status**: ${student.status} • **Mode**: ${student.modeOfLearning || 'N/A'} • **School**: ${student.schoolName || 'N/A'}\n` +
      `${coachLine}\n\n` +
      `🗓️ **Attendance & Cycle Progress**:\n` +
      `• **Total Classes Attended**: ${attendedCount} of ${totalSessions} sessions (${attendanceRate}% attendance rate, ${absentCount} absent)\n` +
      `• **Current 8-Class Cycle**: **${cycleProgress} of 8 classes completed** (Cycle #${completedCycles + 1})\n\n` +
      `💳 **Fee & Ledger Standing**:\n` +
      `${feeDetails}\n\n` +
      `${milestoneSection}`;

    return {
      result,
      summary,
      success: true
    };
  }
};
