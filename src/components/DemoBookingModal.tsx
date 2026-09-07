import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Sparkles, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Mail, 
  CheckCircle2, 
  ArrowRight,
  MessageCircle,
  Award
} from 'lucide-react';
import { commonProperties } from '../properties/common.properties';
import { landingProperties } from '../properties/landing.properties';
import { api } from '../services/api';

// Helper to get formatted YYYY-MM-DD
const getDatePlusDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayDateString = () => getDatePlusDays(0);
const getTomorrowDateString = () => getDatePlusDays(1);

const formatReadableDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
};

// Validate time: must be valid hh:mm format and fall between 4:00 PM (16:00) and 7:00 PM (19:00)
export const parseAndValidateDemoTime = (timeStr: string): { isValid: boolean; error?: string; formattedTime?: string } => {
  if (!timeStr || !timeStr.trim()) {
    return { isValid: false, error: 'Please enter a demo time in hh:mm format (e.g., 04:00 PM).' };
  }

  const trimmed = timeStr.trim();
  // Support "hh:mm", "h:mm", "hh:mm AM/PM", "h:mm AM/PM", "hh:mmAM", etc.
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);

  if (!match) {
    return {
      isValid: false,
      error: 'Invalid time format. Please enter as hh:mm (e.g., 04:00 PM or 16:00).'
    };
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;

  if (minutes < 0 || minutes > 59) {
    return { isValid: false, error: 'Minutes must be between 00 and 59.' };
  }

  let totalMinutes = 0;

  if (meridian === 'PM') {
    if (hours < 1 || hours > 12) {
      return { isValid: false, error: 'Hours must be between 1 and 12.' };
    }
    const h24 = hours === 12 ? 12 : hours + 12;
    totalMinutes = h24 * 60 + minutes;
  } else if (meridian === 'AM') {
    if (hours < 1 || hours > 12) {
      return { isValid: false, error: 'Hours must be between 1 and 12.' };
    }
    const h24 = hours === 12 ? 0 : hours;
    totalMinutes = h24 * 60 + minutes;
  } else {
    // 24h format (16 to 19) or 12h without meridian
    if (hours >= 16 && hours <= 23) {
      totalMinutes = hours * 60 + minutes;
    } else if (hours >= 1 && hours <= 12) {
      // 4 to 7 without meridian assumed PM
      if (hours >= 4 && hours <= 7) {
        totalMinutes = (hours + 12) * 60 + minutes;
      } else {
        totalMinutes = hours * 60 + minutes;
      }
    } else {
      return { isValid: false, error: 'Please enter a valid time between 4:00 PM and 7:00 PM.' };
    }
  }

  const MIN_DEMO = 16 * 60; // 4:00 PM = 960 mins
  const MAX_DEMO = 19 * 60; // 7:00 PM = 1140 mins

  if (totalMinutes < MIN_DEMO || totalMinutes > MAX_DEMO) {
    return {
      isValid: false,
      error: 'Demo time must be between 4:00 PM and 7:00 PM.'
    };
  }

  const h24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const h12 = h24 === 12 ? 12 : h24 - 12;
  const formattedHours = String(h12).padStart(2, '0');
  const formattedMins = String(mins).padStart(2, '0');
  const formattedTime = `${formattedHours}:${formattedMins} PM`;

  return { isValid: true, formattedTime };
};

