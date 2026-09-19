import React, { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import { Modal, Button, Textarea } from '../../ui';
import { DemoBooking } from '../../../types';

interface BookingNotesModalProps {
  booking: DemoBooking | null;
  onClose: () => void;
  onSave: (bookingId: string, notes: string) => Promise<void>;
}

export const BookingNotesModal: React.FC<BookingNotesModalProps> = ({
  booking,
  onClose,
  onSave,
}) => {
  const [notesText, setNotesText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (booking) {
      setNotesText(booking.notes || '');
    }
  }, [booking]);

  if (!booking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(booking.id, notesText);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(booking)}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[#0E3589]">
            <Edit2 className="w-5 h-5 text-[#F46E20]" />
            <h3 className="font-extrabold text-sm sm:text-base">Demo Assessment Notes &amp; Comments</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 min-h-[32px] min-w-[32px]"
            aria-label="Close"
          >
            ✕
          </Button>
        </div>

        <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs text-slate-700 space-y-1">
          <div className="flex items-center justify-between font-bold">
            <span className="text-[#0E3589] font-black text-sm">{booking.studentName}</span>
            <span className="text-slate-600">
              Age: {String(booking.age || '').replace(/\s*(years?|yrs)\b/gi, '').trim() || 'N/A'} yrs
            </span>
          </div>
          <p className="text-slate-600">
            Parent: <strong className="text-slate-900">{booking.parentName || 'N/A'}</strong> • Contact:{' '}
            <strong className="text-slate-900">{booking.contactNumber}</strong>
          </p>
          <p className="text-slate-600">
            Scheduled Demo:{' '}
            <strong className="text-slate-900">
              {booking.preferredDate} ({booking.preferredTimeSlot})
            </strong>{' '}
            • {booking.modeOfLearning === 'Online' ? 'Online' : 'In-person'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
              Parent Remarks &amp; Coach Assessment Notes
            </label>
            <Textarea
              rows={5}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Enter full parent discussion notes, diagnostic observations, handwriting style concerns, or demo evaluation feedback here..."
              className="leading-relaxed"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Notes entered here are fully accessible whenever you open this note editor, without truncation.
            </p>
          </div>

          <div className="flex gap-2.5 pt-2">
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
              isLoading={isSaving}
              disabled={isSaving}
              className="w-2/3 py-2.5"
            >
              {isSaving ? 'Saving...' : 'Save Assessment Notes'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
