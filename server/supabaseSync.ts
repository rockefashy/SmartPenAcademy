import { serverSupabase, isServerSupabaseConfigured } from './supabase.ts';
import { 
  StudentProfile, 
  AttendanceRecord, 
  FeeRecord, 
  ProgressTracker, 
  StudentWorkImage, 
  ProgressReport, 
  FeeReminder,
  User,
  DemoBooking,
  AdminAlert,
  Testimonial,
  ToolAuditLog
} from '../src/types';

// ================= SYNC DEMO BOOKINGS =================
export async function syncDemoBookingToSupabase(booking: DemoBooking) {
  if (!serverSupabase) return;
  try {
    let prefDate = booking.preferredSlot || new Date().toISOString().split('T')[0];
    let prefTime = '04:00 PM';
    if (booking.preferredSlot && booking.preferredSlot.includes(' at ')) {
      const parts = booking.preferredSlot.split(' at ');
      prefDate = parts[0].trim();
      prefTime = parts[1].trim();
    }

    const ageNum = parseInt(String(booking.age).replace(/\D/g, ''), 10) || 5;

    // Check status constraint for Supabase PostgreSQL: 'Confirmed' | 'Scheduled' | 'Completed' | 'Cancelled'
    let status = 'Confirmed';
    if ((booking.status as string) === 'Scheduled' || (booking.status as string) === 'Completed' || (booking.status as string) === 'Cancelled') {
      status = booking.status;
    }

    const cleanPhone = booking.contactNumber ? booking.contactNumber.trim() : '9876543210';
    const emailPrefix = cleanPhone.replace(/\D/g, '') || 'booking';

    const row = {
      id: booking.id,
      child_name: booking.studentName || 'Student',
      child_age: ageNum,
      parent_name: booking.notes?.includes('Parent:') ? booking.notes : `Parent of ${booking.studentName || 'Student'}`,
      parent_phone: cleanPhone,
      parent_email: `${emailPrefix}@smartpen.in`,
      preferred_date: prefDate,
      preferred_time_slot: prefTime,
      status: status,
      coach_notes: booking.notes || '',
      created_at: booking.createdAt || new Date().toISOString()
    };

    const { error } = await serverSupabase
      .from('demo_bookings')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase Sync] demo_bookings upsert notice:', error.message);
    } else {
      console.log(`[Supabase Sync] Successfully persisted demo booking "${booking.studentName}" (${booking.id}) in Supabase PostgreSQL.`);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] demo_bookings sync exception:', err.message);
  }
}

export async function deleteDemoBookingFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('demo_bookings').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete demo_booking exception:', err.message);
  }
}

// ================= SYNC ALERTS =================
export async function syncAlertToSupabase(alert: AdminAlert) {
  if (!serverSupabase) return;
  try {
    let alertType = 'info';
    const rawType = alert.type as string;
    if (rawType === 'fee_due' || rawType === 'warning') {
      alertType = 'warning';
    } else if (rawType === 'success') {
      alertType = 'success';
    } else {
      alertType = 'info';
    }

    const row = {
      id: alert.id,
      title: alert.title,
      message: alert.message,
      student_id: alert.studentId || null,
      alert_type: alertType,
      target_audience: 'all',
      is_read: Boolean(alert.isRead),
      created_at: alert.createdAt || new Date().toISOString(),
    };
    const { error } = await serverSupabase
      .from('alerts')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] alerts upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] alerts sync exception:', err.message);
  }
}

export async function deleteAlertFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('alerts').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete alert exception:', err.message);
  }
}

// ================= SYNC STUDENTS =================
export async function syncStudentToSupabase(student: StudentProfile) {
  if (!serverSupabase) return;
  try {
    const ageNum = student.dateOfBirth 
      ? Math.max(4, new Date().getFullYear() - new Date(student.dateOfBirth).getFullYear())
      : 8;

    const row = {
      id: student.id,
      student_id: student.id,
      name: student.fullName,
      age: ageNum,
      grade: student.gradeClass || 'Grade 3',
      parent_name: student.parentName,
      parent_email: student.email || `${student.id}@smartpen.in`,
      parent_phone: student.whatsappMobile || '9876543210',
      enrollment_date: student.enrollmentDate || new Date().toISOString().split('T')[0],
      status: student.status || 'Active',
      total_classes: 16,
      notes: student.coachRemarks || student.diagnosticObservations?.join(', ') || '',
      created_at: student.createdAt || new Date().toISOString(),
      updated_at: student.updatedAt || new Date().toISOString()
    };
    const { error } = await serverSupabase
      .from('students')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] students upsert notice:', error.message);
    } else {
      console.log(`[Supabase Sync] Synced student profile "${student.fullName}" (${student.id}) to Supabase`);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] students sync exception:', err.message);
  }
}

