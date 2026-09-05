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
              Classes attended by {student.displayName} are highlighted in green.
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
          <button
            onClick={handlePrevMonth}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            title="View Previous Month"
            id="btn-prev-month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>

          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight" id="calendar-current-month-label">
              {monthName}
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            title="View Next Month"
            id="btn-next-month"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>

          {!isCurrentMonthView && (
            <button
              onClick={handleGoToCurrentMonth}
              className="px-3.5 py-2 bg-[#0E3589] hover:bg-[#08225e] text-white text-xs font-extrabold rounded-xl shadow-2xs transition-all cursor-pointer"
              id="btn-today-month"
            >
              Current Month
            </button>
          )}
        </div>

        {/* Schedule & Highlights Summary */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100"></span>
            <span>Blue ring = Enrolled Batch Day ({student.preferredDays || 'Mon/Wed/Fri'})</span>
          </div>
          {isAdmin && (
            <span className="text-[11px] font-bold text-slate-500">
              💡 Use in-cell buttons to mark, clear, or add notes
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CALENDAR MONTH GRID                                                      */}
      {/* ========================================================================= */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
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
                className={`min-h-[110px] sm:min-h-[135px] p-2 transition-all flex flex-col justify-between relative group select-none ${
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
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs sm:text-sm font-black w-6 h-6 rounded-full flex items-center justify-center transition-all ${
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
                      <span className="hidden sm:inline-block text-[8px] font-black uppercase text-[#0E3589] bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Scheduled Batch Day Indicator */}
                  {cell.isEnrolledDay && cell.isCurrentMonth && (
                    <span 
                      className={`text-[8px] sm:text-[9px] font-extrabold px-1 sm:px-1.5 py-0.2 rounded-md ${
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
                <div className="mt-1 space-y-1">
                  {isPresent ? (
                    <div 
                      onClick={() => {
                        if (isAdmin) {
                          handleMarkStatus(cell.dateStr, 'Absent');
                        }
                      }}
                      className={`bg-emerald-500 text-white rounded-lg sm:rounded-xl px-1.5 py-0.5 sm:py-1 shadow-xs text-center flex items-center justify-center gap-1 ${
                        isAdmin ? 'cursor-pointer hover:bg-emerald-600' : ''
                      }`}
                      title={isAdmin ? 'Click to toggle Absent' : 'Attended'}
                    >
                      <span className="text-[9px] sm:text-xs font-black tracking-tight leading-none">
                        Attended
                      </span>
                    </div>
                  ) : isAbsent ? (
                    <div 
                      onClick={() => {
                        if (isAdmin) {
                          handleMarkStatus(cell.dateStr, 'Present');
                        }
                      }}
                      className={`bg-amber-500 text-white rounded-lg px-1.5 py-0.5 text-center shadow-2xs ${
                        isAdmin ? 'cursor-pointer hover:bg-amber-600' : ''
                      }`}
                      title={isAdmin ? 'Click to mark Present' : 'Absent'}
                    >
                      <span className="text-[9px] sm:text-[10px] font-bold">Absent</span>
                    </div>
                  ) : cell.isEnrolledDay && cell.isCurrentMonth ? (
                    /* Enrolled Day not yet recorded */
                    isAdmin ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(cell.dateStr, 'Present')}
                          disabled={isMutating}
                          className="flex-1 py-1 px-1 bg-white hover:bg-emerald-50 text-[#0E3589] hover:text-emerald-700 border border-blue-200 hover:border-emerald-300 rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-2xs transition-all cursor-pointer"
                          title="Mark Attended"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Check</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[9px] text-blue-600 font-semibold text-center bg-blue-50/50 py-0.5 rounded border border-blue-100">
                        Scheduled
                      </div>
                    )
                  ) : isAdmin && cell.isCurrentMonth ? (
                    /* Non-enrolled day in Admin mode */
                    <button
                      type="button"
                      onClick={() => handleMarkStatus(cell.dateStr, 'Present', 'Special extra session')}
                      disabled={isMutating}
                      className="w-full py-0.5 px-1 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 cursor-pointer"
                      title="Mark Extra Class"
                    >
                      <Plus className="w-2 h-2" />
                      <span>Extra</span>
                    </button>
                  ) : null}

                  {/* Note snippet indicator */}
                  {hasNote && (
                    <div 
                      onClick={() => handleOpenNoteModal(cell.dateStr)}
                      className="bg-blue-50/90 border border-blue-200 hover:border-blue-300 rounded-md p-1 cursor-pointer transition-colors text-[9px] text-[#0E3589] font-medium leading-tight flex items-start gap-1 line-clamp-1"
                      title={`Coach Note: ${cell.record?.notes}`}
                    >
                      <FileText className="w-2.5 h-2.5 shrink-0 text-[#0E3589] mt-0.5" />
                      <span className="truncate">{cell.record?.notes}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Row: IN-CELL ACTIONS FOR ADMIN (Clear & Add/Edit Note) */}
                {isAdmin && cell.isCurrentMonth && (
                  <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between gap-1">
                    {/* Add / Edit Note Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNoteModal(cell.dateStr);
                      }}
                      disabled={isMutating}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-all cursor-pointer ${
                        hasNote
                          ? 'bg-blue-100 hover:bg-blue-200 text-[#0E3589]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                      title={hasNote ? 'Edit Note' : 'Add Note'}
                      id={`btn-note-${cell.dateStr}`}
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>{hasNote ? 'Edit' : '+ Note'}</span>
                    </button>

                    {/* Clear Button (Visible when attendance record exists) */}
                    {hasRecord && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRecord(cell.dateStr);
                        }}
                        disabled={isMutating}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 flex items-center gap-0.5 transition-all cursor-pointer"
                        title="Clear attendance record for this date"
                        id={`btn-clear-${cell.dateStr}`}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
            <button
              type="button"
              onClick={() => handleOpenNoteModal(todayStr)}
              className="px-3 py-1.5 bg-[#0E3589] hover:bg-[#08225e] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
              id="btn-add-today-note"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note for Today</span>
            </button>
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
                        <textarea
                          rows={2}
                          value={inlineEditText}
                          onChange={(e) => setInlineEditText(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
                          placeholder="Enter coach observations, lesson drills..."
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveInlineNote(rec.date)}
                            disabled={isMutating}
                            className="px-3 py-1 bg-[#0E3589] hover:bg-[#08225e] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteDate(null)}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          {/* Presets */}
                          <div className="flex flex-wrap gap-1">
                            {COMMON_DRILL_NOTES.slice(0, 3).map((drill) => (
                              <button
                                key={drill}
                                type="button"
                                onClick={() => setInlineEditText(drill)}
                                className="text-[10px] bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#0E3589] px-2 py-0.5 rounded border border-slate-200"
                              >
                                + {drill}
                              </button>
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
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteDate(rec.date);
                          setInlineEditText(rec.notes || '');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#0E3589] border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Edit note"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteNoteOnly(rec.date)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete note only"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
      {activeNoteModalDate && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          id="modal-attendance-note"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
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

              <button
                type="button"
                onClick={() => setActiveNoteModalDate(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Attendance Status Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">
                Attendance Status:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalStatus('Present')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    modalStatus === 'Present'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-emerald-50 text-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Attended (Present)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalStatus('Absent')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    modalStatus === 'Absent'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-amber-50 text-slate-700'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Absent</span>
                </button>
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
              <textarea
                rows={3}
                value={modalNoteText}
                onChange={(e) => setModalNoteText(e.target.value)}
                placeholder="e.g. Practiced cursive loop heights, 4-line baseline check..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#0E3589] outline-none"
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
                  <button
                    key={drill}
                    type="button"
                    onClick={() => setModalNoteText(drill)}
                    className="text-[10px] bg-slate-100 hover:bg-blue-100 hover:text-[#0E3589] text-slate-700 px-2 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    + {drill}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveNoteModalDate(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveModalNote}
                disabled={isMutating}
                className="px-5 py-2 bg-[#0E3589] hover:bg-[#08225e] text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                id="btn-save-modal-note"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

