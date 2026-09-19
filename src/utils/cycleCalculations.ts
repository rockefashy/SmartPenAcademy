import { AttendanceRecord, FeeRecord, StudentProfile } from '../types';

export interface StudentCycleStatus {
  cycleSize: number;
  cycleFee: number;
  attendedCount: number;
  completedCycles: number;
  currentCycle: number;
  currentCycleProgress: number;
  paidCyclesCount: number;
  isFeeDue: boolean;
  pendingFees: FeeRecord[];
  pendingFeeTotal: number;
  totalFeeDue: number;
}

/**
 * Calculates attendance progress, cycle milestones, and fee payment dues for a student.
 * Single source of truth across Admin Dashboard, Student Detail, and Parent Portal.
 */
export function calculateStudentCycleStatus(
  student: Partial<StudentProfile> | null | undefined,
  attendance: AttendanceRecord[] = [],
  fees: FeeRecord[] = []
): StudentCycleStatus {
  const cycleSize = Math.max(1, Number(student?.classesPerCycle) || 8);
  const cycleFee = Math.max(0, student?.feePerCycle !== undefined && student?.feePerCycle !== null ? Number(student?.feePerCycle) : 1600);

  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  const safeFees = Array.isArray(fees) ? fees : [];

  const attendedCount = safeAttendance.filter((a) => a.status === 'Present').length;
  const completedCycles = Math.floor(attendedCount / cycleSize);
  const currentCycle = completedCycles + 1;
  const currentCycleProgress = attendedCount % cycleSize;

  const paidCyclesCount = safeFees.filter((f) => f.status === 'Paid').length;
  const isFeeDueForCurrentCycle = completedCycles > 0 && paidCyclesCount < completedCycles;

  const pendingFees = safeFees.filter((f) => f.status === 'Pending' || f.status === 'Overdue');
  const pendingFeeTotal = pendingFees.reduce((sum, f) => sum + (f.amount || cycleFee), 0);

  const isExplicitPending = (student as any)?.feeStatus === 'Pending' || (student as any)?.feeStatus === 'Overdue';
  const isFeeDue = pendingFees.length > 0 || isFeeDueForCurrentCycle || isExplicitPending;

  const totalFeeDue = pendingFeeTotal > 0 ? pendingFeeTotal : (isFeeDue ? cycleFee : 0);

  return {
    cycleSize,
    cycleFee,
    attendedCount,
    completedCycles,
    currentCycle,
    currentCycleProgress,
    paidCyclesCount,
    isFeeDue,
    pendingFees,
    pendingFeeTotal,
    totalFeeDue,
  };
}
