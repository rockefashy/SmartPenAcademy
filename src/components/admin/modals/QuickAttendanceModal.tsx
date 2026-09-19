import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Modal, Button, Input } from '../../ui';
import { StudentProfile } from '../../../types';
import { api } from '../../../services/api';

interface QuickAttendanceModalProps {
  student: StudentProfile | null;
  onClose: () => void;
  onSuccess: (studentName: string) => void;
  onError?: (message: string) => void;
}

export const QuickAttendanceModal: React.FC<QuickAttendanceModalProps> = ({
  student,
  onClose,
  onSuccess,
  onError,
}) => {
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState<'Present' | 'Absent' | 'Late'>('Present');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setAttendanceDate(new Date().toISOString().split('T')[0]);
      setAttendanceStatus('Present');
      setErrorMessage(null);
    }
  }, [student]);

  if (!student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await api.addAttendance(student.id, {
        date: attendanceDate,
        status: attendanceStatus,
        notes: `Marked from Admin Dashboard Quick Action`,
      });
      onSuccess(student.firstName);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to record attendance';
      setErrorMessage(msg);
      if (onError) onError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(student)}
      onClose={onClose}
      size="md"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[#0E3589]">
            <Calendar className="w-5 h-5 text-[#F46E20]" />
            <h3 className="font-bold text-sm">Mark Attendance</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 min-h-[32px] min-w-[32px]"
            aria-label="Close"
          >
            ✕
          </Button>
        </div>

        <p className="text-xs text-slate-600">
          Recording session for <strong className="text-slate-900">{student.firstName}</strong>
        </p>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
            <Input
              type="date"
              required
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Present', 'Absent', 'Late'] as const).map((st) => (
                <Button
                  key={st}
                  type="button"
                  variant={attendanceStatus === st ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setAttendanceStatus(st)}
                  className={`py-2 text-xs font-bold rounded-xl ${
                    attendanceStatus === st
                      ? 'bg-[#0E3589] text-white border-[#0E3589]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="w-1/3 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-2/3 py-2"
            >
              {isSubmitting ? 'Saving...' : 'Confirm Attendance'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
