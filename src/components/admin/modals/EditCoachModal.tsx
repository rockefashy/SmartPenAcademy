import React, { useState, useEffect } from 'react';
import { Edit2, X, AlertTriangle, Lock, Check } from 'lucide-react';
import { Modal, Button, Input, Select, Textarea } from '../../ui';
import { CoachProfile } from '../../../types';
import { api } from '../../../services/api';

interface EditCoachModalProps {
  coach: CoachProfile | null;
  onClose: () => void;
  onSuccess: (coachName: string) => void;
  onError?: (message: string) => void;
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

export const EditCoachModal: React.FC<EditCoachModalProps> = ({
  coach,
  onClose,
  onSuccess,
  onError,
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
    dateOfJoining: '',
    status: 'Active' as 'Active' | 'Inactive',
    dateOfLeaving: '',
    specializations: [] as string[],
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
    password: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (coach) {
      setForm({
        firstName: coach.firstName || '',
        lastName: coach.lastName || '',
        displayName: coach.displayName || `${coach.firstName || ''} ${coach.lastName || ''}`.trim(),
        email: coach.email || '',
        phoneNumber: coach.phoneNumber || '',
        address: coach.address || '',
        designation: coach.designation || 'Executive Tutor',
        educationalQualification: coach.educationalQualification || '',
        dateOfJoining: coach.dateOfJoining || new Date().toISOString().split('T')[0],
        status: coach.status || 'Active',
        dateOfLeaving: coach.dateOfLeaving || '',
        specializations: coach.specializations || [],
        emergencyContactName: coach.emergencyContactName || '',
        emergencyContactPhone: coach.emergencyContactPhone || '',
        notes: coach.notes || '',
        password: '',
      });
      setErrorMessage(null);
    }
  }, [coach]);

  if (!coach) return null;

  const toggleSpecialization = (spec: string) => {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter((s) => s !== spec)
        : [...prev.specializations, spec],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const displayName = form.displayName.trim() || `${firstName} ${lastName}`.trim();

    if (!firstName && !displayName) {
      setErrorMessage('Coach first name is required.');
      return;
    }
    if (!form.email.trim()) {
      setErrorMessage('Coach email address is required.');
      return;
    }
    if (!form.phoneNumber.trim()) {
      setErrorMessage('Primary phone number is required.');
      return;
    }
    if (form.password && form.password.trim().length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    setIsUpdating(true);
    try {
      const updates: any = {
        firstName,
        lastName,
        displayName,
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
        designation: form.designation,
        educationalQualification: form.educationalQualification.trim(),
        dateOfJoining: form.dateOfJoining,
        status: form.status,
        dateOfLeaving: form.dateOfLeaving || null,
        specializations: form.specializations,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        notes: form.notes.trim(),
      };

      if (form.password.trim()) {
        updates.password = form.password.trim();
      }

      await api.updateCoach(coach.id, updates);
      onSuccess(displayName || firstName);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to update coach profile';
      setErrorMessage(msg);
      if (onError) onError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(coach)}
      onClose={onClose}
      size="2xl"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-[#0E3589]">
            <Edit2 className="w-5 h-5" />
            <div>
              <h3 className="font-black text-base text-slate-900">Edit Coach Profile</h3>
              <p className="text-xs text-slate-500">{coach.firstName} ({coach.email})</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 min-h-[32px] min-w-[32px]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-900">Update Error</p>
                <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-800 text-xs font-bold p-1 min-h-[32px] min-w-[32px]"
              >
                ×
              </Button>
            </div>
          )}

          {/* Name Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
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
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Display Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="e.g. Deepthy Rock"
            />
          </div>

          {/* Contact Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              />
            </div>
          </div>

          {/* Role & Qualification */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <Select
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="font-bold"
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
                  onChange={(e) => {
                    const newStatus = e.target.value as 'Active' | 'Inactive';
                    setForm({
                      ...form,
                      status: newStatus,
                      dateOfLeaving: newStatus === 'Inactive' && !form.dateOfLeaving
                        ? new Date().toISOString().split('T')[0]
                        : newStatus === 'Active'
                        ? ''
                        : form.dateOfLeaving,
                    });
                  }}
                  className="font-bold"
                  id="select-edit-coach-status"
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
                placeholder="e.g. M.Ed, Certified Master Calligrapher"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date of Joining</label>
                <Input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
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
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Residential / Communication Address
            </label>
            <Textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Address details..."
              className="resize-none"
            />
          </div>

          {/* Specializations */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Specializations & Teaching Focus
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COACH_SPECIALIZATIONS.map((spec) => {
                const isSelected = form.specializations.includes(spec);
                return (
                  <Button
                    type="button"
                    key={spec}
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => toggleSpecialization(spec)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Emergency Contact Person
              </label>
              <Input
                type="text"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                placeholder="e.g. Spouse / Relative"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Phone</label>
              <Input
                type="tel"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                placeholder="e.g. 9845012345"
              />
            </div>
          </div>

          {/* Bio / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Professional Notes / Bio
            </label>
            <Input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Senior tutor notes..."
            />
          </div>

          {/* Password update */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reset Password <span className="text-slate-400 font-normal">(Leave blank to keep existing password)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter new password (min 8 chars)"
                className="pl-9 font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="w-1/3 py-2.5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isUpdating}
              disabled={isUpdating}
              className="w-2/3 py-2.5"
              leftIcon={!isUpdating ? <Check className="w-4 h-4" /> : undefined}
            >
              {isUpdating ? 'Saving Changes...' : 'Save Coach Profile'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
