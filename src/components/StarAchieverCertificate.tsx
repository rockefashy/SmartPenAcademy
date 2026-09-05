import React from 'react';
import { 
  Star, 
  Award, 
  Sparkles, 
  CheckCircle, 
  ShieldCheck, 
  PenTool, 
  Ruler, 
  AlignLeft, 
  Edit3,
  Feather
} from 'lucide-react';
import { ProgressReport, StudentProfile, SkillRating } from '../types';
import { certificateProperties } from '../properties/certificate.properties';
import { SmartPenLogo } from './SmartPenLogo';

export type CertificateTheme = 'navyGold' | 'emeraldGold' | 'crimsonGold' | 'amberWarm';

export interface CertificateCustomOptions {
  theme?: CertificateTheme;
  awardTitle?: string;
  customCitation?: string;
  milestoneTitle?: string;
  issueDate?: string;
  includeSkills?: boolean;
  includeSeal?: boolean;
  certificateNumber?: string;
}

interface StarAchieverCertificateProps {
  report?: ProgressReport | null;
  student: StudentProfile;
  options?: CertificateCustomOptions;
}

export const StarAchieverCertificate: React.FC<StarAchieverCertificateProps> = ({
  report,
  student,
  options = {} as CertificateCustomOptions,
}) => {
  const theme = options.theme || 'navyGold';
  const awardTitle = options.awardTitle || certificateProperties.defaultTitle;
  const milestone = options.milestoneTitle || report?.milestoneTitle || '10-Class Handwriting Transformation';
  const issueDate = options.issueDate || report?.reportDate || new Date().toISOString().split('T')[0];
  const includeSkills = options.includeSkills !== undefined ? options.includeSkills : true;
  const includeSeal = options.includeSeal !== undefined ? options.includeSeal : true;
  const overallStars = report?.overallStars || 5;

  const defaultCitation = report?.overallRemark
    ? `For demonstrating ${overallStars}★ Star excellence during the ${milestone}, achieving remarkable advancement in handwriting mechanics, letter symmetry, and penmanship discipline.`
    : certificateProperties.defaultCitation;

  const citation = options.customCitation || defaultCitation;

  // Certificate ID
  const certId = options.certificateNumber || `SPA-${student.id.slice(0, 6).toUpperCase()}-${(report?.id || 'CERT').slice(-4).toUpperCase()}-${new Date(issueDate).getFullYear()}`;

  // Theme styling configurations
  const themeConfig = {
    navyGold: {
      primaryBg: 'bg-white',
      outerBorder: 'border-[#0E3589]',
      innerBorder: 'border-[#D97706]',
      accentBg: 'bg-[#0E3589]',
      accentText: 'text-[#0E3589]',
      goldText: 'text-[#B45309]',
      goldGradient: 'from-[#F59E0B] via-[#D97706] to-[#B45309]',
      sealBg: 'from-[#F59E0B] via-[#D97706] to-[#92400E]',
      sealBorder: 'border-amber-300',
      watermarkText: 'text-[#0E3589]/5',
      cornerColor: 'text-[#D97706]',
      pillBg: 'bg-blue-50/80 border-blue-200 text-blue-900',
    },
    emeraldGold: {
      primaryBg: 'bg-white',
      outerBorder: 'border-[#065F46]',
      innerBorder: 'border-[#D97706]',
      accentBg: 'bg-[#065F46]',
      accentText: 'text-[#065F46]',
      goldText: 'text-[#B45309]',
      goldGradient: 'from-[#10B981] via-[#059669] to-[#047857]',
      sealBg: 'from-[#F59E0B] via-[#D97706] to-[#92400E]',
      sealBorder: 'border-emerald-300',
      watermarkText: 'text-[#065F46]/5',
      cornerColor: 'text-[#D97706]',
      pillBg: 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
    },
    crimsonGold: {
      primaryBg: 'bg-white',
      outerBorder: 'border-[#881337]',
      innerBorder: 'border-[#D97706]',
      accentBg: 'bg-[#881337]',
      accentText: 'text-[#881337]',
      goldText: 'text-[#B45309]',
      goldGradient: 'from-[#E11D48] via-[#BE123C] to-[#881337]',
      sealBg: 'from-[#F59E0B] via-[#D97706] to-[#92400E]',
      sealBorder: 'border-rose-300',
      watermarkText: 'text-[#881337]/5',
      cornerColor: 'text-[#D97706]',
      pillBg: 'bg-rose-50/80 border-rose-200 text-rose-900',
    },
    amberWarm: {
      primaryBg: 'bg-white',
      outerBorder: 'border-[#EA580C]',
      innerBorder: 'border-[#D97706]',
      accentBg: 'bg-[#EA580C]',
      accentText: 'text-[#EA580C]',
      goldText: 'text-[#C2410C]',
      goldGradient: 'from-[#FB923C] via-[#EA580C] to-[#C2410C]',
      sealBg: 'from-[#F59E0B] via-[#D97706] to-[#92400E]',
      sealBorder: 'border-orange-300',
      watermarkText: 'text-[#EA580C]/5',
      cornerColor: 'text-[#D97706]',
      pillBg: 'bg-orange-50/80 border-orange-200 text-orange-900',
    },
  }[theme];

  const getSkillIcon = (key: string) => {
    switch (key) {
      case 'letterFormation':
        return <Edit3 className="w-3.5 h-3.5 text-blue-600" />;
      case 'letterSizeSpacing':
        return <Ruler className="w-3.5 h-3.5 text-amber-600" />;
      case 'lineAlignment':
        return <AlignLeft className="w-3.5 h-3.5 text-emerald-600" />;
      case 'pencilControl':
        return <PenTool className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />;
    }
  };

  const skills: SkillRating[] = report?.skills || [
    { skillKey: 'letterFormation', skillName: 'Letter Formation & Geometry', beforeStars: 2, afterStars: 5, progressNote: 'Mastered' },
    { skillKey: 'letterSizeSpacing', skillName: 'Letter Uniformity & Spacing', beforeStars: 2, afterStars: 5, progressNote: 'Mastered' },
    { skillKey: 'lineAlignment', skillName: 'Line Baseline Discipline', beforeStars: 2, afterStars: 5, progressNote: 'Mastered' },
    { skillKey: 'pencilControl', skillName: 'Pencil Pressure & Posture', beforeStars: 2, afterStars: 5, progressNote: 'Mastered' },
  ];

  return (
    <div 
      id="printable-star-achiever-certificate"
      className={`certificate-printable-container relative w-full aspect-[1.414/1] max-w-[1020px] mx-auto bg-gradient-to-br from-amber-50/30 via-white to-amber-50/20 text-slate-900 rounded-none shadow-2xl p-4 sm:p-7 select-none overflow-hidden print:shadow-none print:m-0 print:p-4 print:w-full print:max-w-none print:h-auto print:border-none`}
      style={{
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Background Watermark Crest */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${themeConfig.watermarkText} z-0 overflow-hidden`}>
        <div className="text-center transform rotate-[-12deg] scale-150 opacity-40">
          <Feather className="w-96 h-96 mx-auto stroke-[0.75]" />
          <p className="font-serif font-black tracking-widest text-4xl mt-2">SMARTPEN ACADEMY</p>
        </div>
      </div>

      {/* Heavy Ornate Outer Double Frame */}
      <div className={`relative z-10 w-full h-full border-4 ${themeConfig.outerBorder} p-1.5 sm:p-2 bg-white/90`}>
        <div className={`w-full h-full border-2 border-dashed ${themeConfig.innerBorder} p-4 sm:p-6 flex flex-col justify-between relative`}>
          
          {/* Corner Ornamental Accents */}
          <div className={`absolute top-2 left-2 ${themeConfig.cornerColor} flex items-center gap-0.5`}>
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-mono">✦</span>
          </div>
          <div className={`absolute top-2 right-2 ${themeConfig.cornerColor} flex items-center gap-0.5`}>
            <span className="text-[10px] font-mono">✦</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className={`absolute bottom-2 left-2 ${themeConfig.cornerColor} flex items-center gap-0.5`}>
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-mono">✦</span>
          </div>
          <div className={`absolute bottom-2 right-2 ${themeConfig.cornerColor} flex items-center gap-0.5`}>
            <span className="text-[10px] font-mono">✦</span>
            <Sparkles className="w-4 h-4" />
          </div>

          {/* Top Academy Header */}
          <div className="text-center space-y-1 pt-1">
            <div className="flex items-center justify-center gap-3">
              <div className="h-0.5 w-12 sm:w-20 bg-gradient-to-r from-transparent via-[#D97706] to-[#0E3589]" />
              <div className="flex items-center gap-2">
                <SmartPenLogo className="w-7 h-7 sm:w-9 sm:h-9" />
                <div className="text-left">
                  <span className={`text-sm sm:text-lg font-black tracking-wider ${themeConfig.accentText} uppercase block leading-tight font-serif`}>
                    {certificateProperties.header.academyName}
                  </span>
                  <span className="text-[9px] sm:text-[11px] font-bold text-amber-700 tracking-widest uppercase block">
                    {certificateProperties.header.academyTagline}
                  </span>
                </div>
              </div>
              <div className="h-0.5 w-12 sm:w-20 bg-gradient-to-l from-transparent via-[#D97706] to-[#0E3589]" />
            </div>
            
            <p className="text-[8px] sm:text-[10px] tracking-widest text-slate-500 font-semibold uppercase">
              {certificateProperties.header.subHeader}
            </p>
          </div>

          {/* Award Title Banner */}
          <div className="text-center my-1 sm:my-2 space-y-1">
            <div className="inline-flex items-center justify-center gap-1.5 px-4 py-0.5 rounded-full bg-amber-100/80 border border-amber-300">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                    i < overallStars ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                  }`} 
                />
              ))}
            </div>

            <h1 className={`text-xl sm:text-3xl lg:text-4xl font-serif font-black tracking-wider uppercase drop-shadow-xs bg-gradient-to-r ${themeConfig.goldGradient} bg-clip-text text-transparent`}>
              ★ {awardTitle} ★
            </h1>

            <p className="text-[9px] sm:text-xs font-serif italic text-slate-600 tracking-wide">
              {certificateProperties.presentedToText}
            </p>
          </div>

          {/* Student Recipient Name */}
          <div className="text-center my-1 sm:my-2">
            <div className="inline-block relative px-8 py-1">
              <h2 className={`text-2xl sm:text-4xl lg:text-5xl font-serif font-black tracking-wide ${themeConfig.accentText} uppercase`}>
                {student.displayName}
              </h2>
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#D97706] to-transparent mt-1" />
            </div>

            <p className="text-[10px] sm:text-xs font-semibold text-slate-700 mt-1 font-sans">
              Grade: <span className="font-bold text-slate-900">{student.gradeClass}</span> • {student.schoolName}
            </p>
          </div>

          {/* Citation / Commendation Paragraph */}
          <div className="max-w-2xl mx-auto text-center px-4">
            <p className="text-[10px] sm:text-xs sm:leading-relaxed text-slate-700 font-serif italic">
              "{citation}"
            </p>
          </div>

          {/* Competencies Showcase (Optional) */}
          {includeSkills && skills.length > 0 && (
            <div className="max-w-3xl mx-auto w-full my-1 sm:my-2">
              <div className="text-center mb-1">
                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {certificateProperties.skillsBadgeTitle}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                {skills.slice(0, 4).map((sk) => (
                  <div 
                    key={sk.skillKey}
                    className={`flex items-center justify-between p-1.5 rounded-lg border text-[9px] sm:text-[10px] ${themeConfig.pillBg}`}
                  >
                    <div className="flex items-center gap-1 min-w-0 pr-1">
                      {getSkillIcon(sk.skillKey)}
                      <span className="font-bold truncate">{sk.skillName.split('&')[0]}</span>
                    </div>
                    <div className="flex items-center text-amber-500 font-bold shrink-0">
                      <span>{sk.afterStars}</span>
                      <Star className="w-2.5 h-2.5 fill-amber-500 inline ml-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Signatures, Gold Foil Seal & Verification */}
          <div className="pt-2 sm:pt-4 border-t border-amber-200/80 flex items-end justify-between px-2 sm:px-6 relative">
            
            {/* Left: Issue Date & Cert ID */}
            <div className="text-left space-y-0.5">
              <p className="text-[8px] sm:text-[9px] text-slate-400 font-mono">
                CERTIFICATE ID: <span className="font-bold text-slate-700">{certId}</span>
              </p>
              <p className="text-[9px] sm:text-[11px] text-slate-600 font-serif">
                Date of Award: <strong className="text-slate-900">{issueDate}</strong>
              </p>
              <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-emerald-700 font-bold">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Verified Pedagogical Record</span>
              </div>
            </div>

            {/* Center: Gold Foil Badge & Rosette Seal */}
            {includeSeal && (
              <div className="flex flex-col items-center justify-center -mt-6">
                <div className="relative flex items-center justify-center">
                  {/* Decorative Ribbons */}
                  <div className="absolute -bottom-3 -left-2 w-4 h-8 bg-gradient-to-b from-[#B45309] to-[#78350F] transform -rotate-25 rounded-b-xs shadow-xs" />
                  <div className="absolute -bottom-3 -right-2 w-4 h-8 bg-gradient-to-b from-[#B45309] to-[#78350F] transform rotate-25 rounded-b-xs shadow-xs" />
                  
                  {/* Circular Gold Seal */}
                  <div className={`w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br ${themeConfig.sealBg} border-2 sm:border-3 ${themeConfig.sealBorder} shadow-lg flex flex-col items-center justify-center text-white text-center p-1 relative z-10`}>
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
                    <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter leading-none mt-0.5">
                      STAR
                    </span>
                    <span className="text-[6px] sm:text-[7px] font-extrabold tracking-widest text-amber-200 uppercase">
                      EXCELLENCE
                    </span>
                    <div className="flex gap-0.5 mt-0.5">
                      <Star className="w-1.5 h-1.5 text-amber-300 fill-amber-300" />
                      <Star className="w-1.5 h-1.5 text-amber-300 fill-amber-300" />
                      <Star className="w-1.5 h-1.5 text-amber-300 fill-amber-300" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right: Master Coach Signature representation */}
            <div className="text-right space-y-0.5">
              <div className="inline-block border-b-2 border-slate-700 pb-1 px-3">
                {/* Stylized Script Signature representation */}
                <span className="font-serif italic font-black text-sm sm:text-lg text-[#0E3589] tracking-wider block font-cursive">
                  Deepthy Rock
                </span>
              </div>
              <p className="text-[9px] sm:text-xs font-bold text-slate-900 font-serif">
                {certificateProperties.signatory.name}
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-sans">
                {certificateProperties.signatory.title}
              </p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
