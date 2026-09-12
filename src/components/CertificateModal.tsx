import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
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
    const text = `🏆 SmartPen Academy - Star Achiever Award\nStudent: ${student.firstName} ${student.lastName || ''}\nAward: ${awardTitle}\nMilestone: ${milestoneTitle}\nRating: ${report?.overallStars || 5} Stars ★★★★★\nCitation: "${customCitation}"\nCoach: Mrs. Deepthy Rock, SmartPen Academy`;
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      showCloseButton={false}
      className="p-0 border-0 overflow-hidden font-sans print:p-0 print:bg-white print:static print:inset-auto print:max-h-none print:shadow-none print:border-none print:rounded-none"
      bodyClassName="p-0 flex flex-col"
    >
        
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
                Conferred to <strong className="text-white">{`${student.firstName} ${student.lastName || ''}`.trim()}</strong> ({student.gradeClass} • {student.schoolName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4 text-[#F46E20]" />}
              className="bg-white hover:bg-amber-100 text-[#0E3589]"
            >
              <span className="hidden sm:inline">Print / Save PDF</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/25 text-white"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tab Selector & Quick Action Bar (Hidden in Print) */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
            <Button
              type="button"
              variant={activeTab === 'preview' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('preview')}
              leftIcon={<Eye className="w-3.5 h-3.5" />}
              className="py-1 px-3"
            >
              {certificateProperties.modal.previewTab}
            </Button>
            <Button
              type="button"
              variant={activeTab === 'customize' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('customize')}
              leftIcon={<Edit3 className="w-3.5 h-3.5 text-[#F46E20]" />}
              className="py-1 px-3"
            >
              {certificateProperties.modal.customizeTab}
            </Button>
          </div>

          {/* Theme Quick Buttons in bar */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 hidden md:inline">Theme:</span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Royal Navy & Gold"
                onClick={() => setTheme('navyGold')}
                className={`w-6 h-6 min-h-[36px] min-w-[36px] rounded-full bg-[#0E3589] border-2 ${
                  theme === 'navyGold' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Emerald Distinction"
                onClick={() => setTheme('emeraldGold')}
                className={`w-6 h-6 min-h-[36px] min-w-[36px] rounded-full bg-[#065F46] border-2 ${
                  theme === 'emeraldGold' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Crimson Prestige"
                onClick={() => setTheme('crimsonGold')}
                className={`w-6 h-6 min-h-[36px] min-w-[36px] rounded-full bg-[#881337] border-2 ${
                  theme === 'crimsonGold' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Golden Sunshine"
                onClick={() => setTheme('amberWarm')}
                className={`w-6 h-6 min-h-[36px] min-w-[36px] rounded-full bg-[#EA580C] border-2 ${
                  theme === 'amberWarm' ? 'scale-115 border-amber-400 ring-2 ring-amber-200' : 'border-white hover:scale-105'
                }`}
              />
            </div>

            <div className="h-4 w-[1px] bg-slate-300 mx-1" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCitation}
              leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              className="py-1 px-2.5"
            >
              {copied ? 'Copied!' : 'Copy Text'}
            </Button>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('customize')}
                  className="text-xs font-bold text-[#0E3589] hover:underline"
                >
                  Customise Citation &amp; Title →
                </Button>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToDefault}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Reset Defaults
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Award Title */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    {certificateProperties.modal.awardTitleLabel}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {certificateProperties.awardTitles.map((t) => (
                      <Button
                        key={t}
                        type="button"
                        variant={awardTitle === t ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setAwardTitle(t)}
                        className="py-1 px-2.5 text-xs"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                  <Input
                    type="text"
                    value={awardTitle}
                    onChange={(e) => setAwardTitle(e.target.value)}
                  />
                </div>

                <Input
                  label={certificateProperties.modal.milestoneLabel}
                  type="text"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="e.g. 10-Class Handwriting Transformation"
                />

                <Input
                  label={certificateProperties.modal.issueDateLabel}
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />

                <div className="sm:col-span-2">
                  <Textarea
                    label={certificateProperties.modal.citationLabel}
                    rows={3}
                    value={customCitation}
                    onChange={(e) => setCustomCitation(e.target.value)}
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
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setActiveTab('preview')}
                  leftIcon={<Eye className="w-4 h-4" />}
                >
                  Preview Certificate with Changes
                </Button>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              {certificateProperties.modal.closeBtn}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4 text-amber-300" />}
            >
              {certificateProperties.modal.printBtn}
            </Button>
          </div>
        </div>

    </Modal>
  );
};
