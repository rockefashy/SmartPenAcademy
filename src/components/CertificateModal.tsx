import React, { useState } from 'react';
import { 
  Award, 
  Printer, 
  Download, 
  Share2, 
  Sparkles, 
  X, 
  Check, 
  Palette, 
  Edit3, 
  Eye, 
  ShieldCheck,
  Mail,
  Copy
} from 'lucide-react';
import { ProgressReport, StudentProfile } from '../types';
import { 
  StarAchieverCertificate, 
  CertificateTheme, 
  CertificateCustomOptions 
} from './StarAchieverCertificate';
import { certificateProperties } from '../properties/certificate.properties';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: ProgressReport | null;
  student: StudentProfile;
  onEmail?: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  report,
  student,
  onEmail,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'customize'>('preview');
  const [copied, setCopied] = useState(false);

  // Customization state
  const [theme, setTheme] = useState<CertificateTheme>('navyGold');
  const [awardTitle, setAwardTitle] = useState<string>(certificateProperties.defaultTitle);
  const [milestoneTitle, setMilestoneTitle] = useState<string>(
    report?.milestoneTitle || '10-Class Handwriting Transformation'
  );
  const [issueDate, setIssueDate] = useState<string>(
    report?.reportDate || new Date().toISOString().split('T')[0]
  );
  const [customCitation, setCustomCitation] = useState<string>(
    report?.overallRemark 
      ? `For demonstrating exceptional ${report.overallStars}★ Star penmanship mastery during the ${report.milestoneTitle || 'Handwriting Coaching Program'}, achieving remarkable progress in letter formation, symmetry, and writing speed.`
      : certificateProperties.defaultCitation
  );
  const [includeSkills, setIncludeSkills] = useState<boolean>(true);
  const [includeSeal, setIncludeSeal] = useState<boolean>(true);

  if (!isOpen) return null;

  const certificateOptions: CertificateCustomOptions = {
    theme,
    awardTitle,
    milestoneTitle,
    issueDate,
    customCitation,
    includeSkills,
    includeSeal,
  };

  const handlePrint = () => {
    // Add print helper class or trigger window.print
    window.print();
  };

  const handleCopyCitation = () => {
    const text = `🏆 SmartPen Academy - Star Achiever Award\nStudent: ${student.displayName}\nAward: ${awardTitle}\nMilestone: ${milestoneTitle}\nRating: ${report?.overallStars || 5} Stars ★★★★★\nCitation: "${customCitation}"\nCoach: Mrs. Deepthy Rock, SmartPen Academy`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleResetToDefault = () => {
    setTheme('navyGold');
    setAwardTitle(certificateProperties.defaultTitle);
    setMilestoneTitle(report?.milestoneTitle || '10-Class Handwriting Transformation');
    setIssueDate(report?.reportDate || new Date().toISOString().split('T')[0]);
    setCustomCitation(
      report?.overallRemark 
        ? `For demonstrating exceptional ${report.overallStars || 5}★ Star penmanship mastery during the ${report?.milestoneTitle || 'Handwriting Coaching Program'}, achieving remarkable progress in letter formation, symmetry, and writing speed.`
        : certificateProperties.defaultCitation
    );
    setIncludeSkills(true);
    setIncludeSeal(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm font-sans print:p-0 print:bg-white print:static print:inset-auto">
      <div className="min-h-full w-full flex items-center justify-center p-2 sm:p-4 text-center">
        {/* Container - hide during print if printing specific element, or make print full size */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] text-left my-auto print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Top Header Bar (Hidden in Print) */}
        <div className="bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] text-white px-5 py-4 flex items-center justify-between gap-4 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black">{certificateProperties.modal.title}</h2>
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full uppercase">
                  Official Award
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                Conferred to <strong className="text-white">{student.displayName}</strong> ({student.gradeClass} • {student.schoolName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white hover:bg-amber-100 text-[#0E3589] text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#F46E20]" />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector & Quick Action Bar (Hidden in Print) */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-[#0E3589] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{certificateProperties.modal.previewTab}</span>
            </button>
            <button
              onClick={() => setActiveTab('customize')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'customize'
                  ? 'bg-white text-[#0E3589] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-[#F46E20]" />
              <span>{certificateProperties.modal.customizeTab}</span>
            </button>
          </div>

          {/* Theme Quick Buttons in bar */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 hidden md:inline">Theme:</span>
            <div className="flex items-center gap-1.5">
              <button
                title="Royal Navy & Gold"
                onClick={() => setTheme('navyGold')}
                className={`w-6 h-6 rounded-full bg-[#0E3589] border-2 transition-transform cursor-pointer ${
                  theme === 'navyGold' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
              <button
                title="Emerald Distinction"
                onClick={() => setTheme('emeraldGold')}
                className={`w-6 h-6 rounded-full bg-[#065F46] border-2 transition-transform cursor-pointer ${
                  theme === 'emeraldGold' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
              <button
                title="Crimson Prestige"
                onClick={() => setTheme('crimsonGold')}
                className={`w-6 h-6 rounded-full bg-[#881337] border-2 transition-transform cursor-pointer ${
                  theme === 'crimsonGold' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
              <button
                title="Golden Sunshine"
                onClick={() => setTheme('amberWarm')}
                className={`w-6 h-6 rounded-full bg-[#EA580C] border-2 transition-transform cursor-pointer ${
                  theme === 'amberWarm' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
            </div>

            <div className="h-4 w-[1px] bg-slate-300 mx-1" />

            <button
              onClick={handleCopyCitation}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Area */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100 flex-1 print:p-0 print:bg-white print:overflow-visible">
          {activeTab === 'preview' ? (
            <div className="flex flex-col items-center justify-center space-y-4 print:space-y-0">
              <div className="w-full max-w-4xl bg-white p-2 rounded-xl shadow-lg border border-slate-200 print:shadow-none print:border-none print:p-0">
                <StarAchieverCertificate
                  report={report}
                  student={student}
                  options={certificateOptions}
                />
              </div>

              {/* Helpful Printing Tip */}
              <div className="flex flex-wrap items-center justify-between w-full max-w-4xl px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 print:hidden gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Print Tip:</strong> Select <strong>Landscape</strong> orientation in your browser print dialogue for best framing results.
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('customize')}
                  className="text-xs font-bold text-[#0E3589] hover:underline cursor-pointer"
                >
                  Customise Citation &amp; Title →
                </button>
              </div>
            </div>
          ) : (
            /* Customization Form */
            <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-md space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {certificateProperties.modal.customizeTab}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fine-tune the certificate wording, designation, and displayed badges.
                  </p>
                </div>
                <button
                  onClick={handleResetToDefault}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Award Title */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    {certificateProperties.modal.awardTitleLabel}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {certificateProperties.awardTitles.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAwardTitle(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          awardTitle === t
                            ? 'bg-[#0E3589] text-white border-[#0E3589]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={awardTitle}
                    onChange={(e) => setAwardTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0E3589] outline-hidden"
                  />
                </div>

                {/* Milestone Batch */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {certificateProperties.modal.milestoneLabel}
                  </label>
                  <input
                    type="text"
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                    placeholder="e.g. 10-Class Handwriting Transformation"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0E3589] outline-hidden"
                  />
                </div>

                {/* Date of Conferral */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {certificateProperties.modal.issueDateLabel}
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0E3589] outline-hidden"
                  />
                </div>

                {/* Citation Paragraph */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    {certificateProperties.modal.citationLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={customCitation}
                    onChange={(e) => setCustomCitation(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0E3589] outline-hidden leading-relaxed"
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-2 sm:col-span-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSkills}
                      onChange={(e) => setIncludeSkills(e.target.checked)}
                      className="w-4 h-4 text-[#0E3589] rounded border-slate-300 focus:ring-[#0E3589]"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      {certificateProperties.modal.includeSkillsLabel} (Letter Formation, Spacing, Baseline)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSeal}
                      onChange={(e) => setIncludeSeal(e.target.checked)}
                      className="w-4 h-4 text-[#0E3589] rounded border-slate-300 focus:ring-[#0E3589]"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      {certificateProperties.modal.includeBadgeLabel} (Official Gold Foil Rosette)
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setActiveTab('preview')}
                  className="px-5 py-2.5 bg-[#0E3589] hover:bg-[#08225e] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Certificate with Changes</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Action Bar (Hidden in Print) */}
        <div className="bg-white border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Official SmartPen Academy Certified Pedagogical Award</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {certificateProperties.modal.closeBtn}
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-gradient-to-r from-[#0E3589] to-[#0084F4] hover:opacity-90 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>{certificateProperties.modal.printBtn}</span>
            </button>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
};
