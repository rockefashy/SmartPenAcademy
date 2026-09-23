import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Users, 
  ChevronDown, 
  ArrowRight,
  ClipboardCheck,
  Type,
  AlignJustify,
  FileText,
  Gauge,
  Trophy,
  Target,
  HelpCircle,
  ShieldCheck,
  Compass,
  Award
} from 'lucide-react';
import { landingProperties } from '../properties/landing.properties';

interface SyllabusPageProps {
  onNavigate: (view: string) => void;
  onOpenDemoBooking?: () => void;
}

export const SyllabusPage: React.FC<SyllabusPageProps> = ({ onNavigate, onOpenDemoBooking }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedAgeTrack, setSelectedAgeTrack] = useState<'junior' | 'middle' | 'senior'>('middle');

  const handleBooking = () => {
    if (onOpenDemoBooking) {
      onOpenDemoBooking();
    } else {
      onNavigate('free-demo');
    }
  };

  const faqs = [
    {
      q: "How many sessions are in the complete handwriting improvement syllabus?",
      a: "Our core transformation syllabus is structured across 10 progressive classes. Each session lasts 45 to 60 minutes with dedicated 1-on-1 coaching, posture checks, and tailored practice worksheets."
    },
    {
      q: "Do you teach both Print (Manuscript) and Cursive writing?",
      a: "Yes! Students can enroll for either Print script, Cursive script, or our dual-script masterclass. We tailor the progression based on the child's school board (CBSE, ICSE, IGCSE, State Board) and current handwriting style."
    },
    {
      q: "My child writes very slowly. Will this course increase their exam speed?",
      a: "Absolutely. Module 6 is exclusively dedicated to Speed & Presentation Improvement. We introduce kinetic muscle release drills and timed writing exercises that yield an average speed boost of +14 words per minute without losing legibility."
    },
    {
      q: "What age groups is this syllabus suitable for?",
      a: "Our curriculum covers students aged 4 to 18, with specialized tracks for Junior Learners (Ages 4–6), Middle School (Ages 7–12), and Board Exam Candidates (Ages 13–18)."
    },
    {
      q: "Will the child receive study material and customized worksheets?",
      a: "Yes, every student receives the official SmartPen Practice Workbook containing specialized guideline grids, stroke angle templates, and daily micro-practice sheets."
    }
  ];

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

  return (
    <div className="space-y-12 sm:space-y-20 pb-16 sm:pb-24 overflow-hidden font-sans">
      {/* 1. HERO BANNER */}
      <section className="relative pt-4 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-[#F46E20]" />
            <span>Structured Academic Curriculum</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
            Handwriting Syllabus &amp; <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20]">
              Progressive Training Blueprint
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-sans">
            A scientifically designed 7-step pedagogical curriculum turning illegible scribbles and hand fatigue into beautiful, swift, and high-scoring handwriting for ages 4 to 18.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleBooking}
              variant="accent"
              size="lg"
              className="bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white shadow-lg shadow-orange-500/25 px-6 py-3 rounded-2xl font-black gap-2"
              id="btn-syllabus-book-demo"
            >
              <Clock className="w-4 h-4 text-white" />
              <span>Book Free Diagnostic Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => onNavigate('workshops')}
              variant="outline"
              size="lg"
              className="border-2 border-[#0E3589]/30 text-[#0E3589] hover:border-[#0E3589] px-6 py-3 rounded-2xl font-bold gap-2"
              id="btn-syllabus-view-workshops"
            >
              <Sparkles className="w-4 h-4 text-[#0E3589]" />
              <span>Specialized Workshops</span>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. THE 4 SCIENTIFIC PILLARS OF OUR METHOD */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>Diagnostic Framework</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
            The 4 Scientific Pillars of Our Method
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-sans">
            How our diagnostic framework guarantees permanent, visible results where standard school drills fail.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200/80 hover:border-[#0E3589] transition-all shadow-md hover:shadow-xl space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0E3589] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">1. Kinetic Grip Realignment</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              We eliminate painful thumb-over grasps and tight fist holds by retraining the hand to use the dynamic tripod grip with whole-forearm fluid movement.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200/80 hover:border-[#F46E20] transition-all shadow-md hover:shadow-xl space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#F46E20] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">2. Spatial Geometrics &amp; Slant</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Students learn microscopic awareness of baseline anchors, uniform 65° letter slants, and consistent 3-zone ascender/descender height ratios.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200/80 hover:border-emerald-600 transition-all shadow-md hover:shadow-xl space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">3. Exam Speed Without Strain</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Timed rhythm exercises boost handwriting speed by an average of +14 words per minute, enabling students to finish lengthy board papers ahead of time.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border-2 border-slate-200/80 hover:border-purple-600 transition-all shadow-md hover:shadow-xl space-y-3 group">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">4. Academic Marks Booster</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Well-structured answers with neat margins, formulas, and headings leave an instant positive impression on examiners, lifting overall scores by 15–25%.
            </p>
          </div>
        </div>
      </section>

      {/* 3. THE 7-STEP PROGRESSIVE CURRICULUM */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
            <Target className="w-3.5 h-3.5" />
            <span>Mastery Roadmap</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
            The 7-Module Transformation Journey
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-sans">
            Every module isolates and refines a crucial handwriting mechanic, ensuring permanent muscle memory and exam neatness.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {landingProperties.syllabusSection.modules.map((mod, index) => (
            <div
              key={index}
              className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-200/80 hover:border-[#0E3589] transition-all shadow-md hover:shadow-xl flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0E3589] to-[#0084F4] text-white flex items-center justify-center font-black text-sm shadow-md">
                    {mod.number}
                  </span>
                  <div className="p-2.5 rounded-2xl bg-blue-50 text-[#0E3589] group-hover:scale-110 transition-transform">
                    {getModuleIcon(mod.icon)}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2.5">
                  {mod.title}
                </h3>

                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                  {mod.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#F46E20] shrink-0 mt-1.5" />
                      <span className="leading-relaxed font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#0E3589]">
                <span>Stage {mod.number} Milestone</span>
                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Skill
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 via-white to-orange-50 border-2 border-blue-100 rounded-3xl text-center shadow-xs">
          <p className="text-sm sm:text-base font-extrabold text-[#0E3589]">
            {landingProperties.syllabusSection.footerBanner}
          </p>
        </div>
      </section>

      {/* 4. AGE-SPECIFIC LEARNING TRACKS */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-slate-900 rounded-3xl p-6 sm:p-12 text-white shadow-2xl relative overflow-hidden border border-slate-800">
          <div className="max-w-3xl mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Users className="w-3.5 h-3.5" />
              Tailored Pedagogical Tracks
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
              Curriculum Adapted to Your Child's Grade
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select an age tier to see how our coaches customize exercises for motor development and school syllabus demands.
            </p>
          </div>

          {/* Age Tab Selector */}
          <div className="flex flex-wrap gap-2.5 mb-8">
            <button
              type="button"
              onClick={() => setSelectedAgeTrack('junior')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedAgeTrack === 'junior'
                  ? 'bg-[#F46E20] text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Junior Writers (Ages 4 – 6)
            </button>
            <button
              type="button"
              onClick={() => setSelectedAgeTrack('middle')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedAgeTrack === 'middle'
                  ? 'bg-[#F46E20] text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Middle School (Ages 7 – 12)
            </button>
            <button
              type="button"
              onClick={() => setSelectedAgeTrack('senior')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                selectedAgeTrack === 'senior'
                  ? 'bg-[#F46E20] text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Board Exam Candidates (Ages 13 – 18)
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {selectedAgeTrack === 'junior' && (
              <>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-amber-400 font-bold text-sm">Focus 1: Tripod Grip</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Eliminates fist grips and thumb-over wraps using ergonomic silicone grips and kinetic finger games.
                  </p>
                </div>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-amber-400 font-bold text-sm">Focus 2: 4-Line Spatial Control</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Teaches upper, middle, and lower zone letter placement using clear color-coded guideline books.
                  </p>
                </div>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-amber-400 font-bold text-sm">Focus 3: Gentle Endurance</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Builds writing stamina without muscle soreness, fostering confidence before school homework begins.
                  </p>
                </div>
              </>
            )}

            {selectedAgeTrack === 'middle' && (
              <>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-blue-300 font-bold text-sm">Focus 1: Uniform Slant &amp; Height</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Instills consistent 65° forward slant and uniform letter sizing across all words and sentences.
                  </p>
                </div>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-blue-300 font-bold text-sm">Focus 2: Cursive Loop Joins</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Mastering fluid ascender/descender joins so the pen glides smoothly without awkward hesitations.
                  </p>
                </div>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-blue-300 font-bold text-sm">Focus 3: Teacher-Ready Homework</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Disciplined margin spacing, clean headings, and smudge-free gel/ball pen control for daily classwork.
                  </p>
                </div>
              </>
            )}

            {selectedAgeTrack === 'senior' && (
              <>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-emerald-400 font-bold text-sm">Focus 1: 3-Hour Exam Speed</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Timed answer writing drills allowing students to complete 80-mark board papers with 15 minutes left to revise.
                  </p>
                </div>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-emerald-400 font-bold text-sm">Focus 2: Scientific Presentation</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Neat numerical formatting for Math formulas, chemical equations, clean margins, and bulleted pointers.
                  </p>
                </div>
                <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700 space-y-3">
                  <div className="text-emerald-400 font-bold text-sm">Focus 3: Fatigue Elimination</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tension-release techniques eliminating wrist cramps during continuous writing in final board examinations.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 5. CURRICULUM FAQS */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-[#0E3589]" />
            Frequently Asked Questions
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Common Questions About Our Syllabus
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
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

      {/* 6. BOTTOM CTA BANNER */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-wider inline-block">
              Free Assessment Available
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              See the Syllabus Applied to Your Child's Writing
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-sans">
              Book a complimentary 1-on-1 handwriting diagnostic assessment with Mrs. Deepthy Rock. Get an instant analysis of your child's grip, slant, and speed bottlenecks.
            </p>
            <div className="pt-2">
              <Button
                onClick={handleBooking}
                variant="accent"
                size="lg"
                className="bg-white text-[#0E3589] hover:bg-amber-100 px-8 py-3.5 rounded-2xl font-black text-base shadow-md cursor-pointer inline-flex items-center gap-2"
                id="btn-syllabus-cta-demo"
              >
                <span>Book for a Free Demo Class</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
