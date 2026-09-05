import React from 'react';
import { 
  Trophy, 
  Smile, 
  Heart, 
  CheckCircle2, 
  Home, 
  PenTool, 
  Ruler, 
  AlignLeft, 
  Edit3, 
  Star,
  Mail,
  Calendar,
  User,
  BookOpen,
  Image as ImageIcon
} from 'lucide-react';
import { ProgressReport, StudentProfile } from '../types';
import { StarRating } from './StarRating';

interface ProgressReportCardProps {
  report: ProgressReport;
  student?: StudentProfile;
  onEmail?: () => void;
  onDelete?: () => void;
  isEmailing?: boolean;
}

export const ProgressReportCard: React.FC<ProgressReportCardProps> = ({
  report,
  student,
  onEmail,
  onDelete,
  isEmailing = false,
}) => {
  const getSkillIcon = (key: string) => {
    switch (key) {
      case 'letterFormation':
        return <Edit3 className="w-4 h-4 text-blue-600" />;
      case 'letterSizeSpacing':
        return <Ruler className="w-4 h-4 text-amber-600" />;
      case 'lineAlignment':
        return <AlignLeft className="w-4 h-4 text-emerald-600" />;
      case 'pencilControl':
        return <PenTool className="w-4 h-4 text-indigo-600" />;
      default:
        return <Star className="w-4 h-4 text-orange-600" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border-4 border-[#0E3589]/20 overflow-hidden font-sans">
      {/* Top Action Bar (if admin actions exist) */}
      {(onEmail || onDelete) && (
        <div className="bg-slate-800 text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300 font-semibold">
            <span>Progress Report</span>
          </div>
          <div className="flex items-center gap-2">
            {onEmail && (
              <button
                onClick={onEmail}
                disabled={isEmailing}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isEmailing ? 'Dispatching Email...' : 'Email to Parent'}</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-semibold rounded-xl transition-all"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Report Container */}
      <div className="p-6 sm:p-10 space-y-6 bg-gradient-to-b from-blue-50/30 via-white to-orange-50/20">
        {/* Clean Header: Heading as 'Progress Report', 'After 10 Classes' */}
        <div className="text-center space-y-1 pb-4 border-b-2 border-blue-100">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0E3589] tracking-tight">
            Progress Report
          </h2>
          <p className="text-base sm:text-lg font-bold text-[#F46E20]">
            {report.milestoneTitle || "After 10 Classes"}
          </p>
        </div>

        {/* Student Info Top Grid (3 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Student Name */}
          <div className="bg-white border-2 border-blue-100 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-full bg-[#0E3589] text-white flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Student Name
              </p>
              <p className="text-base font-extrabold text-[#0E3589] truncate">
                {student?.displayName || "Khwaish"}
              </p>
            </div>
          </div>

          {/* Card 2: Evaluation Date */}
          <div className="bg-white border-2 border-blue-100 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-full bg-[#0084F4] text-white flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Evaluation Date
              </p>
              <p className="text-base font-extrabold text-slate-800">
                {report.reportDate || "August 2026"}
              </p>
            </div>
          </div>

          {/* Card 3: Completed Classes */}
          <div className="bg-white border-2 border-blue-100 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-full bg-[#F46E20] text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Completed Classes
              </p>
              <p className="text-base font-extrabold text-[#F46E20]">
                {report.completedClasses} out of {report.totalClasses || 12}
              </p>
            </div>
          </div>
        </div>

        {/* Skill Improvement Table */}
        <div className="bg-white rounded-2xl border-2 border-blue-100 overflow-hidden shadow-xs">
          <div className="bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#0E3589] text-white py-2.5 px-4 text-center font-extrabold text-xs uppercase tracking-wider">
            SKILL IMPROVEMENT (BEFORE ➔ AFTER)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-blue-50/70 border-b border-blue-100 text-[#0E3589] font-bold text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4 w-1/4">SKILL</th>
                  <th className="py-3 px-4 w-1/4 text-center">BEFORE (CLASS 1)</th>
                  <th className="py-3 px-4 w-1/4 text-center bg-emerald-50/80 text-emerald-800">
                    AFTER ({report.milestoneTitle || "10 CLASSES"})
                  </th>
                  <th className="py-3 px-4 w-1/4">PROGRESS NOTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.skills?.map((skill, index) => (
                  <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                      <span className="p-1 rounded-md bg-slate-100">
                        {getSkillIcon(skill.skillKey)}
                      </span>
                      <span>{skill.skillName}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StarRating value={skill.beforeStars} readOnly size="sm" />
                    </td>
                    <td className="py-3 px-4 text-center bg-emerald-50/40">
                      <StarRating value={skill.afterStars} readOnly size="sm" />
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium text-[11px] leading-relaxed">
                      {skill.progressNote}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overall Progress Banner */}
        <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-600 flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                OVERALL PROGRESS
              </p>
              <div className="mt-0.5">
                <StarRating value={Math.round(report.overallStars)} readOnly size="md" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-right sm:text-left">
            <p className="text-xs sm:text-sm font-extrabold text-slate-800">
              {report.overallRemark || "Significant improvement within star range. Keep practicing!"}
            </p>
            <Smile className="w-6 h-6 text-amber-500 shrink-0" />
          </div>
        </div>

        {/* Optional Before & After Writing Works Comparison */}
        {(report.beforePhotoData || report.afterPhotoData) && (
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E3589]">
              <ImageIcon className="w-4 h-4 text-[#F46E20]" />
              <span>Writing Transformation Samples Attached</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {report.beforePhotoData && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-600">
                    <span>Baseline Sample (Before)</span>
                    <span className="text-slate-400">Class 1</span>
                  </div>
                  <div className="border border-rose-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <img
                      src={report.beforePhotoData}
                      alt="Before sample"
                      className="w-full h-44 object-contain bg-slate-50"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}

              {report.afterPhotoData && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600">
                    <span>Transformed Sample (After)</span>
                    <span className="text-slate-400">{report.milestoneTitle || "Class 10"}</span>
                  </div>
                  <div className="border border-emerald-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <img
                      src={report.afterPhotoData}
                      alt="After sample"
                      className="w-full h-44 object-contain bg-slate-50"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teacher's Feedback */}
        <div className="bg-blue-50/60 border-2 border-blue-100 rounded-2xl p-5 relative">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0E3589]">
              TEACHER'S FEEDBACK
            </h4>
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic font-sans font-medium">
            "{report.teacherFeedback}"
          </p>
        </div>

        {/* Next Steps & Practice Slogan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="bg-emerald-50/60 border-2 border-emerald-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-emerald-800 mb-2.5">
              <Home className="w-4 h-4 text-emerald-600" />
              <span>NEXT STEPS</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
              {report.nextSteps?.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-r from-emerald-100/60 to-orange-100/60 border-2 border-amber-200 rounded-2xl p-6 text-center space-y-1">
            <p className="text-2xl font-bold font-handwriting text-emerald-800">
              Practice today,
            </p>
            <p className="text-3xl font-extrabold font-handwriting text-[#F46E20]">
              Progress tomorrow! ★
            </p>
          </div>
        </div>

        {/* Footer Banner */}
        <div className="text-center pt-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0E3589] bg-white px-4 py-1.5 rounded-full border border-blue-200 shadow-xs">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>Thank you for your trust and support!</span>
          </div>
        </div>
      </div>
    </div>
  );
};
