import React from 'react';
import { BadgeAlert, Check, UserCheck } from 'lucide-react';
import { Modal, Button } from '../../ui';
import { StudentProfile, CoachProfile } from '../../../types';

interface QuickCoachAssignModalProps {
  student: StudentProfile | null;
  coaches: CoachProfile[];
  onClose: () => void;
  onAssign: (studentId: string, coachId: string | null) => Promise<void>;
}

export const QuickCoachAssignModal: React.FC<QuickCoachAssignModalProps> = ({
  student,
  coaches,
  onClose,
  onAssign,
}) => {
  if (!student) return null;

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
            <UserCheck className="w-5 h-5 text-[#F46E20]" />
            <h3 className="font-bold text-sm">Assign Coach to Student</h3>
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

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
          <p className="font-bold text-slate-800">
            {student.firstName} ({student.gradeLevel || 'Standard Grade'})
          </p>
          <p className="text-slate-500">
            Parent: {student.parentName} • Phone: {student.whatsappMobile || student.emergencyContactPhone}
          </p>
          <p className="text-slate-500">
            {student.schoolName}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">Select Coach</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            <Button
              type="button"
              variant={!student.coachId ? 'primary' : 'outline'}
              onClick={() => onAssign(student.id, null)}
              className={`w-full p-3 rounded-xl border text-left text-xs font-bold justify-between ${
                !student.coachId
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <BadgeAlert className="w-4 h-4 text-amber-600" />
                <span>No Coach (Unassigned)</span>
              </span>
              {!student.coachId && <Check className="w-4 h-4 text-amber-600" />}
            </Button>

            {coaches.map((c) => {
              const isCurrent = student.coachId === c.id;
              return (
                <Button
                  key={c.id}
                  type="button"
                  variant={isCurrent ? 'primary' : 'outline'}
                  onClick={() => onAssign(student.id, c.id)}
                  className={`w-full p-3 rounded-xl border text-left text-xs font-bold justify-between ${
                    isCurrent
                      ? 'bg-blue-50 border-[#0E3589] text-[#0E3589] hover:bg-blue-100'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-extrabold text-xs">Coach {c.firstName}</p>
                    <p className="text-[10px] text-slate-500 font-normal">
                      {c.designation} • {c.studentCount || 0} students assigned
                    </p>
                  </div>
                  {isCurrent && <Check className="w-4 h-4 text-[#0E3589]" />}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="px-4 py-2"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
