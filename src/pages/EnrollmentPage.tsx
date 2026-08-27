import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  BookOpen, 
  CheckSquare, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  Award, 
  Key, 
  CheckCircle, 
  ArrowRight,
  School,
  AlertCircle
} from 'lucide-react';
import { enrollmentProperties } from '../properties/enrollment.properties';
import { api } from '../services/api';
import { DominantHand, Gender, StudentStatus } from '../types';

interface EnrollmentPageProps {
  onNavigate: (view: string, studentId?: string) => void;
  onOpenDemoModal?: () => void;
}

export const EnrollmentPage: React.FC<EnrollmentPageProps> = ({ onNavigate, onOpenDemoModal }) => {
  // Form Data State
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('2016-05-10');
  const [gender, setGender] = useState<Gender>('Female');
  const [gradeClass, setGradeClass] = useState('');
  const [dominantHand, setDominantHand] = useState<DominantHand>('Right');
  const [schoolName, setSchoolName] = useState('');
  const [instructionMedium, setInstructionMedium] = useState('English');

  // Section 2: Parent details
  const [parentName, setParentName] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [whatsappMobile, setWhatsappMobile] = useState('');
  const [email, setEmail] = useState('');
  const [residentialArea, setResidentialArea] = useState('');

  // Section 3: Programs & Modules
  const [scriptsRequired, setScriptsRequired] = useState<string[]>([
    enrollmentProperties.section3.scriptsOptions[1], // Cursive Writing default
  ]);
  const [academicModules, setAcademicModules] = useState<string[]>([
    enrollmentProperties.section3.modulesOptions[1], // Exam Speed & Layouts
  ]);

  // Section 4: Diagnostic Checklist
  const [diagnosticObservations, setDiagnosticObservations] = useState<string[]>([
    enrollmentProperties.section4.diagnosticItems[0],
    enrollmentProperties.section4.diagnosticItems[2],
  ]);

  // Section 5: Schedule (Select 2 days per week, and 1-hour slot between 4-7 PM)
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Tuesday',
    'Thursday',
  ]);
  const [preferredSlot, setPreferredSlot] = useState(enrollmentProperties.section5.preferredSlotOptions[0]);

  // Section 6: Consents
  const [practiceCommitment, setPracticeCommitment] = useState(true);
  const [feePolicyAccepted, setFeePolicyAccepted] = useState(true);
  const [mediaConsent, setMediaConsent] = useState(true);

  // Section 7: Coach Assessment
  const [gripClassification, setGripClassification] = useState<'Tripod' | 'Quadropod' | 'Other'>('Tripod');
  const [initialPressureLevel, setInitialPressureLevel] = useState<'Light' | 'Optimal' | 'Heavy'>('Optimal');
  const [baselineSpeedWpm, setBaselineSpeedWpm] = useState<number>(16);
  const [recommendedLevel, setRecommendedLevel] = useState('Level 2 - Cursive & Speed Foundation');
  const [coachRemarks, setCoachRemarks] = useState('');

  // Section 8: Credentials & Status
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('password123');
  const [status, setStatus] = useState<StudentStatus>('Active');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<{
    studentId: string;
    username: string;
    password: string;
    studentName: string;
    parentEmail: string;
  } | null>(null);

  // Auto-generate username when fullName changes
  const handleFullNameChange = (val: string) => {
    setFullName(val);
    if (!username || username.startsWith('std_')) {
      const generated = `std_${val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
      setUsername(generated);
    }
  };

  const toggleScript = (script: string) => {
    setScriptsRequired((prev) =>
      prev.includes(script) ? prev.filter((s) => s !== script) : [...prev, script]
    );
  };

  const toggleModule = (module: string) => {
    setAcademicModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    );
  };

  const toggleObservation = (obs: string) => {
    setDiagnosticObservations((prev) =>
      prev.includes(obs) ? prev.filter((o) => o !== obs) : [...prev, obs]
    );
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      if (prev.length >= 2) {
        // Replace oldest or keep max 2 by swapping
        return [prev[1], day];
      }
      return [...prev, day];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !parentName.trim() || !email.trim()) {
      setErrorMessage('Please fill in all mandatory fields.');
      return;
    }

    if (selectedDays.length !== 2) {
      setErrorMessage('Please select exactly 2 preferred days in a week.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        fullName: fullName.trim(),
        dateOfBirth,
        gender,
        gradeClass: gradeClass.trim() || 'Grade 5',
        dominantHand,
        schoolName: schoolName.trim() || 'School of Excellence',
        instructionMedium: instructionMedium.trim() || 'English',
        parentName: parentName.trim(),
        relationship,
        whatsappMobile: whatsappMobile.trim() || '+91 98401 00000',
        email: email.trim(),
        residentialArea: residentialArea.trim() || 'Chennai',
        scriptsRequired,
        academicModules,
        diagnosticObservations,
        preferredDays: selectedDays.join(' & '),
        preferredSlot,
        practiceCommitment,
        feePolicyAccepted,
        mediaConsent,
        gripClassification,
        initialPressureLevel,
        baselineSpeedWpm: Number(baselineSpeedWpm) || 15,
        recommendedLevel,
        coachRemarks,
        username: username.trim() || `std_${Date.now()}`,
        password: password.trim() || 'password123',
        status,
        enrollmentDate: new Date().toISOString().split('T')[0],
      };

      const result = await api.enrollStudent(payload);

      // Trigger confetti celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setSuccessModalData({
        studentId: result.student.id,
        studentName: result.student.fullName,
        username: result.credentials.username,
        password: result.credentials.password,
        parentEmail: result.credentials.parentEmail,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Simple Clean Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Student Registration Form
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium">
          Transforming Handwriting into Academic Excellence • Age 4 to 18
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: STUDENT PROFILE */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-blue-100 shadow-md space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-blue-100 text-[#0E3589]">
            <User className="w-5 h-5 text-[#F46E20]" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              {enrollmentProperties.section1.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.fullName} *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => handleFullNameChange(e.target.value)}
                placeholder={enrollmentProperties.section1.fullNamePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.dateOfBirth} *
              </label>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.gender} *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
              >
                {enrollmentProperties.section1.genderOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.gradeClass} *
              </label>
              <input
                type="text"
                required
                value={gradeClass}
                onChange={(e) => setGradeClass(e.target.value)}
                placeholder={enrollmentProperties.section1.gradePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.dominantHand} *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {enrollmentProperties.section1.dominantHandOptions.map((hand) => (
                  <button
                    key={hand}
                    type="button"
                    onClick={() => setDominantHand(hand as DominantHand)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      dominantHand === hand
                        ? 'bg-[#0E3589] text-white border-[#0E3589]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {hand} Handed
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.schoolName}
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder={enrollmentProperties.section1.schoolPlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.instructionMedium}
              </label>
              <input
                type="text"
                value={instructionMedium}
                onChange={(e) => setInstructionMedium(e.target.value)}
                placeholder={enrollmentProperties.section1.instructionMediumPlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PARENT / GUARDIAN CONTACT DETAILS */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-orange-100 shadow-md space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-orange-100 text-[#F46E20]">
            <Phone className="w-5 h-5 text-[#0E3589]" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-800">
              {enrollmentProperties.section2.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.parentName} *
              </label>
              <input
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder={enrollmentProperties.section2.parentNamePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.relationship} *
              </label>
              <input
                type="text"
                required
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder={enrollmentProperties.section2.relationshipPlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.whatsappMobile} *
              </label>
              <input
                type="text"
                required
                value={whatsappMobile}
                onChange={(e) => setWhatsappMobile(e.target.value)}
                placeholder={enrollmentProperties.section2.whatsappMobilePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.emailAddress} * (For reports &amp; fee reminders)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={enrollmentProperties.section2.emailAddressPlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.residentialArea}
              </label>
              <input
                type="text"
                value={residentialArea}
                onChange={(e) => setResidentialArea(e.target.value)}
                placeholder={enrollmentProperties.section2.residentialAreaPlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: PROGRAM SELECTION & SKILL GOALS */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-[#0E3589]">
            <BookOpen className="w-5 h-5 text-[#0084F4]" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-800">
              {enrollmentProperties.section3.title}
            </h2>
          </div>

          {/* A. Handwriting Scripts */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0E3589] mb-3">
              {enrollmentProperties.section3.scriptsTitle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {enrollmentProperties.section3.scriptsOptions.map((script) => {
                const isSelected = scriptsRequired.includes(script);
                return (
                  <button
                    key={script}
                    type="button"
                    onClick={() => toggleScript(script)}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-[#0E3589] text-[#0E3589] shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{script}</span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-[#0E3589] text-white' : 'border border-slate-300'
                    }`}>
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* B. Academic & Skill Modules */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#F46E20] mb-3">
              {enrollmentProperties.section3.modulesTitle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {enrollmentProperties.section3.modulesOptions.map((module) => {
                const isSelected = academicModules.includes(module);
                return (
                  <button
                    key={module}
                    type="button"
                    onClick={() => toggleModule(module)}
                    className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50 border-[#F46E20] text-[#F46E20] shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{module}</span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-[#F46E20] text-white' : 'border border-slate-300'
                    }`}>
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 4: DIAGNOSTIC CHECKLIST */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800">
            <CheckSquare className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              {enrollmentProperties.section4.title}
            </h2>
          </div>

          <div className="space-y-2.5">
            {enrollmentProperties.section4.diagnosticItems.map((obs, idx) => {
              const isChecked = diagnosticObservations.includes(obs);
              return (
                <label
                  key={idx}
                  onClick={() => toggleObservation(obs)}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-amber-50/60 border-amber-300 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-0.5 rounded text-[#0E3589] focus:ring-[#0E3589]"
                  />
                  <span className="text-xs font-medium leading-relaxed">{obs}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: PREFERRED SCHEDULE */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 text-slate-800">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#0084F4]" />
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
                {enrollmentProperties.section5.title}
              </h2>
            </div>
            <span className="text-xs font-bold text-[#0E3589] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Selected: {selectedDays.length}/2 Days
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Preferred Days - 7 Days selection (max 2 allowed) */}
            <div className="lg:col-span-7 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {enrollmentProperties.section5.preferredDays} *
                </label>
                <p className="text-[11px] text-slate-500">
                  {enrollmentProperties.section5.preferredDaysHint}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {enrollmentProperties.section5.preferredDaysOptions.map((day) => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#0E3589] text-white border-[#0E3589] shadow-md shadow-blue-900/10'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <span>{day}</span>
                      <span
                        className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] ${
                          isSelected
                            ? 'bg-white text-[#0E3589] border-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDays.length === 0 && (
                <p className="text-[11px] text-amber-600 font-medium">
                  ⚠️ Please choose 2 days of the week for classes.
                </p>
              )}
            </div>

            {/* Preferred Time Slot - 4 to 5 PM with 30 min intervals up to 7 PM */}
            <div className="lg:col-span-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {enrollmentProperties.section5.preferredSlot} *
                </label>
                <p className="text-[11px] text-slate-500">
                  {enrollmentProperties.section5.preferredSlotHint}
                </p>
              </div>

              <div className="space-y-2">
                {enrollmentProperties.section5.preferredSlotOptions.map((slot) => {
                  const isSelected = preferredSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setPreferredSlot(slot)}
                      className={`w-full p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#F46E20] text-white border-[#F46E20] shadow-md shadow-orange-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-400'}`} />
                        {slot}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] uppercase tracking-wider font-extrabold bg-white/20 px-2 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 6: CONSENT & DECLARATION */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-3">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              {enrollmentProperties.section6.title}
            </h2>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700 font-sans font-medium">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={practiceCommitment}
                onChange={(e) => setPracticeCommitment(e.target.checked)}
                className="mt-0.5 text-[#0E3589] rounded"
              />
              <span>{enrollmentProperties.section6.practiceCommitment}</span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={feePolicyAccepted}
                onChange={(e) => setFeePolicyAccepted(e.target.checked)}
                className="mt-0.5 text-[#0E3589] rounded"
              />
              <span>{enrollmentProperties.section6.feePolicy}</span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={mediaConsent}
                onChange={(e) => setMediaConsent(e.target.checked)}
                className="mt-0.5 text-[#0E3589] rounded"
              />
              <span>{enrollmentProperties.section6.mediaConsent}</span>
            </label>
          </div>
        </div>

        {/* SECTION 7: LOGIN CREDENTIALS */}
        <div className="bg-gradient-to-br from-blue-50/80 via-white to-orange-50/40 rounded-3xl p-6 sm:p-8 border-2 border-blue-200 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-200 text-[#0E3589]">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-[#F46E20]" />
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
                {enrollmentProperties.section7.title}
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-extrabold border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Default Status: {status}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section7.username} *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={enrollmentProperties.section7.usernamePlaceholder}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#0E3589] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section7.password} *
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={enrollmentProperties.section7.passwordPlaceholder}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-[#0E3589] outline-none"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-[#0E3589] font-medium leading-relaxed">
            <span className="text-sm">ℹ️</span>
            <span>{enrollmentProperties.section7.statusAdminNotice}</span>
          </div>

          <div className="p-3 bg-white/80 rounded-2xl border border-slate-200 text-xs text-slate-600 font-medium leading-relaxed">
            {enrollmentProperties.section7.emailNotificationNotice}
          </div>
        </div>

        {/* Submit Action */}
        <div className="text-center pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto min-w-[320px] py-4 px-10 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white font-black text-base rounded-2xl shadow-xl shadow-orange-500/25 hover:shadow-orange-500/35 transition-all transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
            id="btn-submit-enrollment"
          >
            {isSubmitting ? enrollmentProperties.submittingText : enrollmentProperties.submitButton}
          </button>
        </div>
      </form>

      {/* Enrollment Success Modal */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border-4 border-emerald-400 text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-slate-900">
              {enrollmentProperties.modalSuccess.title}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
              {enrollmentProperties.modalSuccess.message}
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 space-y-2 font-mono text-xs">
              <p className="font-sans font-bold text-slate-800 border-b pb-1 text-[11px]">
                {enrollmentProperties.modalSuccess.credentialsHeader}
              </p>
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-bold text-[#0E3589]">{successModalData.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{enrollmentProperties.modalSuccess.usernameLabel}</span>
                <span className="font-bold text-emerald-700">{successModalData.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{enrollmentProperties.modalSuccess.passwordLabel}</span>
                <span className="font-bold text-slate-900">{successModalData.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{enrollmentProperties.modalSuccess.parentEmailLabel}</span>
                <span className="text-[#0E3589]">{successModalData.parentEmail}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('studentDetail', successModalData.studentId)}
                className="py-3 px-4 bg-[#0E3589] hover:bg-[#08235f] text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{enrollmentProperties.modalSuccess.viewStudentDetailsBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="py-3 px-4 bg-[#F46E20] hover:bg-[#d6570e] text-white font-bold text-xs rounded-xl shadow transition-colors"
              >
                {enrollmentProperties.modalSuccess.goToAdminRosterBtn}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
