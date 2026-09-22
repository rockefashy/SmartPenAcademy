import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { 
  Sparkles, 
  Clock, 
  Calendar, 
  User, 
  Phone, 
  CheckCircle2, 
  ArrowRight, 
  MapPin, 
  Award, 
  ShieldCheck, 
  HelpCircle,
  MessageCircle,
  Send,
  Loader2,
  Mail
} from 'lucide-react';
import { api } from '../services/api';
import { buildWhatsAppUrl } from '../utils/whatsapp';
import { parseAndValidateDemoTime } from '../components/DemoBookingModal';
import confetti from 'canvas-confetti';

interface FreeDemoPageProps {
  onNavigate: (view: string) => void;
  onOpenLogin?: () => void;
}

export const FreeDemoPage: React.FC<FreeDemoPageProps> = ({ onNavigate, onOpenLogin }) => {
  // Booking Form State
  const [parentName, setParentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [demoDate, setDemoDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [demoTime, setDemoTime] = useState('04:30 PM');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBooked, setIsBooked] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!studentName.trim()) {
      setErrorMsg('Please enter your child’s name.');
      return;
    }
    if (!parentPhone.trim() || parentPhone.trim().length < 10) {
      setErrorMsg('Please enter a valid 10-digit WhatsApp/phone number.');
      return;
    }

    const timeValidation = parseAndValidateDemoTime(demoTime);
    if (!timeValidation.isValid) {
      setErrorMsg(timeValidation.error || 'Please enter a valid time between 4:00 PM and 7:00 PM.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createDemoBooking({
        studentName: studentName.trim(),
        parentName: parentName.trim() || 'Parent',
        age: studentGrade.trim() || 'Not specified',
        contactNumber: parentPhone.trim(),
        preferredDate: demoDate,
        preferredTimeSlot: timeValidation.formattedTime || demoTime,
        modeOfLearning: 'In-person',
        notes: notes.trim() || undefined
      });

      setIsBooked(true);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        // Confetti is optional
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit demo booking. Please try again or reach out on WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const demoFaqs = [
    {
      q: "Is the demo class genuinely free, with no obligation to enroll?",
      a: "Yes, 100% free with no commitment. The session is designed as a diagnostic evaluation to give you and your child an honest assessment of handwriting posture, pencil grip mechanics, and improvement potential."
    },
    {
      q: "How long is the demo session and who conducts it?",
      a: "The demo session lasts approximately 30 to 45 minutes. It is conducted directly by founder Mrs. Deepthy Rock or one of our master certified handwriting coaches."
    },
    {
      q: "Can we attend online if we do not live in Bangalore?",
      a: "Yes! We teach students across India and internationally. For online demos, we use high-resolution overhead camera setups so we can inspect and guide your child's hand movements and grip in real time."
    },
    {
      q: "What should my child keep ready for the demo session?",
      a: "Your child just needs their regular school pencil or pen, a 4-line notebook or plain ruled paper, and 2-3 recent samples of their school notebooks or exam papers for Mrs. Deepthy Rock to review."
    }
  ];

  return (
    <div className="space-y-12 sm:space-y-20 pb-16 sm:pb-24 overflow-hidden font-sans">
      {/* 1. HERO BANNER */}
      <section className="relative pt-4 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#F46E20]" />
            <span>Complimentary 1-on-1 Assessment</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
            Book a Free Handwriting <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20]">
              Diagnostic Demo Class
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-sans">
            Uncover the root causes of messy writing, slow exam speed, and wrist fatigue. Get a personalized 10-class transformation roadmap for your child from Mrs. Deepthy Rock.
          </p>
        </div>
      </section>

      {/* 2. DIAGNOSTIC RUBRIC + EMBEDDED BOOKING FORM GRID */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left: What We Check (The Diagnostic Rubric) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-5 border border-slate-800">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Diagnostic Evaluation Rubric
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  What We Evaluate During the Demo
                </h3>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <strong className="text-white block font-bold mb-0.5">Kinetic Pencil Grip &amp; Posture</strong>
                    <span>We check finger placement, excessive paper pressure, and wrist angle to eliminate muscle strain and fatigue.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <strong className="text-white block font-bold mb-0.5">Letter Proportions &amp; Slant Angle</strong>
                    <span>We measure uniformity in letter heights, ascender/descender loops, and baseline alignment across lined and unlined sheets.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <strong className="text-white block font-bold mb-0.5">Writing Speed vs. Legibility Benchmark</strong>
                    <span>We benchmark words-per-minute (WPM) to ensure your child has the required speed for school term tests and board exams.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-black shrink-0 text-xs">
                    4
                  </div>
                  <div>
                    <strong className="text-white block font-bold mb-0.5">Personalized 10-Class Action Blueprint</strong>
                    <span>Mrs. Deepthy Rock presents an exact roadmap of customized drills suited to your child's grade and school board.</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  100% Free Consultation
                </span>
                <span>30-45 Mins Duration</span>
              </div>
            </div>

            {/* Center Info Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3 text-xs sm:text-sm text-slate-700">
              <h4 className="font-extrabold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#F46E20]" />
                Center Location &amp; Hours
              </h4>
              <p className="text-slate-600">
                Ajmera Infinity, Electronic City Phase 1, Bangalore - 560100
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#0E3589]" />
                  All Days (4:00 PM – 7:00 PM)
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  +91 8861751000
                </span>
              </div>
            </div>
          </div>

          {/* Right: Embedded Direct Booking Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-blue-100 shadow-xl space-y-6">
              {isBooked ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">
                    Demo Class Reserved Successfully!
                  </h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you! Mrs. Deepthy Rock has received your request for <strong>{studentName}</strong> on <strong>{demoDate}</strong> at <strong>{demoTime}</strong>. We will connect on WhatsApp shortly.
                  </p>
                  <div className="pt-3 flex flex-wrap justify-center gap-3">
                    <a
                      href={buildWhatsAppUrl(`Hello Mrs. Deepthy Rock! I just booked a Free Demo for ${studentName} on ${demoDate} at ${demoTime}. Looking forward to connecting!`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Confirm via WhatsApp Directly</span>
                    </a>
                    <Button
                      onClick={() => setIsBooked(false)}
                      variant="outline"
                      size="md"
                      className="rounded-2xl"
                    >
                      Book Another Slot
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      Reserve Your Diagnostic Slot
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fill out the brief details below. We guarantee a slot within 24 hours.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Child's Full Name *
                      </label>
                      <Input
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g., Aarav Sharma"
                        required
                        className="rounded-xl text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Child's Grade / Class
                      </label>
                      <Input
                        value={studentGrade}
                        onChange={(e) => setStudentGrade(e.target.value)}
                        placeholder="e.g., Grade 5 / Age 10"
                        className="rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Parent's Name
                      </label>
                      <Input
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder="e.g., Priya Sharma"
                        className="rounded-xl text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        WhatsApp / Phone Number *
                      </label>
                      <Input
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="e.g., 9876543210"
                        type="tel"
                        required
                        className="rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Preferred Date *
                      </label>
                      <Input
                        type="date"
                        value={demoDate}
                        onChange={(e) => setDemoDate(e.target.value)}
                        required
                        className="rounded-xl text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Preferred Slot (4:00 PM – 7:00 PM) *
                      </label>
                      <Input
                        type="text"
                        value={demoTime}
                        onChange={(e) => setDemoTime(e.target.value)}
                        placeholder="e.g., 04:30 PM"
                        required
                        className="rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Parent's Email Address (Optional)
                    </label>
                    <Input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="e.g., parent@gmail.com"
                      className="rounded-xl text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Handwriting Issues or Questions (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g., Writes too slowly in exams, improper pencil grip, messy cursive..."
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E3589]/20 focus:border-[#0E3589]"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white rounded-2xl font-black py-3.5 shadow-lg shadow-orange-500/20 text-sm justify-center cursor-pointer"
                    id="btn-submit-free-demo"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Reserving Slot...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Confirm Free Demo Class Booking</span>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>

                  <p className="text-[11px] text-center text-slate-400">
                    🔒 No spam guarantee. Your contact number is used strictly to coordinate your child's demo slot.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. DEMO CLASS FAQS */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#0E3589] rounded-full text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-[#0E3589]" />
            Frequently Asked Questions
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Questions About the Free Demo Session
          </h2>
        </div>

        <div className="space-y-3">
          {demoFaqs.map((faq, idx) => (
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
                <span className="text-slate-400 font-normal text-xs shrink-0">
                  {activeFaq === idx ? '▲' : '▼'}
                </span>
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
    </div>
  );
};
