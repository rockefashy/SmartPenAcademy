import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { 
  Sparkles, 
  Zap, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  Award, 
  ChevronDown,
  ShieldCheck,
  MapPin,
  HelpCircle,
  PenTool
} from 'lucide-react';
import { landingProperties } from '../properties/landing.properties';

interface WorkshopsPageProps {
  onNavigate: (view: string) => void;
  onOpenDemoBooking?: () => void;
}

export const WorkshopsPage: React.FC<WorkshopsPageProps> = ({ onNavigate, onOpenDemoBooking }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const handleBooking = () => {
    if (onOpenDemoBooking) {
      onOpenDemoBooking();
    } else {
      onNavigate('free-demo');
    }
  };

  const workshopFaqs = [
    {
      q: "What is the student-to-coach ratio in specialized workshops?",
      a: "To ensure hyper-personalized attention, we cap workshop batches at a maximum of 4 to 5 students per batch. Every child receives real-time grip checks and direct feedback from Mrs. Deepthy Rock."
    },
    {
      q: "Are the workshops conducted in-person, online, or hybrid?",
      a: "We offer both interactive online sessions (with live camera feedback on handwriting angles) and in-center batches at our Electronic City Phase 1 center in Bangalore."
    },
    {
      q: "What materials will my child need during the workshop?",
      a: "We provide specialized printable/physical guideline sheets and workbook templates. Students just need their regular school pens or pencils and a comfortable writing desk."
    },
    {
      q: "Does my child receive a certificate upon workshop completion?",
      a: "Yes! Every student who completes the workshop receives an official SmartPen Academy Achievement Certificate recognizing their speed, neatness, and motor skill milestones."
    },
    {
      q: "Can high school students attending Grade 10 & 12 Board Exams benefit from the Exam Speed Intensive?",
      a: "Yes, the Super-Speed Exam Writing Intensive was specifically created for students preparing for CBSE, ICSE, and State Board exams who struggle to complete lengthy 3-hour papers in time."
    }
  ];

  return (
    <div className="space-y-12 sm:space-y-20 pb-16 sm:pb-24 overflow-hidden font-sans">
      {/* 1. HERO BANNER */}
      <section className="relative pt-4 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-[#F46E20]" />
            <span>Accelerated Masterclasses &amp; Camps</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
            Specialized Handwriting <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20]">
              Workshops &amp; Speed Bootcamps
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-sans">
            Targeted holiday camps and accelerated intensives designed to solve exam time crunch, correct stubborn pencil grips, and master elegant cursive handwriting in record time.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleBooking}
              variant="accent"
              size="lg"
              className="bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white shadow-lg shadow-orange-500/25 px-6 py-3 rounded-2xl font-black gap-2"
              id="btn-workshops-book-demo"
            >
              <Clock className="w-4 h-4 text-white" />
              <span>Reserve Workshop Slot</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => onNavigate('syllabus')}
              variant="outline"
              size="lg"
              className="border-2 border-[#0E3589]/30 text-[#0E3589] hover:border-[#0E3589] px-6 py-3 rounded-2xl font-bold gap-2"
              id="btn-workshops-view-curriculum"
            >
              <PenTool className="w-4 h-4 text-[#0E3589]" />
              <span>View 7-Step Syllabus</span>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. WORKSHOPS DETAILED SHOWCASE */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {landingProperties.adsAndWorkshopsSection.workshops.map((ws, index) => (
            <div
              key={ws.id || index}
              className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200/90 hover:border-[#0E3589] transition-all shadow-md hover:shadow-xl flex flex-col justify-between relative group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-3 py-1 bg-amber-100 text-amber-900 font-extrabold text-[11px] uppercase rounded-full border border-amber-200">
                    {ws.badge}
                  </span>
                  <span className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#F46E20]" />
                    {ws.duration}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 mb-2 leading-tight">
                  {ws.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed font-medium">
                  {ws.subtitle}
                </p>

                {/* Meta details box */}
                <div className="p-3.5 bg-slate-50 rounded-2xl mb-5 space-y-2 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#0E3589] shrink-0" />
                    <span>{ws.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Target: {ws.ageGroup}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#F46E20] shrink-0" />
                    <span>Electronic City Bangalore &amp; Live Online</span>
                  </div>
                </div>

                {/* Highlights */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Core Learning Outcomes:
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    {ws.highlights.map((h, hIdx) => (
                      <li key={hIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100">
                <Button
                  onClick={handleBooking}
                  variant="accent"
                  size="md"
                  className="w-full bg-[#0E3589] hover:bg-[#0b2a70] text-white rounded-xl font-bold py-2.5 shadow-sm text-xs justify-center cursor-pointer"
                  id={`btn-reserve-${ws.id}`}
                >
                  <span>{ws.enrollActionText || 'Reserve Workshop Seat'}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. WORKSHOP ADVANTAGES / WHY ATTEND */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900 via-[#0E3589] to-slate-950 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="max-w-3xl mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Award className="w-3.5 h-3.5" />
              The SmartPen Advantage
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Why Our Accelerated Workshops Deliver Guaranteed Results
            </h2>
            <p className="text-xs sm:text-sm text-blue-200 mt-1">
              Unlike generic handwriting classes, SmartPen workshops use diagnostic motor analysis to correct kinetic barriers immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-300 flex items-center justify-center font-bold">
                1:1
              </div>
              <h4 className="font-extrabold text-white text-base">Small Batches (Max 5)</h4>
              <p className="text-xs text-blue-100 leading-relaxed font-sans">
                Every student receives uninterrupted personalized scrutiny on wrist position, grip firmness, and stroke rhythm.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                +14
              </div>
              <h4 className="font-extrabold text-white text-base">Speed Acceleration</h4>
              <p className="text-xs text-blue-100 leading-relaxed font-sans">
                Timed writing strategies train students to write at speed without losing uniform slant or baseline neatness.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                0%
              </div>
              <h4 className="font-extrabold text-white text-base">Zero Hand Fatigue</h4>
              <p className="text-xs text-blue-100 leading-relaxed font-sans">
                Retrains muscle memory to rely on whole-arm movement rather than tight finger squeezing, preventing writer's cramp.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                100%
              </div>
              <h4 className="font-extrabold text-white text-base">Certified Progress</h4>
              <p className="text-xs text-blue-100 leading-relaxed font-sans">
                Includes before-and-after certified assessment cards showing verifiable improvements in letter formation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. WORKSHOP FAQS */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-[#0E3589]" />
            Workshop Queries
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Frequently Asked Questions on Workshops
          </h2>
        </div>

        <div className="space-y-3">
          {workshopFaqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all shadow-2xs"
            >
              <button
                type="button"
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-bold text-slate-900 text-sm sm:text-base cursor-pointer hover:text-[#0E3589] transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    activeFaq === idx ? 'rotate-180 text-[#F46E20]' : 'text-slate-400'
                  }`}
                />
              </button>

              {activeFaq === idx && (
                <div className="px-5 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 5. BOTTOM CTA BANNER */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-wider inline-block">
              Limited Seats Per Batch
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              Reserve Your Child's Workshop Seat Today
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-sans">
              Batches fill up quickly prior to school exams and term breaks. Book a free diagnostic demo or talk to Mrs. Deepthy Rock directly to find the best batch timing.
            </p>
            <div className="pt-2">
              <Button
                onClick={handleBooking}
                variant="accent"
                size="lg"
                className="bg-white text-[#0E3589] hover:bg-amber-100 px-8 py-3.5 rounded-2xl font-black text-base shadow-md cursor-pointer inline-flex items-center gap-2"
                id="btn-workshops-cta-demo"
              >
                <span>Schedule Free Demo First</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
