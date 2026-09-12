import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Modal } from './ui/Modal';
import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CalendarDays,
  Check,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Info,
  X,
  FileText,
  MessageSquare,
  Save
} from 'lucide-react';
import { AttendanceRecord, StudentProfile } from '../types';
import { api } from '../services/api';

interface AttendanceCalendarTrackerProps {
  attendance: AttendanceRecord[];
  student: StudentProfile;
  isAdmin?: boolean;
  onAttendanceChange?: (updatedRecords: AttendanceRecord[]) => void;
}

/**
 * Parses preferredDays string into numeric days of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
 */
export function parseEnrolledDays(preferredDays?: string): number[] {
  if (!preferredDays) return [1, 3, 5]; // Default Mon, Wed, Fri
  const str = preferredDays.toLowerCase();
  if (str.includes('daily') || str.includes('all day') || str.includes('all days')) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  const days: number[] = [];
  if (str.includes('sun')) days.push(0);
  if (str.includes('mon')) days.push(1);
  if (str.includes('tue')) days.push(2);
  if (str.includes('wed')) days.push(3);
  if (str.includes('thu')) days.push(4);
  if (str.includes('fri')) days.push(5);
  if (str.includes('sat')) days.push(6);
  return days.length > 0 ? days : [1, 3, 5];
}

const COMMON_DRILL_NOTES = [
  'Cursive stroke drills & posture check',
  'Letter sizing & baseline alignment',
  '4-line worksheet practice',
  'Exam writing speed & paragraph trial',
  'Tripod grip stabilization drills',
  'Hindi Devanagari matra positioning',
];

