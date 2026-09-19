import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Button } from '../../ui';
import { DemoBooking } from '../../../types';

interface DeleteBookingModalProps {
  booking: DemoBooking | null;
  onClose: () => void;
  onConfirm: (bookingId: string) => Promise<void>;
}

export const DeleteBookingModal: React.FC<DeleteBookingModalProps> = ({
  booking,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!booking) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(booking.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(booking)}
      onClose={onClose}
      size="md"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">Delete Booking Inquiry</h3>
            <p className="text-xs text-slate-500">This action permanently deletes this record.</p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-1">
          <p>
            Student: <strong className="text-slate-900">{booking.studentName}</strong> (Age{' '}
            {String(booking.age || '').replace(/\s*(years?|yrs)\b/gi, '').trim() || 'N/A'} yrs)
          </p>
          <p>
            Parent: <strong className="text-slate-900">{booking.parentName || 'N/A'}</strong> • Contact:{' '}
            <strong className="text-slate-900">{booking.contactNumber}</strong>
          </p>
          <p>
            Scheduled:{' '}
            <strong className="text-slate-900">
              {booking.preferredDate} ({booking.preferredTimeSlot})
            </strong>
          </p>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to delete this demo inquiry? All associated alerts will also be cleaned up.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isDeleting}
            isLoading={isDeleting}
            onClick={handleDelete}
            className="px-4 py-2"
            leftIcon={!isDeleting ? <Trash2 className="w-3.5 h-3.5" /> : undefined}
          >
            Delete Inquiry
          </Button>
        </div>
      </div>
    </Modal>
  );
};
