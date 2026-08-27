import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  ArrowUpDown, 
  UserPlus, 
  Download, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award,
  Phone,
  Mail,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Edit2,
  Bell,
  BellRing,
  MessageCircle,
  CheckCheck,
  Trash2,
  CalendarCheck,
  AlertCircle,
  ExternalLink,
  Plus,
  GraduationCap
} from 'lucide-react';
import { api } from '../services/api';
import { StudentProfile, StudentStatus, DemoBooking, AdminAlert } from '../types';
import { adminProperties } from '../properties/admin.properties';
import { commonProperties } from '../properties/common.properties';

interface AdminDashboardPageProps {
  onNavigate: (view: string, studentId?: string, defaultSection?: number) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'alerts'>('roster');
  
  // Student Roster State
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | StudentStatus>('All');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [timingFilter, setTimingFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'createdDate' | 'modifiedDate' | 'age' | 'grade'>('createdDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Alerts & Demo Bookings State
  const [demoBookings, setDemoBookings] = useState<DemoBooking[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'All' | 'New' | 'Contacted' | 'Scheduled' | 'Enrolled'>('All');
  const [selectedBookingForNotes, setSelectedBookingForNotes] = useState<DemoBooking | null>(null);
  const [bookingNotesText, setBookingNotesText] = useState('');

  // Quick Action Modal State (for Attendance & Fee marking)
  const [quickAttendanceStudent, setQuickAttendanceStudent] = useState<StudentProfile | null>(null);
  const [quickAttendanceDate, setQuickAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickAttendanceStatus, setQuickAttendanceStatus] = useState<'Present' | 'Absent' | 'Late'>('Present');
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);

  const [quickFeeStudent, setQuickFeeStudent] = useState<StudentProfile | null>(null);
  const [quickFeeAmount, setQuickFeeAmount] = useState<number>(1600);
  const [quickFeePeriod, setQuickFeePeriod] = useState(
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  );
  const [quickFeeReceiptNo, setQuickFeeReceiptNo] = useState('');
  const [quickFeeNotes, setQuickFeeNotes] = useState('');
  const [isSubmittingFee, setIsSubmittingFee] = useState(false);

  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
    loadAlertsAndBookings();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (err: any) {
      console.error('Failed to load students:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAlertsAndBookings = async () => {
    setAlertsLoading(true);
    try {
      const [bookingsData, alertsData] = await Promise.all([
        api.getDemoBookings().catch(() => []),
        api.getAlerts().catch(() => [])
      ]);
      setDemoBookings(bookingsData);
      setAlerts(alertsData);
    } catch (err: any) {
      console.error('Failed to load alerts/bookings:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleUpdateBookingStatus = async (id: string, newStatus: DemoBooking['status']) => {
    try {
      await api.updateDemoBooking(id, { status: newStatus });
      setNotificationBanner(`Booking status updated to "${newStatus}"!`);
      loadAlertsAndBookings();
      setTimeout(() => setNotificationBanner(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update booking status');
    }
  };

  const handleSaveBookingNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForNotes) return;

    try {
      await api.updateDemoBooking(selectedBookingForNotes.id, { notes: bookingNotesText });
      setNotificationBanner(`Notes saved for ${selectedBookingForNotes.studentName}`);
      setSelectedBookingForNotes(null);
      loadAlertsAndBookings();
      setTimeout(() => setNotificationBanner(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save notes');
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this booking inquiry?')) return;
    try {
      await api.deleteDemoBooking(id);
      setNotificationBanner('Demo booking inquiry deleted');
      loadAlertsAndBookings();
      setTimeout(() => setNotificationBanner(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete booking');
    }
  };

  const handleMarkAlertRead = async (id: string) => {
    try {
      await api.markAlertRead(id);
      loadAlertsAndBookings();
    } catch (err: any) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      await api.markAllAlertsRead();
      setNotificationBanner('All alerts marked as read');
      loadAlertsAndBookings();
      setTimeout(() => setNotificationBanner(null), 3000);
    } catch (err: any) {
      alert('Failed to mark all alerts as read');
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await api.deleteAlert(id);
      loadAlertsAndBookings();
    } catch (err: any) {
      console.error('Failed to delete alert:', err);
    }
  };

  const handleQuickAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAttendanceStudent) return;
    setIsSubmittingAttendance(true);

    try {
      await api.addAttendance(quickAttendanceStudent.id, {
        date: quickAttendanceDate,
        status: quickAttendanceStatus,
        notes: `Marked from Admin Dashboard Quick Action`,
      });
      setNotificationBanner(
        adminProperties.messages.attendanceMarkedSuccess.replace('{name}', quickAttendanceStudent.fullName)
      );
      setQuickAttendanceStudent(null);
      loadStudents();
      setTimeout(() => setNotificationBanner(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to record attendance');
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleOpenQuickFee = (student: StudentProfile, defaultCycle?: string) => {
    const currentMonthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const cycleLabel = defaultCycle || currentMonthYear;
    const monthCode = new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const yearCode = new Date().getFullYear().toString().slice(-2);
    setQuickFeeStudent(student);
    setQuickFeeAmount(1600);
    setQuickFeePeriod(cycleLabel);
    setQuickFeeReceiptNo(`REC-${student.id.replace('std-', '')}-${monthCode}${yearCode}`);
    setQuickFeeNotes('');
  };

  const handleQuickFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFeeStudent) return;
    setIsSubmittingFee(true);

    try {
      await api.saveFee({
        studentId: quickFeeStudent.id,
        yearMonth: quickFeePeriod,
        amount: Number(quickFeeAmount) || 1600,
        isPaid: true,
        paidDate: new Date().toISOString().split('T')[0],
        receiptNumber: quickFeeReceiptNo || `REC-${quickFeeStudent.id.replace('std-', '')}-${Date.now().toString().slice(-4)}`,
        paymentMethod: 'In-Person Reception Card/UPI',
        notes: quickFeeNotes.trim() || undefined,
      });
      setNotificationBanner(
        adminProperties.messages.feeMarkedSuccess.replace('{name}', quickFeeStudent.fullName)
      );
      setQuickFeeStudent(null);
      loadStudents();
      loadAlertsAndBookings();
      setTimeout(() => setNotificationBanner(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to record fee payment');
    } finally {
      setIsSubmittingFee(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = api.exportStudentsCSV(filteredStudents);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SmartPen_Students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unread alerts count
  const unreadAlertsCount = alerts.filter(a => !a.isRead).length;
  const newBookingsCount = demoBookings.filter(b => b.status === 'New').length;

  // Filter & Sort Logic for Students
  const filteredStudents = students
    .filter((st) => {
      const matchesSearch =
        st.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.username.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'All' || st.status === statusFilter;
      const matchesGrade = gradeFilter === 'All' || st.gradeClass === gradeFilter;
      const matchesTiming = timingFilter === 'All' || st.preferredSlot === timingFilter;

      return matchesSearch && matchesStatus && matchesGrade && matchesTiming;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.fullName.localeCompare(b.fullName);
      } else if (sortBy === 'createdDate') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'modifiedDate') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortBy === 'age') {
        comparison = new Date(b.dateOfBirth).getTime() - new Date(a.dateOfBirth).getTime();
      } else if (sortBy === 'grade') {
        comparison = a.gradeClass.localeCompare(b.gradeClass);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Filtered Bookings
  const filteredBookings = demoBookings.filter(b => {
    if (alertFilter === 'All') return true;
    return b.status === alertFilter;
  });

  const uniqueGrades = Array.from(new Set(students.map((s) => s.gradeClass))).filter(Boolean);
  const uniqueTimings = Array.from(new Set(students.map((s) => s.preferredSlot))).filter(Boolean);

  const activeCount = students.filter((s) => s.status === 'Active').length;
  const inactiveCount = students.filter((s) => s.status === 'Inactive').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans space-y-6">
      {/* Heading: Admin Command Center */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Admin Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-sans mt-0.5">
            {adminProperties.header.subtitle}
          </p>
        </div>

        <button
          onClick={() => onNavigate('enroll')}
          className="px-5 py-2.5 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white font-extrabold text-xs rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
          id="btn-admin-enroll"
        >
          <UserPlus className="w-4 h-4" />
          <span>{adminProperties.header.newStudentEnrollBtn}</span>
        </button>
      </div>

      {/* Notification Toast Banner */}
      {notificationBanner && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{notificationBanner}</span>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Module Navigation Tabs (Roster vs Alerts & Demo Bookings) + Export Roster */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-5 py-3 rounded-2xl text-sm font-black flex items-center gap-2.5 transition-all cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-[#0E3589] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            id="tab-btn-student-roster"
          >
            <Users className="w-4 h-4" />
            <span>Student Roster &amp; Profiles</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'roster' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#0E3589]'
            }`}>
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('alerts');
              loadAlertsAndBookings();
            }}
            className={`px-5 py-3 rounded-2xl text-sm font-black flex items-center gap-2.5 transition-all cursor-pointer relative ${
              activeTab === 'alerts'
                ? 'bg-[#F46E20] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            id="tab-btn-admin-alerts"
          >
            <BellRing className="w-4 h-4" />
            <span>Alerts &amp; Free Demo Bookings</span>
            {(unreadAlertsCount > 0 || newBookingsCount > 0) && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold animate-pulse ${
                activeTab === 'alerts' ? 'bg-white text-[#F46E20]' : 'bg-red-500 text-white'
              }`}>
                {newBookingsCount > 0 ? `${newBookingsCount} New` : unreadAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-2xl border border-slate-300 shadow-xs flex items-center gap-2 cursor-pointer transition-all"
            id="btn-export-excel"
            title="Export Roster (CSV)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{adminProperties.header.exportExcelBtn}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STUDENT ROSTER VIEW                                                */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search Input */}
              <div className="md:col-span-5 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={adminProperties.filters.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                />
              </div>

              {/* Status Filter */}
              <div className="md:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                >
                  <option value="All">All Statuses ({students.length})</option>
                  <option value="Active">Active ({activeCount})</option>
                  <option value="Inactive">Inactive ({inactiveCount})</option>
                </select>
              </div>

              {/* Grade Filter */}
              <div className="md:col-span-2">
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                >
                  <option value="All">All Grades</option>
                  {uniqueGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Timing Filter */}
              <div className="md:col-span-3">
                <select
                  value={timingFilter}
                  onChange={(e) => setTimingFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                >
                  <option value="All">All Time Slots</option>
                  {uniqueTimings.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sort Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-500">
                <ArrowUpDown className="w-4 h-4 text-[#0E3589]" />
                <span className="font-bold text-slate-700">{adminProperties.filters.sortByLabel}:</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'createdDate') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('createdDate'); setSortOrder('desc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      sortBy === 'createdDate' ? 'bg-blue-100 text-[#0E3589]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {adminProperties.filters.sortCreatedDate} {sortBy === 'createdDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('name'); setSortOrder('asc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      sortBy === 'name' ? 'bg-blue-100 text-[#0E3589]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {adminProperties.filters.sortName} {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'modifiedDate') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('modifiedDate'); setSortOrder('desc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      sortBy === 'modifiedDate' ? 'bg-blue-100 text-[#0E3589]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {adminProperties.filters.sortModifiedDate} {sortBy === 'modifiedDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'grade') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('grade'); setSortOrder('asc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      sortBy === 'grade' ? 'bg-blue-100 text-[#0E3589]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {adminProperties.filters.sortCurrentClass} {sortBy === 'grade' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </div>
              </div>

              <p className="text-slate-400 font-medium">
                Showing <strong className="text-slate-800">{filteredStudents.length}</strong> of {students.length} students
              </p>
            </div>
          </div>

          {/* Student List Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#0E3589]" />
                <p className="text-xs font-bold">{adminProperties.table.loadingText}</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-base font-bold text-slate-700">{adminProperties.table.noStudents}</p>
                <p className="text-xs text-slate-400">Try adjusting your search query or status filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">{adminProperties.table.colStudent}</th>
                      <th className="py-3.5 px-4">{adminProperties.table.colContactParent}</th>
                      <th className="py-3.5 px-4">{adminProperties.table.colBatchTiming}</th>
                      <th className="py-3.5 px-4">{adminProperties.table.colClassesAttended}</th>
                      <th className="py-3.5 px-4">{adminProperties.table.colStatus}</th>
                      <th className="py-3.5 px-4 text-center">{adminProperties.table.colActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const attendedCount = student.attendanceHistory?.filter((a) => a.status === 'Present').length || 0;
                      const completedCycles = Math.floor(attendedCount / 8);
                      const currentCycleIndex = completedCycles + 1;
                      const cycleProgress = attendedCount % 8;
                      const paidCyclesCount = student.feeHistory?.filter((f) => f.status === 'Paid').length || 0;
                      const hasPendingFeeAlert = completedCycles > 0 && paidCyclesCount < completedCycles;

                      return (
                        <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                          {/* Student Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0E3589] to-[#0084F4] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                                {student.fullName.charAt(0)}
                              </div>
                              <div>
                                <button
                                  onClick={() => onNavigate('studentDetail', student.id, 1)}
                                  className="font-extrabold text-sm text-[#0E3589] hover:underline text-left cursor-pointer"
                                >
                                  {student.fullName}
                                </button>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {student.gradeClass} • {student.dominantHand} Handed • {student.schoolName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Parent & Contact */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-800">{student.parentName} ({student.relationship})</p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#F46E20]" />
                                <a href={`tel:${student.whatsappMobile}`} className="hover:underline">{student.whatsappMobile}</a>
                              </p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                {student.email}
                              </p>
                            </div>
                          </td>

                          {/* Preferred Timing */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-800">{student.preferredDays}</p>
                              <p className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {student.preferredSlot}
                              </p>
                            </div>
                          </td>

                          {/* Classes Attended & 8-Class Cycle */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-extrabold text-[#0E3589] text-xs">
                                  {attendedCount} Classes
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">
                                  Cycle {currentCycleIndex} ({cycleProgress}/8)
                                </span>
                              </div>
                              <div className="w-28 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${hasPendingFeeAlert ? 'bg-amber-500' : 'bg-[#F46E20]'}`}
                                  style={{ width: `${(cycleProgress / 8) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                student.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {student.status === 'Active' ? (
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <XCircle className="w-3 h-3 text-slate-400" />
                              )}
                              {student.status}
                            </span>
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Mark Attendance */}
                              <button
                                onClick={() => setQuickAttendanceStudent(student)}
                                title={adminProperties.actions.markAttendance}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#0E3589] rounded-lg transition-colors cursor-pointer"
                              >
                                <Calendar className="w-4 h-4" />
                              </button>

                              {/* 2. Mark Fee Paid (8-Class Cycle) */}
                              <button
                                onClick={() => handleOpenQuickFee(student)}
                                title={hasPendingFeeAlert ? '8 Classes Completed • Fee Receipt Due (₹1,600)' : adminProperties.actions.markFeePaid}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
                                  hasPendingFeeAlert
                                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                    : paidCyclesCount > 0
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                              >
                                <DollarSign className="w-4 h-4" />
                                {hasPendingFeeAlert && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                                )}
                              </button>

                              {/* 3. View Student Details */}
                              <button
                                onClick={() => onNavigate('studentDetail', student.id, 1)}
                                title={adminProperties.actions.viewStudentDetails}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* 4. Preview Parent Portal */}
                              <button
                                onClick={() => onNavigate('parentPortal', student.id)}
                                title={`Preview Parent Portal for ${student.fullName}`}
                                className="p-1.5 bg-orange-50 hover:bg-orange-100 text-[#F46E20] border border-orange-200/80 rounded-lg transition-colors cursor-pointer"
                              >
                                <GraduationCap className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALERTS & FREE DEMO CLASS BOOKINGS MODULE                            */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Alerts Header & Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border-2 border-orange-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#F46E20] flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-[#F46E20]">{demoBookings.length}</p>
                <p className="text-[11px] font-bold text-slate-500">{adminProperties.alertsModule.stats.totalBookings}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-red-600">{newBookingsCount}</p>
                <p className="text-[11px] font-bold text-slate-500">{adminProperties.alertsModule.stats.newBookings}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0E3589] flex items-center justify-center font-bold">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-[#0E3589]">
                  {demoBookings.filter(b => b.status === 'Scheduled').length}
                </p>
                <p className="text-[11px] font-bold text-slate-500">{adminProperties.alertsModule.stats.scheduled}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-emerald-700">
                  {demoBookings.filter(b => b.status === 'Enrolled').length}
                </p>
                <p className="text-[11px] font-bold text-slate-500">{adminProperties.alertsModule.stats.enrolled}</p>
              </div>
            </div>
          </div>

          {/* Quick Filter & Actions Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">Filter Inquiries:</span>
              {(['All', 'New', 'Contacted', 'Scheduled', 'Enrolled'] as const).map((filterOpt) => (
                <button
                  key={filterOpt}
                  onClick={() => setAlertFilter(filterOpt)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    alertFilter === filterOpt
                      ? 'bg-[#0E3589] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filterOpt}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={loadAlertsAndBookings}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Refresh latest inquiries"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${alertsLoading ? 'animate-spin' : ''}`} />
                <span>{adminProperties.alertsModule.refreshBtn}</span>
              </button>

              {unreadAlertsCount > 0 && (
                <button
                  onClick={handleMarkAllAlertsRead}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0E3589] font-bold text-xs rounded-xl border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{adminProperties.alertsModule.markAllReadBtn}</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Notification Feed Section */}
          {alerts.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50/60 to-orange-50/60 rounded-3xl p-5 border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#0E3589] uppercase tracking-wider flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#F46E20]" />
                  <span>Real-time System Alert Stream ({alerts.length})</span>
                </h3>
                <span className="text-[11px] text-slate-500">{unreadAlertsCount} unread</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {alerts.map((al) => {
                  const isFeeDue = al.type === 'fee_due';
                  const targetStudent = students.find((s) => s.id === al.studentId || s.fullName === al.metadata?.studentName);

                  return (
                    <div
                      key={al.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                        isFeeDue && !al.isRead
                          ? 'bg-amber-50/95 border-amber-300 shadow-xs text-amber-950'
                          : al.isRead
                          ? 'bg-white/80 border-slate-200/70 text-slate-600'
                          : 'bg-white border-orange-300 shadow-xs text-slate-900 font-semibold'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!al.isRead && (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isFeeDue ? 'bg-amber-600' : 'bg-[#F46E20]'}`} />
                          )}
                          {isFeeDue && (
                            <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 font-extrabold text-[9px] rounded-md uppercase tracking-wider">
                              8 Classes Fee Due (₹1,600)
                            </span>
                          )}
                          <p className="text-xs font-bold text-slate-900">{al.title}</p>
                        </div>
                        <p className="text-[11px] text-slate-700 font-sans leading-relaxed">{al.message}</p>

                        {isFeeDue && targetStudent && (
                          <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenQuickFee(targetStudent, al.metadata?.cycleLabel)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
                            >
                              Record ₹1,600 Receipt
                            </button>
                            {targetStudent.whatsappMobile && (
                              <a
                                href={`https://wa.me/${targetStudent.whatsappMobile.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                  `Hello! This is Mrs. Deepthy Rock from SmartPen Handwriting Academy. ${targetStudent.fullName} has completed 8 classes (${al.metadata?.cycleLabel || '8 classes'}). The coaching fee of ₹1,600 is now due. Please record the payment at your earliest convenience. Thank you!`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                              >
                                WhatsApp Reminder
                              </a>
                            )}
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400">
                          {new Date(al.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!al.isRead && (
                          <button
                            onClick={() => handleMarkAlertRead(al.id)}
                            className="p-1 hover:bg-blue-50 text-[#0E3589] rounded-lg text-[10px] font-bold cursor-pointer"
                            title="Mark read"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAlert(al.id)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                          title="Delete alert"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Demo Class Bookings Table & Action Roster */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F46E20]" />
                  <span>Free Demo Class Bookings (All Days 4–7 PM)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Direct parent inquiries for Mrs. Deepthy Rock's handwriting demo evaluation.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-700">
                {filteredBookings.length} Inquiries Shown
              </span>
            </div>

            {alertsLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#0E3589]" />
                <p className="text-xs font-bold">Loading demo class bookings...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Clock className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-base font-bold text-slate-700">
                  {adminProperties.alertsModule.emptyAlerts}
                </p>
                <p className="text-xs text-slate-400">
                  When parents click "Book for a Free Demo Class" on the website, bookings appear instantly here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">{adminProperties.alertsModule.columns.studentName}</th>
                      <th className="py-3.5 px-4">{adminProperties.alertsModule.columns.contact}</th>
                      <th className="py-3.5 px-4">{adminProperties.alertsModule.columns.slot}</th>
                      <th className="py-3.5 px-4">{adminProperties.alertsModule.columns.status}</th>
                      <th className="py-3.5 px-4">{adminProperties.alertsModule.columns.receivedAt}</th>
                      <th className="py-3.5 px-4 text-center">{adminProperties.alertsModule.columns.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBookings.map((booking) => {
                      const cleanPhone = booking.contactNumber.replace(/\D/g, '');
                      const whatsappText = encodeURIComponent(
                        adminProperties.alertsModule.whatsappFollowupText
                          .replace('{name}', booking.studentName)
                          .replace('{slot}', booking.preferredSlot)
                      );
                      const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${whatsappText}`;

                      return (
                        <tr key={booking.id} className="hover:bg-orange-50/30 transition-colors">
                          {/* Student & Age */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-[#0E3589] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                                {booking.studentName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-extrabold text-sm text-slate-900">
                                  {booking.studentName}
                                </p>
                                <span className="inline-block px-2 py-0.5 bg-blue-50 text-[#0E3589] text-[10px] font-bold rounded-md mt-0.5">
                                  Age: {booking.age} yrs
                                </span>
                                {booking.notes && (
                                  <p className="text-[11px] text-slate-500 italic mt-1 max-w-xs truncate">
                                    "{booking.notes}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Contact Mobile & Direct WhatsApp */}
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-[#F46E20]" />
                                <a href={`tel:${booking.contactNumber}`} className="hover:underline">
                                  {booking.contactNumber}
                                </a>
                              </p>

                              {/* 1-Click WhatsApp Follow-up Button */}
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-extrabold rounded-lg shadow-xs transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp Parent</span>
                              </a>
                            </div>
                          </td>

                          {/* Preferred Slot */}
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg font-bold text-xs">
                                <Clock className="w-3.5 h-3.5 text-[#F46E20]" />
                                <span>{booking.preferredSlot}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-sans">
                                Timings: 4:00 PM – 7:00 PM
                              </p>
                            </div>
                          </td>

                          {/* Booking Status Dropdown */}
                          <td className="py-4 px-4">
                            <select
                              value={booking.status}
                              onChange={(e) => handleUpdateBookingStatus(booking.id, e.target.value as any)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                booking.status === 'New'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : booking.status === 'Contacted'
                                  ? 'bg-blue-50 text-[#0E3589] border-blue-200'
                                  : booking.status === 'Scheduled'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : booking.status === 'Enrolled'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              <option value="New">● New Inquiry</option>
                              <option value="Contacted">● Parent Contacted</option>
                              <option value="Scheduled">● Demo Scheduled</option>
                              <option value="Enrolled">● Converted &amp; Enrolled</option>
                              <option value="Cancelled">● Cancelled</option>
                            </select>
                          </td>

                          {/* Received At */}
                          <td className="py-4 px-4">
                            <div className="text-slate-600 text-[11px]">
                              <p className="font-semibold">{new Date(booking.createdAt).toLocaleDateString()}</p>
                              <p className="text-[10px] text-slate-400">{new Date(booking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Add / Edit Note */}
                              <button
                                onClick={() => {
                                  setSelectedBookingForNotes(booking);
                                  setBookingNotesText(booking.notes || '');
                                }}
                                title="Add Assessment Note"
                                className="p-2 bg-blue-50 hover:bg-blue-100 text-[#0E3589] rounded-xl transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Fast-Track Enroll */}
                              <button
                                onClick={() => {
                                  onNavigate('enroll');
                                }}
                                title="Fast-Track Enroll this Student"
                                className="p-2 bg-orange-50 hover:bg-orange-100 text-[#F46E20] rounded-xl transition-colors cursor-pointer"
                              >
                                <UserPlus className="w-4 h-4" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteBooking(booking.id)}
                                title="Delete Inquiry"
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Notes Editor Modal */}
      {selectedBookingForNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#0E3589]">
                <Edit2 className="w-5 h-5 text-[#F46E20]" />
                <h3 className="font-bold text-sm">Demo Notes &amp; Follow-up</h3>
              </div>
              <button
                onClick={() => setSelectedBookingForNotes(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Inquiry for <strong className="text-slate-900">{selectedBookingForNotes.studentName}</strong> (Age {selectedBookingForNotes.age}, Slot: {selectedBookingForNotes.preferredSlot})
            </p>

            <form onSubmit={handleSaveBookingNotes} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Coach Notes / Parent Discussion Summary
                </label>
                <textarea
                  rows={4}
                  value={bookingNotesText}
                  onChange={(e) => setBookingNotesText(e.target.value)}
                  placeholder="e.g. Parent confirmed demo on Thursday 5 PM. Focus needed on tripod grip and capital cursive loops..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBookingForNotes(null)}
                  className="w-1/3 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2 bg-[#0E3589] hover:bg-[#072464] text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                >
                  Save Notes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Attendance Modal */}
      {quickAttendanceStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#0E3589]">
                <Calendar className="w-5 h-5 text-[#F46E20]" />
                <h3 className="font-bold text-sm">Mark Attendance</h3>
              </div>
              <button
                onClick={() => setQuickAttendanceStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Recording session for <strong className="text-slate-900">{quickAttendanceStudent.fullName}</strong>
            </p>

            <form onSubmit={handleQuickAttendanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={quickAttendanceDate}
                  onChange={(e) => setQuickAttendanceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Present', 'Absent', 'Late'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setQuickAttendanceStatus(st)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        quickAttendanceStatus === st
                          ? 'bg-[#0E3589] text-white border-[#0E3589]'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAttendanceStudent(null)}
                  className="w-1/3 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAttendance}
                  className="w-2/3 py-2 bg-[#0E3589] hover:bg-[#072464] text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                >
                  {isSubmittingAttendance ? 'Saving...' : 'Confirm Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Fee Modal */}
      {quickFeeStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-800">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm">Issue 8-Class Fee Receipt (₹1,600)</h3>
              </div>
              <button
                onClick={() => setQuickFeeStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Recording payment receipt for <strong className="text-slate-900">{quickFeeStudent.fullName}</strong>
            </p>

            <form onSubmit={handleQuickFeeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fee Milestone / Month</label>
                <input
                  type="text"
                  required
                  value={quickFeePeriod}
                  onChange={(e) => setQuickFeePeriod(e.target.value)}
                  placeholder="e.g. August 2026 or September Milestone"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Number</label>
                <input
                  type="text"
                  value={quickFeeReceiptNo}
                  onChange={(e) => setQuickFeeReceiptNo(e.target.value)}
                  placeholder="e.g. REC-101-C1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹ INR)</label>
                <input
                  type="number"
                  required
                  value={quickFeeAmount}
                  onChange={(e) => setQuickFeeAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-800"
                  id="input-quick-fee-amount"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={quickFeeNotes}
                  onChange={(e) => setQuickFeeNotes(e.target.value)}
                  placeholder="e.g. In-Person Cash / UPI Reference / Bank Transfer details"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#0E3589]"
                  id="input-quick-fee-notes"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickFeeStudent(null)}
                  className="w-1/3 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFee}
                  className="w-2/3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                >
                  {isSubmittingFee ? 'Saving...' : 'Issue & Mark Paid (₹1,600)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