export async function deleteStudentFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('students').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete student exception:', err.message);
  }
}

// ================= SYNC USERS =================
export async function syncUserToSupabase(user: User) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      student_id: user.studentId || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const { error } = await serverSupabase
      .from('users')
      .upsert(row, { onConflict: 'email' });
    if (error) {
      console.warn('[Supabase Sync] users upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] users sync exception:', err.message);
  }
}

// ================= SYNC ATTENDANCE =================
export async function syncAttendanceToSupabase(att: AttendanceRecord) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: att.id,
      student_id: att.studentId,
      class_number: 1,
      date: att.date,
      status: att.status || 'Present',
      coach_notes: att.notes || null,
      marked_by: 'Mrs. Deepthy Rock',
      created_at: new Date().toISOString()
    };
    const { error } = await serverSupabase
      .from('attendance')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] attendance upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] attendance sync exception:', err.message);
  }
}

export async function deleteAttendanceFromSupabase(studentId: string, date: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('attendance').delete().eq('student_id', studentId).eq('date', date);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete attendance exception:', err.message);
  }
}

// ================= SYNC FEES =================
export async function syncFeeToSupabase(fee: FeeRecord) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: fee.id,
      student_id: fee.studentId,
      date: fee.date || fee.paidDate || new Date().toISOString().split('T')[0],
      year_month: fee.yearMonth || fee.milestone || 'Current',
      status: fee.status || (fee.isPaid ? 'Paid' : 'Pending'),
      paid_date: fee.paidDate || (fee.isPaid ? (fee.date || new Date().toISOString().split('T')[0]) : null),
      amount: fee.amount || 1600,
      receipt_number: fee.receiptNumber || fee.receiptNo || (fee.isPaid ? `REC-${Date.now().toString().slice(-6)}` : null),
      payment_method: fee.paymentMethod || 'In-Person Reception - Cash',
      notes: fee.notes || '',
      created_at: fee.createdAt || new Date().toISOString()
    };
    const { error } = await serverSupabase
      .from('fees')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] fees upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] fees sync exception:', err.message);
  }
}

export async function deleteFeeFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('fees').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete fee exception:', err.message);
  }
}

// ================= SYNC PROGRESS TRACKERS =================
export async function syncProgressTrackerToSupabase(prog: ProgressTracker) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: prog.id,
      student_id: prog.studentId,
      milestone_name: prog.evaluationTitle || 'Class Progress Milestone',
      coach_remarks: prog.overallRemark || prog.teacherFeedback || 'Consistent progress',
      target_score: 100,
      current_score: (prog.overallStars || 5) * 20,
      is_unlocked: true,
      created_at: prog.createdAt || new Date().toISOString()
    };
    const { error } = await serverSupabase
      .from('progress_trackers')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] progress_trackers upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] progress_trackers sync exception:', err.message);
  }
}

export async function deleteProgressTrackerFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('progress_trackers').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete progress_tracker exception:', err.message);
  }
}

// ================= SYNC STUDENT WORKS =================
export async function syncStudentWorkToSupabase(work: StudentWorkImage) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: work.id,
      student_id: work.studentId,
      title: (work as any).title || 'Practice Work',
      file_url: work.imageData || '/student_works/sample.jpg',
      status: 'Reviewed',
      created_at: work.createdAt || new Date().toISOString()
    };
    const { error } = await serverSupabase
      .from('student_works')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] student_works upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] student_works sync exception:', err.message);
  }
}

export async function deleteStudentWorkFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('student_works').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete student_work exception:', err.message);
  }
}

