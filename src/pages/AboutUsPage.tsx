import React from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Award, 
  Heart, 
  BookOpen, 
  CheckCircle2, 
  Star, 
  Clock, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Target, 
  ArrowRight,
  Smile,
  GraduationCap
} from 'lucide-react';
import { commonProperties } from '../properties/common.properties';
import { landingProperties } from '../properties/landing.properties';

interface AboutUsPageProps {
  onNavigate: (view: string) => void;
  onOpenDemoBooking?: () => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate, onOpenDemoBooking }) => {
  return (
    <div className="space-y-16 sm:space-y-20 pb-20 overflow-hidden font-sans">
      {/* Top Hero Banner */}
      <section className="relative pt-10 sm:pt-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#F46E20]" />
            <span>About SmartPen Academy</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
            Meet the Founder &amp; <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20]">
              Our Educational Mission
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-sans">
            Dedicated to transforming handwriting from a frustrating chore into a lifelong skill of pride, neatness, and high academic performance.
          </p>
        </div>
      </section>

      {/* Main Founder Showcase Card */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900 via-[#0E3589] to-slate-950 rounded-3xl p-8 sm:p-14 text-white shadow-2xl overflow-hidden relative border border-slate-800">
          {/* Subtle decorative background circles */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#F46E20]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            {/* Left: Founder Photo / Badge */}
            <div className="lg:col-span-4 text-center space-y-4">
              <div className="relative inline-block">
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-4 border-orange-400 shadow-2xl mx-auto bg-slate-800 flex items-center justify-center relative">
                  <img
                    src="/app_images/founder.png"
                    alt="Mrs. Deepthy Rock"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-[#0E3589] to-[#0084F4] text-white p-4">
                    <span className="text-5xl sm:text-6xl font-black tracking-wider text-amber-300">DR</span>
                    <span className="text-xs font-bold mt-2 uppercase tracking-widest text-blue-100">Mrs. Deepthy Rock</span>
                  </div>
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] text-white px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg whitespace-nowrap z-20">
                  Principal Coach
                </div>
              </div>

              <div className="pt-2">
                <h3 className="text-2xl font-black text-white">{commonProperties.founderName}</h3>
                <p className="text-xs sm:text-sm text-blue-200 font-sans mt-0.5">
                  {commonProperties.founderTitle}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[11px] text-amber-300 font-semibold border border-white/10">
                  <Award className="w-3.5 h-3.5" />
                  <span>10+ Years Pedagogical Excellence</span>
                </div>
              </div>
            </div>

            {/* Right: Founder Story & Pedagogy Details */}
            <div className="lg:col-span-8 space-y-6">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold uppercase tracking-wider">
                  {landingProperties.founderSection.tag}
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
                  {landingProperties.founderSection.title}
                </h2>
                <p className="text-xs sm:text-sm text-blue-200 font-medium">
                  {landingProperties.founderSection.subtitle}
                </p>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-blue-100/90 leading-relaxed font-sans font-normal">
                {landingProperties.founderSection.bio.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>

              {/* Quote Block */}
              <div className="p-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 relative">
                <p className="text-sm sm:text-base italic text-amber-200 leading-relaxed font-sans font-medium">
                  "{landingProperties.founderSection.quote}"
                </p>
                <p className="text-right text-xs text-blue-200 font-bold mt-2">
                  — {landingProperties.founderSection.signature}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Academy Core Pillars & Values */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5" />
            <span>Our Teaching Philosophy</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
            Why the SmartPen Method Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-sans">
            Every child is unique. Our individual assessment and progressive 7-step blueprint target the root causes of illegible handwriting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0E3589] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900">Kinetic Grip Correction</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
              We eliminate thumb wraps, heavy pen pressure, and hand cramps through tailored muscle training and dynamic tripod positioning.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Zero wrist fatigue during long exams</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Custom finger posture drills</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#F46E20] flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900">10-Class Visible Guarantee</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
              Our structured 10-class module delivers measurable improvements in letter formation, uniform 65° slant, baseline alignment, and speed.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Before &amp; After certified progress cards</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Immediate teacher praise at school</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900">Exam Strategy &amp; Speed</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
              Beyond pretty letters, we train students to structure answers with clean margins, headings, diagrams, and fast-flowing legible script.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>15–25% higher marks on written papers</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Proven +14 Words Per Minute speed boost</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Center Location & Contact Mrs. Deepthy Rock */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5" />
                <span>Bangalore Center &amp; Timings</span>
              </span>
              <h3 className="text-2xl font-black text-slate-900">
                Visit Our Center or Connect Directly
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                Located conveniently in Electronic City Phase 1, Bangalore, with dedicated coaching batches scheduled daily between 4:00 PM and 7:00 PM.
              </p>

              <div className="space-y-3 pt-2 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#F46E20] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-slate-900">SmartPen Academy Address:</strong>
                    <span>{commonProperties.contact.location}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#0E3589] shrink-0" />
                  <div>
                    <strong className="block text-slate-900">Coaching Hours:</strong>
                    <span>{commonProperties.contact.timings}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="block text-slate-900">Phone &amp; WhatsApp:</strong>
                    <a href={`tel:${commonProperties.contact.phone}`} className="text-[#0E3589] font-bold hover:underline">
                      {commonProperties.contact.phoneDisplay}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <strong className="block text-slate-900">Direct Email:</strong>
                    <a href={`mailto:${commonProperties.contact.email}`} className="text-[#0E3589] font-bold hover:underline">
                      {commonProperties.contact.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: CTA Card for Demo Class */}
            <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50 rounded-3xl p-6 sm:p-8 border-2 border-orange-200/80 shadow-sm text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F46E20] text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-black text-slate-900">
                Experience a Free Demo Class
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans max-w-sm mx-auto">
                Schedule a 1-on-1 personalized handwriting assessment with Mrs. Deepthy Rock and see the transformation plan for your child.
              </p>
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    if (onOpenDemoBooking) onOpenDemoBooking();
                  }}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#e05c10] text-white font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  id="btn-about-book-demo"
                >
                  <Clock className="w-4 h-4" />
                  <span>Book for a Free Demo Class</span>
                </button>
                <button
                  onClick={() => onNavigate('syllabus')}
                  className="w-full py-3 px-6 bg-white hover:bg-slate-50 text-[#0E3589] font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
                  id="btn-about-curriculum"
                >
                  Explore Course Curriculum →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
