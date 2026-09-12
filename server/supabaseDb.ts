import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  StudentProfile,
  AttendanceRecord,
  FeeRecord,
  ProgressTracker,
  StudentWorkImage,
  ProgressReport,
  FeeReminder,
  User,
  CoachProfile,
  DemoBooking,
  AdminAlert,
  Testimonial,
  ToolAuditLog
} from '../src/types';
import { serverSupabase } from './supabase.ts';

import { PaginationParams, applyOffsetPagination, applyRowCeiling, applyQueryPagination } from './pagination';
export type { PaginationParams };


export interface StoredUser extends User {
  passwordHash?: string;
  phoneNumber?: string;
  coachId?: string | null;
  designation?: string | null;
  resetPasswordToken?: string;
  resetPasswordExpiry?: number;
  createdAt?: string;
}

function getSupabase() {
  return serverSupabase;
}

// Safe date normalization helper
function safeIsoDate(val: any): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

// Data Mapping Helpers
function mapUserRow(row: any, coachDesignation?: string | null): StoredUser {
  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || firstName || 'User';
  return {
    id: row.id,
    email: row.email,
    phone: row.phone || '',
    phoneNumber: row.phone || undefined,
    firstName,
    lastName,
    displayName,
    role: row.role || 'student',
    studentId: row.student_id || undefined,
    coachId: row.coach_id || undefined,
    avatarUrl: row.avatar_url || undefined,
    isActive: row.is_active !== false,
    designation: coachDesignation || undefined,
    passwordHash: row.password_hash || undefined,
    resetPasswordToken: row.reset_password_token || undefined,
    resetPasswordExpiry: row.reset_password_expiry ? Number(row.reset_password_expiry) : undefined,
    createdAt: row.created_at || undefined
  };
}