// ================= SYNC PROGRESS REPORTS =================
export async function syncProgressReportToSupabase(report: ProgressReport) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: report.id,
      student_id: report.studentId,
      report_date: report.reportDate,
      report_title: report.reportTitle,
      milestone_title: report.milestoneTitle,
      completed_classes: report.completedClasses,
      total_classes: report.totalClasses,
      skills: report.skills || [],
      overall_stars: report.overallStars,
      overall_remark: report.overallRemark || '',
      teacher_feedback: report.teacherFeedback || '',
      next_steps: report.nextSteps || [],
      before_photo_id: report.beforePhotoId || null,
      before_photo_data: report.beforePhotoData || null,
      after_photo_id: report.afterPhotoId || null,
      after_photo_data: report.afterPhotoData || null,
      comments: report.comments || '',
      saved_to_folder: report.savedToFolder || '/progress_reports/',
      created_at: report.createdAt || new Date().toISOString(),
      emailed_to_parent_at: report.emailedToParentAt || null
    };
    const { error } = await serverSupabase
      .from('progress_reports')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] progress_reports upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] progress_reports sync exception:', err.message);
  }
}

export async function deleteProgressReportFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('progress_reports').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete progress_report exception:', err.message);
  }
}

// ================= SYNC TESTIMONIALS =================
export async function syncTestimonialToSupabase(testimony: Testimonial) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: testimony.id,
      student_name: testimony.studentName || 'Student',
      parent_name: testimony.parentName || 'Parent',
      student_grade: testimony.grade || '',
      rating: testimony.rating || 5,
      review_text: testimony.review || testimony.title || 'Exceptional progress and results!',
      handwriting_style: 'Cursive',
      is_featured: testimony.status === 'Featured' || testimony.rating >= 4,
      created_at: testimony.createdAt || new Date().toISOString()
    };
    const { error } = await serverSupabase
      .from('testimonials')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] testimonials upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] testimonials sync exception:', err.message);
  }
}

export async function deleteTestimonialFromSupabase(id: string) {
  if (!serverSupabase) return;
  try {
    await serverSupabase.from('testimonials').delete().eq('id', id);
  } catch (err: any) {
    console.warn('[Supabase Sync] delete testimonial exception:', err.message);
  }
}

// ================= SYNC FEE REMINDERS =================
export async function syncFeeReminderToSupabase(rem: FeeReminder) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: rem.id,
      student_id: rem.studentId,
      parent_name: rem.parentName,
      parent_phone: '9876543210',
      parent_email: rem.parentEmail || 'parent@smartpen.in',
      amount_due: rem.amount || 1600,
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: rem.status || 'Sent',
      sent_at: rem.sentDate || new Date().toISOString(),
    };
    const { error } = await serverSupabase
      .from('fee_reminders')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] fee_reminders upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] fee_reminders sync exception:', err.message);
  }
}

// ================= SYNC TOOL AUDIT LOGS =================
export async function syncAuditLogToSupabase(log: ToolAuditLog) {
  if (!serverSupabase) return;
  try {
    const row = {
      id: log.id,
      user_id: log.actorId,
      user_role: log.actorRole,
      tool_name: log.toolName,
      action_summary: log.summary,
      input_payload: log.arguments,
      output_result: log.result,
      status: log.success ? 'success' : 'failed',
      created_at: log.timestamp || new Date().toISOString()
    };
    const { error } = await serverSupabase
      .from('tool_audit_logs')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] tool_audit_logs upsert notice:', error.message);
    }
  } catch (err: any) {
    console.warn('[Supabase Sync] tool_audit_logs sync exception:', err.message);
  }
}

