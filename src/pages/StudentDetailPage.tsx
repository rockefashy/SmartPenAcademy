import React, { useState, useEffect } from 'react';
import { 
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
  const [student, setStudent] = useState<StudentProfile | null>(null);
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
  const [reportBeforePhoto, setReportBeforePhoto] = useState('/student_works/sample_baseline_class1.png');
  const [reportAfterPhoto, setReportAfterPhoto] = useState('/student_works/sample_milestone_class10.png');

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
    category?: 'Before' | 'After' | 'Practice' | 'Exam Sheet';
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
      alert(err.message || 'Failed to upload writing work');
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
        beforePhotoData: reportBeforePhoto,
        afterPhotoData: reportAfterPhoto,
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
                {student.fullName}
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
              Grade {student.gradeClass} • {student.schoolName} • Enrolled: {student.enrollmentDate}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name</label>
                  <input
                    type="text"
                    value={profileForm.fullName || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                    required
                  />
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
                  <p className="text-sm font-black text-slate-900">{student.fullName}</p>
                  <p className="text-xs text-slate-600">DOB: {student.dateOfBirth} ({student.gender})</p>
                  <p className="text-xs text-slate-600">Hand: {student.dominantHand} Handed</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parent &amp; Contact</span>
                  <p className="text-sm font-black text-slate-900">{student.parentName} ({student.relationship})</p>
                  <p className="text-xs text-slate-600">WA: {student.whatsappMobile}</p>
                  <p className="text-xs text-slate-600">{student.email}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Schedule &amp; Slot</span>
                  <p className="text-sm font-black text-slate-900">{student.preferredDays}</p>
                  <p className="text-xs text-[#0E3589] font-bold">{student.preferredSlot}</p>
                  <p className="text-xs text-slate-600">Medium: {student.instructionMedium}</p>
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
                    <span className="text-slate-400 text-[10px] block font-sans">Username:</span>
                    <strong className="text-slate-900">{student.username}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block font-sans">Password:</span>
                    <strong className="text-slate-900">{student.password || 'smartpen123'}</strong>
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
          {attendedCount >= 8 && Math.floor(attendedCount / 8) > fees.filter(f => f.isPaid).length && (
            <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F46E20]" />
                  <span>8 Classes Completed in Sequence • Fee Receipt Due</span>
                </p>
                <p className="text-[11px] text-orange-800 font-medium">
                  {student.fullName} has completed 8 classes (Classes {(Math.floor(attendedCount / 8) - 1) * 8 + 1} - {Math.floor(attendedCount / 8) * 8}). ₹1,600 fee receipt is pending.
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

            <button
              onClick={() => setIsCameraModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F46E20] to-[#FF8C38] text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 self-start cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{studentDetailProperties.section4Camera.openCameraBtn}</span>
            </button>
          </div>

          {/* Archive Gallery Grid */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">
              {studentDetailProperties.section4Camera.galleryTitle}
            </h3>

            {works.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {works.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all group"
                  >
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
                ))}
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

              {/* Overall Progress & Teacher Feedback */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Overall Star Rating</label>
                  <div className="p-3 bg-white border border-slate-300 rounded-xl flex items-center gap-3">
                    <StarRating rating={reportOverallStars} onChange={setReportOverallStars} />
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
      />

      {/* Full Photo Zoom Modal */}
      {selectedPhotoZoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-[#0E3589]">Writing Work Sample</h3>
              <button
                onClick={() => setSelectedPhotoZoom(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                ✕
              </button>
            </div>
            <div className="bg-slate-900 rounded-2xl overflow-hidden max-h-[65vh] flex items-center justify-center">
              <img
                src={selectedPhotoZoom}
                alt="Work sample zoom"
                className="max-h-[65vh] w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPhotoZoom(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
