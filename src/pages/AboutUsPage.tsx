import React from 'react';
import { Button } from '../components/ui/Button';
import { 
  Sparkles, 
  Award, 
  Heart, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Target, 
  ArrowRight,
  GraduationCap,
  Users,
  Compass,
  Check
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
            <span>Our Pedagogical Heritage &amp; Vision</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
            Meet the Founder &amp; <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20]">
              The SmartPen Educational Mission
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-sans">
            Founded by certified handwriting analyst Mrs. Deepthy Rock, SmartPen Academy is dedicated to turning handwriting from an agonizing daily struggle into a joyful lifelong craft of clarity, speed, and academic pride.
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
                  Founder, Master Handwriting Coach &amp; Educationalist
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[11px] text-amber-300 font-semibold border border-white/10">
                  <Award className="w-3.5 h-3.5" />
                  <span>10+ Years Dedicated Pedagogy</span>
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
                  A Decade Dedicated to Handwriting Excellence
                </h2>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-blue-100/90 leading-relaxed font-sans font-normal">
                <p>
                  Mrs. Deepthy Rock established SmartPen Academy in 2018 in Bangalore after witnessing firsthand how bright, hardworking students routinely lost marks on examinations simply because their handwriting was illegible, unformatted, or too slow.
                </p>
                <p>
                  Drawing on certified expertise in handwriting analysis, kinetic biomechanics, and child development psychology, she pioneered the proprietary <strong>SmartPen 7-Step Method</strong>. Rather than forcing children through mindless, repetitive copybook drilling, her methodology systematically identifies and corrects the underlying physiological friction—from excessive index-finger tension to incorrect paper tilt angles.
                </p>
                <p>
                  Under her direct mentorship, over 150 students across India have reversed years of poor handwriting habits, gaining effortless exam speed, neatness, and radiant self-confidence.
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

      {/* 3. THE 4 PILLARS OF THE SMARTPEN PEDAGOGY */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-orange-50 border border-orange-200 text-[#F46E20] rounded-full text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>Scientific Distinction</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900">
            The 4 Scientific Pillars of Our Method
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-sans">
            How our diagnostic framework guarantees permanent, visible results where standard school drills fail.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0E3589] flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">1. Kinetic Grip Realignment</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              We eliminate painful thumb-over grasps and tight fist holds by retraining the hand to use the dynamic tripod grip with whole-forearm fluid movement.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#F46E20] flex items-center justify-center font-bold">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">2. Spatial Geometrics &amp; Slant</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Students learn microscopic awareness of baseline anchors, uniform 65° letter slants, and consistent 3-zone ascender/descender height ratios.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">3. Exam Speed Without Strain</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Timed rhythm exercises boost handwriting speed by an average of +14 words per minute, enabling students to finish lengthy board papers ahead of time.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900">4. Academic Marks Booster</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Well-structured answers with neat margins, formulas, and headings leave an instant positive impression on examiners, lifting overall scores by 15–25%.
            </p>
          </div>
        </div>
      </section>

      {/* 4. CENTER LOCATION & DIRECT ACCESS */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-[#F46E20]" />
                Bangalore Academy Center
              </span>
              <h3 className="text-2xl font-black text-slate-900">
                Visit Our Electronic City Center or Join Live Online
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                Our flagship learning studio is located at Ajmera Infinity in Electronic City Phase 1, Bangalore. We also conduct interactive live-streamed 1-on-1 sessions for outstation and international students.
              </p>

              <div className="space-y-3 pt-2 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#F46E20] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-slate-900">Center Address:</strong>
                    <span>Ajmera Infinity, Electronic City Phase 1, Bangalore - 560100</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#0E3589] shrink-0" />
                  <div>
                    <strong className="block text-slate-900">Coaching Hours:</strong>
                    <span>All days (4:00 PM - 7:00 PM)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong className="block text-slate-900">Direct Contact &amp; WhatsApp:</strong>
                    <a href="tel:8861751000" className="text-[#0E3589] font-bold hover:underline">+91 8861751000</a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <strong className="block text-slate-900">Email:</strong>
                    <a href="mailto:deepthysrock@gmail.com" className="text-[#0E3589] font-bold hover:underline">deepthysrock@gmail.com</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50 rounded-3xl p-6 sm:p-8 border-2 border-orange-200/80 shadow-xs text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F46E20] text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-black text-slate-900">
                Schedule a 1-on-1 Assessment
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans max-w-sm mx-auto">
                Discover the exact mechanical causes of your child's handwriting difficulties and review our 10-class transformation roadmap.
              </p>
              <div className="pt-2 space-y-2">
                <Button
                  onClick={handleBooking}
                  variant="accent"
                  size="lg"
                  className="w-full bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white shadow-md shadow-orange-500/20 font-black rounded-2xl"
                  id="btn-about-book-demo"
                >
                  <Clock className="w-4 h-4 mr-1.5" />
                  <span>Book for a Free Demo Class</span>
                </Button>

                <Button
                  onClick={() => onNavigate('syllabus')}
                  variant="outline"
                  size="md"
                  className="w-full rounded-xl font-bold text-xs"
                  id="btn-about-view-curriculum"
                >
                  <span>Explore 7-Step Syllabus</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
