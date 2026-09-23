import React from 'react';
import { Button } from '../components/ui/Button';
import {
  Sparkles,
  Award,
  Heart,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  GraduationCap,
  Compass,
  FileText,
  Star
} from 'lucide-react';
import { commonProperties } from '../properties/common.properties';

interface AboutUsPageProps {
  onNavigate: (view: string) => void;
  onOpenDemoBooking?: () => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate, onOpenDemoBooking }) => {
  const handleBooking = () => {
    if (onOpenDemoBooking) {
      onOpenDemoBooking();
    } else {
      onNavigate('free-demo');
    }
  };

  return (
    <div className="space-y-12 sm:space-y-20 pb-16 sm:pb-24 overflow-hidden font-sans">
      {/* 1. TOP HERO BANNER */}
      <section className="relative pt-4 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#F46E20]" />
            <span>Our Story &amp; Pedagogical Vision</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
            Inspiring Confidence Through the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20]">
              Art &amp; Science of Handwriting
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-sans">
            SmartPen Academy was founded to turn handwriting from an agonizing daily struggle into a joyful lifelong craft of clarity, speed, and genuine academic pride.
          </p>
        </div>
      </section>

      {/* 2. FOUNDER IN-DEPTH SHOWCASE CARD */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900 via-[#0E3589] to-slate-950 rounded-3xl p-8 sm:p-14 text-white shadow-2xl overflow-hidden relative border border-slate-800">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#F46E20]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            {/* Left: Founder Photo / Credential Card */}
            <div className="lg:col-span-4 text-center space-y-4">
              <div className="relative inline-block">
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-4 border-orange-400 shadow-2xl mx-auto bg-slate-800 flex items-center justify-center relative">
                  <img
                    src="/app_images/founder.png"
                    alt={commonProperties.founderName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-[#0E3589] to-[#0084F4] text-white p-4">
                    <span className="text-5xl sm:text-6xl font-black tracking-wider text-amber-300">DR</span>
                    <span className="text-xs font-bold mt-2 uppercase tracking-widest text-blue-100">{commonProperties.founderName}</span>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] text-white px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg whitespace-nowrap z-20">
                  Principal Coach
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-2xl font-black text-white">{commonProperties.founderName}</h3>
                <p className="text-xs sm:text-sm text-blue-200 font-sans mt-0.5">
                  Founder, Master Handwriting Coach &amp; Educationalist
                </p>
                
                {/* Verified Credential Badges */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[11px] text-amber-300 font-semibold border border-white/10">
                    <Award className="w-3.5 h-3.5" />
                    <span>Certified Handwriting Coach</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[11px] text-blue-200 font-semibold border border-white/10">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>English &amp; Hindi Specialist</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Detailed Founder Story */}
            <div className="lg:col-span-8 space-y-5">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold uppercase tracking-wider">
                  FOUNDER PROFILE &amp; PEDAGOGICAL PHILOSOPHY
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
                  Dedicated to Handwriting Excellence &amp; Confidence
                </h2>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-blue-100/90 leading-relaxed font-sans font-normal">
                <p className="font-semibold text-white text-sm sm:text-base">
                  Welcome! I’m Deepthy Rock, the Founder and Principal Coach of SmartPen Academy!
                </p>
                <p>
                  My journey into handwriting coaching didn't begin in a formal classroom—it started at a table, surrounded by my friends' children. We would spend hours together working on new words, practicing writing, and solving puzzles. Through those simple, everyday interactions, a realization sparked within me.
                </p>
                <p>
                  I noticed that teaching children is a beautifully unique process. They don't just need someone to tell them how to write; they need a different, engaging approach to help them write better and, more importantly, to feel genuinely confident about themselves and their work. I realized I wanted to create a space to interact with kids, helping them not only form their letters but also elevate the way they present their school projects, daily assignments, and even their drawings.
                </p>
                <p>
                  Driven by this passion, I decided to turn my idea into a reality. I sought out formal training, studied the mechanics of writing, and earned my certification as a handwriting coach specializing in English (both Print and Cursive) and Hindi.
                </p>
                <p>
                  However, I knew that true academic confidence requires more than just beautiful letters. I expanded my coaching to address the real-world challenges students face. Today, my instruction goes beyond the alphabet to teach proper layout structuring, clear number and formula writing, effective exam paper presentation, and neat diagram labelling.
                </p>
                <p>
                  Because early intervention is so crucial, I also developed a specialized Foundation Course for children ages 4 and up. This program is designed to build a strong base from day one. We start with establishing a comfortable, correct pencil grip and mastering proper letter and number formation. From there, we seamlessly integrate language and logic, guiding kids through sight words, CVC words, spelling, and vocabulary building, while also introducing basic math skills like addition, subtraction, and multiplication tables.
                </p>
              </div>

              {/* Founder Quote Card */}
              <div className="p-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 relative">
                <p className="text-sm sm:text-base italic text-amber-200 leading-relaxed font-sans font-medium">
                  "A child’s handwriting is the direct window into their thinking mind. When their hand moves without strain and their letters flow with harmony, their intellect is completely liberated to excel."
                </p>
                <p className="text-right text-xs text-blue-200 font-bold mt-2">
                  — Mrs. Deepthy Rock, Founder &amp; Master Coach
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. OUR CORE PHILOSOPHY & GUIDING VALUES */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5" />
            <span>Our Pedagogical Values</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
            How We Coach &amp; Nurture Every Student
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-sans">
            Handwriting isn't just mechanical repetition—it's a blend of empathy, presentation skills, and foundational habits that shape a student's self-belief.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Child-Centered Empathy */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-200/80 hover:border-[#0E3589] transition-all shadow-md hover:shadow-xl space-y-3 group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0E3589] flex items-center justify-center font-bold mb-4 group-hover:scale-110 transition-transform">
                <Heart className="w-6 h-6 text-[#0E3589]" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-2">Child-Centered Empathy</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Every child learns uniquely. Instead of rigid copybook pressure, we create a warm, engaging environment where children overcome self-doubt and feel genuinely proud of their work.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-[#0E3589]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Positive Encouragement</span>
            </div>
          </div>

          {/* Card 2: Beyond Just Letters */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-200/80 hover:border-[#F46E20] transition-all shadow-md hover:shadow-xl space-y-3 group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#F46E20] flex items-center justify-center font-bold mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-[#F46E20]" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-2">Whole-Academic Presentation</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Real academic success demands more than neat alphabets. We teach proper page layouts, clear number and formula writing, clean margins, and neat diagram labelling.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-[#F46E20]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exam-Ready Structuring</span>
            </div>
          </div>

          {/* Card 3: Foundation Course for Ages 4+ */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-200/80 hover:border-emerald-600 transition-all shadow-md hover:shadow-xl space-y-3 group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6 text-emerald-700" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-2">Early Foundation (Ages 4+)</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Building a strong base early prevents lifelong strain. We integrate natural pencil grips, letter formations, sight words, phonics, and foundational math skills seamlessly.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Language &amp; Logic Synced</span>
            </div>
          </div>

          {/* Card 4: Multi-Script Certification */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-200/80 hover:border-purple-600 transition-all shadow-md hover:shadow-xl space-y-3 group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-4 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6 text-purple-700" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mb-2">English &amp; Hindi Mastery</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Certified instruction spanning English Print (Manuscript), English Cursive, and Hindi script, tailored to each student’s school board and unique learning pace.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-purple-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Certified Mentorship</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE FOUNDER'S PLEDGE & MISSION */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-blue-50 via-white to-orange-50 rounded-3xl p-8 sm:p-12 border-2 border-blue-100 shadow-md">
          <div className="max-w-3xl mx-auto text-center space-y-5">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white border border-blue-200 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider shadow-2xs">
              <Star className="w-3.5 h-3.5 text-[#F46E20]" />
              <span>Our Guiding Mission</span>
            </span>

            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
              "To help students of all ages discover the pride that comes from clear, beautiful handwriting and to give them the confidence to present their very best selves to the world."
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed max-w-2xl mx-auto">
              Whether your child is writing their very first alphabet, struggling with pencil fatigue in middle school, or preparing for high-stakes board examinations, SmartPen Academy is here to support every step of their journey.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={handleBooking}
                variant="accent"
                size="lg"
                className="bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white shadow-md shadow-orange-500/20 px-6 py-3 rounded-2xl font-black gap-2"
                id="btn-about-book-demo"
              >
                <Clock className="w-4 h-4 text-white" />
                <span>Book for a Free Demo Class</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => onNavigate('syllabus')}
                variant="outline"
                size="lg"
                className="border-2 border-[#0E3589]/30 text-[#0E3589] hover:border-[#0E3589] px-6 py-3 rounded-2xl font-bold gap-2"
                id="btn-about-view-curriculum"
              >
                <Compass className="w-4 h-4 text-[#0E3589]" />
                <span>Explore 7-Step Syllabus</span>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
