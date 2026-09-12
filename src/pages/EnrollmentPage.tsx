import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Select, FormField } from '../components/ui/FormField';
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
  AlertCircle,
  Lock,
  Sparkles,
  UserCheck,
  Save,
  X,
  Users
} from 'lucide-react';
import { enrollmentProperties } from '../properties/enrollment.properties';
import { api } from '../services/api';
import { DominantHand, Gender, StudentProfile } from '../types';
import { formatDominantHand } from '../utils/formatters';

interface EnrollmentPageProps {
  onNavigate?: (view: string, studentId?: string, defaultSection?: any) => void;
  onOpenDemoModal?: () => void;
  initialData?: {
    studentName?: string;
    parentName?: string;
    contactNumber?: string;
    age?: string | number;
    modeOfLearning?: 'In-person' | 'Online';
    notes?: string;
    fromDemoBookingId?: string;
    isSiblingEnrollment?: boolean;
    siblingOfStudentId?: string;
    siblingOfStudentName?: string;
    email?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    residentialArea?: string;
  } | null;
  onBackToDemoBookings?: () => void;
  mode?: 'enroll' | 'edit';
  studentToEdit?: StudentProfile | null;
  onSuccess?: (student: any, isEdit: boolean) => void;
  onCancel?: () => void;
}