// ================= HYDRATE STATE FROM SUPABASE ON STARTUP =================
export async function loadStateFromSupabase(): Promise<{
  students: StudentProfile[];
  demoBookings: DemoBooking[];
  alerts: AdminAlert[];
  users: User[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  progressTrackers: ProgressTracker[];
  studentWorks: StudentWorkImage[];
  progressReports: ProgressReport[];
  testimonials: Testimonial[];
  feeReminders: FeeReminder[];
  toolAuditLogs: ToolAuditLog[];
} | null> {
  if (!isServerSupabaseConfigured || !serverSupabase) {
    return null;
  }

  try {
    console.log('[Supabase Load] Hydrating application state directly from Supabase tables...');

    // Fetch in parallel
    const [
      studentsRes,
      demoBookingsRes,
      alertsRes,
      usersRes,
      attendanceRes,
      feesRes,
      progressTrackersRes,
      studentWorksRes,
      progressReportsRes,
      testimonialsRes,
      feeRemindersRes,
      toolAuditLogsRes
    ] = await Promise.all([
      serverSupabase.from('students').select('*'),
      serverSupabase.from('demo_bookings').select('*'),
      serverSupabase.from('alerts').select('*'),
      serverSupabase.from('users').select('*'),
      serverSupabase.from('attendance').select('*'),
      serverSupabase.from('fees').select('*'),
      serverSupabase.from('progress_trackers').select('*'),
      serverSupabase.from('student_works').select('*'),
      serverSupabase.from('progress_reports').select('*'),
      serverSupabase.from('testimonials').select('*'),
      serverSupabase.from('fee_reminders').select('*'),
      serverSupabase.from('tool_audit_logs').select('*').limit(200)
    ]);

    const students: StudentProfile[] = (studentsRes.data || []).map((row: any) => ({
      id: row.id,
      fullName: row.name || row.full_name || '',
      dateOfBirth: row.date_of_birth || '',
      gender: row.gender || 'Other',
      gradeClass: row.grade || row.grade_class || 'Grade 3',
      dominantHand: row.dominant_hand || 'Right',
      schoolName: row.school_name || 'Vidyashilp Academy',
      instructionMedium: row.instruction_medium || 'English',
      parentName: row.parent_name || 'Parent',
      relationship: row.relationship || 'Parent',
      whatsappMobile: row.parent_phone || row.whatsapp_mobile || '',
      email: row.parent_email || row.email || '',
      residentialArea: row.residential_area || 'Yelahanka',
      scriptsRequired: row.scripts_required || ['Cursive'],
      academicModules: row.academic_modules || ['Handwriting Improvement'],
      diagnosticObservations: row.diagnostic_observations || (row.notes ? [row.notes] : []),
      preferredDays: row.preferred_days || row.batch_schedule || 'Mon, Wed, Fri',
      preferredSlot: row.preferred_slot || '04:00 PM',
      practiceCommitment: true,
      feePolicyAccepted: true,
      mediaConsent: true,
      gripClassification: row.grip_classification || 'Tripod',
      initialPressureLevel: row.initial_pressure_level || 'Optimal',
      baselineSpeedWpm: Number(row.baseline_speed_wpm) || 15,
      recommendedLevel: row.level_name || 'Level 1',
      coachRemarks: row.notes || '',
      username: row.username || `std_${(row.name || row.id).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      status: row.status || 'Active',
      enrollmentDate: row.enrollment_date || new Date().toISOString().split('T')[0],
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString()
    }));

    const demoBookings: DemoBooking[] = (demoBookingsRes.data || []).map((row: any) => ({
      id: row.id,
      studentName: row.child_name || row.student_name || 'Student',
      age: String(row.child_age || row.age || '5'),
      contactNumber: row.parent_phone || row.contact_number || '',
      preferredSlot: (row.preferred_date && row.preferred_time_slot)
        ? `${row.preferred_date} at ${row.preferred_time_slot}`
        : (row.preferred_slot || row.preferred_date || '2026-08-29 at 04:00 PM'),
      status: row.status || 'Confirmed',
      notes: row.coach_notes || row.notes || '',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString()
    }));

    const alerts: AdminAlert[] = (alertsRes.data || []).map((row: any) => ({
      id: row.id,
      type: row.alert_type || row.type || 'demo_booking',
      title: row.title || '',
      message: row.message || '',
      demoBookingId: row.demo_booking_id || undefined,
      studentId: row.student_id || undefined,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at || new Date().toISOString()
    }));

    const users: User[] = (usersRes.data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name || '',
      role: row.role || 'student',
      studentId: row.student_id || undefined,
      username: row.username || (row.email ? row.email.split('@')[0] : row.id)
    }));

    const attendance: AttendanceRecord[] = (attendanceRes.data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      date: row.date,
      yearMonth: row.date ? row.date.substring(0, 7) : '2026-08',
      status: row.status || 'Present',
      notes: row.coach_notes || row.notes || ''
    }));

    const fees: FeeRecord[] = (feesRes.data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      date: row.date || row.paid_date || new Date().toISOString().split('T')[0],
      yearMonth: row.year_month || 'Current',
      milestone: row.year_month || 'Cycle Fee',
      isPaid: row.status === 'Paid' || Boolean(row.is_paid),
      status: row.status || 'Paid',
      paidDate: row.paid_date || undefined,
      amount: Number(row.amount) || 1600,
      receiptNumber: row.receipt_number || row.receipt_no || undefined,
      receiptNo: row.receipt_number || row.receipt_no || undefined,
      paymentMethod: row.payment_method || 'In-Person Reception - Cash',
      notes: row.notes || '',
      createdAt: row.created_at || new Date().toISOString()
    }));

    const progressTrackers: ProgressTracker[] = (progressTrackersRes.data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      evaluationDate: row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      evaluationTitle: row.milestone_name || 'Milestone Evaluation',
      completedClasses: 1,
      totalClasses: 16,
      skills: [
        {
          skillKey: 'grip_posture',
          skillName: 'Grip & Posture',
          beforeStars: 2,
          afterStars: 5,
          progressNote: 'Tripod grip stabilized.'
        }
      ],
      overallStars: Math.round((Number(row.current_score) || 100) / 20) || 5,
      overallRemark: row.coach_remarks || '',
      teacherFeedback: row.coach_remarks || '',
      nextSteps: ['Stroke consistency'],
      comments: row.coach_remarks || '',
      createdAt: row.created_at || new Date().toISOString()
    }));

    const studentWorks: StudentWorkImage[] = (studentWorksRes.data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      imageData: row.file_url || row.image_data || '',
      captureDate: row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      category: 'Practice',
      comments: row.status || '',
      createdAt: row.created_at || new Date().toISOString()
    }));

    const progressReports: ProgressReport[] = (progressReportsRes.data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      reportDate: row.report_date,
      reportTitle: row.report_title,
      milestoneTitle: row.milestone_title,
      completedClasses: Number(row.completed_classes) || 0,
      totalClasses: Number(row.total_classes) || 16,
      skills: row.skills || [],
      overallStars: Number(row.overall_stars) || 5,
      overallRemark: row.overall_remark || '',
      teacherFeedback: row.teacher_feedback || '',
      nextSteps: row.next_steps || [],
      beforePhotoId: row.before_photo_id || undefined,
      beforePhotoData: row.before_photo_data || undefined,
      afterPhotoId: row.after_photo_id || undefined,
      afterPhotoData: row.after_photo_data || undefined,
      comments: row.comments || '',
      savedToFolder: row.saved_to_folder || '/progress_reports/',
      createdAt: row.created_at || new Date().toISOString(),
      emailedToParentAt: row.emailed_to_parent_at || undefined
    }));

    const testimonials: Testimonial[] = (testimonialsRes.data || []).map((row: any) => ({
      id: row.id,
      studentId: undefined,
      studentName: row.student_name || '',
      parentName: row.parent_name || 'Parent',
      grade: row.student_grade || '',
      schoolName: 'Vidyashilp Academy',
      relationship: 'Parent',
      rating: Number(row.rating) || 5,
      title: 'Transformation Review',
      review: row.review_text || '',
      beforeAfterTag: '5 Star Transformation',
      image: undefined,
      mediaConsent: true,
      status: row.is_featured ? 'Featured' : 'Approved',
      createdAt: row.created_at || new Date().toISOString()
    }));

    const feeReminders: FeeReminder[] = (feeRemindersRes.data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      parentName: row.parent_name || 'Parent',
      parentEmail: row.parent_email || '',
      studentName: 'Student',
      amount: Number(row.amount_due) || 1600,
      month: 'Current',
      gpayLink: '',
      status: row.status || 'Sent',
      sentDate: row.sent_at || row.created_at || new Date().toISOString()
    }));

    const toolAuditLogs: ToolAuditLog[] = (toolAuditLogsRes.data || []).map((row: any) => ({
      id: row.id,
      actorId: row.user_id || 'system',
      actorUsername: row.actor_username || 'admin',
      actorRole: (row.user_role || 'admin') as any,
      actorStudentId: row.actor_student_id || undefined,
      toolName: row.tool_name || '',
      summary: row.action_summary || '',
      arguments: row.input_payload || {},
      result: row.output_result || {},
      success: row.status === 'success',
      executionMode: (row.execution_mode || 'local_agent') as any,
      timestamp: row.created_at || new Date().toISOString()
    }));

    console.log(`[Supabase Load] State successfully hydrated: ${students.length} students, ${demoBookings.length} demo bookings, ${alerts.length} alerts.`);

    return {
      students,
      demoBookings,
      alerts,
      users,
      attendance,
      fees,
      progressTrackers,
      studentWorks,
      progressReports,
      testimonials,
      feeReminders,
      toolAuditLogs
    };
  } catch (err: any) {
    console.warn('[Supabase Load] Exception during Supabase hydration:', err.message);
    return null;
  }
}
