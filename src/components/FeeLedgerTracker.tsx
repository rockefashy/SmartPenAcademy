import { Modal } from './ui/Modal';
import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  DollarSign, 
  Send, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  MessageCircle, 
  AlertCircle, 
  CheckCircle2, 
  Receipt, 
  CreditCard, 
  Building2, 
  Sparkles,
  ExternalLink,
  Info,
  FileText
} from 'lucide-react';
import { FeeRecord, StudentProfile } from '../types';
import { api } from '../services/api';

interface FeeLedgerTrackerProps {
  student: StudentProfile;
  fees: FeeRecord[];
  isAdmin?: boolean;
  onFeeChange?: (updatedFees: FeeRecord[]) => void;
  showToast?: (message: string) => void;
}

/**
 * Returns current formatted Month Year string, e.g. "August 2026"
 */
function getCurrentMonthYear(): string {
  const date = new Date();
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export const FeeLedgerTracker: React.FC<FeeLedgerTrackerProps> = ({
  student,
  fees: initialFees,
  isAdmin = true,
  onFeeChange,
  showToast
}) => {
  const [fees, setFees] = useState<FeeRecord[]>(initialFees);

  // Synchronize with parent props
  useEffect(() => {
    setFees(initialFees);
  }, [initialFees]);

  // Form State: Raise Fee Request
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formMilestone, setFormMilestone] = useState<string>(() => getCurrentMonthYear());
  const [formAmount, setFormAmount] = useState<string>('1600');
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>(() => {
    const cleanId = student.id.replace('std-', '');
    const monthCode = new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const yearCode = new Date().getFullYear().toString().slice(-2);
    return `REC-${cleanId}-${monthCode}${yearCode}`;
  });
  const [formStatus, setFormStatus] = useState<'Pending' | 'Paid'>('Pending');
  const [formMethod, setFormMethod] = useState<string>('In-Person Reception - Cash');
  const [formNotes, setFormNotes] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeSendingId, setActiveSendingId] = useState<string | null>(null);

  // Deletion Modal State (Replaces blocked window.confirm)
  const [feeToDelete, setFeeToDelete] = useState<FeeRecord | null>(null);
  const [isDeletingFee, setIsDeletingFee] = useState<boolean>(false);

  // Inline Editing State
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    date: string;
    milestone: string;
    receiptNumber: string;
    amount: number;
    status: 'Paid' | 'Pending';
    paymentMethod: string;
    notes: string;
  }>({
    date: '',
    milestone: '',
    receiptNumber: '',
    amount: 1600,
    status: 'Pending',
    paymentMethod: 'In-Person Reception - Cash',
    notes: ''
  });
  const [isSavingInline, setIsSavingInline] = useState<boolean>(false);

  // Helper Toast trigger
  const notify = (msg: string) => {
    if (showToast) {
      showToast(msg);
    }
  };

  // Helper to open WhatsApp URL safely
  const dispatchWhatsApp = (whatsappUrl: string, messageText?: string) => {
    try {
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Fallback for popup blocking in sandbox
        console.warn('Popup blocked, prompting direct WhatsApp trigger');
      }
    } catch (e) {
      console.error('Error opening WhatsApp URL:', e);
    }
  };

  // Handle Raise Fee Request (Form 1)
  const handleRaiseFeeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setIsSubmitting(true);
    try {
      const isPaid = formStatus === 'Paid';
      const numAmount = Number(formAmount) || 1600;
      const cleanMilestone = formMilestone.trim() || getCurrentMonthYear();

      const newFeePayload: Partial<FeeRecord> = {
        studentId: student.id,
        date: formDate,
        yearMonth: cleanMilestone,
        milestone: cleanMilestone,
        amount: numAmount,
        status: formStatus,
        receiptNumber: formReceiptNumber.trim() || undefined,
        paymentMethod: formMethod,
        paidDate: isPaid ? formDate : undefined,
        notes: formNotes.trim() || undefined
      };

      // 1. Save fee record to database
      const savedFee = await api.saveFee(newFeePayload);

      // 2. Dispatch WhatsApp reminder
      let reminderResult;
      try {
        reminderResult = await api.sendWhatsAppReminder({
          studentId: student.id,
          parentPhone: student.whatsappMobile,
          parentName: student.parentName,
          studentName: student.displayName,
          amount: numAmount,
          milestone: cleanMilestone,
          receiptNumber: formReceiptNumber.trim() || undefined
        });

        if (reminderResult?.whatsappUrl) {
          dispatchWhatsApp(reminderResult.whatsappUrl, reminderResult.messageText);
        }
      } catch (remErr) {
        console.warn('WhatsApp log warning (fee saved successfully):', remErr);
      }

      // 3. Update local state & notify parent
      const updatedList = [savedFee, ...fees.filter(f => f.id !== savedFee.id)];
      setFees(updatedList);
      if (onFeeChange) {
        onFeeChange(updatedList);
      }

      notify(`Fee request raised for ${cleanMilestone} (₹${numAmount}) & WhatsApp reminder prepared!`);

      // Reset form receipt number for next entry
      const cleanId = student.id.replace('std-', '');
      const monthCode = new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const yearCode = new Date().getFullYear().toString().slice(-2);
      setFormReceiptNumber(`REC-${cleanId}-${monthCode}${yearCode}-${Math.floor(100 + Math.random() * 900)}`);
      setFormNotes('');
    } catch (err: any) {
      notify(err.message || 'Failed to raise fee request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start Inline Edit on a row
  const startInlineEdit = (fee: FeeRecord) => {
    setEditingRowId(fee.id);
    setEditFormData({
      date: fee.date || fee.paidDate || new Date().toISOString().split('T')[0],
      milestone: fee.milestone || fee.yearMonth || getCurrentMonthYear(),
      receiptNumber: fee.receiptNumber || '',
      amount: fee.amount || 1600,
      status: (fee.status === 'Paid') ? 'Paid' : 'Pending',
      paymentMethod: fee.paymentMethod || 'In-Person Reception - Cash',
      notes: fee.notes || ''
    });
  };

  // Cancel Inline Edit
  const cancelInlineEdit = () => {
    setEditingRowId(null);
  };

  // Save Inline Edit
  const handleSaveInlineEdit = async (feeId: string) => {
    setIsSavingInline(true);
    try {
      const isPaid = editFormData.status === 'Paid';
      const cleanMilestone = editFormData.milestone.trim() || getCurrentMonthYear();

      const updates: Partial<FeeRecord> = {
        date: editFormData.date,
        yearMonth: cleanMilestone,
        milestone: cleanMilestone,
        receiptNumber: editFormData.receiptNumber.trim() || undefined,
        amount: Number(editFormData.amount) || 1600,
        status: editFormData.status,
        paidDate: isPaid ? (editFormData.date || new Date().toISOString().split('T')[0]) : undefined,
        paymentMethod: editFormData.paymentMethod,
        notes: editFormData.notes.trim() || undefined
      };

      const updated = await api.updateFee(feeId, updates);

      const updatedList = fees.map(f => f.id === feeId ? updated : f);
      setFees(updatedList);
      if (onFeeChange) {
        onFeeChange(updatedList);
      }

      setEditingRowId(null);
      notify(`Fee row updated successfully!`);
    } catch (err: any) {
      notify(err.message || 'Failed to update fee row');
    } finally {
      setIsSavingInline(false);
    }
  };

  // Delete Fee Row modal triggers
  const promptDeleteFeeRow = (fee: FeeRecord) => {
    setFeeToDelete(fee);
  };

  const handleConfirmDelete = async () => {
    if (!feeToDelete) return;
    setIsDeletingFee(true);
    try {
      await api.deleteFee(feeToDelete.id);
      const updatedList = fees.filter(f => f.id !== feeToDelete.id);
      setFees(updatedList);
      if (onFeeChange) {
        onFeeChange(updatedList);
      }
      const label = feeToDelete.milestone || feeToDelete.yearMonth || 'Fee Record';
      notify(`Fee request for "${label}" deleted successfully.`);
      setFeeToDelete(null);
    } catch (err: any) {
      notify(err.message || 'Failed to delete fee record');
    } finally {
      setIsDeletingFee(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeletingFee) return;
    setFeeToDelete(null);
  };

  // Send WhatsApp Reminder for a specific row
  const handleSendRowReminder = async (fee: FeeRecord) => {
    if (!student) return;
    const isPaid = fee.status === 'Paid';
    if (isPaid) return; // Guard clause

    setActiveSendingId(fee.id);
    try {
      const cleanMilestone = fee.milestone || fee.yearMonth || getCurrentMonthYear();
      const res = await api.sendWhatsAppReminder({
        studentId: student.id,
        parentPhone: student.whatsappMobile,
        parentName: student.parentName,
        studentName: student.displayName,
        amount: fee.amount || 1600,
        milestone: cleanMilestone,
        receiptNumber: fee.receiptNumber
      });

      if (res.whatsappUrl) {
        dispatchWhatsApp(res.whatsappUrl, res.messageText);
      }

      notify(`WhatsApp reminder prepared for ${student.parentName} (${cleanMilestone})!`);
    } catch (err: any) {
      notify(err.message || 'Failed to send WhatsApp reminder');
    } finally {
      setActiveSendingId(null);
    }
  };

  return (
    <div className="space-y-8" id="fee-ledger-tracker-container">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0E3589] animate-pulse" />
            <h2 className="text-lg font-black text-slate-900">
              Fee Ledger &amp; Reminders
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Month-wise milestone tracking with in-person reception settlement and instant automated WhatsApp reminders.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
          <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-bold text-emerald-800">
            ₹1,600 Coaching Fee • In-Person Reception Settlement
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABLE 1: RAISE FEE REQUEST (FORM / INTERACTIVE CREATION TABLE)           */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div 
          className="bg-slate-50/80 rounded-3xl p-6 border-2 border-blue-100 shadow-sm space-y-5"
          id="raise-fee-request-panel"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#0E3589] text-white flex items-center justify-center shadow-xs">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Raise Fee Request
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Enter month/milestone and receipt details to register payment request and dispatch instant WhatsApp reminder.
                </p>
              </div>
            </div>

            {/* Target Parent Mobile Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-xl border border-slate-200 text-slate-700 text-xs font-bold self-start">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp: {student.whatsappMobile || 'Not provided'}</span>
            </div>
          </div>

          <form onSubmit={handleRaiseFeeRequest} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
              {/* 1. Date Selection with Calendar Icon */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Request Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#0E3589]" />
                  </div>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent shadow-2xs"
                    id="input-raise-fee-date"
                  />
                </div>
              </div>

              {/* 2. Free Textbox for 8-class period/milestone (Default to Month/Year) */}
              <div className="space-y-1 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                    Milestone / Month Period <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormMilestone(getCurrentMonthYear())}
                    className="text-[10px] font-bold text-[#0E3589] hover:underline cursor-pointer"
                  >
                    Reset to Current Month
                  </button>
                </div>
                <input
                  type="text"
                  value={formMilestone}
                  onChange={(e) => setFormMilestone(e.target.value)}
                  placeholder="e.g. August 2026 or September Milestone"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent shadow-2xs"
                  id="input-raise-fee-milestone"
                />
              </div>

              {/* 3. Receipt Number */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Receipt Number
                </label>
                <input
                  type="text"
                  value={formReceiptNumber}
                  onChange={(e) => setFormReceiptNumber(e.target.value)}
                  placeholder="e.g. REC-101-AUG26"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent shadow-2xs"
                  id="input-raise-fee-receipt"
                />
              </div>

              {/* 4. Amount */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Fee Amount (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    ₹
                  </div>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    min="1"
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-emerald-800 outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent shadow-2xs"
                    id="input-raise-fee-amount"
                  />
                </div>
              </div>

              {/* 5. Receipt Status */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Receipt Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'Pending' | 'Paid')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent shadow-2xs cursor-pointer text-slate-800"
                  id="select-raise-fee-status"
                >
                  <option value="Pending">Pending / Due</option>
                  <option value="Paid">Paid (Receipt Issued)</option>
                </select>
              </div>
            </div>

            {/* In-Person Reception Method & Notes Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  In-Person Reception / Payment Method
                </label>
                <select
                  value={formMethod}
                  onChange={(e) => setFormMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent shadow-2xs cursor-pointer text-slate-800"
                  id="select-raise-fee-method"
                >
                  <option value="In-Person Reception - Cash">In-Person Reception - Cash</option>
                  <option value="In-Person Reception - UPI / GPay">In-Person Reception - UPI / GPay</option>
                  <option value="In-Person Reception - Card / POS">In-Person Reception - Card / POS</option>
                  <option value="Direct Bank Transfer / NEFT">Direct Bank Transfer / NEFT</option>
                </select>
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Notes
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g., Cash collected at desk by Mrs. Deepthy / GPay transaction ref"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent shadow-2xs"
                  id="input-raise-fee-notes"
                />
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 text-[#0E3589] shrink-0" />
                <span>Clicking <strong>Raise Fee Request</strong> will record the milestone in the ledger and dispatch a WhatsApp payment reminder with GPay details.</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-700 to-[#0E3589] hover:from-emerald-700 hover:to-[#09225a] text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap self-end"
                id="btn-submit-raise-fee-request"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing &amp; Dispatching...</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 text-emerald-200" />
                    <span>Raise Fee Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TABLE 2: ROWS OF THE RAISED FEES (LEDGER WITH INLINE EDIT & ACTIONS)       */}
      {/* ========================================================================= */}
      <div className="space-y-4" id="raised-fees-ledger-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Raised Fees &amp; Payment Ledger</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-[#0E3589] border border-blue-200">
                {fees.length} {fees.length === 1 ? 'Record' : 'Records'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Real-time audit log of fee requests. Edit details inline, delete obsolete rows, or send WhatsApp reminders for unpaid periods.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-bold border border-emerald-200 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Paid: {fees.filter(f => f.status === 'Paid').length}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg font-bold border border-amber-200 text-[11px]">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Pending: {fees.filter(f => f.status !== 'Paid').length}
            </span>
          </div>
        </div>

        {/* Ledger Table Container */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" id="raised-fees-table">
              <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Milestone</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Receipt</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Amount</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Method</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Notes</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fees.length > 0 ? (
                  fees.map((fee) => {
                    const isEditing = editingRowId === fee.id;
                    const isPaid = fee.status === 'Paid';
                    const displayDate = fee.date || fee.paidDate || '—';
                    const displayMilestone = fee.milestone || fee.yearMonth || 'August 2026';
                    const displayReceipt = fee.receiptNumber || fee.receiptNo || '—';

                    if (isEditing) {
                      // INLINE EDITING ROW
                      return (
                        <tr key={fee.id} className="bg-amber-50/60 border-2 border-amber-300" id={`row-edit-${fee.id}`}>
                          {/* 1. Date */}
                          <td className="py-3 px-3">
                            <input
                              type="date"
                              value={editFormData.date}
                              onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-[#0E3589]"
                              id={`input-inline-date-${fee.id}`}
                            />
                          </td>

                          {/* 2. Milestone */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={editFormData.milestone}
                              onChange={(e) => setEditFormData({ ...editFormData, milestone: e.target.value })}
                              placeholder="Milestone / Month"
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-[#0E3589]"
                              id={`input-inline-milestone-${fee.id}`}
                            />
                          </td>

                          {/* 3. Receipt */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={editFormData.receiptNumber}
                              onChange={(e) => setEditFormData({ ...editFormData, receiptNumber: e.target.value })}
                              placeholder="Receipt #"
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-[#0E3589]"
                              id={`input-inline-receipt-${fee.id}`}
                            />
                          </td>

                          {/* 4. Amount */}
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              value={editFormData.amount}
                              onChange={(e) => setEditFormData({ ...editFormData, amount: Number(e.target.value) || 0 })}
                              className="w-24 p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-black text-emerald-800 outline-none focus:ring-2 focus:ring-[#0E3589]"
                              id={`input-inline-amount-${fee.id}`}
                            />
                          </td>

                          {/* 5. Status */}
                          <td className="py-3 px-3">
                            <select
                              value={editFormData.status}
                              onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as 'Paid' | 'Pending' })}
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-[#0E3589] cursor-pointer"
                              id={`select-inline-status-${fee.id}`}
                            >
                              <option value="Paid">Paid</option>
                              <option value="Pending">Pending / Due</option>
                            </select>
                          </td>

                          {/* 6. Method */}
                          <td className="py-3 px-3">
                            <select
                              value={editFormData.paymentMethod}
                              onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-[#0E3589] cursor-pointer"
                              id={`select-inline-method-${fee.id}`}
                            >
                              <option value="In-Person Reception - Cash">In-Person Reception - Cash</option>
                              <option value="In-Person Reception - UPI / GPay">In-Person Reception - UPI / GPay</option>
                              <option value="In-Person Reception - Card / POS">In-Person Reception - Card / POS</option>
                              <option value="Direct Bank Transfer / NEFT">Direct Bank Transfer / NEFT</option>
                            </select>
                          </td>

                          {/* 7. Notes */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={editFormData.notes}
                              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                              placeholder="Notes / Ref"
                              className="w-full min-w-[140px] p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#0E3589]"
                              id={`input-inline-notes-${fee.id}`}
                            />
                          </td>

                          {/* 8. Inline Actions (Save & Cancel) */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveInlineEdit(fee.id)}
                                disabled={isSavingInline}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Save changes"
                                id={`btn-save-inline-${fee.id}`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isSavingInline ? 'Saving...' : 'Save'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={cancelInlineEdit}
                                disabled={isSavingInline}
                                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                                title="Cancel editing"
                                id={`btn-cancel-inline-${fee.id}`}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // STANDARD DISPLAY ROW
                    return (
                      <tr key={fee.id} className="hover:bg-slate-50 transition-colors group" id={`row-fee-${fee.id}`}>
                        {/* 1. Date */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {displayDate}
                        </td>

                        {/* 2. Milestone */}
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">
                          {displayMilestone}
                        </td>

                        {/* 3. Receipt */}
                        <td className="py-3.5 px-4 font-mono font-bold text-[#0E3589] whitespace-nowrap">
                          {displayReceipt}
                        </td>

                        {/* 4. Amount */}
                        <td className="py-3.5 px-4 font-black text-emerald-800 whitespace-nowrap">
                          ₹{fee.amount}
                        </td>

                        {/* 5. Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Paid</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Pending / Due</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* 6. Method */}
                        <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {fee.paymentMethod || 'In-Person Reception'}
                        </td>

                        {/* 7. Notes */}
                        <td className="py-3.5 px-4 text-slate-600 font-medium text-xs max-w-[200px]" title={fee.notes || 'No notes'}>
                          {fee.notes ? (
                            <div className="inline-flex items-center gap-1.5 text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] max-w-[180px]">
                              <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{fee.notes}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* 8. Actions (Edit / Delete / Send Reminder) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Action 1: Edit Button */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => startInlineEdit(fee)}
                                className="p-1.5 text-slate-500 hover:text-[#0E3589] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                                title="Edit this fee row inline"
                                id={`btn-edit-fee-${fee.id}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Action 2: Delete Button */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => promptDeleteFeeRow(fee)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                                title="Delete this fee row"
                                id={`btn-delete-fee-${fee.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Action 3: Send Reminder Button (Disabled if Paid) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleSendRowReminder(fee)}
                                disabled={isPaid || activeSendingId === fee.id}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-2xs ${
                                  isPaid
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400 cursor-pointer active:scale-98'
                                }`}
                                title={
                                  isPaid
                                    ? 'Fee already paid • No reminder needed'
                                    : 'Send WhatsApp payment reminder to parent'
                                }
                                id={`btn-remind-fee-${fee.id}`}
                              >
                                <MessageCircle className={`w-3.5 h-3.5 ${isPaid ? 'text-slate-400' : 'text-emerald-600'}`} />
                                <span>
                                  {isPaid 
                                    ? 'Paid' 
                                    : activeSendingId === fee.id 
                                      ? 'Preparing...' 
                                      : 'Send Reminder'}
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 space-y-2">
                      <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      <p className="font-semibold text-xs text-slate-500">
                        No raised fee requests or payment receipts recorded yet.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Use the "Raise Fee Request" form above to create the first payment request.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL (Reliable in iFrames & Touch Devices)             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(feeToDelete)}
        onClose={handleCancelDelete}
        size="md"
        showCloseButton={false}
        id="modal-delete-fee-confirm"
      >
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Delete Fee Record?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This will permanently remove this fee request and receipt entry from the student's ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeletingFee}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Record Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Student:</span>
                <span className="font-bold text-slate-900">{student.displayName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Milestone / Month:</span>
                <span className="font-bold text-slate-900">{feeToDelete.milestone || feeToDelete.yearMonth || 'Milestone'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Receipt #:</span>
                <span className="font-mono font-bold text-[#0E3589]">{feeToDelete.receiptNumber || feeToDelete.receiptNo || '—'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Amount:</span>
                <span className="font-black text-emerald-800 text-sm">₹{feeToDelete.amount || 1600}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  (feeToDelete.status === 'Paid')
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}>
                  {(feeToDelete.status === 'Paid') ? 'Paid' : 'Pending / Due'}
                </span>
              </div>
              {feeToDelete.notes && (
                <div className="flex justify-between items-start text-slate-600 pt-1 border-t border-slate-200/60">
                  <span className="font-medium">Notes:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[220px] truncate">{feeToDelete.notes}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeletingFee}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                id="btn-cancel-delete-modal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingFee}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                id="btn-confirm-delete-modal"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingFee ? 'Deleting...' : 'Delete Record'}</span>
              </button>
            </div>
        </div>
      </Modal>
    </div>
  );
};
