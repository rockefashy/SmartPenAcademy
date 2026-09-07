import { Modal } from '../components/ui/Modal';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  CheckSquare,
  Square,
  X,
  ArrowLeft, 
  User, 
  Calendar, 
  DollarSign, 
  Camera, 
  TrendingUp, 
  Edit3, 
  Save, 
  CheckCircle, 
  Clock, 
  Mail, 
  Plus, 
  Trash2, 
  Eye, 
  Sparkles, 
  Phone, 
  Image as ImageIcon,
  Check,
  AlertCircle,
  FileText,
  Send,
  Printer,
  Award
} from 'lucide-react';
import { api } from '../services/api';
import { 
  StudentProfile, 
  AttendanceRecord, 
  FeeRecord, 
  StudentWorkImage, 
  ProgressReport, 
  ProgressTracker,
  StudentStatus, 
  DominantHand,
  SkillRating
} from '../types';
import { studentDetailProperties } from '../properties/studentDetail.properties';
import { StarRating } from '../components/StarRating';
import { formatGradeClass, formatDominantHand } from '../utils/formatters';
import { CameraCaptureModal } from '../components/CameraCaptureModal';
import { ProgressReportCard } from '../components/ProgressReportCard';
import { AttendanceCalendarTracker } from '../components/AttendanceCalendarTracker';
import { FeeLedgerTracker } from '../components/FeeLedgerTracker';

interface StudentDetailPageProps {
  studentId: string;
  initialSection?: number;
  onBack: () => void;
  onNavigate: (view: string, id?: string) => void;
}

