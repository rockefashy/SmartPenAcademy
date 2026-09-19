import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal, Button } from '../../ui';

interface EnrolledCoachSuccessModalProps {
  coachData: {
    name: string;
    designation: string;
    email: string;
    phoneNumber: string;
  } | null;
  onClose: () => void;
  onEnrollAnother: () => void;
}

export const EnrolledCoachSuccessModal: React.FC<EnrolledCoachSuccessModalProps> = ({
  coachData,
  onClose,
  onEnrollAnother,
}) => {
  if (!coachData) return null;

  return (
    <Modal
      isOpen={Boolean(coachData)}
      onClose={onClose}
      size="md"
      showCloseButton={false}
    >
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            Coach Registered Successfully
          </span>
          <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 pt-2">
            {coachData.name}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            Registered as <strong className="text-[#0E3589] font-bold">{coachData.designation}</strong> in SmartPen Academy.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Designation</span>
            <span className="font-bold text-[#0E3589]">{coachData.designation}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Login Email</span>
            <span className="font-semibold text-slate-800 truncate max-w-[200px]">{coachData.email}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Phone Number</span>
            <span className="font-semibold text-slate-800">{coachData.phoneNumber}</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          The coach can now sign in using the <strong>Coach / Tutor</strong> role with their email/phone and established password.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="py-3 px-4"
            id="btn-confirm-coach-directory-nav"
          >
            Go to Coach Directory
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onEnrollAnother}
            className="py-3 px-4"
            id="btn-confirm-coach-enroll-another"
          >
            + Enroll Another Coach
          </Button>
        </div>
      </div>
    </Modal>
  );
};
