import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { Modal, Button, Input } from '../../ui';
import { StudentProfile } from '../../../types';
import { api } from '../../../services/api';

interface QuickFeeModalProps {
  student: StudentProfile | null;
  defaultCycle?: string;
  onClose: () => void;
  onSuccess: (studentName: string) => void;
  onError?: (message: string) => void;
}

export const QuickFeeModal: React.FC<QuickFeeModalProps> = ({
  student,
  defaultCycle,
  onClose,
  onSuccess,
  onError,
}) => {
  const [feePeriod, setFeePeriod] = useState('');
  const [feeAmount, setFeeAmount] = useState<number>(1600);
  const [feeNotes, setFeeNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      const currentMonthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      setFeePeriod(defaultCycle || currentMonthYear);
      setFeeAmount(student.feePerCycle || 1600);
      setFeeNotes('');
      setErrorMessage(null);
    }
  }, [student, defaultCycle]);

  if (!student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await api.saveFee({
        studentId: student.id,
        yearMonth: feePeriod,
        amount: Number(feeAmount) || (student.feePerCycle || 1600),
        status: 'Paid',
        paidDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'In-Person Reception Card/UPI',
        notes: feeNotes.trim() || undefined,
      });
      onSuccess(student.firstName);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to record fee payment';
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
          <div className="flex items-center gap-2 text-emerald-800">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm">
              Issue {student.classesPerCycle || 8}-Class Fee Receipt (₹{(student.feePerCycle || 1600).toLocaleString()})
            </h3>
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
          Recording payment receipt for <strong className="text-slate-900">{student.firstName}</strong>
        </p>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Fee Milestone / Month</label>
            <Input
              type="text"
              required
              value={feePeriod}
              onChange={(e) => setFeePeriod(e.target.value)}
              placeholder="e.g. August 2026 or September Milestone"
              className="font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Number</label>
            <div className="px-3 py-2 text-xs font-mono font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-lg">
              Auto-generated sequentially upon save by server
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹ INR)</label>
            <Input
              type="number"
              required
              value={feeAmount}
              onChange={(e) => setFeeAmount(Number(e.target.value))}
              className="font-bold text-emerald-800"
              id="input-quick-fee-amount"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <Input
              type="text"
              value={feeNotes}
              onChange={(e) => setFeeNotes(e.target.value)}
              placeholder="e.g. In-Person Cash / UPI Reference / Bank Transfer details"
              className="font-medium text-slate-900"
              id="input-quick-fee-notes"
            />
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
              className="w-2/3 py-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? 'Saving...' : `Issue & Mark Paid (₹${(feeAmount || student.feePerCycle || 1600).toLocaleString()})`}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
