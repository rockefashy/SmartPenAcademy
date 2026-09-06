import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Star, 
  Trophy, 
  ShieldCheck, 
  BookOpen, 
  Calendar, 
  Users, 
  PenTool, 
  Award, 
  Smile, 
  Target,
  ClipboardCheck,
  Type,
  AlignJustify,
  FileText,
  Gauge,
  ChevronRight,
  Clock,
  MapPin,
  Check,
  Zap,
  MessageSquareQuote
} from 'lucide-react';
import { landingProperties } from '../properties/landing.properties';
import { commonProperties } from '../properties/common.properties';
import { SmartPenLogo } from '../components/SmartPenLogo';
import { HeroAgentPanel } from '../components/HeroAgentPanel';
import { ChatMessage } from '../components/SmartPenAIAgentCore';
import { api } from '../services/api';
import { Testimonial, User, StudentProfile } from '../types';

interface LandingPageProps {
  onNavigate: (view: string, extraId?: string, defaultSection?: number) => void;
  onOpenLogin: () => void;
  onOpenDemoBooking?: () => void;
  currentUser?: User | null;
  currentStudent?: StudentProfile | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onNavigate, 
  onOpenLogin, 
  onOpenDemoBooking, 
  currentUser,
  currentStudent,
  messages,
  setMessages 
}) => {
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [liveTestimonials, setLiveTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    api.getTestimonials()
      .then((data) => {
        if (data && data.length > 0) {
          setLiveTestimonials(data);
        }
      })
      .catch((err) => {
        console.log('Using default landing testimonials:', err);
      });
  }, []);

  const handleDemoClick = () => {
    if (onOpenDemoBooking) {
      onOpenDemoBooking();
    } else {
      onNavigate('enroll');
    }
  };

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'ClipboardCheck': return <ClipboardCheck className="w-5 h-5" />;
      case 'Type': return <Type className="w-5 h-5" />;
      case 'AlignJustify': return <AlignJustify className="w-5 h-5" />;
      case 'FileText': return <FileText className="w-5 h-5" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5" />;
      case 'Gauge': return <Gauge className="w-5 h-5" />;
      case 'Trophy': return <Trophy className="w-5 h-5" />;
      default: return <BookOpen className="w-5 h-5" />;
    }
  };

  const getBenefitIcon = (iconName: string) => {
    switch (iconName) {
      case 'PenTool': return <PenTool className="w-6 h-6 text-blue-600" />;
      case 'Award': return <Award className="w-6 h-6 text-amber-600" />;
      case 'Smile': return <Smile className="w-6 h-6 text-emerald-600" />;
      case 'Target': return <Target className="w-6 h-6 text-rose-600" />;
      default: return <Star className="w-6 h-6 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-20 overflow-hidden font-sans">
      {/* 1. HERO SECTION (SPLIT 2-COLUMN WITH EMBEDDED AI ASSISTANT WINDOW) */}
      <section className="relative pt-4 sm:pt-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Background Subtle Gradient Blobs */}
        <div className="absolute top-10 left-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Academy Value Proposition & CTAs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 space-y-6 text-left"
          >
            {/* Top Category Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#F46E20]" />
                Next-Gen Handwriting Coaching
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-[1.18] tracking-tight">
              {landingProperties.hero.titlePrefix}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20]">
                {landingProperties.hero.titleHighlight}
              </span>{' '}
              {landingProperties.hero.titleSuffix}
            </h1>

            {/* Description */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans max-w-xl">
              {landingProperties.hero.description}
            </p>

            {/* Key Pill Tags */}
            <div className="flex flex-wrap gap-2 pt-1">
              {landingProperties.hero.featuresPill.map((pill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-full border border-slate-200 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{pill}</span>
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                onClick={handleDemoClick}
                className="px-6 sm:px-8 py-3.5 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 transition-all transform hover:-translate-y-0.5 flex items-center gap-2.5 cursor-pointer"
                id="btn-hero-demo-booking"
              >
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span>{landingProperties.hero.ctaSecondary}</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('syllabus-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    onNavigate('landing');
                  }
                }}
                className="px-5 sm:px-6 py-3.5 bg-white hover:bg-slate-50 text-[#0E3589] font-bold text-sm sm:text-base rounded-2xl border-2 border-[#0E3589]/30 hover:border-[#0E3589] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                id="btn-hero-explore-curriculum"
              >
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#0E3589]" />
                <span>Explore Curriculum</span>
              </button>
            </div>

            {/* Trust Mini-Bar */}
            <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>1:1 Attention Guaranteed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Flexible Slots (4–7 PM)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                <span>Accredited Certification</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Integrated SmartPen AI Agent Window */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-5 w-full"
          >
            <HeroAgentPanel 
              onNavigate={onNavigate} 
              currentUser={currentUser}
              currentStudent={currentStudent}
              onOpenDemoBooking={onOpenDemoBooking}
              messages={messages}
              setMessages={setMessages}
            />
          </motion.div>
        </div>
      </section>

      {/* 2. SYLLABUS / CURRICULUM SECTION (7-Step Progressive Training Programme) */}
      <section id="syllabus-section" className="scroll-mt-24 sm:scroll-mt-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-[#F46E20]" />
            {landingProperties.syllabusSection.tag}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
            {landingProperties.syllabusSection.title}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
            {landingProperties.syllabusSection.subtitle}
          </p>
          <div className="pt-1">
            <span className="px-5 py-1.5 bg-gradient-to-r from-[#0E3589] to-[#0084F4] text-white font-extrabold text-xs uppercase tracking-widest rounded-full shadow-xs">
              {landingProperties.syllabusSection.motto}
            </span>
          </div>
        </div>

        {/* Interactive 7 Modules Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {landingProperties.syllabusSection.modules.map((module, index) => {
            const isHighlighted = index === 0 || index === 6;

            return (
              <motion.div
                key={index}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className={`bg-white rounded-3xl p-6 border-2 transition-all shadow-md flex flex-col justify-between relative overflow-hidden ${
                  isHighlighted
                    ? 'border-[#0E3589] shadow-blue-500/10'
                    : 'border-slate-200/80 hover:border-blue-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-9 h-9 rounded-2xl bg-[#0E3589] text-white flex items-center justify-center font-black text-sm shadow-md">
                      {module.number}
                    </span>
                    <div className="p-2 rounded-xl bg-blue-50 text-[#0E3589]">
                      {getModuleIcon(module.icon)}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    {module.title}
                  </h3>

                  <ul className="space-y-2 text-xs text-slate-600">
                    {module.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F46E20] shrink-0 mt-1.5" />
                        <span className="leading-relaxed font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#0E3589] font-bold">
                  <span>SmartPen Milestone {module.number}</span>
                  <span className="text-slate-400 font-sans">Module Verified ✓</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Syllabus Footer Motto Banner */}
        <div className="mt-8 p-5 bg-gradient-to-r from-blue-50 via-white to-orange-50 border-2 border-blue-100 rounded-3xl text-center shadow-xs">
          <p className="text-sm sm:text-base font-extrabold text-[#0E3589]">
            {landingProperties.syllabusSection.footerBanner}
          </p>
        </div>
      </section>

      {/* 3. SPECIALIZED WORKSHOPS SECTION */}
      <section id="workshops-section" className="scroll-mt-24 sm:scroll-mt-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-[#0E3589] via-[#0B2A70] to-[#123E99] rounded-3xl p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden">
          {/* Decorative Sparkle Blobs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              {landingProperties.adsAndWorkshopsSection.tag}
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
              {landingProperties.adsAndWorkshopsSection.title}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl">
              {landingProperties.adsAndWorkshopsSection.subtitle}
            </p>
          </div>

          {/* Workshop Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {landingProperties.adsAndWorkshopsSection.workshops.map((ws) => (
              <div
                key={ws.id}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col justify-between hover:bg-white/15 transition-all space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded-full shadow-xs">
                      {ws.badge}
                    </span>
                    <span className="text-[11px] text-blue-200 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-orange-300" />
                      {ws.duration}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-lg text-white leading-tight mb-1">
                    {ws.title}
                  </h3>
                  <p className="text-xs text-blue-100 leading-snug mb-3">
                    {ws.subtitle}
                  </p>

                  <div className="p-2.5 bg-black/20 rounded-xl mb-3 space-y-1 text-xs">
                    <p className="text-[11px] text-amber-200 font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {ws.date}
                    </p>
                    <p className="text-[11px] text-blue-100 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {ws.ageGroup}
                    </p>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-200">
                    {ws.highlights.map((hl, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={handleDemoClick}
                  className="w-full py-2.5 bg-white text-[#0E3589] hover:bg-blue-50 font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <span>Inquire via Demo / Assessment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. STUDENTS WILL BENEFIT BY (4 Core Cards) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            {landingProperties.benefitsSection.tag}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
            {landingProperties.benefitsSection.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-sans">
            {landingProperties.benefitsSection.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {landingProperties.benefitsSection.cards.map((b, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md hover:shadow-xl transition-all flex flex-col justify-between text-left group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {getBenefitIcon(b.icon)}
                  </div>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                    {b.badge}
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-slate-900 mb-2">
                  {b.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
                  {b.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-[11px] text-[#F46E20] font-bold">
                <span>Guaranteed Result</span>
                <Check className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. TESTIMONIALS SECTION */}
      <section id="testimonials-section" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24 sm:scroll-mt-28">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
            <Smile className="w-3.5 h-3.5" />
            {landingProperties.testimonialsSection.tag}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
            {landingProperties.testimonialsSection.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-sans">
            {landingProperties.testimonialsSection.subtitle}
          </p>
        </div>

        {liveTestimonials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {liveTestimonials.slice(0, 6).map((rev, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex text-amber-400">
                      {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400" />
                      ))}
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                      {rev.beforeAfterTag || 'Featured'}
                    </span>
                  </div>

                  {rev.title && (
                    <h4 className="font-extrabold text-xs text-slate-900 line-clamp-1">
                      "{rev.title}"
                    </h4>
                  )}

                  <p className="text-xs text-slate-700 leading-relaxed italic font-sans font-medium line-clamp-4">
                    "{rev.review}"
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#0E3589] text-white flex items-center justify-center font-black text-xs">
                      {rev.studentName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{rev.studentName}</h4>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {rev.grade || 'Student'} • {rev.parentName}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 text-center max-w-xl mx-auto space-y-3">
            <Smile className="w-10 h-10 text-[#F46E20] mx-auto opacity-80" />
            <h4 className="text-base font-extrabold text-slate-800">
              Student Handwriting Transformation Stories
            </h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Parent reviews and verified before-and-after handwriting transformations will be showcased here as enrolled parents submit reviews through the portal.
            </p>
          </div>
        )}

        {/* Share testimony prompt for enrolled parents */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              if (currentUser && currentUser.role === 'student') {
                onNavigate('parentPortal', currentUser.studentId, 'testimony' as any);
              } else {
                onNavigate('parentPortal', undefined, 'testimony' as any);
                onOpenLogin();
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#F46E20] font-bold text-xs rounded-full transition-all cursor-pointer shadow-2xs"
            id="btn-landing-add-testimony"
          >
            <MessageSquareQuote className="w-4 h-4" />
            <span>Enrolled Parent? Add your child's testimony in the Parent Portal →</span>
          </button>
        </div>
      </section>

      {/* 7. CALL TO ACTION BOTTOM BANNER */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-[#F46E20] via-[#FF8C38] to-[#F46E20] rounded-3xl p-8 sm:p-12 text-white shadow-2xl text-center space-y-6 relative overflow-hidden">
          <h2 className="text-3xl sm:text-4xl font-black">
            Ready to Transform Your Child's Handwriting?
          </h2>
          <p className="text-sm sm:text-base text-orange-100 max-w-2xl mx-auto font-sans leading-relaxed">
            Join thousands of happy learners who gained confidence, neatness, and exam excellence at SmartPen Academy. Book your complimentary Free Demo Class (All days 4–7 PM) with Mrs. Deepthy Rock today!
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button
              onClick={handleDemoClick}
              className="px-8 py-4 bg-[#0E3589] hover:bg-[#07205c] text-white font-extrabold text-base rounded-2xl shadow-xl transition-all cursor-pointer flex items-center gap-2"
              id="btn-cta-demo-footer"
            >
              <Clock className="w-5 h-5" />
              <span>Book for a Free Demo Class</span>
            </button>
            <button
              onClick={() => onOpenLogin()}
              className="px-6 py-4 bg-white/20 hover:bg-white/30 text-white font-bold text-base rounded-2xl backdrop-blur-sm border border-white/40 transition-all cursor-pointer"
              id="btn-cta-portal-signin"
            >
              Sign In to Portal
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