interface DemoBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DemoBookingModal: React.FC<DemoBookingModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [age, setAge] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [modeOfLearning, setModeOfLearning] = useState<'In-person' | 'Online'>('In-person');
  
  // Date default: current date + 1
  const [demoDate, setDemoDate] = useState<string>(getTomorrowDateString());
  // Time default: 4:00 PM (04:00 PM)
  const [demoTime, setDemoTime] = useState<string>('04:00 PM');
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setErrorMessage('Please enter student name');
      return;
    }
    if (!parentName.trim()) {
      setErrorMessage('Please enter parent / guardian name');
      return;
    }
    if (!age.trim()) {
      setErrorMessage('Please enter student age or grade');
      return;
    }
    if (!contactNumber.trim()) {
      setErrorMessage('Please provide a valid contact number (Phone/WhatsApp)');
      return;
    }

    const todayStr = getTodayDateString();
    if (!demoDate) {
      setErrorMessage('Please select a preferred demo date from the calendar');
      return;
    }
    if (demoDate <= todayStr) {
      setErrorMessage('Demo date must be greater than today (starting from tomorrow).');
      return;
    }

    const timeValidation = parseAndValidateDemoTime(demoTime);
    if (!timeValidation.isValid) {
      setErrorMessage(timeValidation.error || 'Please enter a valid time between 4:00 PM and 7:00 PM.');
      return;
    }

    const finalFormattedTime = timeValidation.formattedTime || demoTime;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await api.createDemoBooking({
        studentName: studentName.trim(),
        parentName: parentName.trim(),
        age: age.trim(),
        contactNumber: contactNumber.trim(),
        preferredDate: demoDate,
        preferredTimeSlot: finalFormattedTime,
        modeOfLearning,
        notes: notes.trim(),
      });

      confetti({
        particleCount: 80,
        spread: 65,
        origin: { y: 0.6 },
      });

      setBookingSuccess(response);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit demo class booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setStudentName('');
    setParentName('');
    setAge('');
    setContactNumber('');
    setModeOfLearning('In-person');
    setDemoDate(getTomorrowDateString());
    setDemoTime('04:00 PM');
    setDateError(null);
    setTimeError(null);
    setNotes('');
    setBookingSuccess(null);
    setErrorMessage(null);
    onClose();
  };

  const waMessage = encodeURIComponent(
    `Hello Mrs. Deepthy Rock! I have submitted a Free Demo Class request at SmartPen Academy for ${studentName || 'my child'} (Parent: ${parentName || 'N/A'}, Age/Grade: ${age || 'N/A'}, Mode: ${modeOfLearning}, Date: ${formatReadableDate(demoDate)}, Time: ${demoTime}). Contact: ${contactNumber}`
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      size="lg"
      showCloseButton={false}
      className="p-0 border-2 border-orange-100/90 overflow-hidden"
      bodyClassName="p-0 flex flex-col"
      id="modal-demo-booking"
    >
          {/* Header Ribbon (Always pinned & visible at top) */}
          <div className="shrink-0 bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] px-5 sm:px-6 py-4 sm:py-5 text-white relative shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleResetAndClose}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 bg-white/20 hover:bg-white/30 text-white rounded-full z-10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>SmartPen Academy • Free Experience</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight pr-10">
              {landingProperties.demoModal.title}
            </h2>
            <p className="text-xs text-blue-100 mt-1 leading-relaxed max-w-md">
              {landingProperties.demoModal.subtitle}
            </p>

            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 bg-black/25 backdrop-blur-xs rounded-xl text-[11px] sm:text-xs font-bold text-amber-300 border border-amber-400/30">
              <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>{landingProperties.demoModal.timingNotice}</span>
            </div>
          </div>

          {/* Content Body (Scrollable on small screens) */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {bookingSuccess ? (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-slate-900">
                  {landingProperties.demoModal.successHeading}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  {landingProperties.demoModal.successMessage}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Student Name:</span>
                  <span className="font-bold text-slate-800">{studentName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Parent / Guardian:</span>
                  <span className="font-bold text-slate-800">{parentName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Age / Grade:</span>
                  <span className="font-bold text-slate-800">{age}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Contact Number:</span>
                  <span className="font-bold text-slate-800">{contactNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Mode of Learning:</span>
                  <span className="font-bold text-[#0E3589]">{modeOfLearning === 'Online' ? '💻 Online Live Class' : '🏫 In-person Classroom'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                  <span className="text-slate-500 font-medium">Scheduled Date:</span>
                  <span className="font-bold text-[#0E3589]">{formatReadableDate(demoDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Scheduled Time:</span>
                  <span className="font-bold text-[#F46E20]">{demoTime}</span>
                </div>
              </div>

              {/* Direct WhatsApp / Call CTAs */}
              <div className="space-y-2 pt-2">
                <a
                  href={`https://wa.me/918861751000?text=${waMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Connect on WhatsApp with Mrs. Deepthy Rock (8861751000)</span>
                </a>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handleResetAndClose}
                >
                  Done &amp; Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                  {errorMessage}
                </div>
              )}

              {/* Student Name & Parent Name in 2 Cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={landingProperties.demoModal.studentNameLabel}
                  required
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder={landingProperties.demoModal.studentNamePlaceholder}
                  leftIcon={<User className="w-4 h-4 text-slate-400" />}
                />

                <Input
                  label={landingProperties.demoModal.parentNameLabel}
                  required
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder={landingProperties.demoModal.parentNamePlaceholder}
                  leftIcon={<User className="w-4 h-4 text-slate-400" />}
                />
              </div>

              {/* Age / Grade & Contact Number in 2 Cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={landingProperties.demoModal.ageLabel}
                  required
                  type="text"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={landingProperties.demoModal.agePlaceholder}
                />

                <Input
                  label={landingProperties.demoModal.contactLabel}
                  required
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder={landingProperties.demoModal.contactPlaceholder}
                  leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                />
              </div>

              {/* Mode of Learning */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Mode of Learning <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={modeOfLearning === 'In-person' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setModeOfLearning('In-person')}
                    className="w-full"
                    id="btn-demo-mode-in-person"
                  >
                    🏫 In-person
                  </Button>
                  <Button
                    type="button"
                    variant={modeOfLearning === 'Online' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setModeOfLearning('Online')}
                    className="w-full"
                    id="btn-demo-mode-online"
                  >
                    💻 Online
                  </Button>
                </div>
              </div>

              {/* Preferred Demo Date & Time (Calendar Date > Today & Time hh:mm between 4:00 - 7:00 PM) */}
              <div className="space-y-3 bg-gradient-to-br from-blue-50/80 to-orange-50/60 p-4 rounded-2xl border border-blue-100 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#0E3589] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#F46E20]" />
                    <span>Preferred Demo Date &amp; Time</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-[#F46E20] rounded-full border border-orange-200">
                    Daily 4:00 – 7:00 PM
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Demo Date (After today)"
                    required
                    type="date"
                    min={getTomorrowDateString()}
                    value={demoDate}
                    onChange={(e) => {
                      setDemoDate(e.target.value);
                      if (e.target.value && e.target.value <= getTodayDateString()) {
                        setDateError('Date must be greater than today.');
                      } else {
                        setDateError(null);
                      }
                    }}
                    error={dateError || undefined}
                    helperText={demoDate && !dateError ? `📅 ${formatReadableDate(demoDate)}` : undefined}
                  />

                  <Input
                    label="Demo Time (hh:mm) (4 - 7 PM)"
                    required
                    type="text"
                    value={demoTime}
                    onChange={(e) => {
                      setDemoTime(e.target.value);
                      setTimeError(null);
                    }}
                    onBlur={(e) => {
                      const check = parseAndValidateDemoTime(e.target.value);
                      if (!check.isValid) {
                        setTimeError(check.error || 'Must be between 4:00 PM and 7:00 PM');
                      } else if (check.formattedTime) {
                        setDemoTime(check.formattedTime);
                        setTimeError(null);
                      }
                    }}
                    placeholder="04:00 PM"
                    leftIcon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
                    error={timeError || undefined}
                    helperText={!timeError ? "Default: 04:00 PM (4:00 – 7:00 PM)" : undefined}
                  />
                </div>

                {/* Quick Select Preset Pills */}
                <div className="pt-1">
                  <p className="text-[10px] font-bold text-slate-600 mb-1.5">Quick Select Time Slots:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {landingProperties.demoModal.timePresets.map((preset) => (
                      <Button
                        type="button"
                        key={preset}
                        variant={demoTime === preset ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setDemoTime(preset);
                          setTimeError(null);
                        }}
                        className="py-1 px-2.5 text-[11px]"
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <Textarea
                label="Specific Handwriting Goals / Observations (Optional)"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Struggling with cursive joining, pencil grip fatigue, slow exam speed..."
              />

              {/* Academy Direct Details Banner */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center justify-between font-bold text-[#0E3589]">
                  <span>Academy Direct Details:</span>
                  <span>Mrs. Deepthy Rock</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Phone/WhatsApp: <strong>{commonProperties.contact.phoneDisplay}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Email: <strong>{commonProperties.contact.email}</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                  <span>{commonProperties.contact.location}</span>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  fullWidth
                  isLoading={isSubmitting}
                  loadingText="Scheduling Demo..."
                  leftIcon={<Sparkles className="w-4 h-4" />}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  id="btn-confirm-demo-booking"
                >
                  {landingProperties.demoModal.submitBtn}
                </Button>
              </div>
            </form>
          )}
        </div>
    </Modal>
  );
};