export const StudentDetailPage: React.FC<StudentDetailPageProps> = ({
  studentId,
  initialSection = 1,
  onBack,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<number>(initialSection);
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const isAdmin = user?.role === 'admin';
  const isAssignedCoach = user?.role === 'coach' && (
    student?.coachId === user?.id || 
    student?.coachId === user?.coachId || 
    user?.authorizedStudentIds?.includes(student?.id)
  );
  const hasFullAccess = isAdmin || isAssignedCoach;

  // Multi-select and delete states for student works
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
  const [isDeletingWorks, setIsDeletingWorks] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [works, setWorks] = useState<StudentWorkImage[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Edit Profile Form State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<StudentProfile>>({});

  // Attendance Form State
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attStatus, setAttStatus] = useState<'Present' | 'Absent'>('Present');
  const [attNotes, setAttNotes] = useState('');
  const [isSavingAtt, setIsSavingAtt] = useState(false);

  // Camera & Image Works Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [selectedPhotoZoom, setSelectedPhotoZoom] = useState<string | null>(null);

  // Progress Report Generation State
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [viewingReport, setViewingReport] = useState<ProgressReport | null>(null);
  const [isSendingReportEmail, setIsSendingReportEmail] = useState(false);

  // Report Creation Form State
  const [reportMilestone, setReportMilestone] = useState('After 10 Classes');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportCompletedClasses, setReportCompletedClasses] = useState(10);
  const [reportTotalClasses, setReportTotalClasses] = useState(12);
  const [reportSkills, setReportSkills] = useState<SkillRating[]>([
    {
      skillKey: 'letterFormation',
      skillName: 'Letter Formation & Anatomy',
      beforeStars: 2,
      afterStars: 5,
      progressNote: 'Letter shapes are distinct with accurate ascent and descent loops.',
    },
    {
      skillKey: 'letterSizeSpacing',
      skillName: 'Letter Size & Spacing Uniformity',
      beforeStars: 2,
      afterStars: 4,
      progressNote: 'Consistent letter height and disciplined inter-word gaps.',
    },
    {
      skillKey: 'lineAlignment',
      skillName: 'Line Alignment & Margin Discipline',
      beforeStars: 1,
      afterStars: 5,
      progressNote: 'Letters rest squarely on baseline with neat margins.',
    },
    {
      skillKey: 'pencilControl',
      skillName: 'Pencil Control & Ergonomic Grip',
      beforeStars: 2,
      afterStars: 4,
      progressNote: 'Tripod grip stabilized, reduced page pressure fatigue.',
    },
    {
      skillKey: 'overallPresentation',
      skillName: 'Overall Presentation & Confidence',
      beforeStars: 2,
      afterStars: 5,
      progressNote: 'Neat, legible, confident, and rapid examination writing.',
    },
  ]);
  const [reportOverallStars, setReportOverallStars] = useState(5);
  const [reportOverallRemark, setReportOverallRemark] = useState('Outstanding Transformation');
  const [reportTeacherFeedback, setReportTeacherFeedback] = useState(
    'Remarkable consistency and dedication observed throughout the milestone classes. The letter clarity and line grounding have shown dramatic improvement.'
  );
  const [reportNextSteps, setReportNextSteps] = useState<string[]>([
    'Maintain consistent practice at home using the 4-line worksheet',
    'Focus on uniform inter-word spacing during school class notes',
    'Apply the same relaxed grip technique during timed tests',
  ]);
  const [reportBeforePhoto, setReportBeforePhoto] = useState<string | null>(null);
  const [reportAfterPhoto, setReportAfterPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadAllStudentData();
  }, [studentId]);

  useEffect(() => {
    if (initialSection) {
      setActiveTab(initialSection);
    }
  }, [initialSection]);

  const loadAllStudentData = async () => {
    setIsLoading(true);
    try {
      const [studentData, attData, feeData, worksData, reportsData] = await Promise.all([
        api.getStudent(studentId),
        api.getAttendanceByStudent(studentId),
        api.getFeesByStudent(studentId),
        api.getStudentWorks(studentId),
        api.getProgressReports(studentId),
      ]);

      setStudent(studentData);
      setProfileForm(studentData);
      setAttendance(attData);
      setFees(feeData);
      setWorks(worksData);
      setReports(reportsData);

      if (reportsData.length > 0) {
        setViewingReport(reportsData[reportsData.length - 1]);
      }
    } catch (err: any) {
      console.error('Failed to load student data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Section 1: Update Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.updateStudent(studentId, profileForm);
      setStudent(updated);
      setIsEditingProfile(false);
      showToast(studentDetailProperties.section1.saveSuccess);
    } catch (err: any) {
      alert(err.message || 'Failed to save student profile');
    }
  };

  // Section 2: Add Attendance
  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAtt(true);
    try {
      const record = {
        studentId,
        date: attDate,
        yearMonth: attDate.slice(0, 7),
        status: attStatus,
        notes: attNotes,
      };
      await api.saveAttendanceBatch([record]);
      const updatedList = await api.getAttendanceByStudent(studentId);
      setAttendance(updatedList);
      setAttNotes('');
      showToast(studentDetailProperties.section2.saveSuccess);
    } catch (err: any) {
      alert(err.message || 'Failed to record attendance');
    } finally {
      setIsSavingAtt(false);
    }
  };

  // Section 4: Save Camera Snapshot
  const handleSaveCameraWork = async (data: {
    imageData: string;
    captureDate: string;
    comments: string;
    category?: string;
  }) => {
    try {
      await api.uploadStudentWork({
        studentId,
        imageData: data.imageData,
        captureDate: data.captureDate,
        comments: data.comments,
        category: data.category,
      });
      const updatedWorks = await api.getStudentWorks(studentId);
      setWorks(updatedWorks);
      showToast(studentDetailProperties.section4Camera.saveSuccess);
    } catch (err: any) {
      console.error('Error saving camera work sample:', err);
      showToast(err.message || 'Failed to upload writing work');
      throw err; // Re-throw to prevent modal from closing silently
    }
  };

  // Work Sample Selection and Deletion Handlers
  const toggleSelectWork = (id: string) => {
    setSelectedWorkIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllWorks = () => {
    if (selectedWorkIds.size === works.length) {
      setSelectedWorkIds(new Set());
    } else {
      setSelectedWorkIds(new Set(works.map(w => w.id)));
    }
  };

  const handleDeleteSingleWork = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasFullAccess) {
      alert('Only administrators and the assigned coach can delete writing samples.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this handwriting sample? This cannot be undone.')) return;
    try {
      await api.deleteStudentWork(id);
      setWorks(prev => prev.filter(w => w.id !== id));
      setSelectedWorkIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedPhotoZoom && works.find(w => w.id === id)?.imageData === selectedPhotoZoom) {
        setSelectedPhotoZoom(null);
      }
      showToast('Writing sample deleted successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to delete writing sample');
    }
  };

  const handleBulkDeleteWorks = async () => {
    if (!hasFullAccess) {
      alert('Only administrators and the assigned coach can delete writing samples.');
      return;
    }
    const count = selectedWorkIds.size;
    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} selected handwriting sample${count > 1 ? 's' : ''}? This action cannot be undone.`)) return;
    setIsDeletingWorks(true);
    try {
      await api.bulkDeleteStudentWorks(Array.from(selectedWorkIds));
      setWorks(prev => prev.filter(w => !selectedWorkIds.has(w.id)));
      setSelectedWorkIds(new Set());
      showToast(`Successfully deleted ${count} handwriting sample${count > 1 ? 's' : ''}`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected handwriting samples');
    } finally {
      setIsDeletingWorks(false);
    }
  };

  // Section 5: Delete Progress Report Handler
  const handleDeleteProgressReport = async (reportId: string) => {
    if (!hasFullAccess) {
      alert('Only administrators and the assigned coach can delete progress reports.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this progress report? This action cannot be undone.')) return;
    setIsDeletingReport(true);
    try {
      await api.deleteProgressReport(reportId);
      const updatedReports = await api.getProgressReports(studentId);
      setReports(updatedReports);
      setViewingReport(updatedReports.length > 0 ? updatedReports[0] : null);
      showToast('Progress report deleted successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to delete progress report');
    } finally {
      setIsDeletingReport(false);
    }
  };

  // Section 5: Save New Progress Report
  const handleSaveProgressReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const reportPayload: Partial<ProgressReport> = {
        studentId,
        reportTitle: 'Progress Report',
        milestoneTitle: reportMilestone,
        reportDate,
        completedClasses: Number(reportCompletedClasses),
        totalClasses: Number(reportTotalClasses),
        skills: reportSkills,
        overallStars: Number(reportOverallStars),
        overallRemark: reportOverallRemark,
        teacherFeedback: reportTeacherFeedback,
        nextSteps: reportNextSteps,
        beforePhotoData: reportBeforePhoto || undefined,
        afterPhotoData: reportAfterPhoto || undefined,
        savedToFolder: '/progress_reports/',
      };

      const newReport = await api.generateProgressReport(reportPayload);
      const updatedReports = await api.getProgressReports(studentId);
      setReports(updatedReports);
      setViewingReport(newReport);
      setIsCreatingReport(false);
      showToast(studentDetailProperties.section5Progress.saveSuccess);
    } catch (err: any) {
      alert(err.message || 'Failed to create progress report');
    }
  };

  // Section 5: Email Progress Report to Parent
  const handleEmailProgressReport = async (reportId: string) => {
    if (!student) return;
    setIsSendingReportEmail(true);
    try {
      const res = await api.emailProgressReport(reportId, {
        parentEmail: student.email,
      });
      showToast(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to email progress report');
    } finally {
      setIsSendingReportEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500 space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-[#0E3589] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold">Loading Student Dossier...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4 font-sans">
        <h2 className="text-xl font-bold text-slate-800">Student Record Not Found</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#0E3589] text-white rounded-xl text-xs font-bold"
        >
          Return to Admin Roster
        </button>
      </div>
    );
  }

  const attendedCount = attendance.filter((a) => a.status === 'Present').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans space-y-8">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold border border-slate-700 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Top Header & Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-[#0E3589] transition-all shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                {student.displayName}
              </h1>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase ${
                  student.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {student.status === 'Active'
                  ? studentDetailProperties.header.badgeActive
                  : studentDetailProperties.header.badgeInactive}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {student.gradeClass ? `${formatGradeClass(student.gradeClass)} • ` : ''}{student.schoolName ? `${student.schoolName} • ` : ''}Enrolled: {student.enrollmentDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('parentPortal', student.id)}
            className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0E3589] text-xs font-bold border border-blue-200 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Parent Portal Preview</span>
          </button>
        </div>
      </div>

      {/* 5-Section Navigational Tab Pills */}
      <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab(1)}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 1
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{studentDetailProperties.header.tabs.section1}</span>
        </button>

        <button
          onClick={() => setActiveTab(2)}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 2
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{studentDetailProperties.header.tabs.section2}</span>
        </button>

        <button
          onClick={() => setActiveTab(3)}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 3
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{studentDetailProperties.header.tabs.section3}</span>
        </button>

        <button
          onClick={() => setActiveTab(4)}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 4
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>{studentDetailProperties.header.tabs.section4}</span>
        </button>

        <button
          onClick={() => setActiveTab(5)}
          className={`flex-1 min-w-[140px] py-3 px-4 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 5
              ? 'bg-[#F46E20] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{studentDetailProperties.header.tabs.section5}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: STUDENT PROFILE & STATUS                                      */}
      {/* ========================================================================= */}
      {activeTab === 1 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {studentDetailProperties.section1.title}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {studentDetailProperties.section1.subtitle}
              </p>
            </div>

            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all self-start cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingProfile ? studentDetailProperties.section1.cancelBtn : studentDetailProperties.section1.editBtn}</span>
            </button>
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={profileForm.firstName || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const lastName = profileForm.lastName || '';
                      setProfileForm({ 
                        ...profileForm, 
                        firstName: val,
                        displayName: `${val} ${lastName}`.trim()
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={profileForm.lastName || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const firstName = profileForm.firstName || '';
                      setProfileForm({ 
                        ...profileForm, 
                        lastName: val,
                        displayName: `${firstName} ${val}`.trim()
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={profileForm.displayName || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mode of Learning</label>
                  <select
                    value={profileForm.modeOfLearning || 'In-person'}
                    onChange={(e) => setProfileForm({ ...profileForm, modeOfLearning: e.target.value as 'In-person' | 'Online' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                  >
                    <option value="In-person">In-person</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={profileForm.status || 'Active'}
                    onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value as StudentStatus })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                  >
                    <option value="Active">{studentDetailProperties.section1.activeOption}</option>
                    <option value="Inactive">{studentDetailProperties.section1.inactiveOption}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Grade / Class</label>
                  <input
                    type="text"
                    value={profileForm.gradeClass || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, gradeClass: e.target.value })}
                    placeholder="e.g. 5 or Grade 5"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dominant Hand</label>
                  <select
                    value={profileForm.dominantHand || 'Right'}
                    onChange={(e) => setProfileForm({ ...profileForm, dominantHand: e.target.value as DominantHand })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                  >
                    <option value="Right">Right-handed</option>
                    <option value="Left">Left-handed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parent Name</label>
                  <input
                    type="text"
                    value={profileForm.parentName || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, parentName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Mobile</label>
                  <input
                    type="tel"
                    value={profileForm.whatsappMobile || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, whatsappMobile: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parent Email</label>
                  <input
                    type="email"
                    value={profileForm.email || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">School Name</label>
                  <input
                    type="text"
                    value={profileForm.schoolName || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, schoolName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Days</label>
                  <input
                    type="text"
                    value={profileForm.preferredDays || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, preferredDays: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Time Slot</label>
                  <input
                    type="text"
                    value={profileForm.preferredSlot || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, preferredSlot: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#0E3589] hover:bg-[#09225a] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {studentDetailProperties.section1.saveBtn}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student Profile</span>
                  <p className="text-sm font-black text-slate-900">{student.displayName}</p>
                  <p className="text-xs text-slate-600">
                    {student.age ? `Age: ${student.age} yrs` : (student.dateOfBirth ? `DOB: ${student.dateOfBirth}` : '')} {student.gender ? `(${student.gender})` : ''}
                  </p>
                  <p className="text-xs text-slate-600">
                    {student.gradeClass ? `${formatGradeClass(student.gradeClass)} • ` : ''}{formatDominantHand(student.dominantHand)} • <span className="font-bold text-[#0E3589]">{student.modeOfLearning || 'In-person'}</span>
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parent &amp; Contact</span>
                  <p className="text-sm font-black text-slate-900">
                    {student.parentName} {student.relationship ? `(${student.relationship})` : ''}
                  </p>
                  <p className="text-xs text-slate-600">WA: {student.whatsappMobile}</p>
                  <p className="text-xs text-slate-600">{student.email}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Schedule &amp; Slot</span>
                  <p className="text-sm font-black text-slate-900">{student.preferredDays}</p>
                  <p className="text-xs text-[#0E3589] font-bold">{student.preferredSlot}</p>
                  {student.schoolName && <p className="text-xs text-slate-600">School: {student.schoolName}</p>}
                </div>
              </div>

              {/* Login Credentials Box */}
              <div className="bg-gradient-to-r from-blue-50 to-orange-50 p-5 rounded-2xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F46E20]" />
                    <h4 className="text-xs font-black text-[#0E3589]">
                      {studentDetailProperties.section1.credentialsBoxTitle}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded text-slate-600 border">
                    Shared Access
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block font-sans">Login ID (Email):</span>
                    <strong className="text-slate-900">{student.email || student.username}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block font-sans">Password:</span>
                    <strong className="text-slate-900">{student.password || '••••••••'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: ATTENDANCE TRACKER (Unified Calendar Tracker with Admin Mode)   */}
      {/* ========================================================================= */}
      {activeTab === 2 && (
        <div className="space-y-6">
          {/* Alert Banner if 8 classes completed and fee receipt pending */}
          {attendedCount >= 8 && Math.floor(attendedCount / 8) > fees.filter(f => f.status === 'Paid').length && (
            <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F46E20]" />
                  <span>8 Classes Completed in Sequence • Fee Receipt Due</span>
                </p>
                <p className="text-[11px] text-orange-800 font-medium">
                  {student.displayName} has completed 8 classes (Classes {(Math.floor(attendedCount / 8) - 1) * 8 + 1} - {Math.floor(attendedCount / 8) * 8}). ₹1,600 fee receipt is pending.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(3)}
                className="px-4 py-2 bg-[#0E3589] hover:bg-[#08225e] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer shadow-xs transition-all"
              >
                Record Receipt (₹1,600)
              </button>
            </div>
          )}

          {/* Unified Attendance Calendar Tracker */}
          <AttendanceCalendarTracker
            attendance={attendance}
            student={student}
            isAdmin={true}
            onAttendanceChange={async (updatedRecords) => {
              setAttendance(updatedRecords);
              showToast('Attendance updated successfully');
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: FEE LEDGER & REMINDERS (Month-wise Milestones & WhatsApp)       */}
      {/* ========================================================================= */}
      {activeTab === 3 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md">
          <FeeLedgerTracker
            student={student}
            fees={fees}
            isAdmin={true}
            onFeeChange={(updatedFees) => setFees(updatedFees)}
            showToast={showToast}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: CAMERA WRITING CAPTURE & WORKS ARCHIVE                        */}
      {/* ========================================================================= */}
      {activeTab === 4 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {studentDetailProperties.section4Camera.title}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {studentDetailProperties.section4Camera.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start">
              <button
                onClick={() => setIsCameraModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                id="btn-open-camera-modal"
              >
                <Camera className="w-4 h-4" />
                <span>{studentDetailProperties.section4Camera.openCameraBtn}</span>
              </button>
            </div>
          </div>

          {/* Archive Gallery Grid Header & Actions */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  {studentDetailProperties.section4Camera.galleryTitle}
                </h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
                  {works.length} samples
                </span>
              </div>

              {works.length > 0 && hasFullAccess && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAllWorks}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {selectedWorkIds.size === works.length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-[#0E3589]" />
                        <span>Deselect All</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                        <span>Select All</span>
                      </>
                    )}
                  </button>

                  {selectedWorkIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDeleteWorks}
                      disabled={isDeletingWorks}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      id="btn-delete-selected-works"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingWorks ? 'Deleting...' : `Delete Selected (${selectedWorkIds.size})`}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {works.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {works.map((item) => {
                  const isSelected = selectedWorkIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`bg-slate-50 rounded-2xl border transition-all group relative overflow-hidden shadow-xs hover:shadow-md ${
                        isSelected ? 'border-[#F46E20] ring-2 ring-[#F46E20]/30' : 'border-slate-200'
                      }`}
                    >
                      {/* Top Action Overlay: Select Checkbox & Delete Button */}
                      {hasFullAccess && (
                        <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectWork(item.id);
                            }}
                            className={`p-1.5 rounded-lg backdrop-blur-xs transition-all cursor-pointer shadow ${
                              isSelected
                                ? 'bg-[#F46E20] text-white'
                                : 'bg-slate-900/60 hover:bg-slate-900 text-white'
                            }`}
                            title={isSelected ? 'Deselect image' : 'Select image'}
                          >
                            {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteSingleWork(item.id, e)}
                            className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-rose-600 text-white backdrop-blur-xs transition-colors cursor-pointer shadow"
                            title="Delete this writing sample"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div
                        onClick={() => setSelectedPhotoZoom(item.imageData)}
                        className="h-44 bg-slate-900 overflow-hidden flex items-center justify-center relative cursor-pointer"
                      >
                        <img
                          src={item.imageData}
                          alt={item.comments}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                          <Eye className="w-4 h-4" />
                          <span>Zoom</span>
                        </div>
                      </div>

                      <div className="p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 bg-blue-100 text-[#0E3589] font-bold text-[10px] rounded">
                            {item.category || 'Practice'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.captureDate}</span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium pt-1 line-clamp-2">
                          {item.comments}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold">{studentDetailProperties.section4Camera.noWorks}</p>
                <p className="text-[11px] text-slate-400 mt-1">{studentDetailProperties.section4Camera.noPhotosMessage}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: PROGRESS TRACKER & OFFICIAL REPORT CARDS                      */}
      {/* ========================================================================= */}
      {activeTab === 5 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {studentDetailProperties.section5Progress.title}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {studentDetailProperties.section5Progress.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsCreatingReport(!isCreatingReport)}
                className="px-4 py-2.5 rounded-xl bg-[#0E3589] hover:bg-[#09225a] text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingReport ? 'Cancel Report Generator' : studentDetailProperties.section5Progress.createReportBtn}</span>
              </button>
            </div>
          </div>

          {isCreatingReport ? (
            <form onSubmit={handleSaveProgressReport} className="bg-slate-50 p-6 rounded-3xl border border-slate-300 space-y-6">
              <h3 className="text-sm font-black text-[#0E3589] uppercase tracking-wider">
                {studentDetailProperties.section5Progress.newReportTitle}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Milestone Title</label>
                  <input
                    type="text"
                    value={reportMilestone}
                    onChange={(e) => setReportMilestone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#0E3589]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Evaluation Date</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#0E3589]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Completed Classes</label>
                  <input
                    type="number"
                    value={reportCompletedClasses}
                    onChange={(e) => setReportCompletedClasses(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#0E3589]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Classes</label>
                  <input
                    type="number"
                    value={reportTotalClasses}
                    onChange={(e) => setReportTotalClasses(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#0E3589]"
                    required
                  />
                </div>
              </div>

              {/* 5-Skill Evaluation Star Matrix */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-800">5-Dimensional Handwriting Skill Star Matrix:</h4>
                <div className="space-y-3">
                  {reportSkills.map((skill, index) => (
                    <div key={skill.skillKey} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <strong className="text-xs text-slate-900">{skill.skillName}</strong>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold">Before:</span>
                            <StarRating
                              value={skill.beforeStars}
                              rating={skill.beforeStars}
                              onChange={(val) => {
                                const copy = [...reportSkills];
                                copy[index].beforeStars = val;
                                setReportSkills(copy);
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#F46E20] font-bold">After:</span>
                            <StarRating
                              value={skill.afterStars}
                              rating={skill.afterStars}
                              onChange={(val) => {
                                const copy = [...reportSkills];
                                copy[index].afterStars = val;
                                setReportSkills(copy);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={skill.progressNote}
                        onChange={(e) => {
                          const copy = [...reportSkills];
                          copy[index].progressNote = e.target.value;
                          setReportSkills(copy);
                        }}
                        placeholder="Progress Note..."
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Writing Transformation Samples (Before & After) Selection */}
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#F46E20]" />
                      <span>Attach Transformation Writing Samples (Before &amp; After)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Select photos from this student's writing samples archive to showcase baseline vs transformed handwriting.
                    </p>
                  </div>
                  {works.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0E3589] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer self-start"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Capture / Upload Photo</span>
                    </button>
                  )}
                </div>

                {/* Visual Before & After Slots */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Before Slot */}
                  <div className="p-3.5 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-rose-600 flex items-center gap-1.5">
                        <span>Baseline Sample (Before - Class 1)</span>
                      </span>
                      {reportBeforePhoto && (
                        <button
                          type="button"
                          onClick={() => setReportBeforePhoto(null)}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {reportBeforePhoto ? (
                      <div className="relative rounded-lg overflow-hidden border border-rose-200 bg-white h-36 flex items-center justify-center">
                        <img src={reportBeforePhoto} alt="Baseline Sample" className="max-h-36 max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-36 flex flex-col items-center justify-center text-center p-3 text-slate-400">
                        <ImageIcon className="w-8 h-8 text-rose-300 mb-1" />
                        <p className="text-xs font-semibold text-slate-500">No baseline sample selected</p>
                        <p className="text-[10px] text-slate-400">Click &quot;Set Before&quot; on any sample below</p>
                      </div>
                    )}
                  </div>

                  {/* After Slot */}
                  <div className="p-3.5 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-600 flex items-center gap-1.5">
                        <span>Transformed Sample (After - Milestone)</span>
                      </span>
                      {reportAfterPhoto && (
                        <button
                          type="button"
                          onClick={() => setReportAfterPhoto(null)}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {reportAfterPhoto ? (
                      <div className="relative rounded-lg overflow-hidden border border-emerald-200 bg-white h-36 flex items-center justify-center">
                        <img src={reportAfterPhoto} alt="Transformed Sample" className="max-h-36 max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-36 flex flex-col items-center justify-center text-center p-3 text-slate-400">
                        <ImageIcon className="w-8 h-8 text-emerald-300 mb-1" />
                        <p className="text-xs font-semibold text-slate-500">No transformed sample selected</p>
                        <p className="text-[10px] text-slate-400">Click &quot;Set After&quot; on any sample below</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Student Works Archive Quick-Select Gallery */}
                {works.length > 0 ? (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
                      Choose from Camera Works Archive ({works.length} samples):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                      {works.map((item) => {
                        const isBefore = reportBeforePhoto === item.imageData;
                        const isAfter = reportAfterPhoto === item.imageData;

                        return (
                          <div
                            key={item.id}
                            className={`p-2 rounded-xl border transition-all text-left bg-slate-50 ${
                              isBefore
                                ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/50'
                                : isAfter
                                ? 'border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50/50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="h-20 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center mb-1.5">
                              <img src={item.imageData} alt={item.comments} className="w-full h-full object-cover" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-800 truncate">{item.category || 'Sample'}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{item.captureDate}</p>
                            <div className="flex gap-1.5 mt-2">
                              <button
                                type="button"
                                onClick={() => setReportBeforePhoto(item.imageData)}
                                className={`flex-1 py-1 text-[10px] font-extrabold rounded-md cursor-pointer transition-colors ${
                                  isBefore
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                                }`}
                              >
                                {isBefore ? '✓ Before' : 'Set Before'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setReportAfterPhoto(item.imageData)}
                                className={`flex-1 py-1 text-[10px] font-extrabold rounded-md cursor-pointer transition-colors ${
                                  isAfter
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                }`}
                              >
                                {isAfter ? '✓ After' : 'Set After'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-500 text-xs">
                    No handwriting samples have been captured yet for this student. You can generate the report without samples, or click &quot;Capture / Upload Photo&quot; above to add one.
                  </div>
                )}
              </div>

              {/* Overall Progress & Teacher Feedback */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Overall Star Rating</label>
                  <div className="p-3 bg-white border border-slate-300 rounded-xl flex items-center gap-3">
                    <StarRating value={reportOverallStars} rating={reportOverallStars} onChange={setReportOverallStars} />
                    <span className="text-xs font-bold text-amber-500">({reportOverallStars} / 5 Stars)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Overall Progress Title</label>
                  <input
                    type="text"
                    value={reportOverallRemark}
                    onChange={(e) => setReportOverallRemark(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teacher's Feedback &amp; Encouragement</label>
                <textarea
                  rows={3}
                  value={reportTeacherFeedback}
                  onChange={(e) => setReportTeacherFeedback(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreatingReport(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#F46E20] hover:bg-[#d95d13] text-white text-xs font-black rounded-xl shadow-md cursor-pointer"
                >
                  Generate &amp; Save Official Progress Report
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Reports list selection if more than 1 report */}
              {reports.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 shrink-0">Milestones:</span>
                  {reports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setViewingReport(r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        viewingReport?.id === r.id
                          ? 'bg-[#0E3589] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {r.milestoneTitle} ({r.reportDate})
                    </button>
                  ))}
                </div>
              )}

              {viewingReport ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      <h3 className="text-sm font-black text-slate-900">
                        {viewingReport.milestoneTitle} ({viewingReport.reportDate})
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEmailProgressReport(viewingReport.id)}
                        disabled={isSendingReportEmail}
                        className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0E3589] text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSendingReportEmail ? 'Emailing...' : studentDetailProperties.section5Progress.emailReportBtn}</span>
                      </button>

                      {hasFullAccess && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProgressReport(viewingReport.id)}
                          disabled={isDeletingReport}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                          title="Delete this progress report"
                          id="btn-delete-progress-report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isDeletingReport ? 'Deleting...' : 'Delete Report'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <ProgressReportCard
                    report={viewingReport}
                    student={student || undefined}
                  />
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold">{studentDetailProperties.section5Progress.noReports}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSave={handleSaveCameraWork}
        studentName={student?.displayName || 'Student'}
      />

      {/* Full Photo Zoom Modal */}
      <Modal
        isOpen={Boolean(selectedPhotoZoom)}
        onClose={() => setSelectedPhotoZoom(null)}
        size="2xl"
        title="Writing Work Sample"
      >
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-2xl overflow-hidden max-h-[65vh] flex items-center justify-center">
            <img
              src={selectedPhotoZoom || ''}
              alt="Work sample zoom"
              className="max-h-[65vh] w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedPhotoZoom(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