function mapCoachRow(row: any, studentCount = 0, userRow?: any): CoachProfile {
  const firstName = userRow?.first_name || row.first_name || 'Coach';
  const lastName = userRow?.last_name || row.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || firstName;

  let specs: string[] = [];
  if (Array.isArray(row.specializations)) {
    specs = row.specializations;
  } else if (typeof row.specializations === 'string' && row.specializations.trim()) {
    try {
      const parsed = JSON.parse(row.specializations);
      if (Array.isArray(parsed)) specs = parsed;
    } catch {
      specs = row.specializations.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  return {
    id: row.id,
    firstName,
    lastName,
    displayName,
    email: userRow?.email || row.email || '',
    phoneNumber: userRow?.phone || row.phone || row.phone_number || '',
    address: row.address || undefined,
    dateOfJoining: row.date_of_joining || undefined,
    status: (row.status === 'Inactive' ? 'Inactive' : 'Active'),
    dateOfLeaving: row.date_of_leaving || undefined,
    educationalQualification: row.educational_qualification || undefined,
    designation: row.designation || 'Principal Coach',
    specializations: specs,
    emergencyContactName: row.emergency_contact_name || undefined,
    emergencyContactPhone: row.emergency_contact_phone || undefined,
    notes: row.notes || row.bio || undefined,
    assignedStudentCount: studentCount,
    activeStudentsCount: studentCount,
    studentCount: studentCount,
    userId: row.user_id || userRow?.id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined
  };
}

function mapStudentRow(row: any, userRow?: any, resolvedCoachName?: string | null): StudentProfile {
  const firstName = userRow?.first_name || row.first_name || 'Student';
  const lastName = userRow?.last_name || row.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || firstName;

  let dominantHand: 'Right' | 'Left' = 'Right';
  let preferredDays: string | undefined = row.preferred_days || undefined;
  let relationship: string | undefined = undefined;
  let scriptsRequired: string[] = [];
  let academicModules: string[] = [];
  let studentNotes: string | undefined = row.notes || undefined;
  let dateOfLeaving: string | undefined = row.date_of_leaving || undefined;

  if (row.notes) {
    try {
      const parsed = JSON.parse(row.notes);
      if (parsed && typeof parsed === 'object') {
        if (parsed.dominantHand) dominantHand = parsed.dominantHand === 'Left' ? 'Left' : 'Right';
        if (parsed.preferredDays) preferredDays = parsed.preferredDays;
        if (parsed.relationship) relationship = parsed.relationship;
        if (Array.isArray(parsed.scriptsRequired)) scriptsRequired = parsed.scriptsRequired;
        if (Array.isArray(parsed.academicModules)) academicModules = parsed.academicModules;
        if (parsed.dateOfLeaving && !dateOfLeaving) dateOfLeaving = parsed.dateOfLeaving;
        studentNotes = parsed.customNotes || parsed.notes || undefined;
      }
    } catch {
      // notes was plain text
      studentNotes = row.notes;
    }
  }

  if (row.dominant_hand) {
    dominantHand = row.dominant_hand === 'Left' ? 'Left' : 'Right';
  }

  return {
    id: row.student_id || row.id,
    firstName,
    lastName,
    displayName,
    age: row.age !== undefined && row.age !== null ? Number(row.age) : 0,
    gradeClass: row.grade || row.grade_class || undefined,
    dominantHand,
    schoolName: row.school_name || undefined,
    parentName: row.parent_name || '',
    relationship,
    modeOfLearning: row.mode_of_learning || 'In-person',
    email: userRow?.email || row.parent_email || row.email || '',
    whatsappMobile: userRow?.phone || row.emergency_contact_phone || '',
    emergencyContactName: row.emergency_contact_name || undefined,
    emergencyContactPhone: row.emergency_contact_phone || undefined,
    emergencyPhone: row.emergency_contact_phone || undefined,
    enrollmentDate: row.enrollment_date || row.created_at?.split('T')[0] || undefined,
    status: row.status || 'Active',
    dateOfLeaving: dateOfLeaving || undefined,
    userId: row.user_id || userRow?.id || undefined,
    coachId: row.coach_id || undefined,
    coachName: resolvedCoachName || row.coach_name || undefined,
    preferredDays,
    preferredSlot: row.preferred_slot || undefined,
    scriptsRequired,
    academicModules,
    totalClasses: row.total_classes !== undefined && row.total_classes !== null ? Number(row.total_classes) : undefined,
    attendedClasses: row.attended_classes !== undefined && row.attended_classes !== null ? Number(row.attended_classes) : 0,
    notes: studentNotes,
    avatarUrl: row.avatar_url || userRow?.avatar_url || undefined,
    diagnosticObservations: Array.isArray(row.diagnostic_observations) ? row.diagnostic_observations : [],
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function mapAttendanceRow(row: any): AttendanceRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    classNumber: row.class_number !== undefined && row.class_number !== null ? Number(row.class_number) : 1,
    date: row.date || '',
    status: row.status || 'Present',
    coachNotes: row.coach_notes || undefined,
    markedBy: row.marked_by || undefined,
    createdAt: row.created_at || ''
  };
}

function mapFeeRow(row: any): FeeRecord {
  const status: 'Paid' | 'Pending' | 'Overdue' | 'Waived' =
    (row.status === 'Paid' || row.status === 'Pending' || row.status === 'Overdue' || row.status === 'Waived')
      ? row.status
      : (row.is_paid ? 'Paid' : 'Pending');

  return {
    id: row.id,
    studentId: row.student_id,
    date: row.date || row.paid_date || '',
    yearMonth: row.year_month || '',
    milestone: row.milestone || undefined,
    amount: row.amount !== undefined && row.amount !== null ? Number(row.amount) : 0,
    status,
    paidDate: row.paid_date || undefined,
    receiptNumber: row.receipt_number || row.receipt_no || '',
    paymentMethod: row.payment_method || undefined,
    notes: row.notes || undefined
  };
}

function mapProgressTrackerRow(row: any): ProgressTracker {
  const parsedNextSteps = Array.isArray(row.next_steps)
    ? row.next_steps
    : (typeof row.next_steps === 'string' ? row.next_steps.split(';').map((s: string) => s.trim()).filter(Boolean) : []);

  return {
    id: row.id,
    studentId: row.student_id,
    evaluationTitle: row.evaluation_title || row.milestone_name || row.report_title || 'Progress Milestone',
    milestoneTitle: row.evaluation_title || row.milestone_name || 'After 10 Classes',
    evaluationDate: row.evaluation_date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    overallRemark: row.overall_remark || row.teacher_feedback || '',
    teacherFeedback: row.teacher_feedback || row.overall_remark || '',
    nextSteps: parsedNextSteps,
    targetScore: row.target_score !== undefined && row.target_score !== null ? Number(row.target_score) : undefined,
    currentScore: row.current_score !== undefined && row.current_score !== null ? Number(row.current_score) : undefined,
    overallStars: row.overall_stars !== undefined && row.overall_stars !== null ? Number(row.overall_stars) : 0,
    formationStars: row.formation_stars !== undefined && row.formation_stars !== null ? Number(row.formation_stars) : undefined,
    spacingStars: row.spacing_stars !== undefined && row.spacing_stars !== null ? Number(row.spacing_stars) : undefined,
    alignmentStars: row.alignment_stars !== undefined && row.alignment_stars !== null ? Number(row.alignment_stars) : undefined,
    speedStars: row.speed_stars !== undefined && row.speed_stars !== null ? Number(row.speed_stars) : undefined,
    gripPostureStars: row.grip_posture_stars !== undefined && row.grip_posture_stars !== null ? Number(row.grip_posture_stars) : undefined,
    speedWpm: row.speed_wpm !== undefined && row.speed_wpm !== null ? Number(row.speed_wpm) : undefined,
    baselineSpeedWpm: row.baseline_speed_wpm !== undefined && row.baseline_speed_wpm !== null ? Number(row.baseline_speed_wpm) : undefined,
    pressureLevel: row.pressure_level || undefined,
    beforePhotoData: row.before_image_url || row.before_photo_url || undefined,
    afterPhotoData: row.after_image_url || row.after_photo_url || undefined,
    beforeImageUrl: row.before_image_url || row.before_photo_url || undefined,
    afterImageUrl: row.after_image_url || row.after_photo_url || undefined,
    skills: Array.isArray(row.skills) && row.skills.length > 0 ? row.skills : undefined,
    isUnlocked: row.is_unlocked !== undefined ? Boolean(row.is_unlocked) : true,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined
  };
}

function buildProgressReportFromTrackerRow(row: any, student?: any): ProgressReport {
  const tracker = mapProgressTrackerRow(row);
  const overallStars = tracker.overallStars || 5;

  // Build skills breakdown from explicit skills JSON or derive from stars
  let skills = tracker.skills;
  if (!skills || skills.length === 0) {
    skills = [
      {
        skillKey: 'letterFormation',
        skillName: 'Letter Formation & Geometry',
        beforeStars: Math.max(1, (tracker.formationStars || overallStars) - 2),
        afterStars: tracker.formationStars || overallStars,
        progressNote: 'Consistent ascenders, descenders, and loop closure.'
      },
      {
        skillKey: 'letterSizeSpacing',
        skillName: 'Word Spacing & Consistency',
        beforeStars: Math.max(1, (tracker.spacingStars || overallStars) - 2),
        afterStars: tracker.spacingStars || overallStars,
        progressNote: 'Uniform finger spacing between words and letters.'
      },
      {
        skillKey: 'lineAlignment',
        skillName: 'Line Alignment & Margin Balance',
        beforeStars: Math.max(1, (tracker.alignmentStars || overallStars) - 2),
        afterStars: tracker.alignmentStars || overallStars,
        progressNote: 'Maintains consistent baseline alignment on ruled sheets.'
      },
      {
        skillKey: 'pencilControl',
        skillName: 'Grip, Posture & Speed',
        beforeStars: Math.max(1, (tracker.gripPostureStars || overallStars) - 2),
        afterStars: tracker.gripPostureStars || overallStars,
        progressNote: tracker.speedWpm ? `Measured writing speed: ${tracker.speedWpm} WPM.` : 'Relaxed tripod grip and zero hand fatigue.'
      }
    ];
  }

  const completedClasses = student?.attendedClasses !== undefined && student?.attendedClasses !== null
    ? Number(student.attendedClasses)
    : (student?.attended_classes !== undefined ? Number(student.attended_classes) : 10);
  const totalClasses = student?.totalClasses !== undefined && student?.totalClasses !== null
    ? Number(student.totalClasses)
    : (student?.total_classes !== undefined ? Number(student.total_classes) : 10);

  return {
    id: tracker.id,
    studentId: tracker.studentId,
    reportDate: tracker.evaluationDate || (tracker.createdAt ? tracker.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
    reportTitle: 'Progress Report',
    milestoneTitle: tracker.milestoneTitle || tracker.evaluationTitle || 'After 10 Classes',
    completedClasses,
    totalClasses,
    skills,
    overallStars: tracker.overallStars,
    overallRemark: tracker.overallRemark || 'Excellent progress and noticeable improvement in legibility.',
    teacherFeedback: tracker.teacherFeedback || tracker.overallRemark || 'Shows great dedication during handwriting coaching.',
    nextSteps: tracker.nextSteps && tracker.nextSteps.length > 0
      ? tracker.nextSteps
      : ['Continue 10-minute daily speed drills', 'Maintain relaxed tripod pencil grip'],
    beforePhotoData: tracker.beforePhotoData,
    afterPhotoData: tracker.afterPhotoData,
    savedToFolder: '/progress_reports/',
    createdAt: tracker.createdAt || new Date().toISOString(),
    emailedToParentAt: tracker.emailedToParentAt
  };
}

function mapStudentWorkRow(row: any): StudentWorkImage {
  return {
    id: row.id,
    studentId: row.student_id,
    imageData: row.file_url || '',
    captureDate: row.submitted_date || row.created_at || '',
    title: row.title || 'Work Sample',
    comments: row.title || undefined,
    category: row.work_type || undefined,
    createdAt: row.created_at || ''
  };
}

function mapProgressReportRow(row: any): ProgressReport {
  return {
    id: row.id,
    studentId: row.student_id,
    reportDate: row.report_date || '',
    reportTitle: row.report_title || row.milestone_title || undefined,
    completedClasses: row.completed_classes !== undefined && row.completed_classes !== null ? Number(row.completed_classes) : 0,
    totalClasses: row.total_classes !== undefined && row.total_classes !== null ? Number(row.total_classes) : 0,
    skills: Array.isArray(row.skills) ? row.skills : [],
    overallStars: row.overall_stars !== undefined && row.overall_stars !== null ? Number(row.overall_stars) : 0,
    overallRemark: row.overall_remark || row.teacher_feedback || '',
    nextSteps: Array.isArray(row.next_steps) ? row.next_steps : [],
    beforePhotoId: row.before_photo_id || undefined,
    beforePhotoData: row.before_photo_data || undefined,
    afterPhotoId: row.after_photo_id || undefined,
    afterPhotoData: row.after_photo_data || undefined,
    comments: row.comments || undefined,
    savedToFolder: row.saved_to_folder || undefined,
    emailedToParentAt: row.emailed_to_parent_at || undefined,
    createdAt: row.created_at || ''
  };
}

function mapFeeReminderRow(row: any): FeeReminder {
  return {
    id: row.id,
    studentId: row.student_id,
    parentEmail: row.parent_email || row.parent_phone || '',
    parentName: row.parent_name || '',
    studentName: '',
    amount: row.amount_due !== undefined && row.amount_due !== null ? Number(row.amount_due) : 0,
    month: row.due_date || '',
    gpayLink: row.amount_due ? `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${row.amount_due}&cu=INR` : '',
    status: row.status || 'Sent',
    sentDate: row.sent_at || row.created_at || '',
    sentAt: row.sent_at || row.created_at || ''
  };
}

function mapDemoBookingRow(row: any): DemoBooking {
  const cleanAge = String(row.student_age !== undefined && row.student_age !== null ? row.student_age : '').replace(/\s*(years?|yrs)\b/gi, '').trim();

  return {
    id: row.id,
    studentName: row.student_name || '',
    parentName: row.parent_name || '',
    studentAge: Number(row.student_age) || 0,
    age: cleanAge,
    contactNumber: row.parent_phone || '',
    preferredDate: row.preferred_date || '',
    preferredTimeSlot: row.preferred_time_slot || '',
    modeOfLearning: (row.mode_of_learning === 'Online' ? 'Online' : 'In-person') as 'Online' | 'In-person',
    status: row.status || 'New',
    notes: row.parent_notes || row.coach_notes || '',
    createdAt: row.created_at || ''
  };
}

function mapAlertRow(row: any): AdminAlert {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    studentId: row.student_id || undefined,
    type: (row.alert_type || 'info') as any,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || ''
  };
}

function mapTestimonialRow(row: any): Testimonial {
  return {
    id: row.id,
    studentId: row.student_id || '',
    studentName: row.student_name || '',
    parentName: row.parent_name || '',
    grade: row.grade || undefined,
    schoolName: undefined,
    relationship: 'Parent',
    rating: row.rating !== undefined && row.rating !== null ? Number(row.rating) : 0,
    title: row.title || undefined,
    review: row.review || '',
    beforeAfterTag: row.before_after_tag || undefined,
    image: row.image || undefined,
    mediaConsent: Boolean(row.media_consent),
    status: (row.status || 'Published') as any,
    createdAt: row.created_at || ''
  };
}

function mapToolAuditLogRow(row: any): ToolAuditLog {
  return {
    id: row.id,
    userId: row.user_id || row.actor_id || '',
    userRole: row.user_role || row.actor_role || '',
    actorId: row.user_id || row.actor_id || '',
    actorUsername: row.actor_username || undefined,
    actorRole: (row.user_role || row.actor_role || undefined) as any,
    actorStudentId: row.actor_student_id || undefined,
    executionMode: row.execution_mode || undefined,
    toolName: row.tool_name,
    arguments: row.arguments || row.input_payload || {},
    result: row.result || row.output_result || {},
    actionSummary: row.action_summary || row.summary || '',
    status: row.status || (row.success ? 'success' : 'failed'),
    createdAt: row.created_at || ''
  };
}

export class SupabaseDatabase {
  // ================= USERS & AUTH =================
  async findUsersByIdentifier(loginIdentifier: string): Promise<StoredUser[]> {
    if (!loginIdentifier || typeof loginIdentifier !== "string") return [];
    const supabase = getSupabase();
    const clean = loginIdentifier.trim().toLowerCase();
    const phoneDigits = loginIdentifier.replace(/\D/g, '');

    // 1. Primary privileged pre-authentication RPC path (bypasses RLS via hardened SECURITY DEFINER)
    let userCandidates: any[] = [];
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_auth_user_by_identifier', { p_identifier: clean });
      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        userCandidates = rpcData;
      }
    } catch {
      // Fall through to explicit column projection
    }

    // 2. Direct targeted query fallback if RPC didn't return matches
    let resolvedUserIds: string[] = [];
    let directMatchedStudentId: string | null = null;
    if (userCandidates.length === 0) {
      try {
        const { data: stdRecord } = await supabase
          .from('students')
          .select('id, user_id')
          .or(`id.eq.${clean},id.ilike.${clean}`)
          .maybeSingle();
        if (stdRecord?.user_id) {
          resolvedUserIds.push(stdRecord.user_id);
          directMatchedStudentId = stdRecord.id;
        }
      } catch {
        // ignore
      }

      const filterConditions = [
        `email.ilike.${clean}`,
        `phone.eq.${phoneDigits || clean}`,
        `id.eq.${clean}`
      ];
      if (resolvedUserIds.length > 0) {
        filterConditions.push(`id.in.(${resolvedUserIds.join(',')})`);
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version')
        .or(filterConditions.join(','));

      if (!error && Array.isArray(data) && data.length > 0) {
        userCandidates = data;
      } else {
        // If username prefix or exact email search is required
        const { data: emailData } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version')
          .ilike('email', clean.includes('@') ? clean : `${clean}@%`);
        if (emailData && emailData.length > 0) {
          userCandidates = emailData;
        }
      }
    }

    if (userCandidates.length === 0) return [];

    // Identity-First: Enrich user candidates with coachId/designation or studentId from child tables
    const userIds = userCandidates.map((u: any) => u.id);
    const [coachResult, studentResult] = await Promise.all([
      supabase.from('coaches').select('id, user_id, designation').in('user_id', userIds),
      supabase.from('students').select('id, user_id').in('user_id', userIds)
    ]);

    const coachMap = new Map<string, { id: string; designation?: string }>();
    if (coachResult.data) {
      coachResult.data.forEach((c: any) => {
        if (c.user_id) coachMap.set(c.user_id, { id: c.id, designation: c.designation });
      });
    }

    const studentMap = new Map<string, string>();
    if (studentResult.data) {
      studentResult.data.forEach((s: any) => {
        if (s.user_id && !studentMap.has(s.user_id)) {
          studentMap.set(s.user_id, s.id);
        }
      });
    }

    return userCandidates.map((u: any) => {
      const coachInfo = coachMap.get(u.id);
      const studentId = directMatchedStudentId || studentMap.get(u.id);
      const mapped = mapUserRow(u, coachInfo?.designation || null);
      if (coachInfo) mapped.coachId = coachInfo.id;
      if (studentId) mapped.studentId = studentId;
      return mapped;
    });
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error looking up user ${id}: ${error.message}`);
    }
    if (!data) return null;

    let coachDesignation: string | null = null;
    let coachId: string | undefined = undefined;
    let studentId: string | undefined = undefined;

    if (data.role === 'coach') {
      try {
        const { data: coachData } = await supabase
          .from('coaches')
          .select('id, designation')
          .eq('user_id', data.id)
          .maybeSingle();
        if (coachData) {
          coachId = coachData.id;
          coachDesignation = coachData.designation;
        }
      } catch {
        // fallback
      }
    } else if (data.role === 'student') {
      try {
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', data.id)
          .limit(1)
          .maybeSingle();
        if (studentData) {
          studentId = studentData.id;
        }
      } catch {
        // fallback
      }
    }

    const user = mapUserRow(data, coachDesignation);
    if (coachId) user.coachId = coachId;
    if (studentId) user.studentId = studentId;
    return user;
  }

  async findUserByEmailOrUsername(identifier: string): Promise<StoredUser | null> {
    const users = await this.findUsersByIdentifier(identifier);
    return users.length > 0 ? users[0] : null;
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    return this.findUserByEmailOrUsername(username);
  }

  async findUserByStudentId(studentId: string): Promise<StoredUser | null> {
    const supabase = getSupabase();

    // Identity-First lookup: Check students.user_id foreign key
    const { data: stdData } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('id', studentId)
      .maybeSingle();

    if (stdData?.user_id) {
      const user = await this.findUserById(stdData.user_id);
      if (user) {
        user.studentId = studentId;
        return user;
      }
    }

    return null;
  }

  async getAdminUser(): Promise<StoredUser | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, password_hash, token_version, created_at')
      .eq('role', 'admin')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[SupabaseDatabase] Error querying admin user from users table: ${error.message}`);
      throw new Error(`Failed to query admin user: ${error.message}`);
    }
    return data ? mapUserRow(data) : null;
  }

  async getAdminEmail(): Promise<string | null> {
    const admin = await this.getAdminUser();
    return admin?.email || null;
  }

  async getSiblingStudentsForUser(user: StoredUser): Promise<StudentProfile[]> {
    if (!user.id && !user.phoneNumber && !user.email) return [];
    const supabase = getSupabase();
    const phoneClean = (user.phoneNumber || '').replace(/\D/g, '');
    const cleanEmail = (user.email || '').trim().toLowerCase();

    const orConditions: string[] = [];
    if (user.id) {
      orConditions.push(`user_id.eq.${user.id}`);
    }
    if (user.studentId) {
      orConditions.push(`id.eq.${user.studentId}`);
    }
    if (phoneClean && phoneClean.length >= 7) {
      orConditions.push(`emergency_contact_phone.ilike.%${phoneClean.slice(-10)}%`);
    }

    // Also link by all user accounts sharing the same email
    if (cleanEmail) {
      const { data: siblingUsers } = await supabase
        .from('users')
        .select('id')
        .ilike('email', cleanEmail);
      if (siblingUsers && siblingUsers.length > 0) {
        const siblingUserIds = siblingUsers.map((u: any) => u.id).filter(Boolean);
        if (siblingUserIds.length > 0) {
          orConditions.push(`user_id.in.(${siblingUserIds.join(',')})`);
        }
      }
    }

    let query = supabase
      .from('students')
      .select('id, user_id, coach_id, age, grade, school_name, parent_name, mode_of_learning, emergency_contact_name, emergency_contact_phone, status, preferred_slot, total_classes, attended_classes, notes, avatar_url, diagnostic_observations, created_at, updated_at');

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const seenIds = new Set<string>();
    const siblings: any[] = [];
    for (const s of data) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        siblings.push(s);
      }
    }

    const userIds = siblings.map((s: any) => s.user_id).filter(Boolean);
    const userMap = new Map();
    if (userIds.length > 0) {
      const { data: uData } = await supabase.from('users').select('*').in('id', userIds);
      (uData || []).forEach((u: any) => userMap.set(u.id, u));
    }
    return siblings.map((s: any) => mapStudentRow(s, userMap.get(s.user_id)));

  }

  async getFamilyStudentsByEmailOrPhone(identifier: string): Promise<StudentProfile[]> {
    if (!identifier) return [];
    const supabase = getSupabase();
    const clean = identifier.trim().toLowerCase();
    const phoneDigits = identifier.replace(/\D/g, '');

    const { data: users } = await supabase
      .from('users')
      .select('id, email, phone')
      .or(`email.ilike.${clean},phone.eq.${phoneDigits || clean}`);

    const userIds = (users || []).map((u: any) => u.id);
    const orConditions: string[] = [];
    if (userIds.length > 0) {
      orConditions.push(`user_id.in.(${userIds.join(',')})`);
    }
    if (phoneDigits && phoneDigits.length >= 7) {
      orConditions.push(`emergency_contact_phone.ilike.%${phoneDigits.slice(-10)}%`);
    }

    if (orConditions.length === 0) return [];

    const { data: students, error } = await supabase
      .from('students')
      .select('id, user_id, coach_id, age, grade, school_name, parent_name, mode_of_learning, emergency_contact_name, emergency_contact_phone, status, preferred_slot, total_classes, attended_classes, notes, avatar_url, diagnostic_observations, created_at, updated_at')
      .or(orConditions.join(','));

    if (error || !students) return [];

    const seenIds = new Set<string>();
    const uniqueStudents: any[] = [];
    for (const s of students) {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        uniqueStudents.push(s);
      }
    }
    const userMap = new Map();
    (users || []).forEach((u: any) => userMap.set(u.id, u));

    return uniqueStudents.map((s: any) => mapStudentRow(s, userMap.get(s.user_id)));
  }

  async changeUserPassword(
    email: string,
    currentPassword?: string,
    newPassword?: string,
    options?: { targetStudentId?: string; targetUserId?: string; applyToAll?: boolean }
  ): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const supabase = getSupabase();
    const cleanEmail = email.trim().toLowerCase();

    // Query all users matching this email
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, password_hash, token_version')
      .ilike('email', cleanEmail);

    if (findError || !users || users.length === 0) {
      return { success: false, error: 'User account not found.' };
    }

    // Determine target users to update
    let targetUsers = users;

    if (options?.targetUserId) {
      targetUsers = users.filter((u: any) => u.id === options.targetUserId);
      if (targetUsers.length === 0) {
        return { success: false, error: 'Target user profile not found.' };
      }
    } else if (options?.targetStudentId) {
      // Find user linked to targetStudentId
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id, user_id')
        .eq('id', options.targetStudentId)
        .maybeSingle();

      if (studentRecord?.user_id) {
        targetUsers = users.filter((u: any) => u.id === studentRecord.user_id);
      }
      if (targetUsers.length === 0) {
        return { success: false, error: 'Target student account not found.' };
      }
    }

    // If currentPassword was provided, verify it
    if (currentPassword) {
      const passwordMatchingUsers = targetUsers.filter((u: any) =>
        u.password_hash && bcrypt.compareSync(currentPassword, u.password_hash)
      );

      if (passwordMatchingUsers.length === 0) {
        return { success: false, error: 'Incorrect current password.' };
      }

      // If applyToAll is true (or default when not targeting a specific student),
      // update all matching users whose current password matched
      targetUsers = passwordMatchingUsers;
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const targetIds = targetUsers.map((u: any) => u.id);

    // Update password_hash and increment token_version to invalidate existing tokens
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        token_version: ((targetUsers[0] as any)?.token_version || 1) + 1
      })
      .in('id', targetIds);

    if (updateError) {
      return { success: false, error: `Failed to update password: ${updateError.message}` };
    }

    return { success: true, updatedCount: targetIds.length };
  }

  async createPasswordResetToken(email: string): Promise<{ token: string } | { error: string }> {
    const supabase = getSupabase();
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    if (findError || !user) {
      return { error: 'No account registered with this email address.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_password_token: token,
        reset_password_expiry: expiry
      })
      .eq('id', user.id);

    if (updateError) {
      return { error: `Failed to create reset token: ${updateError.message}` };
    }

    return { token };
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!token || !newPassword || newPassword.length < 8) {
      return { success: false, error: 'Invalid reset parameters or password too short.' };
    }

    const supabase = getSupabase();
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('reset_password_token', token)
      .maybeSingle();

    if (findError || !user) {
      return { success: false, error: 'Invalid or expired password reset link.' };
    }

    if (user.reset_password_expiry && Number(user.reset_password_expiry) < Date.now()) {
      return { success: false, error: 'Password reset link has expired. Please request a new one.' };
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        reset_password_token: null,
        reset_password_expiry: null
      })
      .eq('id', user.id);

    if (updateError) {
      return { success: false, error: `Failed to reset password: ${updateError.message}` };
    }

    return { success: true };
  }

  async upsertUserFromSupabase(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'coach' | 'student' | 'parent';
    studentId?: string;
    id?: string;
    username?: string;
  }): Promise<StoredUser> {
    const supabase = getSupabase();
    const targetId = userData.id || `usr-${Date.now()}`;
    const targetRole = userData.role || 'student';
    const firstName = userData.firstName;
    const lastName = userData.lastName;

    // Lookup-first strategy: never overwrite an existing user's role from client-supplied data
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, username, is_active, student_id, coach_id, phone_number')
      .eq('email', userData.email)
      .maybeSingle();

    if (existingUser) {
      // User exists — return without modifying role or security fields
      return mapUserRow(existingUser);
    }

    // New user — insert with the provided role
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: targetId,
        email: userData.email,
        first_name: firstName,
        last_name: lastName,
        role: targetRole,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to sync user session in database: ${error.message}`);
    }

    return mapUserRow(data);
  }

  // ================= STUDENTS =================
  async getAllStudents(options?: PaginationParams): Promise<StudentProfile[]> {
    const supabase = getSupabase();
    let query = supabase.from('students').select('*');

    query = applyQueryPagination(query, options);

    const { data: students, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch students from database: ${error.message}`);
    }

    const { data: users } = await applyRowCeiling(
      supabase.from('users').select('*')
    );

    const userMap = new Map();
    (users || []).forEach((u: any) => {
      if (u.id) userMap.set(u.id, u);
    });

    // Build coach map to dynamically pick coach name from coach/user table
    const { data: coaches } = await applyRowCeiling(
      supabase.from('coaches').select('id, user_id')
    );

    const coachMap = new Map<string, string>();
    (coaches || []).forEach((c: any) => {
      const u = c.user_id ? userMap.get(c.user_id) : null;
      const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
      if (name) coachMap.set(c.id, name);
    });

    return (students || []).map((s: any) => {
      const user = (s.user_id && userMap.get(s.user_id)) || userMap.get(s.id);
      const coachName = s.coach_id ? (coachMap.get(s.coach_id) || null) : null;
      return mapStudentRow(s, user, coachName);
    });
  }

  async getStudentsCount(): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }

  async getStudentsByCoachId(coachId: string, alternateId?: string, options?: PaginationParams): Promise<StudentProfile[]> {
    const supabase = getSupabase();
    const rawIds = [coachId, alternateId].filter(Boolean) as string[];
    if (rawIds.length === 0) return [];

    const { data: coachRows } = await supabase
      .from('coaches')
      .select('id, user_id')
      .or(`id.in.(${rawIds.join(',')}),user_id.in.(${rawIds.join(',')})`);

    const allCoachIds = new Set<string>(rawIds);
    (coachRows || []).forEach((c: any) => {
      if (c.id) allCoachIds.add(c.id);
      if (c.user_id) allCoachIds.add(c.user_id);
    });

    const targetIds = Array.from(allCoachIds);

    let query = supabase.from('students').select('*');
    if (targetIds.length === 1) {
      query = query.eq('coach_id', targetIds[0]);
    } else {
      query = query.in('coach_id', targetIds);
    }

    query = applyQueryPagination(query, options);

    const { data: students, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch coach students: ${error.message}`);
    }

    const { data: users } = await applyRowCeiling(
      supabase.from('users').select('*')
    );

    const userMap = new Map();
    (users || []).forEach((u: any) => {
      if (u.id) userMap.set(u.id, u);
    });

    const { data: coaches } = await applyRowCeiling(
      supabase.from('coaches').select('id, user_id')
    );

    const coachMap = new Map<string, string>();
    (coaches || []).forEach((c: any) => {
      const u = c.user_id ? userMap.get(c.user_id) : null;
      const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
      if (name) coachMap.set(c.id, name);
    });

    return (students || []).map((s: any) => {
      const user = (s.user_id && userMap.get(s.user_id)) || userMap.get(s.id);
      const coachName = s.coach_id ? (coachMap.get(s.coach_id) || null) : null;
      return mapStudentRow(s, user, coachName);
    });
  }

  async getStudentsCountByCoachId(coachId: string, alternateId?: string): Promise<number> {
    const supabase = getSupabase();
    const rawIds = [coachId, alternateId].filter(Boolean) as string[];
    if (rawIds.length === 0) return 0;

    const { data: coachRows } = await supabase
      .from('coaches')
      .select('id, user_id')
      .or(`id.in.(${rawIds.join(',')}),user_id.in.(${rawIds.join(',')})`);

    const allCoachIds = new Set<string>(rawIds);
    (coachRows || []).forEach((c: any) => {
      if (c.id) allCoachIds.add(c.id);
      if (c.user_id) allCoachIds.add(c.user_id);
    });

    const targetIds = Array.from(allCoachIds);

    let query = supabase.from('students').select('*', { count: 'exact', head: true });
    if (targetIds.length === 1) {
      query = query.eq('coach_id', targetIds[0]);
    } else {
      query = query.in('coach_id', targetIds);
    }
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  }

  async getStudentById(id: string): Promise<StudentProfile | null> {
    const supabase = getSupabase();
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup student ${id}: ${error.message}`);
    }
    if (!student) return null;

    let user: any = null;
    const lookupUserId = student.user_id || student.id;
    if (lookupUserId) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', lookupUserId)
        .maybeSingle();
      user = uData;
    }

    let coachName: string | null = null;
    if (student.coach_id) {
      const coach = await this.getCoachById(student.coach_id);
      if (coach) {
        coachName = `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || null;
      }
    }

    return mapStudentRow(student, user, coachName);
  }

  async checkStudentDuplicate(
    param1: string | { firstName?: string; lastName?: string; phoneNumber?: string; email?: string; age?: number },
    param2?: number | string,
    param3?: string,
    param4?: string
  ): Promise<boolean> {
    const supabase = getSupabase();

    let firstName = '';
    let lastName = '';
    let phoneNumber = '';
    let email = '';

    if (typeof param1 === 'object' && param1 !== null) {
      firstName = (param1.firstName || '').trim();
      lastName = (param1.lastName || '').trim();
      phoneNumber = (param1.phoneNumber || '').trim();
      email = (param1.email || '').trim();
    } else if (typeof param1 === 'string') {
      firstName = param1.trim();
      if (typeof param2 === 'number') {
        phoneNumber = (param3 || '').trim();
      } else if (typeof param2 === 'string') {
        lastName = param2.trim();
        phoneNumber = (param3 || '').trim();
        email = (param4 || '').trim();
      }
    }

    const cleanFirstName = firstName.toLowerCase();
    const cleanLastName = lastName.toLowerCase();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const cleanEmail = email.toLowerCase();

    // 1. Check USERS table:
    // If first name + last name + phone number OR first name + last name + emailid already exists in users table
    const { data: users, error: uError } = await supabase
      .from('users')
      .select('id, first_name, last_name, phone, email, role');

    if (!uError && users) {
      for (const u of users) {
        const uFirst = (u.first_name || '').trim().toLowerCase();
        const uLast = (u.last_name || '').trim().toLowerCase();
        const uPhone = (u.phone || '').replace(/\D/g, '');
        const uEmail = (u.email || '').trim().toLowerCase();

        const nameMatches = Boolean(
          cleanFirstName && uFirst === cleanFirstName &&
          ((cleanLastName && uLast === cleanLastName) || (!cleanLastName && !uLast))
        );

        if (nameMatches) {
          // Condition 1: first name + last name + phone number
          const phoneMatches = Boolean(
            cleanPhone.length >= 7 &&
            uPhone.length >= 7 &&
            (cleanPhone === uPhone || cleanPhone.endsWith(uPhone) || uPhone.endsWith(cleanPhone) || cleanPhone.includes(uPhone) || uPhone.includes(cleanPhone))
          );

          // Condition 2: first name + last name + emailid
          const emailMatches = Boolean(cleanEmail && uEmail && cleanEmail === uEmail);

          if (phoneMatches || emailMatches) {
            return true;
          }
        }
      }
    }

    // 2. Check STUDENTS table:
    if (cleanPhone.length >= 7) {
      const { data: students, error: sError } = await supabase
        .from('students')
        .select('id, emergency_contact_phone');

      if (!sError && students) {
        for (const s of students) {
          const sPhone = (s.emergency_contact_phone || '').replace(/\D/g, '');
          if (sPhone.length >= 7 && (cleanPhone === sPhone || cleanPhone.endsWith(sPhone) || sPhone.endsWith(cleanPhone))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  async createStudent(student: any): Promise<StudentProfile> {
    const supabase = getSupabase();
    const studentId = student.id || `std-${Date.now()}`;

    const ageNum = student.age !== undefined && student.age !== null && student.age !== '' ? Number(student.age) : null;

    let firstName = (student.firstName || '').trim();
    let lastName = (student.lastName || '').trim();

    if (!firstName && student.name) {
      const parts = student.name.trim().split(' ');
      firstName = parts[0] || 'Student';
      lastName = parts.slice(1).join(' ') || '';
    }
    if (!firstName) firstName = 'Student';

    const phone = (student.whatsappMobile || student.phoneNumber || student.phone || student.emergencyContactPhone || '').trim();
    if (!phone) {
      throw new Error("A valid phone number is required to create a student account.");
    }
    const email = student.email ? student.email.toLowerCase().trim() : null;
    const userFirstName = student.firstName?.trim() || firstName;
    const userLastName = student.lastName?.trim() || lastName;

    // 1. Identity-First: Create or link user account in public.users first
    let createdUser: any = null;
    let assignedUserId: string = student.userId || '';

    // Check if an existing user account already exists with the EXACT SAME first name, last name, and email
    if (!assignedUserId && email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email)
        .ilike('first_name', userFirstName)
        .ilike('last_name', userLastName)
        .maybeSingle();

      if (existingUser) {
        assignedUserId = existingUser.id;
        createdUser = existingUser;
      }
    }

    if (!assignedUserId && (email || student.password || student.passwordHash)) {
      let passwordHash = student.passwordHash;
      if (!passwordHash && student.password && student.password.trim()) {
        passwordHash = bcrypt.hashSync(student.password.trim(), 10);
      }
      if (!passwordHash) {
        throw new Error("A valid password is required to create a student user account.");
      }
      assignedUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const { data: uData, error: uError } = await supabase
        .from('users')
        .insert({
          id: assignedUserId,
          email: email,
          first_name: userFirstName,
          last_name: userLastName,
          phone: phone,
          role: 'student',
          password_hash: passwordHash,
          is_active: true
        })
        .select()
        .single();

      if (uError) {
        throw new Error(`Failed to create student user account: ${uError.message}`);
      }
      createdUser = uData;
    }

    // 2. Insert into students table with forward-written user_id
    const metaNotesPayload: any = {
      dominantHand: student.dominantHand || 'Right',
      preferredDays: student.preferredDays || undefined,
      relationship: student.relationship || undefined,
      scriptsRequired: Array.isArray(student.scriptsRequired) ? student.scriptsRequired : [],
      academicModules: Array.isArray(student.academicModules) ? student.academicModules : [],
      dateOfLeaving: student.dateOfLeaving?.trim() || undefined,
      customNotes: student.notes || undefined
    };

    const studentRow: any = {
      id: studentId,
      user_id: assignedUserId || null,
      age: isNaN(ageNum as number) ? null : ageNum,
      grade: student.gradeClass || student.grade || null,
      school_name: student.schoolName || null,
      parent_name: student.parentName || null,
      mode_of_learning: student.modeOfLearning || 'In-person',
      emergency_contact_name: student.emergencyContactName?.trim() || null,
      emergency_contact_phone: (student.emergencyContactPhone || student.emergencyPhone || '').trim() || null,
      status: student.status || 'Active',
      coach_id: student.coachId || null,
      preferred_slot: student.preferredSlot || null,
      total_classes: student.totalClasses !== undefined && student.totalClasses !== null ? Number(student.totalClasses) : 8,
      attended_classes: student.attendedClasses !== undefined && student.attendedClasses !== null ? Number(student.attendedClasses) : 0,
      notes: JSON.stringify(metaNotesPayload),
      avatar_url: student.avatarUrl || null,
      diagnostic_observations: Array.isArray(student.diagnosticObservations) ? student.diagnosticObservations : []
    };

    let { data, error } = await supabase
      .from('students')
      .insert(studentRow)
      .select()
      .single();

    // If user_id column is not yet present on students table (prior to migration 001 execution), retry without user_id
    if (error && error.message && error.message.includes('user_id')) {
      const fallbackRow = { ...studentRow };
      delete fallbackRow.user_id;
      const retryResult = await supabase
        .from('students')
        .insert(fallbackRow)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      // Roll back created user if student insertion failed
      if (createdUser?.id) {
        await supabase.from('users').delete().eq('id', createdUser.id);
      }
      throw new Error(`Failed to create student in database: ${error.message}`);
    }

    let coachName: string | null = null;
    if (studentRow.coach_id) {
      const coachData = await this.getCoachById(studentRow.coach_id);
      if (coachData) {
        coachName = `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() || null;
      }
    }

    const mapped = mapStudentRow(data, createdUser, coachName);
    if (!mapped.email && email) {
      mapped.email = email;
    }
    if (!mapped.whatsappMobile && phone) {
      mapped.whatsappMobile = phone;
    }
    return mapped;
  }

  async updateStudent(id: string, updates: Partial<StudentProfile>): Promise<StudentProfile | null> {
    const supabase = getSupabase();
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.firstName !== undefined) updateData.first_name = updates.firstName.trim();
    if (updates.lastName !== undefined) updateData.last_name = updates.lastName.trim();
    if (updates.age !== undefined) updateData.age = Number(updates.age);
    if (updates.gradeClass !== undefined) updateData.grade = updates.gradeClass;
    if (updates.schoolName !== undefined) updateData.school_name = updates.schoolName;
    if (updates.parentName !== undefined) updateData.parent_name = updates.parentName;
    if (updates.modeOfLearning !== undefined) updateData.mode_of_learning = updates.modeOfLearning;
    if (updates.emergencyContactName !== undefined) updateData.emergency_contact_name = updates.emergencyContactName;
    if (updates.emergencyContactPhone !== undefined || updates.emergencyPhone !== undefined) {
      updateData.emergency_contact_phone = updates.emergencyContactPhone || updates.emergencyPhone;
    }
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.coachId !== undefined) updateData.coach_id = updates.coachId || null;
    if (updates.preferredSlot !== undefined) updateData.preferred_slot = updates.preferredSlot;
    if (updates.totalClasses !== undefined) updateData.total_classes = Number(updates.totalClasses);
    if (updates.attendedClasses !== undefined) updateData.attended_classes = Number(updates.attendedClasses);

    if (updates.dominantHand !== undefined || updates.preferredDays !== undefined || updates.relationship !== undefined || updates.notes !== undefined || updates.scriptsRequired !== undefined || updates.academicModules !== undefined || updates.dateOfLeaving !== undefined || updates.status !== undefined) {
      const { data: currentStudent } = await supabase
        .from('students')
        .select('notes, user_id')
        .eq('id', id)
        .maybeSingle();

      let existingMeta: any = {};
      if (currentStudent?.notes) {
        try {
          existingMeta = JSON.parse(currentStudent.notes);
        } catch {
          existingMeta = { customNotes: currentStudent.notes };
        }
      }

      if (updates.dominantHand !== undefined) existingMeta.dominantHand = updates.dominantHand;
      if (updates.preferredDays !== undefined) existingMeta.preferredDays = updates.preferredDays;
      if (updates.relationship !== undefined) existingMeta.relationship = updates.relationship;
      if (updates.notes !== undefined) existingMeta.customNotes = updates.notes;
      if (updates.scriptsRequired !== undefined) existingMeta.scriptsRequired = updates.scriptsRequired;
      if (updates.academicModules !== undefined) existingMeta.academicModules = updates.academicModules;

      if (updates.dateOfLeaving !== undefined) {
        existingMeta.dateOfLeaving = updates.dateOfLeaving?.trim() || null;
      }
      if (updates.status !== undefined) {
        if (updates.status === 'Inactive') {
          if (!updates.dateOfLeaving && !existingMeta.dateOfLeaving) {
            existingMeta.dateOfLeaving = new Date().toISOString().split('T')[0];
          }
        } else if (updates.status === 'Active') {
          existingMeta.dateOfLeaving = null;
        }
      }

      updateData.notes = JSON.stringify(existingMeta);
    }

    if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
    if (updates.diagnosticObservations !== undefined) updateData.diagnostic_observations = updates.diagnosticObservations;

    let updatedStudent = null;
    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update student ${id}: ${error.message}`);
    }
    updatedStudent = data;

    // Also update public.users if contact info, name, or password is updated
    if (updates.email !== undefined || updates.whatsappMobile !== undefined || updates.firstName !== undefined || updates.lastName !== undefined || (updates.password && updates.password.trim().length >= 8)) {
      const userUpdates: any = {
        updated_at: new Date().toISOString()
      };
      if (updates.email !== undefined) userUpdates.email = updates.email.toLowerCase().trim();
      if (updates.whatsappMobile !== undefined) userUpdates.phone = updates.whatsappMobile.trim();
      if (updates.firstName !== undefined) userUpdates.first_name = updates.firstName.trim();
      if (updates.lastName !== undefined) userUpdates.last_name = updates.lastName.trim();
      if (updates.password && updates.password.trim().length >= 8) {
        userUpdates.password_hash = bcrypt.hashSync(updates.password.trim(), 10);
      }

      if (updatedStudent?.user_id) {
        await supabase
          .from('users')
          .update(userUpdates)
          .eq('id', updatedStudent.user_id);
      }
    }

    let user: any = null;
    if (updatedStudent?.user_id) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', updatedStudent.user_id)
        .maybeSingle();
      user = uData;
    }

    let coachName: string | null = null;
    const coachIdToLookup = updatedStudent?.coach_id || updates.coachId;
    if (coachIdToLookup) {
      const coachData = await this.getCoachById(coachIdToLookup);
      if (coachData) {
        coachName = `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() || null;
      }
    }

    return updatedStudent ? mapStudentRow(updatedStudent, user, coachName) : null;
  }

  async deleteStudent(id: string): Promise<boolean> {
    // Soft Deactivation: No physical deletion of student records
    const today = new Date().toISOString().split('T')[0];
    const updated = await this.updateStudent(id, {
      status: 'Inactive',
      dateOfLeaving: today
    });
    return Boolean(updated);
  }

  // ================= COACHES =================
  async getAllCoaches(): Promise<CoachProfile[]> {
    const supabase = getSupabase();

    // 1. Fetch coaches from dedicated `coaches` table using explicit projection
    const { data: coachesData, error: coachError } = await applyRowCeiling(
      supabase
        .from('coaches')
        .select('id, user_id, address, date_of_joining, status, date_of_leaving, educational_qualification, designation, specializations, emergency_contact_name, emergency_contact_phone, notes, created_at, updated_at')
        .order('created_at', { ascending: false })
    );

    if (coachError) {
      console.error(`[SupabaseDatabase] Error fetching from coaches table: ${coachError.message}`);
      throw new Error(`Failed to fetch coaches from database: ${coachError.message}`);
    }

    // 2. Fetch coach users from users table using explicit projection
    const { data: coachUsers, error: userError } = await applyRowCeiling(
      supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, is_active, created_at')
        .eq('role', 'coach')
    );

    if (userError) {
      console.error(`[SupabaseDatabase] Error fetching coach users from users table: ${userError.message}`);
    }

    const { data: students } = await supabase
      .from('students')
      .select('id, coach_id');

    const coachesList = coachesData || [];
    const userLookupByUserId = new Map<string, any>();

    (coachUsers || []).forEach((u: any) => {
      userLookupByUserId.set(u.id, u);
      if (u.email) userLookupByUserId.set(u.email.toLowerCase(), u);
    });

    // Data integrity validation: Detect and LOG orphaned coach users who lack a coaches table record.
    // In accordance with Section 3 (NO MOCK / NO FALLBACK DATA), we NEVER synthesize fake records.
    if (coachUsers && coachUsers.length > 0) {
      for (const u of coachUsers) {
        const matchesCoach = coachesList.some(
          (c: any) => c.id === u.id || c.user_id === u.id || (c.email && u.email && c.email.toLowerCase() === u.email.toLowerCase())
        );
        if (!matchesCoach) {
          console.error(`[DATA_INTEGRITY_ANOMALY] User "${u.id}" (${u.email}) has role='coach' in users table but no corresponding profile exists in the coaches table.`);
        }
      }
    }

    // Return real coach records from coaches table (single source of truth)
    return coachesList.map((c: any) => {
      const assignedCount = (students || []).filter((s: any) => s.coach_id === c.id).length;
      const linkedUser = (c.user_id && userLookupByUserId.get(c.user_id)) || userLookupByUserId.get(c.id) || (c.email ? userLookupByUserId.get(c.email.toLowerCase()) : null);
      return mapCoachRow(c, assignedCount, linkedUser);
    });
  }

  async updateUserSelfProfile(userId: string, allowedUpdates: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; user?: StoredUser; error?: string }> {
    const supabase = getSupabase();

    // Check user role: Coaches cannot edit their own details. Only Admin can do that.
    const { data: targetUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (targetUser?.role === 'coach') {
      return { success: false, error: 'Access denied: Coaches cannot edit their own details. Only an Administrator can update coach details.' };
    }

    // Explicit column-level whitelist: only allow safe self-profile fields
    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (allowedUpdates.phoneNumber !== undefined) {
      payload.phone = allowedUpdates.phoneNumber.trim();
    }
    if (allowedUpdates.avatarUrl !== undefined) {
      payload.avatar_url = allowedUpdates.avatarUrl.trim();
    }

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('id, email, first_name, last_name, phone, role, avatar_url, is_active, token_version, created_at, updated_at')
      .single();

    if (error) {
      return { success: false, error: `Failed to update user profile: ${error.message}` };
    }

    return { success: true, user: mapUserRow(data) };
  }

  async getCoachById(id: string): Promise<CoachProfile | null> {
    const supabase = getSupabase();

    const { data: coachData } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('coach_id', id);

    const studentCount = students?.length || 0;

    let linkedUser: any = null;
    const lookupUserId = coachData?.user_id || id;
    if (lookupUserId) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', lookupUserId)
        .maybeSingle();
      linkedUser = uData;
    }

    if (coachData) {
      return mapCoachRow(coachData, studentCount, linkedUser);
    }

    if (linkedUser && linkedUser.role === 'coach') {
      const firstName = linkedUser.first_name || 'Coach';
      const lastName = linkedUser.last_name || '';
      return mapCoachRow({
        id: linkedUser.id,
        user_id: linkedUser.id,
        first_name: firstName,
        last_name: lastName,
        designation: linkedUser.designation || 'Principal Coach',
        status: linkedUser.is_active !== false ? 'Active' : 'Inactive',
        created_at: linkedUser.created_at
      }, studentCount, linkedUser);
    }

    return null;
  }

  async createCoach(data: {
    firstName?: string;
    lastName?: string;
    email: string;
    phoneNumber: string;
    address?: string;
    dateOfJoining?: string;
    status?: 'Active' | 'Inactive';
    dateOfLeaving?: string;
    educationalQualification?: string;
    designation?: string;
    specializations?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    password?: string;
  }): Promise<CoachProfile> {
    if (data.dateOfJoining && data.dateOfLeaving && new Date(data.dateOfLeaving) < new Date(data.dateOfJoining)) {
      throw new Error('Date of leaving cannot be earlier than date of joining.');
    }

    const supabase = getSupabase();
    const coachId = `coach-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let firstName = (data.firstName || '').trim();
    let lastName = (data.lastName || '').trim();

    if (!lastName) {
      lastName = '';
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedPhone = data.phoneNumber ? data.phoneNumber.trim() : '';
    if (!normalizedPhone) {
      throw new Error("A valid phone number is required to create a coach profile.");
    }
    const coachStatus = data.status === 'Inactive' ? 'Inactive' : 'Active';
    const designation = data.designation?.trim() || 'Principal Coach';
    const specs = Array.isArray(data.specializations)
      ? data.specializations
      : [];

    const dateOfJoining = (data.dateOfJoining && data.dateOfJoining.trim())
      ? data.dateOfJoining.trim()
      : new Date().toISOString().split('T')[0];
    const dateOfLeaving = (data.dateOfLeaving && data.dateOfLeaving.trim())
      ? data.dateOfLeaving.trim()
      : null;

    // 1. Validate password first
    if (!data.password || data.password.trim().length < 8) {
      throw new Error("A valid password (minimum 8 characters) is required to create a coach account.");
    }
    const initialPassword = data.password.trim();
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    // 2. Identity-First: Create or resolve user record first
    let createdUser: any = null;
    let assignedUserId: string = '';
    let isNewUser = false;

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      assignedUserId = existingUser.id;
      const { data: updatedU, error: uUpdateError } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          role: 'coach',
          password_hash: passwordHash,
          is_active: coachStatus === 'Active',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (uUpdateError) {
        console.warn(`[SupabaseDatabase] Warning updating user for coach: ${uUpdateError.message}`);
      }
      createdUser = updatedU || existingUser;
    } else {
      assignedUserId = `usr-${coachId}`;
      isNewUser = true;
      const { data: newU, error: uInsertError } = await supabase
        .from('users')
        .insert({
          id: assignedUserId,
          email: normalizedEmail,
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
          role: 'coach',
          password_hash: passwordHash,
          is_active: coachStatus === 'Active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (uInsertError) {
        throw new Error(`Failed to create coach user credentials: ${uInsertError.message}`);
      }
      createdUser = newU;
    }

    // 3. Insert into coaches table with forward-written user_id
    const coachPayload: any = {
      id: coachId,
      user_id: assignedUserId || null,
      address: (data.address && data.address.trim()) ? data.address.trim() : null,
      date_of_joining: dateOfJoining,
      status: coachStatus,
      date_of_leaving: dateOfLeaving,
      educational_qualification: (data.educationalQualification && data.educationalQualification.trim()) ? data.educationalQualification.trim() : null,
      designation: designation,
      specializations: specs,
      emergency_contact_name: (data.emergencyContactName && data.emergencyContactName.trim()) ? data.emergencyContactName.trim() : null,
      emergency_contact_phone: (data.emergencyContactPhone && data.emergencyContactPhone.trim()) ? data.emergencyContactPhone.trim() : null,
      notes: (data.notes && data.notes.trim()) ? data.notes.trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertedCoach, error: coachError } = await supabase
      .from('coaches')
      .insert(coachPayload)
      .select()
      .single();

    if (coachError) {
      // Roll back user if newly created
      if (isNewUser && assignedUserId) {
        await supabase.from('users').delete().eq('id', assignedUserId);
      }
      console.error('[SupabaseDatabase] Error inserting into coaches table:', coachError);
      throw new Error(`Failed to create coach profile in database: ${coachError.message}${coachError.details ? ` (${coachError.details})` : ''}`);
    }

    return mapCoachRow(insertedCoach || coachPayload, 0, createdUser);
  }

  async updateCoach(id: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    dateOfJoining?: string;
    status?: 'Active' | 'Inactive';
    dateOfLeaving?: string;
    educationalQualification?: string;
    designation?: string;
    specializations?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    notes?: string;
    password?: string;
  }): Promise<CoachProfile> {
    if (updates.dateOfJoining && updates.dateOfLeaving && new Date(updates.dateOfLeaving) < new Date(updates.dateOfJoining)) {
      throw new Error('Date of leaving cannot be earlier than date of joining.');
    }

    const supabase = getSupabase();

    let firstName = updates.firstName?.trim();
    let lastName = updates.lastName?.trim();
    const patch: any = {
      updated_at: new Date().toISOString()
    };

    if (firstName !== undefined) patch.first_name = firstName;
    if (lastName !== undefined) patch.last_name = lastName;
    if (updates.email !== undefined) patch.email = updates.email.toLowerCase().trim();
    if (updates.phoneNumber !== undefined) patch.phone = updates.phoneNumber.trim();
    if (updates.address !== undefined) patch.address = updates.address.trim() || null;
    if (updates.dateOfJoining !== undefined) patch.date_of_joining = updates.dateOfJoining?.trim() || null;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.dateOfLeaving !== undefined) patch.date_of_leaving = updates.dateOfLeaving?.trim() || null;
    if (updates.educationalQualification !== undefined) patch.educational_qualification = updates.educationalQualification.trim() || null;
    if (updates.designation !== undefined) patch.designation = updates.designation.trim() || null;
    if (updates.specializations !== undefined) patch.specializations = updates.specializations;
    if (updates.emergencyContactName !== undefined) patch.emergency_contact_name = updates.emergencyContactName.trim() || null;
    if (updates.emergencyContactPhone !== undefined) patch.emergency_contact_phone = updates.emergencyContactPhone.trim() || null;
    if (updates.notes !== undefined) patch.notes = updates.notes.trim() || null;

    const { data: updatedCoach, error } = await supabase
      .from('coaches')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update coach: ${error.message}`);
    }

    // Sync changes to associated user in users table
    const userPatch: any = {
      updated_at: new Date().toISOString()
    };
    if (firstName !== undefined) userPatch.first_name = firstName;
    if (lastName !== undefined) userPatch.last_name = lastName;
    if (updates.email) userPatch.email = updates.email.toLowerCase().trim();
    if (updates.phoneNumber) userPatch.phone = updates.phoneNumber.trim();
    if (updates.status) userPatch.is_active = updates.status === 'Active';
    if (updates.password && updates.password.trim().length >= 8) {
      userPatch.password_hash = bcrypt.hashSync(updates.password.trim(), 10);
    }

    let updatedUser: any = null;
    if (Object.keys(userPatch).length > 0) {
      try {
        if (updatedCoach?.user_id) {
          const { data: uData } = await supabase
            .from('users')
            .update(userPatch)
            .eq('id', updatedCoach.user_id)
            .select()
            .maybeSingle();
          updatedUser = uData;
        } else {
          const { data: uData } = await supabase
            .from('users')
            .update(userPatch)
            .eq('id', id)
            .select()
            .maybeSingle();
          updatedUser = uData;
        }
      } catch (e: any) {
        console.warn(`[SupabaseDatabase] Notice updating user for coach ${id}: ${e.message}`);
      }
    }

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('coach_id', id);

    return mapCoachRow(updatedCoach, students?.length || 0, updatedUser);
  }

  async deleteCoach(id: string): Promise<boolean> {
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];

    // 1. Unassign coach from any students so active students are not stranded
    try {
      await supabase
        .from('students')
        .update({ coach_id: null, updated_at: new Date().toISOString() })
        .eq('coach_id', id);
    } catch (e: any) {
      console.warn(`[SupabaseDatabase] Notice unassigning coach ${id} from students: ${e.message}`);
    }

    // 2. Soft Deactivation in coaches table: Set Inactive & date_of_leaving
    const { error: coachError } = await supabase
      .from('coaches')
      .update({
        status: 'Inactive',
        date_of_leaving: today,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (coachError) {
      throw new Error(`Failed to deactivate coach: ${coachError.message}`);
    }

    // 3. Deactivate linked user account in users table
    try {
      const { data: coachRecord } = await supabase
        .from('coaches')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle();

      const targetUserId = coachRecord?.user_id || id;
      await supabase
        .from('users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId);
    } catch (e: any) {
      console.warn(`[SupabaseDatabase] Notice setting coach user inactive for ${id}: ${e.message}`);
    }

    return true;
  }

  async assignCoachToStudent(
    studentId: string,
    coachId: string | null
  ): Promise<(StudentProfile & { assignmentChanged: boolean }) | null> {
    const supabase = getSupabase();

    // 1. Student existence and status check
    const { data: studentRow, error: studentErr } = await supabase
      .from('students')
      .select('id, coach_id, status')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr) {
      throw new Error(`Failed to lookup student: ${studentErr.message}`);
    }
    if (!studentRow) {
      throw new Error('Student not found');
    }
    if (studentRow.status !== 'Active') {
      throw new Error('Cannot assign a coach to an inactive student.');
    }

    // 2. Coach existence and status check (when coachId is non-null)
    let coachName: string | null = null;
    if (coachId) {
      const coachData = await this.getCoachById(coachId);
      if (!coachData) {
        throw new Error('Coach not found');
      }
      if (coachData.status !== 'Active') {
        throw new Error('Cannot assign an inactive coach to a student.');
      }

      coachName = `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() || null;
    }

    // 3. Idempotency check
    const currentCoachId = studentRow.coach_id || null;
    const targetCoachId = coachId || null;
    const assignmentChanged = currentCoachId !== targetCoachId;

    // 4. Update student record
    const { data, error } = await supabase
      .from('students')
      .update({
        coach_id: targetCoachId,
        updated_at: new Date().toISOString()
      })
      .eq('id', studentId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to assign coach: ${error.message}`);
    }

    let user: any = null;
    if (data?.user_id) {
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user_id)
        .maybeSingle();
      user = uData;
    }

    if (!data) return null;

    const mapped = mapStudentRow(data, user, coachName);
    return {
      ...mapped,
      assignmentChanged
    };
  }

  // ================= ATTENDANCE =================
  async getAttendanceByMonth(
    yearMonth: string,
    options?: PaginationParams & { studentIds?: string[] }
  ): Promise<AttendanceRecord[]> {
    const supabase = getSupabase();
    if (options?.studentIds && options.studentIds.length === 0) {
      return [];
    }

    // In PostgreSQL, 'date' is of type DATE so ilike fails. Calculate month range:
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${yearMonth}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    let query = supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true });

    // Database-level scoping for coach assigned students
    if (options?.studentIds && options.studentIds.length > 0) {
      if (options.studentIds.length === 1) {
        query = query.eq('student_id', options.studentIds[0]);
      } else {
        query = query.in('student_id', options.studentIds);
      }
    }

    query = applyQueryPagination(query, options);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch attendance for ${yearMonth}: ${error.message}`);
    }
    return (data || []).map(mapAttendanceRow);
  }

  async getAttendanceByStudent(studentId: string, options?: PaginationParams): Promise<AttendanceRecord[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .order('date', { ascending: true });

    query = applyQueryPagination(query, options);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch attendance for student ${studentId}: ${error.message}`);
    }
    return (data || []).map(mapAttendanceRow);
  }

  async saveAttendanceBatch(records: AttendanceRecord[]): Promise<void> {
    if (!records || records.length === 0) return;
    const supabase = getSupabase();

    // Look up existing attendance counts for students missing classNumber
    const studentIdsNeedingCount = Array.from(
      new Set(records.filter(r => r.classNumber === undefined || r.classNumber === null || isNaN(Number(r.classNumber))).map(r => r.studentId))
    );

    const countMap = new Map<string, number>();
    for (const sid of studentIdsNeedingCount) {
      const { count } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', sid);
      countMap.set(sid, count || 0);
    }

    const rows = records.map(r => {
      let classNum = r.classNumber !== undefined && r.classNumber !== null ? Number(r.classNumber) : NaN;
      if (isNaN(classNum) || classNum <= 0) {
        const curr = countMap.get(r.studentId) || 0;
        classNum = curr + 1;
        countMap.set(r.studentId, classNum);
      }

      return {
        id: r.id || `att-${r.studentId}-${r.date}`,
        student_id: r.studentId,
        class_number: classNum,
        date: r.date,
        status: r.status || 'Present',
        coach_notes: r.coachNotes || null,
        marked_by: r.markedBy || null,
        created_at: new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save attendance batch: ${error.message}`);
    }
  }

  async deleteAttendance(id: string): Promise<void> {
    const supabase = getSupabase();
    if (!id || typeof id !== 'string') {
      throw new Error('[Data Integrity Error] deleteAttendance requires a valid record id.');
    }
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete attendance: ${error.message}`);
    }
  }

  // ================= FEES =================
  async getFeesByMonth(
    yearMonth: string,
    options?: PaginationParams & { studentIds?: string[] }
  ): Promise<FeeRecord[]> {
    const supabase = getSupabase();
    if (options?.studentIds && options.studentIds.length === 0) {
      return [];
    }

    let query = supabase
      .from('fees')
      .select('*')
      .or(`year_month.eq.${yearMonth},date.gte.${yearMonth}-01,paid_date.gte.${yearMonth}-01`);

    // Database-level scoping for coach assigned students
    if (options?.studentIds && options.studentIds.length > 0) {
      if (options.studentIds.length === 1) {
        query = query.eq('student_id', options.studentIds[0]);
      } else {
        query = query.in('student_id', options.studentIds);
      }
    }

    query = applyQueryPagination(query, options);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch fees for ${yearMonth}: ${error.message}`);
    }
    return (data || []).map(mapFeeRow);
  }

  async getFeesByStudent(studentId: string, options?: PaginationParams): Promise<FeeRecord[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('fees')
      .select('*')
      .eq('student_id', studentId)
      .order('paid_date', { ascending: false });

    query = applyQueryPagination(query, options);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch fees for student ${studentId}: ${error.message}`);
    }
    return (data || []).map(mapFeeRow);
  }

  async findFeeById(id: string): Promise<FeeRecord | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('fees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find fee record ${id}: ${error.message}`);
    }
    return data ? mapFeeRow(data) : null;
  }

  async saveFeeRecord(fee: Partial<FeeRecord>): Promise<FeeRecord> {
    const supabase = getSupabase();
    if (!fee.studentId) {
      throw new Error("Cannot save fee record without a valid studentId.");
    }
    if (fee.amount === undefined || fee.amount === null || isNaN(Number(fee.amount))) {
      throw new Error("Cannot save fee record without a valid numeric amount.");
    }

    const feeId = fee.id || `fee-${Date.now()}`;
    const effectiveDate = safeIsoDate(fee.date) || safeIsoDate(fee.paidDate) || safeIsoDate((fee as any).createdAt) || safeIsoDate(new Date());
    if (!effectiveDate) {
      throw new Error("Cannot save fee record without a valid date.");
    }

    const yearMonth = fee.yearMonth?.trim() || effectiveDate.substring(0, 7);
    if (!yearMonth) {
      throw new Error("Cannot save fee record without a valid year_month.");
    }

    const status = (fee.status === 'Paid' || fee.status === 'Pending' || fee.status === 'Overdue' || fee.status === 'Waived')
      ? fee.status
      : ((fee as any).isPaid ? 'Paid' : 'Pending');
    const isPaid = status === 'Paid';
    const paidDate = safeIsoDate(fee.paidDate) || (isPaid ? effectiveDate : null);

    const row: any = {
      id: feeId,
      student_id: fee.studentId,
      date: effectiveDate,
      year_month: yearMonth,
      milestone: fee.milestone || fee.period || null,
      status,
      paid_date: paidDate,
      amount: Number(fee.amount),
      payment_method: fee.paymentMethod || null,
      notes: fee.notes || null,
      created_at: (fee as any).createdAt || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('fees')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save fee record: ${error.message}`);
    }

    return mapFeeRow(data);
  }

  async updateFeeRecord(id: string, updates: Partial<FeeRecord>): Promise<FeeRecord | null> {
    const supabase = getSupabase();
    const updateData: any = {};

    if (updates.date !== undefined) {
      const validDate = safeIsoDate(updates.date);
      if (validDate) {
        updateData.date = validDate;
        if (!updates.yearMonth) {
          updateData.year_month = validDate.substring(0, 7);
        }
      }
    }
    if (updates.yearMonth !== undefined && updates.yearMonth.trim()) {
      updateData.year_month = updates.yearMonth.trim();
    }
    if (updates.milestone !== undefined) updateData.milestone = updates.milestone;
    if (updates.paidDate !== undefined) {
      updateData.paid_date = safeIsoDate(updates.paidDate) || null;
    }
    if ((updates as any).isPaid !== undefined && updates.status === undefined) {
      updateData.status = (updates as any).isPaid ? 'Paid' : 'Pending';
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status === 'Paid' && !updates.paidDate) {
        updateData.paid_date = new Date().toISOString().split('T')[0];
      } else if (updates.status !== 'Paid' && updates.paidDate === undefined) {
        updateData.paid_date = null;
      }
    }
    if (updates.amount !== undefined && updates.amount !== null && !isNaN(Number(updates.amount))) {
      updateData.amount = Number(updates.amount);
    }
    if (updates.receiptNumber !== undefined || (updates as any).receiptNo !== undefined) {
      throw new Error("receipt_number is immutable and cannot be updated.");
    }
    if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await supabase
      .from('fees')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update fee record ${id}: ${error.message}`);
    }

    return data ? mapFeeRow(data) : null;
  }

  async deleteFeeRecord(id: string): Promise<boolean> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('fees')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete fee record ${id}: ${error.message}`);
    }
    return true;
  }

  // ================= PROGRESS TRACKERS & DYNAMIC REPORTS =================
  async getProgressTrackersByStudent(studentId: string): Promise<ProgressTracker[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('progress_trackers')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`[SupabaseDatabase] Error fetching progress trackers for student ${studentId}: ${error.message}`);
      throw new Error(`Failed to fetch progress trackers: ${error.message}`);
    }
    return (data || []).map(mapProgressTrackerRow);
  }

  async saveProgressTracker(tracker: Partial<ProgressTracker>): Promise<ProgressTracker> {
    const supabase = getSupabase();
    const id = tracker.id || `pt-${Date.now()}`;
    const row = {
      id,
      student_id: tracker.studentId,
      evaluation_title: tracker.evaluationTitle || tracker.milestoneTitle || 'Milestone Review',
      evaluation_date: tracker.evaluationDate || new Date().toISOString().split('T')[0],
      overall_remark: tracker.overallRemark || tracker.teacherFeedback || null,
      teacher_feedback: tracker.teacherFeedback || tracker.overallRemark || null,
      next_steps: Array.isArray(tracker.nextSteps) ? tracker.nextSteps.join('; ') : (tracker.nextSteps || null),
      overall_stars: tracker.overallStars !== undefined && tracker.overallStars !== null ? Number(tracker.overallStars) : 5,
      formation_stars: tracker.formationStars !== undefined && tracker.formationStars !== null ? Number(tracker.formationStars) : null,
      spacing_stars: tracker.spacingStars !== undefined && tracker.spacingStars !== null ? Number(tracker.spacingStars) : null,
      alignment_stars: tracker.alignmentStars !== undefined && tracker.alignmentStars !== null ? Number(tracker.alignmentStars) : null,
      speed_stars: tracker.speedStars !== undefined && tracker.speedStars !== null ? Number(tracker.speedStars) : null,
      grip_posture_stars: tracker.gripPostureStars !== undefined && tracker.gripPostureStars !== null ? Number(tracker.gripPostureStars) : null,
      target_score: tracker.targetScore !== undefined && tracker.targetScore !== null ? Number(tracker.targetScore) : null,
      current_score: tracker.currentScore !== undefined && tracker.currentScore !== null ? Number(tracker.currentScore) : null,
      speed_wpm: tracker.speedWpm !== undefined && tracker.speedWpm !== null ? Number(tracker.speedWpm) : null,
      baseline_speed_wpm: tracker.baselineSpeedWpm !== undefined && tracker.baselineSpeedWpm !== null ? Number(tracker.baselineSpeedWpm) : null,
      pressure_level: tracker.pressureLevel || null,
      before_image_url: tracker.beforePhotoData || tracker.beforeImageUrl || null,
      after_image_url: tracker.afterPhotoData || tracker.afterImageUrl || null,
      skills: (tracker.skills as any) || [],
      is_unlocked: tracker.isUnlocked !== undefined ? Boolean(tracker.isUnlocked) : true,
      created_at: tracker.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('progress_trackers')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save progress tracker: ${error.message}`);
    }

    return mapProgressTrackerRow(data);
  }

  async deleteProgressTracker(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('progress_trackers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete progress tracker: ${error.message}`);
    }
  }

  // ================= STUDENT WORKS & PORTFOLIO =================
  async getStudentWorks(studentId: string): Promise<StudentWorkImage[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('student_works')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch student works: ${error.message}`);
    }
    return (data || []).map(mapStudentWorkRow);
  }

  async saveStudentWork(work: Partial<StudentWorkImage>): Promise<StudentWorkImage> {
    const supabase = getSupabase();
    const id = work.id || `work-${Date.now()}`;
    const captureDate = work.captureDate || new Date().toISOString().split('T')[0];
    const category = work.category || 'Practice Sheet';
    const defaultTitle = `${category} - ${captureDate}`;
    const title = (work.comments && work.comments.trim().length > 0) ? work.comments.trim() : defaultTitle;

    const row = {
      id,
      student_id: work.studentId,
      title,
      work_type: category,
      file_url: work.imageData || '',
      submitted_date: captureDate,
      status: (work as any).status || 'Completed',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('student_works')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save student work: ${error.message}`);
    }

    return mapStudentWorkRow(data);
  }

  async findStudentWorkById(id: string): Promise<StudentWorkImage | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('student_works')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find student work ${id}: ${error.message}`);
    }
    return data ? mapStudentWorkRow(data) : null;
  }

  async deleteStudentWork(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('student_works')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete student work: ${error.message}`);
    }
  }

  // ================= DYNAMIC PROGRESS REPORTS (GENERATED ON-DEMAND FROM PROGRESS TRACKERS) =================
  async getProgressReports(studentId: string): Promise<ProgressReport[]> {
    const supabase = getSupabase();

    // 1. Fetch all progress tracker records for student
    const { data: trackerRows, error: trackerError } = await supabase
      .from('progress_trackers')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (trackerError) {
      console.warn(`[SupabaseDatabase] Warning fetching trackers for reports: ${trackerError.message}`);
      return [];
    }

    // 2. Fetch live student record for real-time class counts and profile info
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    return (trackerRows || []).map((row: any) => buildProgressReportFromTrackerRow(row, studentData));
  }

  async saveProgressReport(report: Partial<ProgressReport>): Promise<ProgressReport> {
    const supabase = getSupabase();
    const id = report.id || `pt-rep-${Date.now()}`;

    // Extract skill star ratings from skills array if provided
    let formationStars: number | null = null;
    let spacingStars: number | null = null;
    let alignmentStars: number | null = null;
    let gripPostureStars: number | null = null;

    if (report.skills && Array.isArray(report.skills)) {
      const fSkill = report.skills.find(s => s.skillKey === 'letterFormation');
      if (fSkill) formationStars = fSkill.afterStars;
      const sSkill = report.skills.find(s => s.skillKey === 'letterSizeSpacing' || s.skillKey === 'spacingControl');
      if (sSkill) spacingStars = sSkill.afterStars;
      const aSkill = report.skills.find(s => s.skillKey === 'lineAlignment');
      if (aSkill) alignmentStars = aSkill.afterStars;
      const gSkill = report.skills.find(s => s.skillKey === 'pencilControl' || s.skillKey === 'pencilGrip');
      if (gSkill) gripPostureStars = gSkill.afterStars;
    }

    const row = {
      id,
      student_id: report.studentId,
      evaluation_title: report.milestoneTitle || report.reportTitle || 'After 10 Classes',
      evaluation_date: report.reportDate || new Date().toISOString().split('T')[0],
      overall_remark: report.overallRemark || report.teacherFeedback || null,
      teacher_feedback: report.teacherFeedback || report.overallRemark || null,
      next_steps: Array.isArray(report.nextSteps) ? report.nextSteps.join('; ') : (report.nextSteps || null),
      overall_stars: report.overallStars !== undefined && report.overallStars !== null ? Number(report.overallStars) : 5,
      formation_stars: formationStars,
      spacing_stars: spacingStars,
      alignment_stars: alignmentStars,
      grip_posture_stars: gripPostureStars,
      before_image_url: report.beforePhotoData || null,
      after_image_url: report.afterPhotoData || null,
      skills: (report.skills as any) || [],
      is_unlocked: true,
      created_at: report.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('progress_trackers')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save progress report evaluation: ${error.message}`);
    }

    // Fetch student info for complete dynamic report presentation
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('id', report.studentId)
      .maybeSingle();

    return buildProgressReportFromTrackerRow(data, studentData);
  }

  async findProgressReportById(id: string): Promise<ProgressReport | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('progress_trackers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('id', data.student_id)
      .maybeSingle();

    return buildProgressReportFromTrackerRow(data, studentData);
  }

  async deleteProgressReport(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('progress_trackers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete progress report: ${error.message}`);
    }
  }

  // ================= FEE REMINDERS =================
  async saveFeeReminder(reminder: Partial<FeeReminder>): Promise<FeeReminder> {
    const supabase = getSupabase();
    const id = reminder.id || `rem-${Date.now()}`;
    const row = {
      id,
      student_id: reminder.studentId,
      parent_name: reminder.parentName || null,
      parent_phone: (reminder as any).parentPhone || null,
      parent_email: reminder.parentEmail || null,
      amount_due: reminder.amount !== undefined && reminder.amount !== null ? Number(reminder.amount) : null,
      due_date: reminder.month || null,
      status: reminder.status || null,
      sent_at: reminder.sentDate || (reminder as any).sentAt || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('fee_reminders')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save fee reminder: ${error.message}`);
    }

    return mapFeeReminderRow(data);
  }

  // ================= FREE DEMO CLASS BOOKINGS =================
  async getDemoBookings(): Promise<DemoBooking[]> {
    const supabase = getSupabase();
    const { data, error } = await applyRowCeiling(
      supabase
        .from('demo_bookings')
        .select('*')
        .order('created_at', { ascending: false })
    );

    if (error) {
      throw new Error(`Failed to fetch demo bookings: ${error.message}`);
    }
    return (data || []).map(mapDemoBookingRow);
  }

  async createDemoBooking(booking: any): Promise<{ booking: DemoBooking; alert: AdminAlert }> {
    const supabase = getSupabase();

    // Strict requirement validation without silent fallbacks
    const childName = booking.studentName?.trim();
    const parentName = booking.parentName?.trim();
    const contactNumber = booking.contactNumber?.trim();
    const ageStr = String(booking.age || '').replace(/\D/g, '');
    const preferredDate = booking.preferredDate?.trim();
    const preferredTimeSlot = booking.preferredTimeSlot?.trim();

    if (!childName) throw new Error("Student name is required for demo booking.");
    if (!parentName) throw new Error("Parent name is required for demo booking.");
    if (!contactNumber) throw new Error("Contact number is required for demo booking.");
    if (!ageStr) throw new Error("Valid child age is required for demo booking.");
    if (!preferredDate) throw new Error("Preferred date is required for demo booking.");
    if (!preferredTimeSlot) throw new Error("Preferred time slot is required for demo booking.");

    const id = `demo-${Date.now()}`;
    const ageNum = parseInt(ageStr, 10);

    const row: any = {
      id,
      student_name: childName,
      student_age: ageNum,
      parent_name: parentName,
      parent_phone: contactNumber,
      preferred_date: preferredDate,
      preferred_time_slot: preferredTimeSlot,
      mode_of_learning: booking.modeOfLearning === 'Online' ? 'Online' : 'In-person',
      status: booking.status || 'Scheduled',
      parent_notes: booking.notes?.trim() || null,
      coach_notes: booking.notes?.trim() || null,
      created_at: new Date().toISOString()
    };

    const { data: bookingData, error: bookingError } = await supabase
      .from('demo_bookings')
      .insert(row)
      .select()
      .single();

    if (bookingError) {
      throw new Error(`Failed to create demo booking: ${bookingError.message}`);
    }

    // Create system alert for admin
    const alertId = `alert-${Date.now()}`;
    const alertRow = {
      id: alertId,
      title: `New Demo Booking: ${childName}`,
      message: `Parent: ${parentName}, Phone: ${contactNumber}, Age: ${ageStr}, Mode: ${booking.modeOfLearning || 'In-person'}, Date: ${preferredDate}, Time: ${preferredTimeSlot}`,
      alert_type: 'demo_booking',
      target_audience: 'admin',
      is_read: false,
      created_at: new Date().toISOString()
    };

    const { data: alertData, error: alertError } = await supabase
      .from('alerts')
      .insert(alertRow)
      .select()
      .single();

    if (alertError) {
      console.warn(`[SupabaseDatabase] Warning creating alert for demo booking: ${alertError.message}`);
    }

    return {
      booking: mapDemoBookingRow(bookingData),
      alert: alertData ? mapAlertRow(alertData) : {
        id: alertId,
        title: alertRow.title,
        message: alertRow.message,
        type: 'demo_booking',
        isRead: false,
        createdAt: alertRow.created_at
      }
    };
  }

  async updateDemoBooking(id: string, updates: Partial<DemoBooking>): Promise<DemoBooking | null> {
    const supabase = getSupabase();
    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.studentName !== undefined) updateData.student_name = updates.studentName;
    if (updates.notes !== undefined) {
      updateData.coach_notes = updates.notes;
      updateData.parent_notes = updates.notes;
    }
    if (updates.preferredDate !== undefined) updateData.preferred_date = updates.preferredDate;
    if (updates.preferredTimeSlot !== undefined) updateData.preferred_time_slot = updates.preferredTimeSlot;
    if (updates.modeOfLearning !== undefined) updateData.mode_of_learning = updates.modeOfLearning;

    const { data, error } = await supabase
      .from('demo_bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update demo booking ${id}: ${error.message}`);
    }

    return data ? mapDemoBookingRow(data) : null;
  }

  async deleteDemoBooking(id: string): Promise<void> {
    const supabase = getSupabase();
    // Attempt to delete any associated demo alert
    try {
      await supabase.from('alerts').delete().ilike('action_url', `%${id}%`);
    } catch {
      // ignore if not found
    }

    const { error } = await supabase
      .from('demo_bookings')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete demo booking: ${error.message}`);
    }
  }

  // ================= ADMIN ALERTS =================
  async getAlerts(): Promise<AdminAlert[]> {
    const supabase = getSupabase();
    const { data, error } = await applyRowCeiling(
      supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
    );

    if (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`);
    }
    return (data || []).map(mapAlertRow);
  }

  async markAlertAsRead(id: string): Promise<AdminAlert | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark alert read: ${error.message}`);
    }
    return data ? mapAlertRow(data) : null;
  }

  async markAllAlertsAsRead(): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to mark all alerts read: ${error.message}`);
    }
  }

  async deleteAlert(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete alert: ${error.message}`);
    }
  }

  // ================= TESTIMONIALS =================
  async getTestimonials(studentId?: string, status?: string): Promise<Testimonial[]> {
    const supabase = getSupabase();
    let query = supabase.from('testimonials').select('*');

    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await applyRowCeiling(
      query.order('created_at', { ascending: false })
    );
    if (error) {
      throw new Error(`Failed to fetch testimonials: ${error.message}`);
    }
    return (data || []).map(mapTestimonialRow);
  }

  async saveTestimonial(testimonial: Partial<Testimonial>): Promise<Testimonial> {
    const supabase = getSupabase();
    const id = testimonial.id || `test-${Date.now()}`;
    const row = {
      id,
      student_id: testimonial.studentId || null,
      student_name: testimonial.studentName || null,
      parent_name: testimonial.parentName || null,
      grade: testimonial.grade || null,
      rating: testimonial.rating !== undefined && testimonial.rating !== null ? Number(testimonial.rating) : null,
      review: testimonial.review || null,
      title: testimonial.title || null,
      handwriting_style: (testimonial as any).handwritingStyle || null,
      status: testimonial.status || null,
      is_featured: testimonial.status === 'Featured' ? true : (testimonial.status === 'Approved' ? false : null),
      image: testimonial.image || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('testimonials')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save testimonial: ${error.message}`);
    }

    return mapTestimonialRow(data);
  }

  async updateTestimonial(id: string, updates: Partial<Testimonial>): Promise<Testimonial | null> {
    const supabase = getSupabase();
    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.review !== undefined) {
      updateData.review = updates.review;
    }
    if (updates.rating !== undefined) updateData.rating = Number(updates.rating);
    if (updates.title !== undefined) updateData.title = updates.title;

    const { data, error } = await supabase
      .from('testimonials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update testimonial ${id}: ${error.message}`);
    }

    return data ? mapTestimonialRow(data) : null;
  }

  async deleteTestimonial(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete testimonial: ${error.message}`);
    }
  }

  // ================= TOOL AUDIT LOGS =================
  async recordToolAuditLog(log: any): Promise<ToolAuditLog> {
    const supabase = getSupabase();
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Format actor: always logged in userId or 'anonymous'
    const rawUserId = log.userId || log.actorId;
    const userId = (!rawUserId || rawUserId === 'system') ? 'anonymous' : rawUserId;

    const row: any = {
      id,
      user_id: userId,
      user_role: log.actorRole || log.userRole || 'student',
      actor_student_id: log.actorStudentId || null,
      execution_mode: log.executionMode || 'remote_gemini',
      tool_name: log.toolName || log.action || 'system_action',
      action_summary: log.actionSummary || log.summary || '',
      arguments: log.arguments || {},
      input_payload: log.arguments || {},
      result: log.result || {},
      output_result: log.result || {},
      status: log.status || (log.success !== false ? 'success' : 'failed'),
      created_at: new Date().toISOString()
    };
    if (log.actorUsername) {
      row.actor_username = log.actorUsername;
    }

    let { data, error } = await supabase
      .from('tool_audit_logs')
      .insert(row)
      .select()
      .single();

    // If actor_username column is not yet present on tool_audit_logs (prior to migration 006 execution), retry without actor_username
    if (error && error.message && error.message.includes('actor_username')) {
      console.warn('[SupabaseDatabase] Warning: public.tool_audit_logs.actor_username column missing in database; falling back to schema-compatible row without actor_username. Run migration 006 to enable actor_username recording.');
      const fallbackRow = { ...row };
      delete fallbackRow.actor_username;
      const retryResult = await supabase
        .from('tool_audit_logs')
        .insert(fallbackRow)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error(`[SupabaseDatabase] Fatal error recording tool audit log: ${error.message}`);
      throw new Error(`Failed to record tool audit log: ${error.message}`);
    }

    return mapToolAuditLogRow(data);
  }

  async getToolAuditLogs(options?: { page?: number; limit?: number } | number): Promise<ToolAuditLog[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('tool_audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeof options === 'object' && options !== null && options.page && options.limit) {
      query = applyOffsetPagination(query, options.page, options.limit);
    } else {
      const limit = typeof options === 'number' ? options : (options?.limit || 50);
      query = applyOffsetPagination(query, 1, limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }
    return (data || []).map(mapToolAuditLogRow);
  }

  async getAttendanceCountByMonth(yearMonth: string, studentIds?: string[]): Promise<number> {
    if (studentIds && studentIds.length === 0) return 0;
    const supabase = getSupabase();
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${yearMonth}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    let query = supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('date', startDate)
      .lt('date', endDate);

    if (studentIds && studentIds.length > 0) {
      if (studentIds.length === 1) {
        query = query.eq('student_id', studentIds[0]);
      } else {
        query = query.in('student_id', studentIds);
      }
    }

    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  }

  async getAttendanceCountByStudent(studentId: string): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);
    if (error) return 0;
    return count || 0;
  }

  async getFeesCountByMonth(yearMonth: string, studentIds?: string[]): Promise<number> {
    if (studentIds && studentIds.length === 0) return 0;
    const supabase = getSupabase();
    let query = supabase
      .from('fees')
      .select('*', { count: 'exact', head: true })
      .or(`year_month.eq.${yearMonth},date.gte.${yearMonth}-01,paid_date.gte.${yearMonth}-01`);

    if (studentIds && studentIds.length > 0) {
      if (studentIds.length === 1) {
        query = query.eq('student_id', studentIds[0]);
      } else {
        query = query.in('student_id', studentIds);
      }
    }

    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  }

  async getFeesCountByStudent(studentId: string): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('fees')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);
    if (error) return 0;
    return count || 0;
  }

  async getToolAuditLogsCount(): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('tool_audit_logs')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }

  // ================= RATE LIMITING (SUPABASE-BACKED ATOMIC RPC) =================
  async checkRateLimit(
    key: string,
    maxCalls: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    const supabase = getSupabase();

    // 1. Primary path: Invoke atomic SECURITY DEFINER Postgres function
    try {
      const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
        p_key: key,
        p_max_calls: maxCalls,
        p_window_seconds: windowSeconds,
      });

      if (!error && data) {
        const rpcRes = data as any;
        return {
          allowed: Boolean(rpcRes?.allowed),
          retryAfter: Number(rpcRes?.retry_after || 0),
        };
      }

      if (error) {
        console.warn(`[SupabaseDatabase] RPC check_and_increment_rate_limit notice: ${error.message}`);
      }
    } catch (rpcErr: any) {
      console.warn(`[SupabaseDatabase] RPC check_and_increment_rate_limit exception: ${rpcErr.message}`);
    }

    // 2. Direct table fallback against public.rate_limits
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();

      const { data: existing, error: selectErr } = await supabase
        .from('rate_limits')
        .select('key, count, reset_at')
        .eq('key', key)
        .maybeSingle();

      if (!selectErr && existing) {
        const isExpired = new Date(existing.reset_at) < now;
        if (isExpired) {
          await supabase
            .from('rate_limits')
            .update({ count: 1, reset_at: resetAt })
            .eq('key', key);
          return { allowed: true, retryAfter: 0 };
        }

        if (existing.count >= maxCalls) {
          const retryAfter = Math.max(1, Math.ceil((new Date(existing.reset_at).getTime() - now.getTime()) / 1000));
          return { allowed: false, retryAfter };
        }

        await supabase
          .from('rate_limits')
          .update({ count: existing.count + 1 })
          .eq('key', key);
        return { allowed: true, retryAfter: 0 };
      }

      // No record yet or initial insert
      await supabase
        .from('rate_limits')
        .upsert({
          key,
          count: 1,
          reset_at: resetAt,
          created_at: nowIso,
        }, { onConflict: 'key' });

      return { allowed: true, retryAfter: 0 };
    } catch (tableErr: any) {
      console.warn(`[SupabaseDatabase] Direct rate_limits table fallback notice: ${tableErr.message}`);
      return { allowed: true, retryAfter: 0 };
    }
  }

  // Lightweight token-version check used by authenticateJwt to invalidate tokens after password change.
  // Only fetches id + token_version — never returns sensitive fields.
  async findUserTokenVersion(userId: string): Promise<number | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, token_version')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as any).token_version ?? null;
  }

}

export const db = new SupabaseDatabase();
