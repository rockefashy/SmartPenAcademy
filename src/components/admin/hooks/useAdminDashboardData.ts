import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../../services/api';
import { StudentProfile, StudentStatus, DemoBooking, AdminAlert, CoachProfile } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

export function useAdminDashboardData() {
  const { user, isAdmin, isCoach } = useAuth();

  // Banners
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);
  const [errorMessageBanner, setErrorMessageBanner] = useState<string | null>(null);

  const showNotification = useCallback((message: string, durationMs = 4000) => {
    setNotificationBanner(message);
    setTimeout(() => {
      setNotificationBanner((prev) => (prev === message ? null : prev));
    }, durationMs);
  }, []);

  // 1. Students State
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | StudentStatus>('All');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [timingFilter, setTimingFilter] = useState<string>('All');
  const [rosterCoachFilter, setRosterCoachFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'createdDate' | 'modifiedDate' | 'age' | 'grade'>('createdDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 2. Coaches State
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [deletingCoachId, setDeletingCoachId] = useState<string | null>(null);
  const [coachSearchQuery, setCoachSearchQuery] = useState('');
  const [coachStatusFilter, setCoachStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [coachDesignationFilter, setCoachDesignationFilter] = useState<string>('All');

  // 3. Assignment State
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCoachFilter, setAssignmentCoachFilter] = useState<string>('All');
  const [assignmentGradeFilter, setAssignmentGradeFilter] = useState<string>('All');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [updatingStudentCoachId, setUpdatingStudentCoachId] = useState<string | null>(null);

  // 4. Alerts & Demo Bookings State
  const [demoBookings, setDemoBookings] = useState<DemoBooking[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState<string>('All');

  // Data Loading
  const loadCoaches = useCallback(async () => {
    setCoachesLoading(true);
    try {
      const data = await api.getCoaches();
      setCoaches(data);
    } catch (err: any) {
      console.error('Failed to load coaches:', err);
      setErrorMessageBanner(err.message || 'Failed to load coaches');
    } finally {
      setCoachesLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (err: any) {
      console.error('Failed to load students:', err);
      setErrorMessageBanner(err.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAlertsAndBookings = useCallback(async () => {
    if (!isAdmin) return;
    setAlertsLoading(true);
    try {
      const [bookingsData, alertsData] = await Promise.all([
        api.getDemoBookings(),
        api.getAlerts(),
      ]);
      setDemoBookings(bookingsData);
      setAlerts(alertsData);
    } catch (err: any) {
      console.error('Failed to load alerts/bookings:', err);
      setErrorMessageBanner(err.message || 'Failed to load alerts and bookings');
    } finally {
      setAlertsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadStudents();
    loadCoaches();
    if (isAdmin) {
      loadAlertsAndBookings();
    }
  }, [isAdmin, loadStudents, loadCoaches, loadAlertsAndBookings]);

  // Derived: Filtered & Sorted Students
  const filteredStudents = useMemo(() => {
    return students
      .filter((st) => {
        const matchesSearch =
          st.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          st.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          st.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          st.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          st.username.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'All' || st.status === statusFilter;
        const matchesGrade = gradeFilter === 'All' || st.gradeClass === gradeFilter;
        const matchesTiming = timingFilter === 'All' || st.preferredSlot === timingFilter;
        const matchesCoach =
          rosterCoachFilter === 'All'
            ? true
            : rosterCoachFilter === 'Unassigned'
            ? !st.coachId
            : st.coachId === rosterCoachFilter;

        return matchesSearch && matchesStatus && matchesGrade && matchesTiming && matchesCoach;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
          comparison = a.displayName.localeCompare(b.displayName);
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
  }, [students, searchQuery, statusFilter, gradeFilter, timingFilter, rosterCoachFilter, sortBy, sortOrder]);

  // Derived: Assignment Students (Active only)
  const assignmentStudents = useMemo(() => {
    return students.filter((st) => {
      // Only active students are eligible for coach assignment
      if (st.status !== 'Active') return false;

      const matchesSearch =
        !assignmentSearch.trim() ||
        st.firstName.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
        st.parentName.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
        st.whatsappMobile.includes(assignmentSearch) ||
        st.schoolName.toLowerCase().includes(assignmentSearch.toLowerCase());

      const matchesCoach =
        assignmentCoachFilter === 'All'
          ? true
          : assignmentCoachFilter === 'Unassigned'
          ? !st.coachId
          : st.coachId === assignmentCoachFilter;

      const matchesGrade = assignmentGradeFilter === 'All' || st.gradeClass === assignmentGradeFilter;
      const matchesStatus =
        assignmentStatusFilter === 'All'
          ? true
          : assignmentStatusFilter === 'Assigned'
          ? Boolean(st.coachId)
          : !st.coachId;

      return matchesSearch && matchesCoach && matchesGrade && matchesStatus;
    });
  }, [students, assignmentSearch, assignmentCoachFilter, assignmentGradeFilter, assignmentStatusFilter]);

  // Derived: Filtered Coaches
  const filteredCoaches = useMemo(() => {
    return coaches.filter((coach) => {
      const matchesSearch =
        !coachSearchQuery.trim() ||
        coach.firstName.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
        coach.lastName.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
        coach.displayName.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
        coach.email.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
        coach.phoneNumber.includes(coachSearchQuery);

      const matchesStatus = coachStatusFilter === 'All' || coach.status === coachStatusFilter;
      const matchesDesignation =
        coachDesignationFilter === 'All' || coach.designation === coachDesignationFilter;

      return matchesSearch && matchesStatus && matchesDesignation;
    });
  }, [coaches, coachSearchQuery, coachStatusFilter, coachDesignationFilter]);

  // Derived: Filtered Demo Bookings
  const filteredBookings = useMemo(() => {
    return demoBookings.filter((b) => {
      if (alertFilter === 'All') return true;
      return b.status === alertFilter;
    });
  }, [demoBookings, alertFilter]);

  // Counts and Metadata
  const unreadAlertsCount = useMemo(() => alerts.filter((a) => !a.isRead).length, [alerts]);
  const newBookingsCount = useMemo(() => demoBookings.filter((b) => b.status === 'New').length, [demoBookings]);
  const activeStudents = useMemo(() => students.filter((s) => s.status === 'Active'), [students]);
  const unassignedStudentsCount = useMemo(() => activeStudents.filter((s) => !s.coachId).length, [activeStudents]);
  const assignedStudentsCount = useMemo(() => activeStudents.filter((s) => Boolean(s.coachId)).length, [activeStudents]);

  const uniqueGrades = useMemo(
    () => Array.from(new Set(students.map((s) => s.gradeClass))).filter(Boolean),
    [students]
  );
  const uniqueTimings = useMemo(
    () => Array.from(new Set(students.map((s) => s.preferredSlot))).filter(Boolean),
    [students]
  );
  const uniqueCoachDesignations = useMemo(
    () => Array.from(new Set(coaches.map((c) => c.designation))).filter(Boolean),
    [coaches]
  );

  // Mutations
  const handleAssignCoach = async (studentId: string, coachId: string | null) => {
    setUpdatingStudentCoachId(studentId);
    try {
      const updated = await api.assignCoachToStudent(studentId, coachId);
      const studentName = students.find((s) => s.id === studentId)?.displayName || 'Student';
      const assignedCoachName = coaches.find((c) => c.id === coachId)?.displayName || updated.coachName;

      showNotification(
        coachId
          ? `Assigned ${studentName} to Coach ${assignedCoachName}!`
          : `Unassigned coach for ${studentName}`
      );
      loadStudents();
      loadCoaches();
    } catch (err: any) {
      console.error('[ADMIN_DASHBOARD] Failed to update coach assignment:', err);
      alert(err.message || 'Failed to update coach assignment');
    } finally {
      setUpdatingStudentCoachId(null);
    }
  };

  const handleToggleStudentStatus = async (student: StudentProfile) => {
    if (!isAdmin) return;
    const isCurrentlyActive = student.status === 'Active';
    if (isCurrentlyActive) {
      const today = new Date().toISOString().split('T')[0];
      if (
        !confirm(
          `Deactivate student "${student.firstName}"?\n\n• Status will be set to Inactive\n• Date of Leaving will be recorded as today (${today})\n• Student will not be able to login\n• Coaches will no longer manage this student\n• All historical records (attendance, fees, works) will be permanently preserved.`
        )
      ) {
        return;
      }
      try {
        await api.updateStudent(student.id, { status: 'Inactive', dateOfLeaving: today });
        showNotification(
          `Student ${student.firstName} has been deactivated (soft delete). Historical records preserved.`
        );
        loadStudents();
      } catch (err: any) {
        console.error('[ADMIN_DASHBOARD] Failed to deactivate student:', err);
        alert(err.message || 'Failed to deactivate student');
      }
    } else {
      if (
        !confirm(
          `Reactivate student "${student.firstName}"?\n\n• Status will be restored to Active\n• Date of Leaving will be cleared\n• Student login access will be restored.`
        )
      ) {
        return;
      }
      try {
        await api.updateStudent(student.id, { status: 'Active', dateOfLeaving: null as any });
        showNotification(`Student ${student.firstName} has been reactivated to Active status.`);
        loadStudents();
      } catch (err: any) {
        console.error('[ADMIN_DASHBOARD] Failed to reactivate student:', err);
        alert(err.message || 'Failed to reactivate student');
      }
    }
  };

  const handleToggleCoachStatus = async (coach: CoachProfile) => {
    const isCurrentlyActive = coach.status === 'Active';
    if (isCurrentlyActive) {
      const today = new Date().toISOString().split('T')[0];
      if (
        !confirm(
          `Deactivate coach "${coach.firstName}"?\n\n• Status will be set to Inactive\n• Date of Leaving will be recorded as today (${today})\n• Coach will not be able to login\n• Any assigned students will be unassigned\n• All historical attendance and records are permanently preserved.`
        )
      ) {
        return;
      }
      setDeletingCoachId(coach.id);
      try {
        await api.deleteCoach(coach.id);
        showNotification(
          `Coach ${coach.firstName} has been deactivated (soft delete). Historical records are preserved.`
        );
        loadCoaches();
        loadStudents();
      } catch (err: any) {
        console.error('[ADMIN_DASHBOARD] Failed to deactivate coach:', err);
        alert(err.message || 'Failed to deactivate coach');
      } finally {
        setDeletingCoachId(null);
      }
    } else {
      if (
        !confirm(
          `Reactivate coach "${coach.firstName}"?\n\n• Status will be set to Active\n• Date of Leaving will be cleared\n• Coach login access will be restored.`
        )
      ) {
        return;
      }
      setDeletingCoachId(coach.id);
      try {
        await api.updateCoach(coach.id, { status: 'Active', dateOfLeaving: null });
        showNotification(`Coach ${coach.firstName} has been reactivated to Active status.`);
        loadCoaches();
      } catch (err: any) {
        console.error('[ADMIN_DASHBOARD] Failed to reactivate coach:', err);
        alert(err.message || 'Failed to reactivate coach');
      } finally {
        setDeletingCoachId(null);
      }
    }
  };

  const handleUpdateBookingStatus = async (id: string, newStatus: DemoBooking['status']) => {
    try {
      await api.updateDemoBooking(id, { status: newStatus });
      showNotification(`Booking status updated to "${newStatus}"!`, 3000);
      loadAlertsAndBookings();
    } catch (err: any) {
      console.error('[ADMIN_DASHBOARD] Failed to update booking status:', err);
      alert(err.message || 'Failed to update booking status');
    }
  };

  const handleSaveBookingNotes = async (bookingId: string, notes: string) => {
    try {
      await api.updateDemoBooking(bookingId, { notes });
      showNotification(`Assessment notes updated successfully!`, 3000);
      loadAlertsAndBookings();
    } catch (err: any) {
      console.error('[ADMIN_DASHBOARD] Failed to save booking notes:', err);
      alert(err.message || 'Failed to save booking notes');
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
      showNotification('All alerts marked as read', 3000);
      loadAlertsAndBookings();
    } catch (err: any) {
      console.error('Failed to mark all alerts read:', err);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    try {
      await api.deleteDemoBooking(id);
      showNotification('Demo booking inquiry deleted successfully');
      loadAlertsAndBookings();
    } catch (err: any) {
      console.error('[ADMIN_DASHBOARD] Failed to delete booking inquiry:', err);
      alert(err.message || 'Failed to delete booking inquiry');
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

  return {
    user,
    isAdmin,
    isCoach,

    // Banners
    notificationBanner,
    setNotificationBanner,
    errorMessageBanner,
    setErrorMessageBanner,
    showNotification,

    // Students
    students,
    isLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    gradeFilter,
    setGradeFilter,
    timingFilter,
    setTimingFilter,
    rosterCoachFilter,
    setRosterCoachFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filteredStudents,
    uniqueGrades,
    uniqueTimings,
    loadStudents,
    handleToggleStudentStatus,

    // Coaches
    coaches,
    coachesLoading,
    coachSearchQuery,
    setCoachSearchQuery,
    coachStatusFilter,
    setCoachStatusFilter,
    coachDesignationFilter,
    setCoachDesignationFilter,
    filteredCoaches,
    uniqueCoachDesignations,
    deletingCoachId,
    loadCoaches,
    handleToggleCoachStatus,

    // Assignment
    assignmentSearch,
    setAssignmentSearch,
    assignmentCoachFilter,
    setAssignmentCoachFilter,
    assignmentGradeFilter,
    setAssignmentGradeFilter,
    assignmentStatusFilter,
    setAssignmentStatusFilter,
    assignmentStudents,
    activeStudents,
    unassignedStudentsCount,
    assignedStudentsCount,
    updatingStudentCoachId,
    handleAssignCoach,

    // Alerts & Bookings
    demoBookings,
    alerts,
    alertsLoading,
    alertFilter,
    setAlertFilter,
    filteredBookings,
    unreadAlertsCount,
    newBookingsCount,
    loadAlertsAndBookings,
    handleUpdateBookingStatus,
    handleSaveBookingNotes,
    handleDeleteBooking,
    handleDeleteAlert,
    handleMarkAlertRead,
    handleMarkAllAlertsRead,

    // Export
    handleExportCSV,
  };
}