export const AttendanceCalendarTracker: React.FC<AttendanceCalendarTrackerProps> = ({
  attendance: initialAttendance,
  student,
  isAdmin = false,
  onAttendanceChange,
}) => {
  // Local attendance state to allow instantaneous responsive UI updates
  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>(initialAttendance);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Note Modal State
  const [activeNoteModalDate, setActiveNoteModalDate] = useState<string | null>(null);
  const [modalNoteText, setModalNoteText] = useState<string>('');
  const [modalStatus, setModalStatus] = useState<'Present' | 'Absent'>('Present');

  // Inline Note Editor State for Notes List
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState<string>('');

  // Keep local attendance in sync if parent updates initialAttendance
  React.useEffect(() => {
    setLocalAttendance(initialAttendance);
  }, [initialAttendance]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  // Today's real local date string (YYYY-MM-DD)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const isCurrentMonthView = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  // Month display label e.g., "August 2026"
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthShortName = currentDate.toLocaleDateString('en-US', { month: 'short' });

  // Parse student's enrolled batch days
  const enrolledDayNumbers = useMemo(() => parseEnrolledDays(student.preferredDays), [student.preferredDays]);

  // Map attendance by date string (YYYY-MM-DD)
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    localAttendance.forEach(rec => {
      if (rec.date) {
        map.set(rec.date, rec);
      }
    });
    return map;
  }, [localAttendance]);

  // Classes attended in the currently selected month
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthAttendedRecords = localAttendance.filter(
    rec => rec.date?.startsWith(monthPrefix) && rec.status === 'Present'
  );

  // All records with non-empty notes (sorted descending by date)
  const recordsWithNotes = useMemo(() => {
    return localAttendance
      .filter(rec => rec.notes && rec.notes.trim().length > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [localAttendance]);

  const showFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // ================= ADMIN ATTENDANCE MUTATIONS =================
  const handleMarkStatus = async (dateStr: string, status: 'Present' | 'Absent', notesOverride?: string) => {
    if (!isAdmin) return;
    setIsMutating(true);

    const yearMonth = dateStr.slice(0, 7);
    const existingRec = attendanceMap.get(dateStr);
    const finalNote = notesOverride !== undefined ? notesOverride : (existingRec?.notes || '');

    const newRecord: AttendanceRecord = {
      id: existingRec?.id || `att-${Date.now()}`,
      studentId: student.id,
      classNumber: existingRec?.classNumber || (localAttendance.length + 1),
      date: dateStr,
      yearMonth,
      status,
      notes: finalNote,
    };

    // Optimistic UI update
    const updatedList = [
      ...localAttendance.filter(a => a.date !== dateStr),
      newRecord,
    ].sort((a, b) => b.date.localeCompare(a.date));

    setLocalAttendance(updatedList);

    try {
      await api.saveAttendanceBatch([{
        studentId: student.id,
        classNumber: existingRec?.classNumber || (localAttendance.length + 1),
        date: dateStr,
        yearMonth,
        status,
        notes: finalNote,
      }]);
      showFeedback(`Attendance marked as ${status} on ${dateStr}`);
      if (onAttendanceChange) {
        onAttendanceChange(updatedList);
      }
    } catch (err: any) {
      console.error('Failed to save attendance:', err);
      // Revert on error
      setLocalAttendance(initialAttendance);
      alert(err.message || 'Failed to save attendance');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteRecord = async (dateStr: string) => {
    if (!isAdmin) return;
    const targetRecord = localAttendance.find(a => a.date === dateStr);
    setIsMutating(true);

    const updatedList = localAttendance.filter(a => a.date !== dateStr);
    setLocalAttendance(updatedList);

    try {
      if (targetRecord?.id) {
        await api.deleteAttendance(targetRecord.id);
      } else {
        await api.deleteAttendance(student.id, dateStr);
      }
      showFeedback(`Attendance record cleared for ${dateStr}`);
      if (onAttendanceChange) {
        onAttendanceChange(updatedList);
      }
    } catch (err: any) {
      console.error('Failed to delete attendance:', err);
      setLocalAttendance(initialAttendance);
      alert(err.message || 'Failed to delete attendance');
    } finally {
      setIsMutating(false);
    }
  };

  // Open note popup dialog
  const handleOpenNoteModal = (dateStr: string) => {
    const rec = attendanceMap.get(dateStr);
    setActiveNoteModalDate(dateStr);
    setModalNoteText(rec?.notes || '');
    setModalStatus(rec?.status || 'Present');
  };

  // Save note from popup dialog
  const handleSaveModalNote = async () => {
    if (!activeNoteModalDate || !isAdmin) return;
    const dateStr = activeNoteModalDate;
    await handleMarkStatus(dateStr, modalStatus, modalNoteText.trim());
    setActiveNoteModalDate(null);
  };

  // Save inline note edit in notes table
  const handleSaveInlineNote = async (dateStr: string) => {
    if (!isAdmin) return;
    const rec = attendanceMap.get(dateStr);
    const status = rec?.status || 'Present';
    await handleMarkStatus(dateStr, status, inlineEditText.trim());
    setEditingNoteDate(null);
  };

  // Delete note only (keeps attendance or clears if requested)
  const handleDeleteNoteOnly = async (dateStr: string) => {
    if (!isAdmin) return;
    const rec = attendanceMap.get(dateStr);
    if (!rec) return;
    await handleMarkStatus(dateStr, rec.status, '');
    showFeedback(`Note removed for ${dateStr}`);
  };

  // Generate calendar grid cells
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon, ...
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isEnrolledDay: boolean;
      dayOfWeek: number;
      record?: AttendanceRecord;
    }> = [];

    // Previous month padding days
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth() + 1;

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const dateStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dObj = new Date(prevYear, prevMonthNum - 1, dayNum);
      const dow = dObj.getDay();
      cells.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isEnrolledDay: enrolledDayNumbers.includes(dow),
        dayOfWeek: dow,
        record: attendanceMap.get(dateStr),
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(currentYear, currentMonth, day);
      const dow = dObj.getDay();
      cells.push({
        dayNumber: day,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isEnrolledDay: enrolledDayNumbers.includes(dow),
        dayOfWeek: dow,
        record: attendanceMap.get(dateStr),
      });
    }

    // Next month padding days to complete grid (multiples of 7)
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonthNum = nextMonthDate.getMonth() + 1;

    const remainingCells = (7 - (cells.length % 7)) % 7;
    const totalNeeded = cells.length + remainingCells < 35 ? 35 - cells.length : remainingCells;

    for (let day = 1; day <= totalNeeded; day++) {
      const dateStr = `${nextYear}-${String(nextMonthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(nextYear, nextMonthNum - 1, day);
      const dow = dObj.getDay();
      cells.push({
        dayNumber: day,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isEnrolledDay: enrolledDayNumbers.includes(dow),
        dayOfWeek: dow,
        record: attendanceMap.get(dateStr),
      });
    }

    return cells;
  }, [currentYear, currentMonth, attendanceMap, todayStr, enrolledDayNumbers]);

  const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-md space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-full text-xs font-extrabold uppercase tracking-wider mb-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#0E3589]" />
            <span>Attendance Tracker {isAdmin && '• Coach Admin Mode'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Attendance Calendar
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-slate-500 font-medium">
              Classes attended by {student.firstName} are highlighted in green.
            </p>
            {/* Student's Enrolled Batch Schedule Indicator */}
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0E3589] bg-blue-50/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
              <Clock className="w-3 h-3 text-[#0E3589]" />
              Enrolled: {student.preferredDays || 'Mon / Wed / Fri'} • {student.preferredSlot || '5:00 - 6:00 PM'}
            </span>
          </div>
        </div>

        {/* Dynamic Attended count for the selected month */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2.5 rounded-2xl border border-emerald-200 shadow-2xs">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-100"></span>
            <span className="text-xs sm:text-sm font-extrabold text-emerald-900">
              {monthAttendedRecords.length} Attended in {monthShortName}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Action Success Banner */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CALENDAR CONTROLS & MONTH SELECTOR                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
        {/* Navigation Buttons: Left Arrow / Month Name / Right Arrow */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs"
            title="View Previous Month"
            id="btn-prev-month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </Button>

          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight" id="calendar-current-month-label">
              {monthName}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs"
            title="View Next Month"
            id="btn-next-month"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </Button>

          {!isCurrentMonthView && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleGoToCurrentMonth}
              id="btn-today-month"
            >
              Current Month
            </Button>
          )}
        </div>

        {/* Schedule & Highlights Summary */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="w-4 h-4 rounded-full bg-[#0E3589] text-white text-[9px] font-black flex items-center justify-center ring-2 ring-blue-200">
              {new Date().getDate()}
            </span>
            <span className="text-[11px] sm:text-xs">Today</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-[#0E3589] border border-blue-200 text-[9px] font-extrabold">
              Batch
            </span>
            <span className="text-[11px] sm:text-xs">Enrolled Batch ({student.preferredDays || 'Mon/Wed/Fri'})</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></span>
            <span className="text-[11px] sm:text-xs font-bold text-emerald-800">Attended</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100"></span>
            <span className="text-[11px] sm:text-xs font-bold text-amber-800">Absent</span>
          </div>

          {isAdmin && (
            <span className="text-[11px] font-bold text-slate-500 w-full sm:w-auto mt-1 sm:mt-0">
              💡 Tap any date cell to mark, edit notes, or clear records
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CALENDAR MONTH GRID                                                      */}
      {/* ========================================================================= */}
      <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs bg-white">
        <div className="min-w-[340px] sm:min-w-full">
        {/* Weekday Header Columns */}
        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200 text-center text-xs font-extrabold text-slate-700 uppercase tracking-wider py-3">
          {weekDayNames.map((name, idx) => {
            const isBatchDayColumn = enrolledDayNumbers.includes(idx);
            return (
              <div 
                key={name} 
                className={`flex items-center justify-center gap-1 ${
                  isBatchDayColumn ? 'text-[#0E3589] font-black' : idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                <span>{name}</span>
                {isBatchDayColumn && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0E3589]" title="Enrolled day column" />
                )}
              </div>
            );
          })}
        </div>

        {/* Day Cells Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/50">
          {calendarGrid.map((cell, idx) => {
            const isPresent = cell.record && cell.record.status === 'Present';
            const isAbsent = cell.record && cell.record.status === 'Absent';
            const hasRecord = !!cell.record;
            const hasNote = !!cell.record?.notes && cell.record.notes.trim().length > 0;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (isAdmin && cell.isCurrentMonth) {
                    handleOpenNoteModal(cell.dateStr);
                  }
                }}
                className={`min-h-[75px] sm:min-h-[115px] md:min-h-[135px] p-1 sm:p-2 transition-all flex flex-col justify-between relative group select-none ${
                  isAdmin && cell.isCurrentMonth ? 'cursor-pointer hover:shadow-xs' : ''
                } ${
                  !cell.isCurrentMonth
                    ? 'bg-slate-50/40 text-slate-300 opacity-40'
                    : isPresent
                    ? 'bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-950 font-bold border-emerald-200'
                    : isAbsent
                    ? 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-950'
                    : cell.isEnrolledDay
                    ? 'bg-blue-50/30 hover:bg-blue-50/60 border-dashed border-blue-200 text-slate-800'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                id={`calendar-cell-${cell.dateStr}`}
              >
                {/* Top Row: Day Number + Batch Day Indicator */}
                <div className="flex items-center justify-between gap-0.5 sm:gap-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[11px] sm:text-sm font-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
                        cell.isToday
                          ? 'bg-[#0E3589] text-white shadow-2xs ring-2 ring-blue-200'
                          : isPresent
                          ? 'text-emerald-900 font-extrabold'
                          : cell.isEnrolledDay && cell.isCurrentMonth
                          ? 'text-[#0E3589] font-black'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {cell.isToday && (
                      <span className="hidden md:inline-block text-[8px] font-black uppercase text-[#0E3589] bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Scheduled Batch Day Indicator */}
                  {cell.isEnrolledDay && cell.isCurrentMonth && (
                    <span 
                      className={`text-[7px] sm:text-[9px] font-extrabold px-1 sm:px-1.5 py-0.2 rounded-md ${
                        isPresent 
                          ? 'bg-emerald-200/70 text-emerald-900' 
                          : 'bg-blue-100 text-[#0E3589] border border-blue-200'
                      }`}
                      title={`Enrolled Batch Day (${student.preferredDays})`}
                    >
                      Batch
                    </span>
                  )}
                </div>

                {/* Middle Content: Status Badge & Note Preview snippet */}
                <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                  {isPresent ? (
                    <div 
                      className="bg-emerald-500 text-white rounded sm:rounded-xl px-1 py-0.5 sm:py-1 shadow-2xs text-center flex items-center justify-center gap-0.5 sm:gap-1"
                      title={isAdmin ? 'Attended (Tap to edit)' : 'Attended'}
                    >
                      <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span className="text-[8px] sm:text-xs font-black tracking-tight leading-none truncate">
                        Attended
                      </span>
                    </div>
                  ) : isAbsent ? (
                    <div 
                      className="bg-amber-500 text-white rounded sm:rounded-lg px-1 py-0.5 text-center shadow-2xs flex items-center justify-center gap-0.5"
                      title={isAdmin ? 'Absent (Tap to edit)' : 'Absent'}
                    >
                      <X className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                      <span className="text-[8px] sm:text-[10px] font-bold truncate">Absent</span>
                    </div>
                  ) : cell.isEnrolledDay && cell.isCurrentMonth ? (
                    /* Enrolled Day not yet recorded */
                    <div className="text-[7px] sm:text-[9px] text-blue-600 font-semibold text-center bg-blue-50/50 py-0.5 rounded border border-blue-100 truncate">
                      Scheduled
                    </div>
                  ) : null}

                  {/* Note snippet indicator */}
                  {hasNote && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNoteModal(cell.dateStr);
                      }}
                      className="bg-blue-50/90 border border-blue-200 rounded p-0.5 sm:p-1 text-[7px] sm:text-[9px] text-[#0E3589] font-medium leading-tight flex items-start gap-0.5 sm:gap-1 cursor-pointer line-clamp-1"
                      title={`Coach Note: ${cell.record?.notes}`}
                    >
                      <FileText className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0 text-[#0E3589] mt-0.5" />
                      <span className="truncate hidden sm:inline">{cell.record?.notes}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Row: IN-CELL ACTIONS FOR ADMIN */}
                {isAdmin && cell.isCurrentMonth && (
                  <>
                    {/* Desktop View: In-cell buttons */}
                    <div className="hidden md:flex mt-1 pt-1 border-t border-slate-200/60 items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNoteModal(cell.dateStr);
                        }}
                        disabled={isMutating}
                        className="text-[9px] px-1.5 py-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        title={hasNote ? 'Edit Note' : 'Add Note'}
                        id={`btn-note-${cell.dateStr}`}
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>{hasNote ? 'Edit' : '+ Note'}</span>
                      </button>

                      {hasRecord && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRecord(cell.dateStr);
                          }}
                          disabled={isMutating}
                          className="text-[9px] px-1.5 py-0.5 text-red-600 hover:bg-red-50 rounded font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="Clear attendance record for this date"
                          id={`btn-clear-${cell.dateStr}`}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>

                    {/* Mobile View: Clean Tap Hint */}
                    <div className="md:hidden mt-0.5 text-center">
                      <span className="text-[7px] text-slate-400 font-medium group-active:text-[#0E3589]">
                        {hasRecord ? 'Tap to edit' : '+ Mark'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SHARED SECTION: DATES & NOTES LOG (Visible for both Admin and Parent)     */}
      {/* Displays only dates where notes are available; Admin can edit/delete     */}
      {/* ========================================================================= */}
      <div 
        className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs"
        id="section-session-notes-log"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0E3589] text-white flex items-center justify-center shadow-xs shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <span>Session Drills &amp; Coach Notes</span>
                <span className="px-2 py-0.5 bg-blue-100 text-[#0E3589] rounded-full text-[10px] font-extrabold">
                  {recordsWithNotes.length} Logged
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isAdmin
                  ? 'Showing dates with coach notes. Click edit to modify drill notes directly.'
                  : 'Teacher observations, handwriting drills, and lesson notes for completed classes.'}
              </p>
            </div>
          </div>

          {/* Quick Add Note Button for Admin */}
          {isAdmin && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleOpenNoteModal(todayStr)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              id="btn-add-today-note"
            >
              Add Note for Today
            </Button>
          )}
        </div>

        {/* Notes List / Table */}
        {recordsWithNotes.length > 0 ? (
          <div className="divide-y divide-slate-200/80 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            {recordsWithNotes.map((rec) => {
              const dateObj = new Date(rec.date + 'T00:00:00');
              const formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const isEditing = editingNoteDate === rec.date;

              return (
                <div 
                  key={rec.id || rec.date}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                  id={`note-row-${rec.date}`}
                >
                  {/* Left Column: Date & Status */}
                  <div className="md:w-56 shrink-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">
                        {formattedDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          rec.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {rec.status === 'Present' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-amber-600" />
                        )}
                        <span>{rec.status === 'Present' ? 'Attended' : 'Absent'}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {rec.date}
                      </span>
                    </div>
                  </div>

                  {/* Middle Column: Note Content / Inline Edit Box */}
                  <div className="flex-1">
                    {isEditing && isAdmin ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          value={inlineEditText}
                          onChange={(e) => setInlineEditText(e.target.value)}
                          placeholder="Enter coach observations, lesson drills..."
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveInlineNote(rec.date)}
                            isLoading={isMutating}
                            leftIcon={<Save className="w-3 h-3" />}
                            className="px-3 py-1 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingNoteDate(null)}
                            className="px-3 py-1 text-xs"
                          >
                            Cancel
                          </Button>
                          {/* Presets */}
                          <div className="flex flex-wrap gap-1">
                            {COMMON_DRILL_NOTES.slice(0, 3).map((drill) => (
                              <Button
                                key={drill}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setInlineEditText(drill)}
                                className="text-[10px] px-2 py-0.5"
                              >
                                + {drill}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-800 font-medium leading-relaxed">
                        {rec.notes}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Admin Actions (Edit & Remove Note) */}
                  {isAdmin && !isEditing && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end md:self-start">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingNoteDate(rec.date);
                          setInlineEditText(rec.notes || '');
                        }}
                        leftIcon={<Edit3 className="w-3 h-3" />}
                        className="px-2.5 py-1 text-xs"
                        title="Edit note"
                      >
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteNoteOnly(rec.date)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete note only"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">
              No session notes logged yet
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              {isAdmin
                ? 'Click on any calendar date or the "+ Note" button inside a date cell to record student handwriting drills and observations.'
                : 'Session drill notes and coach feedback will appear here as classes are conducted.'}
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* POPUP MODAL: ADD / EDIT NOTE DIALOG (Admin)                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(activeNoteModalDate)}
        onClose={() => setActiveNoteModalDate(null)}
        size="md"
        showCloseButton={false}
        id="modal-attendance-note"
      >
        {activeNoteModalDate && (
          <div className="space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#0E3589] text-white flex items-center justify-center shadow-xs">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Session Note &amp; Drills
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {new Date(activeNoteModalDate + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setActiveNoteModalDate(null)}
                className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
                title="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Attendance Status Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">
                Attendance Status:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={modalStatus === 'Present' ? 'success' : 'secondary'}
                  size="sm"
                  onClick={() => setModalStatus('Present')}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Attended (Present)
                </Button>

                <Button
                  type="button"
                  variant={modalStatus === 'Absent' ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={() => setModalStatus('Absent')}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Absent
                </Button>
              </div>
            </div>

            {/* Textarea for note */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 block">
                  Coach Notes &amp; Practice Drills:
                </label>
                <span className="text-[10px] text-slate-400">Visible on Parent Portal</span>
              </div>
              <Textarea
                rows={3}
                value={modalNoteText}
                onChange={(e) => setModalNoteText(e.target.value)}
                placeholder="e.g. Practiced cursive loop heights, 4-line baseline check..."
                autoFocus
              />
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold block">
                Quick Drill Presets:
              </span>
              <div className="flex flex-wrap gap-1">
                {COMMON_DRILL_NOTES.map((drill) => (
                  <Button
                    key={drill}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalNoteText(drill)}
                    className="text-[10px] px-2 py-1"
                  >
                    + {drill}
                  </Button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {activeNoteModalDate && attendanceMap.has(activeNoteModalDate) ? (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (activeNoteModalDate) {
                      handleDeleteRecord(activeNoteModalDate);
                      setActiveNoteModalDate(null);
                    }
                  }}
                  isLoading={isMutating}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  className="text-xs"
                >
                  Clear Record
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNoteModalDate(null)}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSaveModalNote}
                  isLoading={isMutating}
                  loadingText="Saving..."
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                  id="btn-save-modal-note"
                >
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