export const EnrollmentPage: React.FC<EnrollmentPageProps> = ({ 
  onNavigate, 
  initialData, 
  mode = 'enroll',
  studentToEdit,
  onSuccess,
  onCancel
}) => {
  const isEditMode = mode === 'edit' || !!studentToEdit;
  const isSiblingEnrollment = Boolean(initialData?.isSiblingEnrollment);

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
      email: data?.email || '',
      emergencyContactName: data?.emergencyContactName || '',
      emergencyContactPhone: data?.emergencyContactPhone || '',
      residentialArea: data?.residentialArea || '',
      isSiblingEnrollment: Boolean(data?.isSiblingEnrollment),
      siblingOfStudentName: data?.siblingOfStudentName || '',
      siblingOfStudentId: data?.siblingOfStudentId || ''
    };
  };

  // Helper to parse schedule days string
  const parseDays = (daysStr?: string): string[] => {
    if (!daysStr) return [];
    return daysStr
      .split(/&|,|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => s && !['&', ',', 'and'].includes(s.toLowerCase()));
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
  const [emergencyContactName, setEmergencyContactName] = useState(initialValues.emergencyContactName);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialValues.emergencyContactPhone);
  const [email, setEmail] = useState(initialValues.email);
  const [password, setPassword] = useState('');
  const [residentialArea, setResidentialArea] = useState(initialValues.residentialArea);

  // Status & Date of Leaving Governance (Admin Controlled)
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [dateOfLeaving, setDateOfLeaving] = useState<string>('');

  // Section 3: Programs & Modules
  const [scriptsRequired, setScriptsRequired] = useState<string[]>([]);
  const [academicModules, setAcademicModules] = useState<string[]>([]);

  // Section 4: Schedule
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [preferredSlot, setPreferredSlot] = useState<string>('');

  // Section 5: Areas of Concern (Parent Observations)
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

  // Synchronize state when studentToEdit or initialData changes
  useEffect(() => {
    if (studentToEdit) {
      const firstNameVal = studentToEdit.firstName || '';
      const lastNameVal = studentToEdit.lastName || '';
      setFirstName(studentToEdit.firstName || '');
      setLastName(studentToEdit.lastName || '');
      setModeOfLearning(studentToEdit.modeOfLearning || 'In-person');
      setAge(studentToEdit.age !== undefined && studentToEdit.age !== null ? studentToEdit.age : '');
      setGender(studentToEdit.gender || 'Female');
      setGradeClass(studentToEdit.gradeClass || '');
      setDominantHand(studentToEdit.dominantHand || 'Right');
      setSchoolName(studentToEdit.schoolName || '');
      setParentName(studentToEdit.parentName || '');
      setWhatsappMobile(studentToEdit.whatsappMobile || '');
      setEmergencyContactName(studentToEdit.emergencyContactName || '');
      setEmergencyContactPhone(studentToEdit.emergencyContactPhone || studentToEdit.emergencyPhone || '');
      setEmail(studentToEdit.email || '');
      setPassword(''); // Blank when editing to preserve current password
      setResidentialArea(studentToEdit.residentialArea || '');
      setScriptsRequired(Array.isArray(studentToEdit.scriptsRequired) ? studentToEdit.scriptsRequired : []);
      setAcademicModules(Array.isArray(studentToEdit.academicModules) ? studentToEdit.academicModules : []);
      setSelectedDays(parseDays(studentToEdit.preferredDays));
      setPreferredSlot(studentToEdit.preferredSlot || '');
      setDiagnosticObservations(Array.isArray(studentToEdit.diagnosticObservations) ? studentToEdit.diagnosticObservations : []);
      setPracticeCommitment(studentToEdit.practiceCommitment !== false);
      setFeePolicyAccepted(studentToEdit.feePolicyAccepted !== false);
      setMediaConsent(studentToEdit.mediaConsent !== false);
      setStatus(studentToEdit.status || 'Active');
      setDateOfLeaving(studentToEdit.dateOfLeaving || '');
    } else if (initialData) {
      const parsed = parsePrefillData(initialData);
      setFirstName(parsed.firstName);
      setLastName(parsed.lastName);
      setAge(parsed.age);
      setModeOfLearning(parsed.modeOfLearning);
      setParentName(parsed.parentName);
      setWhatsappMobile(parsed.whatsappMobile);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.emergencyContactName) setEmergencyContactName(parsed.emergencyContactName);
      if (parsed.emergencyContactPhone) setEmergencyContactPhone(parsed.emergencyContactPhone);
      if (parsed.residentialArea) setResidentialArea(parsed.residentialArea);
    }
  }, [studentToEdit, initialData]);

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
        return [prev[1], day];
      }
      return [...prev, day];
    });
  };

  const handleValidationError = (message: string, elementId?: string) => {
    setErrorMessage(message);
    if (elementId) {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
          el.focus({ preventScroll: true });
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const calculatedDisplayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim()) {
      handleValidationError(enrollmentProperties.validation?.fullNameRequired || "Student's First Name is required.", "input-student-firstname");
      return;
    }

    if (!age || Number(age) <= 0 || isNaN(Number(age))) {
      handleValidationError(enrollmentProperties.validation.ageRequired, "input-student-age");
      return;
    }

    if (!parentName.trim()) {
      handleValidationError(enrollmentProperties.validation.parentNameRequired, "input-parent-name");
      return;
    }

    if (!whatsappMobile.trim() || whatsappMobile.trim().replace(/\D/g, '').length < 10) {
      handleValidationError(enrollmentProperties.validation.phoneRequired, "input-whatsapp-mobile");
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      handleValidationError(enrollmentProperties.validation.emailRequired, "input-email-login");
      return;
    }

    if (!isEditMode && !isSiblingEnrollment && (!password || password.length < 8)) {
      handleValidationError(enrollmentProperties.validation.passwordRequired, "input-password");
      return;
    }

    if (isEditMode && password && password.length < 8) {
      handleValidationError(enrollmentProperties.validation.passwordMinLength, "input-password");
      return;
    }

    if (selectedDays.length !== 2) {
      handleValidationError(enrollmentProperties.validation.daysRequired, "section-4-preferred-schedule");
      return;
    }

    if (!preferredSlot) {
      handleValidationError(enrollmentProperties.validation.slotRequired, "select-preferred-slot");
      return;
    }

    if (scriptsRequired.length === 0) {
      handleValidationError(enrollmentProperties.validation.scriptRequired, "section-3-programs-modules");
      return;
    }

    if (academicModules.length === 0) {
      handleValidationError(enrollmentProperties.validation.moduleRequired, "section-3-programs-modules");
      return;
    }

    if (diagnosticObservations.length === 0) {
      handleValidationError(enrollmentProperties.validation.observationRequired, "section-5-areas-of-concern");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && studentToEdit) {
        // ==================== EDIT STUDENT FLOW ====================
        const updatePayload: any = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          
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
          residentialArea: residentialArea.trim() || '',
          scriptsRequired,
          academicModules,
          diagnosticObservations,
          preferredDays: selectedDays.join(' & '),
          preferredSlot,
          status,
          dateOfLeaving: status === 'Inactive' ? (dateOfLeaving || new Date().toISOString().split('T')[0]) : null,
          practiceCommitment,
          feePolicyAccepted,
          mediaConsent,
        };

        if (password && password.trim().length >= 8) {
          updatePayload.password = password.trim();
        }

        const updatedStudent = await api.updateStudent(studentToEdit.id, updatePayload);

        if (onSuccess) {
          onSuccess(updatedStudent, true);
        } else if (onNavigate) {
          onNavigate('admin', undefined, 'roster');
        }
      } else {
        // ==================== ENROLL NEW STUDENT FLOW ====================
        const payload: any = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          
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
          password: isSiblingEnrollment ? undefined : (password ? password.trim() : undefined),
          isSiblingEnrollment,
          siblingOfStudentId: initialData?.siblingOfStudentId,
          siblingOfStudentName: initialData?.siblingOfStudentName,
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

        if (onSuccess) {
          onSuccess(result.student, false);
        } else {
          setSuccessModalData({
            studentId: result.student.id,
            studentName: result.student.firstName,
            email: result.student.email || result.credentials?.parentEmail || email.trim().toLowerCase(),
            password: password.trim(),
          });
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process student details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      {/* Top Banner: Fast-Track Demo Conversion Notice if applicable */}
      {initialData?.fromDemoBookingId && !isEditMode && (
        <div className="mb-6 p-4 bg-orange-50/90 border border-orange-200 rounded-2xl flex items-start sm:items-center gap-3.5 shadow-xs animate-in fade-in duration-200">
          <div className="w-10 h-10 rounded-xl bg-[#F46E20] text-white flex items-center justify-center shrink-0 shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-[#F46E20]">
                Fast-Track Conversion
              </span>
              <p className="text-xs font-black text-slate-900">
                Pre-populated from Demo Booking
              </p>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Student details and parent contacts were automatically imported from inquiry. Complete curriculum selections below to finalize registration.
            </p>
          </div>
        </div>
      )}

      {/* Editing Banner */}
      {isEditMode && studentToEdit && (
        <div className="mb-6 p-4 bg-blue-50/90 border border-blue-200 rounded-2xl flex items-center justify-between gap-3.5 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0E3589] text-white flex items-center justify-center shrink-0 shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-[#0E3589]">
                  Editing Student
                </span>
                <p className="text-xs font-black text-slate-900">
                  {studentToEdit.firstName}
                </p>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Modifications will update student credentials, batch schedule, and trigger email notifications to parent & admin.
              </p>
            </div>
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="shrink-0"
            >
              Cancel Edit
            </Button>
          )}
        </div>
      )}

      {/* Form Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight" id="form-heading-title">
          {isEditMode 
            ? (enrollmentProperties.header.editFormTitle || "Edit Student") 
            : (enrollmentProperties.header.enrollFormTitle || enrollmentProperties.header.formTitle || "Enroll New Student")
          }
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 font-medium">
          {isEditMode 
            ? (enrollmentProperties.header.editTagline || `Updating profile and enrollment settings for ${studentToEdit?.firstName || 'Student'}`) 
            : enrollmentProperties.header.tagline
          }
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2" id="enrollment-error-banner">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Registration / Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-8" id="student-enrollment-form">
        {/* ========================================================================= */}
        {/* SECTION: ACCOUNT STATUS & LIFECYCLE GOVERNANCE (ADMIN EDIT MODE ONLY)     */}
        {/* ========================================================================= */}
        {isEditMode && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-amber-200 shadow-md space-y-4" id="section-admin-status-governance">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-100">
              <div className="flex items-center gap-2.5 text-slate-900">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-[#0E3589]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-900">
                    Account Status &amp; Lifecycle Governance
                  </h2>
                  <p className="text-xs text-slate-500">Only administrators have access to change student status or record date of leaving.</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black border self-start sm:self-auto ${
                status === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
              }`} id="badge-current-edit-status">
                {status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <Select
                  label="Student Enrollment Status"
                  required
                  value={status}
                  onChange={(e) => {
                    const newStatus = e.target.value as 'Active' | 'Inactive';
                    setStatus(newStatus);
                    if (newStatus === 'Inactive' && !dateOfLeaving) {
                      setDateOfLeaving(new Date().toISOString().split('T')[0]);
                    } else if (newStatus === 'Active') {
                      setDateOfLeaving('');
                    }
                  }}
                  helperText="Only Active students can log into their application and be managed by coaches."
                  id="select-student-status"
                >
                  <option value="Active">Active (Can Login &amp; Assigned to Coach)</option>
                  <option value="Inactive">Inactive (Deactivated / Left Academy)</option>
                </Select>
              </div>

              <div>
                <Input
                  label={`Date of Leaving ${status === 'Inactive' ? '' : '(Optional)'}`}
                  required={status === 'Inactive'}
                  type="date"
                  value={dateOfLeaving}
                  onChange={(e) => setDateOfLeaving(e.target.value)}
                  helperText={status === 'Inactive' 
                    ? 'Records the date when the student completed or discontinued their courses.' 
                    : 'Auto-set when marked Inactive. Leave blank while student is actively enrolled.'}
                  id="input-student-date-of-leaving"
                />
              </div>
            </div>
          </div>
        )}

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
              <Input
                label={enrollmentProperties.section1.firstName}
                required
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={enrollmentProperties.section1.firstNamePlaceholder}
                id="input-student-firstname"
              />
            </div>

            <div>
              <Input
                label={enrollmentProperties.section1.lastName}
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={enrollmentProperties.section1.lastNamePlaceholder}
                id="input-student-lastname"
              />
            </div>



            {/* Age & Gender */}
            <div>
              <Input
                label={enrollmentProperties.section1.age}
                required
                type="number"
                min="3"
                max="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={enrollmentProperties.section1.agePlaceholder}
                id="input-student-age"
              />
            </div>

            <div>
              <Select
                label={enrollmentProperties.section1.gender}
                required
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                id="select-student-gender"
              >
                {enrollmentProperties.section1.genderOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>

            {/* Grade / Class */}
            <div>
              <Input
                label={enrollmentProperties.section1.gradeClass}
                type="text"
                value={gradeClass}
                onChange={(e) => setGradeClass(e.target.value)}
                placeholder={enrollmentProperties.section1.gradePlaceholder}
                id="input-student-grade"
              />
            </div>

            {/* Dominant Hand */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.dominantHand} *
              </label>
              <div className="flex gap-4 pt-1">
                {enrollmentProperties.section1.dominantHandOptions.map((hand) => (
                  <label key={hand} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 min-h-[44px] py-1">
                    <input
                      type="radio"
                      name="dominantHand"
                      value={hand}
                      checked={dominantHand === hand}
                      onChange={() => setDominantHand(hand as DominantHand)}
                      className="text-[#0E3589] focus:ring-[#0E3589]"
                    />
                    <span>{formatDominantHand(hand)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* School Name */}
            <div>
              <Input
                label={enrollmentProperties.section1.schoolName}
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder={enrollmentProperties.section1.schoolPlaceholder}
                id="input-student-school"
              />
            </div>

            {/* Mode of Learning */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {enrollmentProperties.section1.modeOfLearning} *
              </label>
              <div className="flex gap-4 pt-1">
                {enrollmentProperties.section1.modeOfLearningOptions.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 min-h-[44px] py-1">
                    <input
                      type="radio"
                      name="modeOfLearning"
                      value={opt}
                      checked={modeOfLearning === opt}
                      onChange={() => setModeOfLearning(opt as 'In-person' | 'Online')}
                      className="text-[#0E3589] focus:ring-[#0E3589]"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: PARENT CONTACT & LOGIN CREDENTIALS                             */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-5" id="section-2-parent-details">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-slate-800">
            <div className="flex items-center gap-2.5">
              <Phone className="w-5 h-5 text-[#0E3589]" />
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
                {enrollmentProperties.section2.title}
              </h2>
            </div>
            {isSiblingEnrollment && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold border border-purple-200" id="badge-sibling-locked">
                <Users className="w-3.5 h-3.5" />
                <span>Family Account (Locked)</span>
              </span>
            )}
          </div>

          {isSiblingEnrollment && (
            <div className="p-3.5 bg-purple-50/90 border border-purple-200 rounded-2xl flex items-start gap-3 text-purple-900" id="banner-sibling-enrollment">
              <div className="w-8 h-8 rounded-xl bg-purple-200 text-purple-800 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-purple-950">
                  Enrolling a Sibling for {initialData?.siblingOfStudentName || 'Student'}
                </p>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  Parent contact details are pre-populated from the existing family account and locked to guarantee profile linkage. The student will automatically inherit the family account password.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Parent Name */}
            <div>
              <Input
                label={enrollmentProperties.section2.parentName}
                required
                type="text"
                readOnly={isSiblingEnrollment}
                disabled={isSiblingEnrollment}
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder={enrollmentProperties.section2.parentNamePlaceholder}
                id="input-parent-name"
              />
            </div>

            {/* WhatsApp Mobile */}
            <div>
              <Input
                label={enrollmentProperties.section2.whatsappMobile}
                required
                type="tel"
                readOnly={isSiblingEnrollment}
                disabled={isSiblingEnrollment}
                value={whatsappMobile}
                onChange={(e) => setWhatsappMobile(e.target.value)}
                placeholder={enrollmentProperties.section2.whatsappMobilePlaceholder}
                id="input-whatsapp-mobile"
              />
            </div>

            {/* Emergency Contact Name */}
            <div>
              <Input
                label={enrollmentProperties.section2.emergencyContactName}
                type="text"
                readOnly={isSiblingEnrollment}
                disabled={isSiblingEnrollment}
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder={enrollmentProperties.section2.emergencyContactNamePlaceholder}
                id="input-emergency-name"
              />
            </div>

            {/* Emergency Contact Phone */}
            <div>
              <Input
                label={enrollmentProperties.section2.emergencyContactPhone}
                type="tel"
                readOnly={isSiblingEnrollment}
                disabled={isSiblingEnrollment}
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder={enrollmentProperties.section2.emergencyContactPhonePlaceholder}
                id="input-emergency-phone"
              />
            </div>

            {/* Email Address (Login ID) */}
            <div>
              <Input
                label={enrollmentProperties.section2.emailAddress}
                required
                type="email"
                readOnly={isSiblingEnrollment}
                disabled={isSiblingEnrollment}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={enrollmentProperties.section2.emailAddressPlaceholder}
                helperText={isSiblingEnrollment 
                  ? 'Locked to link this student profile directly to the family account.' 
                  : enrollmentProperties.section2.emailAddressHint}
                id="input-email-login"
              />
            </div>

            {/* Password */}
            <div>
              {isSiblingEnrollment ? (
                <div className="space-y-1.5 font-sans">
                  <label className="block text-xs font-bold text-slate-700 select-none tracking-wide">
                    {enrollmentProperties.section2.password} (Locked - Inherited from Family)
                  </label>
                  <div className="w-full px-4 min-h-[44px] sm:min-h-[38px] py-2.5 sm:py-2 bg-slate-100 border border-slate-300 rounded-xl text-base sm:text-sm text-slate-600 flex items-center justify-between cursor-not-allowed select-none" id="box-password-sibling-locked">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-slate-700">???????????? (Inherited from Family Account)</span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-md border border-purple-200">
                      Locked
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Family password inherited automatically. Parents can manage or customize passwords directly from their portal.
                  </p>
                </div>
              ) : (
                <Input
                  label={`${enrollmentProperties.section2.password} ${isEditMode ? '(Optional - leave blank to keep unchanged)' : ''}`}
                  required={!isEditMode}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    isEditMode 
                      ? "Leave blank to keep existing password" 
                      : enrollmentProperties.section2.passwordPlaceholder
                  }
                  helperText={isEditMode 
                    ? 'Enter a new password (min 8 chars) only if you wish to change credentials' 
                    : enrollmentProperties.section2.passwordHint}
                  id="input-password"
                />
              )}
            </div>

            {/* Residential Area */}
            <div className="sm:col-span-2">
              <Input
                label={enrollmentProperties.section2.residentialArea}
                type="text"
                value={residentialArea}
                onChange={(e) => setResidentialArea(e.target.value)}
                placeholder={enrollmentProperties.section2.residentialAreaPlaceholder}
                id="input-residential-area"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: PROGRAM SELECTION & SKILL GOALS                               */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-6" id="section-3-programs-modules">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              {enrollmentProperties.section3.title}
            </h2>
          </div>

          {/* Scripts required */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              {enrollmentProperties.section3.scriptsTitle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enrollmentProperties.section3.scriptsOptions.map((script) => {
                const isSelected = scriptsRequired.includes(script);
                return (
                  <Button
                    type="button"
                    variant="outline"
                    key={script}
                    onClick={() => toggleScript(script)}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all h-auto min-h-[44px] ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#0E3589] text-[#0E3589] font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs">{script}</span>
                    {isSelected && <CheckCircle className="w-4 h-4 text-[#0E3589] shrink-0" />}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Academic modules */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              {enrollmentProperties.section3.modulesTitle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enrollmentProperties.section3.modulesOptions.map((module) => {
                const isSelected = academicModules.includes(module);
                return (
                  <Button
                    type="button"
                    variant="outline"
                    key={module}
                    onClick={() => toggleModule(module)}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all h-auto min-h-[44px] ${
                      isSelected
                        ? 'bg-orange-50/80 border-[#F46E20] text-[#F46E20] font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-xs">{module}</span>
                    {isSelected && <CheckCircle className="w-4 h-4 text-[#F46E20] shrink-0" />}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 4: PREFERRED SCHEDULE                                            */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-6" id="section-4-preferred-schedule">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800">
            <Clock className="w-5 h-5 text-teal-600" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              {enrollmentProperties.section4.title}
            </h2>
          </div>

          {/* Days Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                {enrollmentProperties.section4.preferredDays} *
              </label>
              <span className="text-[11px] font-bold text-slate-500">
                Selected: {selectedDays.length} / 2
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {enrollmentProperties.section4.preferredDaysHint}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
              {enrollmentProperties.section4.preferredDaysOptions.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <Button
                    type="button"
                    variant="outline"
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`min-h-[44px] flex items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#0E3589] border-[#0E3589] text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Slot Selection */}
          <div className="space-y-2 pt-2" id="select-preferred-slot">
            <label className="block text-xs font-bold text-slate-700">
              {enrollmentProperties.section4.preferredSlot} *
            </label>
            <p className="text-[11px] text-slate-500">
              {enrollmentProperties.section4.preferredSlotHint}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {enrollmentProperties.section4.preferredSlotOptions.map((slot) => {
                const isSelected = preferredSlot === slot;
                return (
                  <Button
                    type="button"
                    variant="outline"
                    key={slot}
                    onClick={() => setPreferredSlot(slot)}
                    className={`min-h-[44px] p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{slot}</span>
                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-teal-600" />}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 5: AREAS OF CONCERN                                              */}
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
            <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px] py-1">
              <input
                type="checkbox"
                required
                checked={practiceCommitment}
                onChange={(e) => setPracticeCommitment(e.target.checked)}
                className="w-4 h-4 text-[#0E3589] rounded"
              />
              <span>{enrollmentProperties.section6.practiceCommitment}</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px] py-1">
              <input
                type="checkbox"
                required
                checked={feePolicyAccepted}
                onChange={(e) => setFeePolicyAccepted(e.target.checked)}
                className="w-4 h-4 text-[#0E3589] rounded"
              />
              <span>{enrollmentProperties.section6.feePolicy}</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px] py-1">
              <input
                type="checkbox"
                checked={mediaConsent}
                onChange={(e) => setMediaConsent(e.target.checked)}
                className="w-4 h-4 text-[#0E3589] rounded"
              />
              <span>{enrollmentProperties.section6.mediaConsent}</span>
            </label>
          </div>
        </div>

        {/* Submit Action */}
        <div className="text-center pt-4">
          <Button
            type="submit"
            variant="accent"
            size="lg"
            isLoading={isSubmitting}
            loadingText={isEditMode ? (enrollmentProperties.editSubmittingText || "Saving Student Details...") : enrollmentProperties.submittingText}
            className="w-full sm:w-auto min-w-[320px] shadow-xl shadow-orange-500/25"
            id="btn-submit-enrollment"
          >
            {isEditMode ? (enrollmentProperties.editSubmitButton || "Save Student Details") : (enrollmentProperties.submitButton || "Enroll New Student")}
          </Button>
        </div>
      </form>

      {/* Fallback Enrollment Success Modal (only if onSuccess not handled by parent) */}
      <Modal
        isOpen={Boolean(successModalData)}
        onClose={() => setSuccessModalData(null)}
        size="lg"
        showCloseButton={true}
        id="enrollment-success-modal"
      >
        {successModalData && (
          <div className="text-center space-y-5">
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
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => onNavigate && onNavigate('studentDetail', successModalData.studentId)}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                id="btn-success-view-details"
              >
                {enrollmentProperties.modalSuccess.viewStudentDetailsBtn}
              </Button>

              <Button
                type="button"
                variant="accent"
                size="md"
                onClick={() => onNavigate && onNavigate('admin', undefined, 'roster')}
                id="btn-success-go-roster"
              >
                {enrollmentProperties.modalSuccess.goToAdminRosterBtn}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
