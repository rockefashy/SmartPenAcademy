import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, Lock, CheckCircle } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../../ui';
import { api } from '../../../services/api';
import { adminProperties } from '../../../properties/admin.properties';

interface CoachEnrollmentTabProps {
  onSuccess: (coachData: {
    name: string;
    designation: string;
    email: string;
    phoneNumber: string;
  }) => void;
  onCancel: () => void;
}

const COACH_SPECIALIZATIONS = [
  'Cursive Writing',
  'Print Script Mastery',
  'Speed Enhancement',
  'Motor Grip Correction',
  'Devanagari / Hindi',
  'Dysgraphia Support',
  'Exam Presentation',
];

export const CoachEnrollmentTab: React.FC<CoachEnrollmentTabProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phoneNumber: '',
    address: '',
    designation: 'Executive Tutor',
    educationalQualification: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    status: 'Active' as 'Active' | 'Inactive',
    dateOfLeaving: '',
    specializations: [] as string[],
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
    password: '',
  });

  const [isDisplayNameTouched, setIsDisplayNameTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleSpecialization = (spec: string) => {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter((s) => s !== spec)
        : [...prev.specializations, spec],
    }));
  };

  const handleValidationError = (msg: string, elementId?: string) => {
    setFormError(msg);
    if (elementId) {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.focus({ preventScroll: true });
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const calculatedDisplayName =
      form.displayName.trim() || `${firstName} ${lastName}`.trim();

    if (!firstName && !calculatedDisplayName) {
      handleValidationError('Coach first name is required.', 'input-coach-first-name');
      return;
    }
    if (!form.email.trim()) {
      handleValidationError(
        adminProperties.messages.coachValidationEmail || 'Coach email address is required.',
        'input-coach-email'
      );
      return;
    }
    if (!form.phoneNumber.trim()) {
      handleValidationError(
        adminProperties.messages.coachValidationPhone || 'Primary phone number is required.',
        'input-coach-phone'
      );
      return;
    }
    if (!form.password || form.password.trim().length < 8) {
      handleValidationError(
        adminProperties.messages.coachValidationPasswordLength ||
          'Initial password must be at least 8 characters.',
        'input-coach-password'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const enrolledCoach = await api.createCoach({
        firstName,
        lastName,
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
        designation: form.designation,
        educationalQualification: form.educationalQualification.trim(),
        dateOfJoining: form.dateOfJoining,
        status: form.status,
        dateOfLeaving: form.dateOfLeaving || undefined,
        specializations: form.specializations,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        notes: form.notes.trim(),
        password: form.password.trim(),
      });

      onSuccess({
        name: calculatedDisplayName || firstName,
        designation: enrolledCoach.designation || form.designation,
        email: enrolledCoach.email || form.email,
        phoneNumber: enrolledCoach.phoneNumber || form.phoneNumber,
      });
    } catch (err: any) {
      handleValidationError(err.message || 'Failed to enroll coach. Please verify data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Header & Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            className="rounded-xl shadow-2xs font-bold"
            title="Return to Coach Directory"
            id="btn-back-to-coach-directory"
            leftIcon={<ArrowLeft className="w-4 h-4 text-slate-700" />}
          >
            Coach Directory
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Enroll New Coach
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-[#0E3589]">
                Admin Only
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Register a handwriting coach or tutor with complete profile credentials, specializations, and login access.
            </p>
          </div>
        </div>
      </div>

      {/* Expanded Enrollment Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-900">Enrollment Error</p>
                <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{formError}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormError(null)}
                className="text-red-500 hover:text-red-800 text-xs font-bold p-1 min-h-[32px] min-w-[32px]"
              >
                ×
              </Button>
            </div>
          )}

          {/* Name Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({
                    ...form,
                    firstName: val,
                    displayName: !isDisplayNameTouched ? `${val} ${form.lastName}`.trim() : form.displayName,
                  });
                }}
                placeholder="e.g. Deepthy"
                id="input-coach-first-name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({
                    ...form,
                    lastName: val,
                    displayName: !isDisplayNameTouched ? `${form.firstName} ${val}`.trim() : form.displayName,
                  });
                }}
                placeholder="e.g. Rock"
                id="input-coach-last-name"
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Display Name <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Shown in rosters &amp; applet</span>
            </div>
            <Input
              type="text"
              required
              value={form.displayName}
              onChange={(e) => {
                setIsDisplayNameTouched(true);
                setForm({ ...form, displayName: e.target.value });
              }}
              placeholder="e.g. Deepthy Rock"
              id="input-coach-display-name"
            />
          </div>

          {/* Contact Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. coach@smartpen.in"
                id="input-coach-email"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Primary Phone / WhatsApp <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                required
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="e.g. 8861751000"
                id="input-coach-phone"
              />
            </div>
          </div>

          {/* Professional & Qualifications */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <Select
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  id="select-coach-designation"
                >
                  <option value="Principal Tutor">Principal Tutor (Master Instructor)</option>
                  <option value="Executive Tutor">Executive Tutor (Senior Coach)</option>
                  <option value="Senior Master Coach">Senior Master Coach</option>
                  <option value="Associate Tutor">Associate Tutor (Junior Coach)</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <Select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })
                  }
                  id="select-coach-status"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Educational Qualification
              </label>
              <Input
                type="text"
                value={form.educationalQualification}
                onChange={(e) => setForm({ ...form, educationalQualification: e.target.value })}
                placeholder="e.g. M.Ed, Certified Master Calligrapher, B.A. Literature"
                id="input-coach-qualification"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date of Joining</label>
                <Input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                  id="input-coach-joining-date"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date of Leaving <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Input
                  type="date"
                  min={form.dateOfJoining || undefined}
                  value={form.dateOfLeaving}
                  onChange={(e) => setForm({ ...form, dateOfLeaving: e.target.value })}
                  id="input-coach-leaving-date"
                />
              </div>
            </div>
          </div>

          {/* Communication Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Residential / Communication Address
            </label>
            <Textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. #42, 5th Cross, Indiranagar, Bangalore - 560038"
              className="resize-none"
              id="textarea-coach-address"
            />
          </div>

          {/* Specializations & Teaching Focus */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Specializations &amp; Teaching Focus
            </label>
            <div className="flex flex-wrap gap-2">
              {COACH_SPECIALIZATIONS.map((spec) => {
                const isSelected = form.specializations.includes(spec);
                return (
                  <Button
                    type="button"
                    key={spec}
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => toggleSpecialization(spec)}
                    className={`rounded-lg text-xs font-bold ${
                      isSelected
                        ? 'bg-[#0E3589] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {spec} {isSelected ? '✓' : '+'}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Emergency Contact Person
              </label>
              <Input
                type="text"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                placeholder="e.g. Spouse / Relative"
                id="input-coach-emergency-name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Phone</label>
              <Input
                type="tel"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                placeholder="e.g. 9845012345"
                id="input-coach-emergency-phone"
              />
            </div>
          </div>

          {/* Bio & Internal Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Professional Notes / Bio
            </label>
            <Input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. 8+ years experience in handwriting transformation"
              id="input-coach-notes"
            />
          </div>

          {/* Initial Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Initial Login Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                type="text"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="e.g. Coach@Secure2026 (min 8 chars)"
                className="pl-10 font-mono"
                id="input-coach-password"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              The coach will use this password along with their email/phone to log in.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="w-full sm:w-auto"
              id="btn-cancel-coach-enrollment"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
              id="btn-submit-coach-enrollment"
              leftIcon={!isSubmitting ? <CheckCircle className="w-4 h-4" /> : undefined}
            >
              {isSubmitting ? 'Enrolling Coach...' : 'Enroll Coach & Create Credentials'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
