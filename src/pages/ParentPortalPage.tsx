import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  DollarSign, 
  Image as ImageIcon, 
  TrendingUp, 
  Star, 
  Award, 
  Heart, 
  Clock, 
  CheckCircle, 
  Download, 
  Printer, 
  Sparkles, 
  Phone, 
  User, 
  BookOpen, 
  Eye, 
  Smile,
  MessageSquareQuote,
  Send,
  Upload,
  Check,
  Trash2,
  ThumbsUp,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  StudentProfile, 
  ProgressReport, 
  AttendanceRecord, 
  FeeRecord, 
  StudentWorkImage,
  Testimonial
} from '../types';
import { parentPortalProperties } from '../properties/parentPortal.properties';
import { commonProperties } from '../properties/common.properties';
import { ProgressReportCard } from '../components/ProgressReportCard';
import { formatGradeClass } from '../utils/formatters';
import { SmartPenLogo } from '../components/SmartPenLogo';
import { AttendanceCalendarTracker } from '../components/AttendanceCalendarTracker';

interface ParentPortalPageProps {
  studentId?: string;
  onNavigate: (view: string, extraId?: string, defaultSection?: number) => void;
  onOpenLogin: () => void;
}

export const ParentPortalPage: React.FC<ParentPortalPageProps> = ({
  studentId,
  onNavigate,
  onOpenLogin,
}) => {
  const { user, isAuthenticated, switchStudent } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'works' | 'attendance' | 'fees' | 'testimony'>('overview');
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [works, setWorks] = useState<StudentWorkImage[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Testimony Form State
  const [testimonyRating, setTestimonyRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [testimonyTag, setTestimonyTag] = useState<string>('From 2 Stars to 5 Stars');
  const [customTag, setCustomTag] = useState<string>('');
  const [testimonyHeadline, setTestimonyHeadline] = useState<string>('');
  const [testimonyReview, setTestimonyReview] = useState<string>('');
  const [testimonyParentName, setTestimonyParentName] = useState<string>('');
  const [testimonyRelationship, setTestimonyRelationship] = useState<string>('Mother');
  const [testimonyImage, setTestimonyImage] = useState<string>('');
  const [testimonyConsent, setTestimonyConsent] = useState<boolean>(true);
  const [isSubmittingTestimony, setIsSubmittingTestimony] = useState<boolean>(false);
  const [testimonySuccessMsg, setTestimonySuccessMsg] = useState<string | null>(null);
  const [testimonyErrorMsg, setTestimonyErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadPortalData();
  }, [studentId, user]);

  const loadPortalData = async () => {
    setIsLoading(true);
    setTestimonyErrorMsg(null);
    try {
      let targetId = studentId;
      if (!targetId && user?.studentId) {
        targetId = user.studentId;
      }
      if (!targetId) {
        const students = await api.getStudents();
        if (students.length > 0) {
          targetId = students[0].id;
        }
      }

      if (targetId) {
        const [studentData, attData, feeData, worksData, reportsData, testimoniesData] = await Promise.all([
          api.getStudent(targetId),
          api.getAttendanceByStudent(targetId),
          api.getFeesByStudent(targetId),
          api.getStudentWorks(targetId),
          api.getProgressReports(targetId),
          api.getTestimonialsByStudent(targetId),
        ]);

        setStudent(studentData);
        setAttendance(attData);
        setFees(feeData);
        setWorks(worksData);
        setReports(reportsData);
        setTestimonials(testimoniesData || []);

        if (studentData) {
          setTestimonyParentName(studentData.parentName || '');
          setTestimonyRelationship(studentData.relationship || 'Mother');
        }
      }
    } catch (err: any) {
      console.error('Failed to load parent portal student data:', err);
      setTestimonyErrorMsg(err.message || 'Failed to load student data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTestimonyImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitTestimony = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    if (!testimonyReview.trim()) {
      setTestimonyErrorMsg('Please write your testimony / experience before submitting.');
      return;
    }

    setIsSubmittingTestimony(true);
    setTestimonyErrorMsg(null);
    setTestimonySuccessMsg(null);

    const chosenTag = customTag.trim() ? customTag.trim() : testimonyTag;

    try {
      const saved = await api.submitTestimonial({
        studentId: student.id,
        studentName: student.displayName,
        parentName: testimonyParentName.trim() || student.parentName || 'Parent',
        grade: `Grade ${student.gradeClass}, ${student.schoolName}`,
        schoolName: student.schoolName,
        relationship: testimonyRelationship,
        rating: testimonyRating,
        title: testimonyHeadline.trim() || 'Transformation Review',
        review: testimonyReview.trim(),
        beforeAfterTag: chosenTag,
        image: testimonyImage || undefined,
        mediaConsent: testimonyConsent,
        status: 'Featured'
      });

      setTestimonials(prev => [saved, ...prev]);
      setTestimonySuccessMsg(parentPortalProperties.testimony.successMessage);
      setTestimonyHeadline('');
      setTestimonyReview('');
      setTestimonyImage('');
      setCustomTag('');
    } catch (err: any) {
      setTestimonyErrorMsg(err.message || 'Failed to submit testimony. Please try again.');
    } finally {
      setIsSubmittingTestimony(false);
    }
  };

  const handleDeleteTestimony = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this testimony?')) return;
    try {
      await api.deleteTestimonial(id);
      setTestimonials(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert('Failed to delete testimony');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500 space-y-3 font-sans">
        <div className="w-10 h-10 border-4 border-[#F46E20] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold">{parentPortalProperties.loadingText}</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-xl text-center space-y-4 font-sans">
        <div className="w-16 h-16 bg-blue-50 text-[#0E3589] rounded-full flex items-center justify-center mx-auto">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{parentPortalProperties.noStudentSelected}</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Please sign in with your student credentials or select a student profile.
        </p>
        <button
          onClick={() => onOpenLogin()}
          className="w-full py-3 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] text-white font-bold text-xs rounded-xl shadow cursor-pointer"
        >
          Sign In to Student Portal
        </button>
      </div>
    );
  }

  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;
  const attendedCount = attendance.filter((a) => a.status === 'Present').length;
  const completedCycles = Math.floor(attendedCount / 8);
  const currentCycle = completedCycles + 1;
  const currentCycleProgress = attendedCount % 8;
  const paidCyclesCount = fees.filter((f) => f.status === 'Paid' || f.isPaid).length;
  const isFeeDueForCurrentCycle = completedCycles > 0 && paidCyclesCount < completedCycles;

  // Pending fee records or cycle due calculation
  const pendingFees = fees.filter((f) => f.status === 'Pending' || (!f.isPaid && f.status !== 'Paid'));
  const pendingFeeTotal = pendingFees.reduce((sum, f) => sum + (f.amount || 1600), 0);
  const hasFeeDue = pendingFees.length > 0 || isFeeDueForCurrentCycle || student.feeStatus === 'Pending' || student.feeStatus === 'Overdue';
  const totalFeeDue = pendingFeeTotal > 0 ? pendingFeeTotal : (hasFeeDue ? 1600 : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans space-y-6">
      {/* Admin Preview Mode Banner with Return Navigation */}
      {user?.role === 'admin' && (
        <div 
          className="bg-gradient-to-r from-blue-950 via-[#0E3589] to-indigo-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border-2 border-blue-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200"
          id="admin-portal-preview-banner"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-400/20 text-amber-300 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-amber-300/30">
                <ShieldCheck className="w-3 h-3" />
                <span>Coach Admin Preview Mode</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-white mt-1">
                Viewing Parent Portal for <span className="text-amber-200 font-extrabold">{student.displayName}</span> (Grade {student.gradeClass})
              </p>
            </div>
          </div>

          {/* Navigation Links to return back to Admin screens */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('studentDetail', student.id)}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-[#0E3589] font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              id="btn-preview-back-student-file"
              title={`Return to ${student.displayName}'s Student Dossier`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Student File</span>
            </button>

            <button
              onClick={() => onNavigate('admin')}
              className="px-4 py-2 bg-blue-800/80 hover:bg-blue-700/80 text-white font-bold text-xs rounded-xl border border-blue-400/40 shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              id="btn-preview-back-admin-dashboard"
              title="Return to Admin Command Center"
            >
              <ShieldCheck className="w-4 h-4 text-blue-200" />
              <span>Admin Dashboard</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Header: Welcome with minimal spacing and height */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Welcome, {student.displayName}!
            </h1>
            {user?.role === 'student' && user.siblingStudents && user.siblingStudents.length > 1 && (
              <div className="flex items-center gap-1.5 bg-orange-50 px-2.5 py-1 rounded-xl border border-orange-200">
                <span className="text-[11px] font-bold text-[#F46E20]">Family Profiles:</span>
                <select
                  value={student.id}
                  onChange={(e) => switchStudent(e.target.value)}
                  className="bg-white text-xs font-bold text-slate-800 py-0.5 px-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-1 focus:ring-[#F46E20] cursor-pointer"
                  id="select-portal-switch-student"
                >
                  {user.siblingStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName || s.fullName} {s.age ? `(Age ${s.age})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Grade {student.gradeClass} • {student.schoolName} • Coach: {student.coachName || commonProperties.founderName}
          </p>
        </div>

        {/* Quick Return button in header for Admin */}
        {user?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('studentDetail', student.id)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#0E3589] border border-slate-300 hover:border-blue-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              id="btn-header-return-student"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit Preview &amp; Back to Student File</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 min-w-[130px] py-3 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          id="tab-portal-overview"
        >
          <Smile className="w-4 h-4" />
          <span>{parentPortalProperties.tabs.overview}</span>
        </button>

        <button
          onClick={() => setActiveTab('progress')}
          className={`flex-1 min-w-[130px] py-3 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'progress'
              ? 'bg-[#F46E20] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          id="tab-portal-progress"
        >
          <TrendingUp className="w-4 h-4" />
          <span>{parentPortalProperties.tabs.progressReport}</span>
        </button>

        <button
          onClick={() => setActiveTab('works')}
          className={`flex-1 min-w-[130px] py-3 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'works'
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          id="tab-portal-works"
        >
          <ImageIcon className="w-4 h-4" />
          <span>{parentPortalProperties.tabs.writingWorks}</span>
        </button>

        <button
          onClick={() => setActiveTab('testimony')}
          className={`flex-1 min-w-[130px] py-3 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'testimony'
              ? 'bg-gradient-to-r from-[#F46E20] to-[#FF8C38] text-white shadow-md'
              : 'text-slate-600 hover:bg-orange-50 hover:text-[#F46E20]'
          }`}
          id="tab-portal-testimony"
        >
          <MessageSquareQuote className="w-4 h-4 text-amber-300" />
          <span>Add Testimony</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 min-w-[130px] py-3 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          id="tab-portal-attendance"
        >
          <Calendar className="w-4 h-4" />
          <span>{parentPortalProperties.tabs.attendance}</span>
        </button>

        <button
          onClick={() => setActiveTab('fees')}
          className={`flex-1 min-w-[130px] py-3 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'fees'
              ? 'bg-[#0E3589] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          id="tab-portal-fees"
        >
          <DollarSign className="w-4 h-4" />
          <span>{parentPortalProperties.tabs.feeReceipts}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW DASHBOARD                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Add Testimony Quick Action Banner */}
          <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-blue-50 border-2 border-orange-200/80 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F46E20] to-[#FF8C38] text-white flex items-center justify-center shadow-md shrink-0">
                <Heart className="w-6 h-6 fill-white/30 text-white" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Loving Your Child's Handwriting Progress?
                </h4>
                <p className="text-xs text-slate-600">
                  Share a quick testimony &amp; feedback for Mrs. Deepthy Rock to inspire new parents and celebrate your child's success!
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('testimony')}
              className="px-5 py-2.5 bg-[#F46E20] hover:bg-[#e05c10] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0"
              id="btn-overview-add-testimony"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Add Parent Testimony →</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-900 text-sm">Handwriting Milestone</h3>
                <p className="text-xs text-slate-600 font-semibold truncate mt-0.5">
                  Level 2: Cursive &amp; Speed Alignment
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#0E3589] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-900 text-sm">Class Schedule</h3>
                <p className="text-xs text-slate-600 font-semibold truncate mt-0.5">
                  {student.preferredDays} • {student.preferredSlot}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  hasFeeDue ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <DollarSign className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 text-sm">Fee Due</h3>
                  <p className={`text-sm sm:text-base font-black truncate mt-0.5 ${hasFeeDue ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {hasFeeDue ? `₹${totalFeeDue.toLocaleString('en-IN')}` : '₹0'}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold border shrink-0 ${
                hasFeeDue 
                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {hasFeeDue ? 'Due' : 'All Cleared ✓'}
              </span>
            </div>
          </div>

          {latestReport && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span>Progress Report ({latestReport.milestoneTitle || "After 10 Classes"})</span>
                </h3>
                <button
                  onClick={() => setActiveTab('progress')}
                  className="text-xs font-bold text-[#0E3589] hover:underline cursor-pointer"
                >
                  Full Screen Report View →
                </button>
              </div>
              <ProgressReportCard report={latestReport} student={student} />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PROGRESS REPORT FULL CARD VIEW                                         */}
      {/* ========================================================================= */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          {latestReport ? (
            <ProgressReportCard report={latestReport} student={student} />
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 space-y-3">
              <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No Progress Reports Issued Yet</p>
              <p className="text-xs text-slate-400">
                Your coach will generate the official Milestone Progress Card upon reaching milestone classes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. WRITING SAMPLES & WORKS GALLERY                                        */}
      {/* ========================================================================= */}
      {activeTab === 'works' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">Student Writing Sample Portfolio</h2>
              <p className="text-xs text-slate-500">
                Live captures of class exercises, baseline assessments, and transformation proofs.
              </p>
            </div>
            <span className="text-xs font-bold text-[#0E3589] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {works.length} Works Archived
            </span>
          </div>

          {works.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {works.map((work) => (
                <div
                  key={work.id}
                  onClick={() => setSelectedPhoto(work.imageData)}
                  className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="h-48 bg-slate-900 overflow-hidden flex items-center justify-center relative">
                    <img
                      src={work.imageData}
                      alt={work.comments}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                      <Eye className="w-4 h-4" />
                      <span>Click to View Full Size</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-blue-100 text-[#0E3589] font-bold text-[10px] rounded-md">
                        {work.category || 'Practice'}
                      </span>
                      <span className="text-[11px] text-slate-400">{work.captureDate}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium pt-1 line-clamp-2">
                      {work.comments}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-xs">No sample writing works uploaded yet.</p>
            </div>
          )}

          {/* Photo Modal */}
          {selectedPhoto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <h3 className="font-bold text-sm text-[#0E3589]">Writing Work Sample</h3>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="bg-slate-900 rounded-2xl overflow-hidden max-h-[65vh] flex items-center justify-center">
                  <img
                    src={selectedPhoto}
                    alt="Work sample zoom"
                    className="max-h-[65vh] w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ADD TESTIMONY & FEEDBACK SECTION                                      */}
      {/* ========================================================================= */}
      {activeTab === 'testimony' && (
        <div className="space-y-8 text-left">
          {/* Header Banner */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
                  <Heart className="w-3.5 h-3.5 fill-[#F46E20]" />
                  <span>Student &amp; Parent Testimony</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {parentPortalProperties.testimony.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-sans">
                  {parentPortalProperties.testimony.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-2.5 rounded-2xl border border-blue-200/70 shrink-0">
                <GraduationCap className="w-5 h-5 text-[#0E3589]" />
                <div className="text-xs font-bold text-[#0E3589]">
                  <span>{student.displayName}</span>
                  {student.gradeClass && <span className="text-slate-500 font-normal"> ({formatGradeClass(student.gradeClass)})</span>}
                </div>
              </div>
            </div>

            {/* Success Notification */}
            {testimonySuccessMsg && (
              <div className="mt-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold shadow-xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{testimonySuccessMsg}</span>
              </div>
            )}

            {/* Error Notification */}
            {testimonyErrorMsg && (
              <div className="mt-6 p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold shadow-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{testimonyErrorMsg}</span>
              </div>
            )}

            {/* Main Form & Live Preview Grid */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Interactive Form (7 cols) */}
              <form onSubmit={handleSubmitTestimony} className="lg:col-span-7 space-y-6">
                {/* 1. Star Rating Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {parentPortalProperties.testimony.ratingLabel} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((starVal) => {
                        const isFilled = (hoverRating || testimonyRating) >= starVal;
                        return (
                          <button
                            type="button"
                            key={starVal}
                            onClick={() => setTestimonyRating(starVal)}
                            onMouseEnter={() => setHoverRating(starVal)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 hover:scale-125 transition-transform cursor-pointer focus:outline-none"
                            id={`star-rating-btn-${starVal}`}
                          >
                            <Star
                              className={`w-7 h-7 transition-colors ${
                                isFilled
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <span className="ml-2 text-xs font-bold text-slate-700">
                      {parentPortalProperties.testimony.ratingDescriptions[testimonyRating as keyof typeof parentPortalProperties.testimony.ratingDescriptions]}
                    </span>
                  </div>
                </div>

                {/* 2. Parent Name & Relationship */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Parent / Guardian Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={testimonyParentName}
                      onChange={(e) => setTestimonyParentName(e.target.value)}
                      placeholder="e.g. Mrs. Sunita Sharma"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#0E3589] focus:outline-none bg-slate-50/50"
                      id="input-testimony-parent-name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Relationship
                    </label>
                    <select
                      value={testimonyRelationship}
                      onChange={(e) => setTestimonyRelationship(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#0E3589] focus:outline-none bg-slate-50/50"
                      id="select-testimony-relationship"
                    >
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Student">Student (Self)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Quick Transformation Tag Chips */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Key Transformation Badge / Highlight
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {parentPortalProperties.testimony.transformationTags.map((tag) => {
                      const isSelected = testimonyTag === tag && !customTag;
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => {
                            setTestimonyTag(tag);
                            setCustomTag('');
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#F46E20] text-white shadow-xs scale-102'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/70'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{tag}
                        </button>
                      );
                    })}
                  </div>
                  {/* Custom tag input option */}
                  <div className="pt-1">
                    <input
                      type="text"
                      value={customTag}
                      onChange={(e) => {
                        setCustomTag(e.target.value);
                      }}
                      placeholder="Or enter a custom highlight tag (e.g. Scored 98% in CBSE Board Exam)..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-[#F46E20] focus:outline-none bg-white"
                    />
                  </div>
                </div>

                {/* 4. Headline / Summary */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    {parentPortalProperties.testimony.headlineLabel} (Optional)
                  </label>
                  <input
                    type="text"
                    value={testimonyHeadline}
                    onChange={(e) => setTestimonyHeadline(e.target.value)}
                    placeholder={parentPortalProperties.testimony.headlinePlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#0E3589] focus:outline-none bg-white"
                    id="input-testimony-headline"
                  />
                </div>

                {/* 5. Detailed Review */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {parentPortalProperties.testimony.reviewLabel} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={testimonyReview}
                    onChange={(e) => setTestimonyReview(e.target.value)}
                    placeholder={parentPortalProperties.testimony.reviewPlaceholder}
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium leading-relaxed focus:ring-2 focus:ring-[#0E3589] focus:outline-none bg-white"
                    id="textarea-testimony-review"
                  />
                  <p className="text-[11px] text-slate-400">
                    Your genuine review helps other parents understand how Mrs. Deepthy Rock's coaching works.
                  </p>
                </div>

                {/* 6. Photo Upload */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    {parentPortalProperties.testimony.photoLabel}
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Choose Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="input-testimony-photo"
                      />
                    </label>
                    {testimonyImage && (
                      <div className="flex items-center gap-2">
                        <img
                          src={testimonyImage}
                          alt="Preview"
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setTestimonyImage('')}
                          className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 7. Media Consent Checkbox */}
                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/60 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="chk-testimony-consent"
                    checked={testimonyConsent}
                    onChange={(e) => setTestimonyConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#0E3589] focus:ring-[#0E3589] cursor-pointer"
                  />
                  <label htmlFor="chk-testimony-consent" className="text-[11px] text-slate-700 font-medium cursor-pointer leading-snug">
                    {parentPortalProperties.testimony.consentLabel}
                  </label>
                </div>

                {/* 8. Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={isSubmittingTestimony}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-[#F46E20] via-[#FF8C38] to-[#F46E20] hover:from-[#e05c10] hover:to-[#e05c10] text-white font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    id="btn-submit-testimony"
                  >
                    {isSubmittingTestimony ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{parentPortalProperties.testimony.submittingBtn}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>{parentPortalProperties.testimony.submitBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Right Column: Live Showcase Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F46E20]" />
                  <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">
                    {parentPortalProperties.testimony.previewTitle}
                  </h3>
                </div>

                {/* Preview Card styled exactly like the Landing Page review cards */}
                <div className="bg-white rounded-3xl p-6 border-2 border-orange-200/90 shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-400 to-[#F46E20] text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-xs">
                    Live Preview
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex text-amber-400">
                        {Array.from({ length: testimonyRating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400" />
                        ))}
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                        {customTag.trim() || testimonyTag}
                      </span>
                    </div>

                    {testimonyHeadline && (
                      <h4 className="font-black text-sm text-slate-900">
                        "{testimonyHeadline}"
                      </h4>
                    )}

                    <p className="text-xs text-slate-700 leading-relaxed italic font-sans font-medium">
                      "{testimonyReview || 'Khwaish\'s handwriting improved miraculously in just 10 classes! Earlier, teachers struggled to read her exam answers. Now her notebook is showcased as an example in class.'}"
                    </p>
                  </div>

                  {testimonyImage && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 max-h-32 bg-slate-50 flex items-center justify-center">
                      <img
                        src={testimonyImage}
                        alt="Testimony attachment"
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0E3589] text-white flex items-center justify-center font-black text-xs shadow-xs">
                      {student.displayName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{student.displayName}</h4>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {student.gradeClass ? `${formatGradeClass(student.gradeClass)} • ` : ''}{testimonyParentName || student.parentName || 'Parent'} ({testimonyRelationship})
                      </p>
                    </div>
                  </div>
                </div>

                {/* Helpful Note Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 text-xs space-y-1.5">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Instant Academy Visibility</span>
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Submitted reviews are immediately featured in the SmartPen Academy parent voices gallery and shared with Mrs. Deepthy Rock.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Submitted Testimonies History */}
          {testimonials.length > 0 && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-[#0E3589]" />
                  <h3 className="font-extrabold text-base text-slate-900">
                    {parentPortalProperties.testimony.myTestimoniesTitle} ({testimonials.length})
                  </h3>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Featured on Academy Showcase ✓
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {testimonials.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex text-amber-400">
                        {Array.from({ length: item.rating }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full">
                          {item.beforeAfterTag || 'Featured'}
                        </span>
                        <button
                          onClick={() => handleDeleteTestimony(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                          title="Delete testimony"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {item.title && (
                      <h4 className="font-bold text-xs text-slate-900">
                        {item.title}
                      </h4>
                    )}

                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      "{item.review}"
                    </p>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>By {item.parentName} ({item.relationship || 'Parent'})</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ATTENDANCE CALENDAR TRACKER                                            */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <AttendanceCalendarTracker
          attendance={attendance}
          student={student}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. FEE RECEIPTS LEDGER                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'fees' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">Fee Ledger &amp; Receipts</h2>
              <p className="text-xs text-slate-500">
                Month-wise coaching fees and receipts settled in-person at academy reception or via UPI.
              </p>
            </div>
            <div className="text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full font-bold border border-emerald-200">
              ₹1,600 Coaching Fee • In-Person Reception Settlement
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Milestone / Month</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Receipt No</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Fee Amount</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Payment Method</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No fee receipts recorded yet.
                    </td>
                  </tr>
                ) : (
                  fees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">{fee.date || fee.paidDate || '—'}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{fee.milestone || fee.yearMonth || fee.period || 'Current Milestone'}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0E3589]">{fee.receiptNumber || fee.receiptNo || '—'}</td>
                      <td className="py-3.5 px-4 font-black text-emerald-800 text-sm">₹{fee.amount || 1600}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            fee.isPaid || fee.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {fee.isPaid || fee.status === 'Paid' ? 'Paid' : 'Pending / Due'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        <div>{fee.paymentMethod || 'In-Person Reception'}</div>
                        {fee.paidDate && <div className="text-[11px] text-slate-400">Paid on {fee.paidDate}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium text-xs max-w-[220px]">
                        {fee.notes ? (
                          <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 font-medium text-[11px] max-w-[200px]" title={fee.notes}>
                            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{fee.notes}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
