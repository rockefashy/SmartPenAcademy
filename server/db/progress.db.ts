import { ProgressTracker, StudentWorkImage, ProgressReport } from '../../src/types';
import { getSupabase } from './client.ts';

export function mapProgressTrackerRow(row: any): ProgressTracker {
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

export function buildProgressReportFromTrackerRow(row: any, student?: any): ProgressReport {
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

export function mapStudentWorkRow(row: any): StudentWorkImage {
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

export function mapProgressReportRow(row: any): ProgressReport {
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

export class ProgressDatabase {
  async getProgressTrackersByStudent(studentId: string): Promise<ProgressTracker[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('progress_trackers')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`[ProgressDatabase] Error fetching progress trackers for student ${studentId}: ${error.message}`);
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

  async findProgressTrackerById(id: string): Promise<ProgressTracker | null> {
    const supabase = getSupabase();
    if (!id) return null;
    const { data, error } = await supabase
      .from('progress_trackers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find progress tracker ${id}: ${error.message}`);
    }
    return data ? mapProgressTrackerRow(data) : null;
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

  async getProgressReports(studentId: string): Promise<ProgressReport[]> {
    const supabase = getSupabase();

    // 1. Fetch all progress tracker records for student
    const { data: trackerRows, error: trackerError } = await supabase
      .from('progress_trackers')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (trackerError) {
      console.warn(`[ProgressDatabase] Warning fetching trackers for reports: ${trackerError.message}`);
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
}

export const progressDb = new ProgressDatabase();
