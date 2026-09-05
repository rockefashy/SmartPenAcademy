import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  User, 
  Phone, 
  BookOpen, 
  CheckSquare, 
  Clock, 
  ShieldCheck, 
  CheckCircle, 
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Lock,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { enrollmentProperties } from '../properties/enrollment.properties';
import { api } from '../services/api';
import { DominantHand, Gender } from '../types';
import { formatDominantHand } from '../utils/formatters';

interface EnrollmentPageProps {
  onNavigate: (view: string, studentId?: string, defaultSection?: any) => void;
  onOpenDemoModal?: () => void;
  initialData?: {
    studentName?: string;
    parentName?: string;
    contactNumber?: string;
    age?: string | number;
    modeOfLearning?: 'In-person' | 'Online';
    notes?: string;
    fromDemoBookingId?: string;
  } | null;
  onBackToDemoBookings?: () => void;
}

export const EnrollmentPage: React.FC<EnrollmentPageProps> = ({ 
  onNavigate, 
  initialData, 
  onBackToDemoBookings 
}) => {
  // Helper to parse student pre-population from demo booking inquiry
  const parsePrefillData = (data?: typeof initialData) => {
    const rawName = (data?.studentName || '').trim();
    const nameParts = rawName ? rawName.split(/\s+/) : [];
    const prefillFirst = nameParts[0] || '';
    const prefillLast = nameParts.slice(1).join(' ') || '';
    const cleanAge = String(data?.age || '').replace(/\D/g, '');
    const ageNum = cleanAge ? parseInt(cleanAge, 10) : '';
    const mode = data?.modeOfLearning === 'Online' ? 'Online' : 'In-person';
    return {
      firstName: prefillFirst,
      lastName: prefillLast,
      age: ageNum,
      modeOfLearning: mode as 'In-person' | 'Online',
      parentName: data?.parentName || '',
      whatsappMobile: data?.contactNumber || '',
    };
  };

  const initialValues = parsePrefillData(initialData);

  // Section 1: Student Profile
  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [modeOfLearning, setModeOfLearning] = useState<'In-person' | 'Online'>(initialValues.modeOfLearning);
  const [age, setAge] = useState<number | string>(initialValues.age);
  const [gender, setGender] = useState<Gender>('Female');
  const [gradeClass, setGradeClass] = useState('');
  const [dominantHand, setDominantHand] = useState<DominantHand>('Right');
  const [schoolName, setSchoolName] = useState('');

  // Section 2: Parent details & Login setup
  const [parentName, setParentName] = useState(initialValues.parentName);
  const [whatsappMobile, setWhatsappMobile] = useState(initialValues.whatsappMobile);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [residentialArea, setResidentialArea] = useState('');

  // Synchronize state when initialData changes or arrives on screen load
  useEffect(() => {
    if (initialData) {
      const parsed = parsePrefillData(initialData);
      setFirstName(parsed.firstName);
      setLastName(parsed.lastName);
      setAge(parsed.age);
      setModeOfLearning(parsed.modeOfLearning);
      setParentName(parsed.parentName);
      setWhatsappMobile(parsed.whatsappMobile);
    }
  }, [initialData]);

  // Section 3: Programs & Modules (No defaults on load, select at least one)
  const [scriptsRequired, setScriptsRequired] = useState<string[]>([]);
  const [academicModules, setAcademicModules] = useState<string[]>([]);

  // Section 4: Schedule (No defaults on load, mandatory 2 days and 1 time slot)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [preferredSlot, setPreferredSlot] = useState<string>('');

  // Section 5: Areas of Concern (Parent Observations) (No defaults on load, select at least one)
  const [diagnosticObservations, setDiagnosticObservations] = useState<string[]>([]);

  // Section 6: Consents & Declaration
  const [practiceCommitment, setPracticeCommitment] = useState(true);
  const [feePolicyAccepted, setFeePolicyAccepted] = useState(true);
  const [mediaConsent, setMediaConsent] = useState(true);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<{
    studentId: string;
    studentName: string;
    email: string;
    password: string;
  } | null>(null);

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

    const calculatedDisplayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim()) {
      setErrorMessage(enrollmentProperties.validation?.fullNameRequired || "Student's First Name is required.");
      return;
    }

    if (!age || Number(age) <= 0 || isNaN(Number(age))) {
      setErrorMessage(enrollmentProperties.validation.ageRequired);
      return;
    }

    if (!parentName.trim()) {
      setErrorMessage(enrollmentProperties.validation.parentNameRequired);
      return;
    }

    if (!whatsappMobile.trim() || whatsappMobile.trim().replace(/\D/g, '').length < 10) {
      setErrorMessage(enrollmentProperties.validation.phoneRequired);
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage(enrollmentProperties.validation.emailRequired);
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage(enrollmentProperties.validation.passwordRequired);
      return;
    }

    if (selectedDays.length !== 2) {
      setErrorMessage(enrollmentProperties.validation.daysRequired);
      return;
    }

    if (!preferredSlot) {
      setErrorMessage(enrollmentProperties.validation.slotRequired);
      return;
    }

    if (scriptsRequired.length === 0) {
      setErrorMessage(enrollmentProperties.validation.scriptRequired);
      return;
    }

    if (academicModules.length === 0) {
      setErrorMessage(enrollmentProperties.validation.moduleRequired);
      return;
    }

    if (diagnosticObservations.length === 0) {
      setErrorMessage(enrollmentProperties.validation.observationRequired);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: calculatedDisplayName,
        fullName: calculatedDisplayName,
        modeOfLearning,
        age: Number(age),
        gender,
        gradeClass: gradeClass.trim() || undefined,
        dominantHand,
        schoolName: schoolName.trim() || '',
        parentName: parentName.trim(),
        whatsappMobile: whatsappMobile.trim() || '',
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        email: email.trim().toLowerCase(),
        password: password.trim(),
        residentialArea: residentialArea.trim() || '',
        scriptsRequired,
        academicModules,
        diagnosticObservations,
        preferredDays: selectedDays.join(' & '),
        preferredSlot,
        practiceCommitment,
        feePolicyAccepted,
        mediaConsent,
        username: email.trim().toLowerCase(),
        status: 'Active' as const,
        enrollmentDate: new Date().toISOString().split('T')[0],
      };

      const result = await api.enrollStudent(payload);

      // If enrolled via fast-track from a demo booking inquiry, auto-update demo booking status to 'Enrolled'
      if (initialData?.fromDemoBookingId) {
        try {
          await api.updateDemoBooking(initialData.fromDemoBookingId, { status: 'Enrolled' });
        } catch (updateErr) {
          console.warn('Could not auto-update demo booking status:', updateErr);
        }
      }

      // Trigger confetti celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setSuccessModalData({
        studentId: result.student.id,
        studentName: result.student.displayName,
        email: result.student.email || result.credentials?.parentEmail || email.trim().toLowerCase(),
        password: password.trim(),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Top Bar: Back to Demo Inquiries navigation */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (onBackToDemoBookings) {
              onBackToDemoBookings();
            } else {
              onNavigate('admin', undefined, 'alerts');
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-[#0E3589] font-bold text-xs rounded-2xl border border-slate-200 shadow-xs hover:border-[#0E3589]/40 transition-all cursor-pointer group"
          id="btn-back-to-demo-bookings"
        >
          <ArrowLeft className="w-4 h-4 text-[#F46E20] group-hover:-translate-x-0.5 transition-transform" />
          <span>← Back to Demo Inquiries</span>
        </button>

        {initialData?.fromDemoBookingId && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-[#F46E20] text-xs font-extrabold rounded-xl border border-orange-200 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fast-Track Demo Conversion</span>
          </span>
        )}
      </div>

      {/* Fast-Track Pre-population Notice Banner */}
      {initialData && (
        <div className="mb-6 p-4 bg-orange-50/90 border border-orange-200 rounded-2xl flex items-start sm:items-center gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#F46E20] text-white flex items-center justify-center shrink-0 shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900">
              Fast-Track Pre-populated for {initialData.studentName || 'Student'}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Student name, parent contact, age, and preferred mode were automatically populated from the demo booking inquiry. Please complete the remaining curriculum options and submit to complete registration.
            </p>
          </div>
        </div>
      )}

      {/* Simple Clean Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {enrollmentProperties.header.formTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium">
          {enrollmentProperties.header.tagline}
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2" id="enrollment-error-banner">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-8" id="student-enrollment-form">
        {/* ========================================================================= */}
        {/* SECTION 1: STUDENT PROFILE                                               */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-blue-100 shadow-md space-y-5" id="section-1-student-profile">
          <div className="flex items-center gap-2.5 pb-3 border-b border-blue-100 text-[#0E3589]">
            <User className="w-5 h-5 text-[#F46E20]" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              {enrollmentProperties.section1.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name & Last Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.firstName} *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={enrollmentProperties.section1.firstNamePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                id="input-student-firstname"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.lastName}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={enrollmentProperties.section1.lastNamePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                id="input-student-lastname"
              />
            </div>

            {/* Age (Numeric in years) - Mandatory */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.age} *
              </label>
              <input
                type="number"
                required
                min={3}
                max={25}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={enrollmentProperties.section1.agePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                id="input-student-age"
              />
            </div>

            {/* Gender - Mandatory */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.gender} *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                id="select-student-gender"
              >
                {enrollmentProperties.section1.genderOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Grade / Class - Optional */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.gradeClass}
              </label>
              <input
                type="text"
                value={gradeClass}
                onChange={(e) => setGradeClass(e.target.value)}
                placeholder={enrollmentProperties.section1.gradePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                id="input-student-grade"
              />
            </div>

            {/* Dominant Hand - Mandatory */}
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
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      dominantHand === hand
                        ? 'bg-[#0E3589] text-white border-[#0E3589]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {formatDominantHand(hand)}
                  </button>
                ))}
              </div>
            </div>

            {/* School Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.schoolName}
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder={enrollmentProperties.section1.schoolPlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                id="input-student-school"
              />
            </div>

            {/* Mode of Learning */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.modeOfLearning} *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {enrollmentProperties.section1.modeOfLearningOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setModeOfLearning(opt as 'In-person' | 'Online')}
                    className={`py-2.5 px-4 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      modeOfLearning === opt
                        ? 'bg-[#0E3589] text-white border-[#0E3589] shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    id={`btn-student-mode-${opt.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  >
                    <span>{opt === 'In-person' ? '🏫 In-person Classroom' : '💻 Online Live Class'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: PARENT / GUARDIAN CONTACT DETAILS & LOGIN SETUP                */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-orange-100 shadow-md space-y-5" id="section-2-parent-details">
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
                id="input-parent-name"
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
                id="input-parent-whatsapp"
              />
            </div>

            {/* Emergency Contact Details */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.emergencyContactName}
              </label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder={enrollmentProperties.section2.emergencyContactNamePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
                id="input-emergency-contact-name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.emergencyContactPhone}
              </label>
              <input
                type="text"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder={enrollmentProperties.section2.emergencyContactPhonePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
                id="input-emergency-contact-phone"
              />
            </div>

            {/* Email Address - Login ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.emailAddress} *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={enrollmentProperties.section2.emailAddressPlaceholder}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
                id="input-parent-email"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {enrollmentProperties.section2.emailAddressHint}
              </p>
            </div>

            {/* Password field - 8 char */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section2.password} *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={enrollmentProperties.section2.passwordPlaceholder}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20]"
                  id="input-parent-password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {enrollmentProperties.section2.passwordHint}
              </p>
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
                id="input-residential-area"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: PROGRAM SELECTION & SKILL GOALS                                */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-6" id="section-3-programs">
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

        {/* ========================================================================= */}
        {/* SECTION 4: PREFERRED SCHEDULE (Swapped with Section 5)                     */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-5" id="section-4-preferred-schedule">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 text-slate-800">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#0084F4]" />
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
                {enrollmentProperties.section4.title}
              </h2>
            </div>
            <span className="text-xs font-bold text-[#0E3589] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Days: {selectedDays.length}/2 | Slot: {preferredSlot ? preferredSlot : 'None'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Preferred Days - 7 Days selection (max 2 allowed) */}
            <div className="lg:col-span-7 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {enrollmentProperties.section4.preferredDays} *
                </label>
                <p className="text-[11px] text-slate-500">
                  {enrollmentProperties.section4.preferredDaysHint}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {enrollmentProperties.section4.preferredDaysOptions.map((day) => {
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
                  {enrollmentProperties.section4.preferredSlot} *
                </label>
                <p className="text-[11px] text-slate-500">
                  {enrollmentProperties.section4.preferredSlotHint}
                </p>
              </div>

              <div className="space-y-2">
                {enrollmentProperties.section4.preferredSlotOptions.map((slot) => {
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

              {!preferredSlot && (
                <p className="text-[11px] text-amber-600 font-medium">
                  ⚠️ Please select 1 preferred time slot.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 5: AREAS OF CONCERN (PARENT OBSERVATIONS)                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-4" id="section-5-areas-of-concern">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800">
            <CheckSquare className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              {enrollmentProperties.section5.title}
            </h2>
          </div>

          <div className="space-y-2.5">
            {enrollmentProperties.section5.diagnosticItems.map((obs, idx) => {
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

        {/* ========================================================================= */}
        {/* SECTION 6: CONSENT & DECLARATION                                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-3" id="section-6-consent-declaration">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" id="enrollment-success-modal">
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
                <span className="text-slate-500 font-sans">Student:</span>
                <span className="font-bold text-[#0E3589]">{successModalData.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">{enrollmentProperties.modalSuccess.emailLoginLabel}</span>
                <span className="font-bold text-emerald-700">{successModalData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">{enrollmentProperties.modalSuccess.passwordLabel}</span>
                <span className="font-bold text-slate-900">{successModalData.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">{enrollmentProperties.modalSuccess.statusLabel}</span>
                <span className="font-bold text-emerald-600">Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('studentDetail', successModalData.studentId)}
                className="py-3 px-4 bg-[#0E3589] hover:bg-[#08235f] text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                id="btn-success-view-details"
              >
                <span>{enrollmentProperties.modalSuccess.viewStudentDetailsBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onBackToDemoBookings) {
                    onBackToDemoBookings();
                  } else {
                    onNavigate('admin', undefined, 'alerts');
                  }
                }}
                className="py-3 px-4 bg-[#F46E20] hover:bg-[#d6570e] text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                id="btn-success-go-roster"
              >
                {initialData?.fromDemoBookingId ? 'Back to Demo Inquiries' : enrollmentProperties.modalSuccess.goToAdminRosterBtn}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
