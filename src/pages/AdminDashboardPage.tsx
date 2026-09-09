import { Modal, Button, Input, Select, Textarea, FormField, StatCard } from '../components/ui';
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
  Edit3,
  Bell,
  BellRing,
  MessageCircle,
  CheckCheck,
  Trash2,
  CalendarCheck,
  AlertCircle,
  ExternalLink,
  Plus,
  GraduationCap,
  Check,
  UserCheck,
  Briefcase,
  Key,
  Lock,
  Layers,
  ArrowRight,
  ArrowLeft,
  BadgeAlert,
  MapPin,
  UserX,
  X,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { EnrollmentPage } from './EnrollmentPage';
import { StudentProfile, StudentStatus, DemoBooking, AdminAlert, CoachProfile } from '../types';
import { adminProperties } from '../properties/admin.properties';
import { commonProperties } from '../properties/common.properties';
import { useAuth } from '../context/AuthContext';
import { formatGradeClass, formatDominantHand } from '../utils/formatters';

interface AdminDashboardPageProps {
  onNavigate: (view: string, studentId?: string, defaultSection?: any, prefillData?: any) => void;
  initialTab?: 'roster' | 'assignment' | 'coaches' | 'coachEnrollment' | 'studentEnrollment' | 'alerts';
  initialPrefillData?: any;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate, initialTab, initialPrefillData }) => {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';
  const [activeTab, setActiveTab] = useState<'roster' | 'assignment' | 'coaches' | 'coachEnrollment' | 'studentEnrollment' | 'alerts'>(initialTab || 'roster');
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [enrollmentPrefillData, setEnrollmentPrefillData] = useState<any | null>(initialPrefillData || null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (initialTab === 'studentEnrollment' && initialPrefillData) {
        setEnrollmentPrefillData(initialPrefillData);
        setEditingStudent(null);
      }
    }
  }, [initialTab, initialPrefillData]);
  const [enrolledCoachSuccessModal, setEnrolledCoachSuccessModal] = useState<{
    name: string;
    designation: string;
    email: string;
    phoneNumber: string;
  } | null>(null);
  
  // Student Roster State
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | StudentStatus>('All');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [timingFilter, setTimingFilter] = useState<string>('All');
  const [rosterCoachFilter, setRosterCoachFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'createdDate' | 'modifiedDate' | 'age' | 'grade'>('createdDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Coach Management State
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [coachForm, setCoachForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phoneNumber: '',
    address: '',
    designation: 'Executive Tutor',
    educationalQualification: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    status: 'Active' as 'Active' | 'Inactive',
    dateOfLeaving: '',
    specializations: [] as string[],
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
    password: ''
  });
  const [isCoachDisplayNameTouched, setIsCoachDisplayNameTouched] = useState(false);
  const [isSubmittingCoach, setIsSubmittingCoach] = useState(false);

  // Coach Edit & Filter State
  const [editingCoach, setEditingCoach] = useState<CoachProfile | null>(null);
  const [editCoachForm, setEditCoachForm] = useState<{
    firstName: string;
    lastName: string;
    displayName: string;
    email: string;
    phoneNumber: string;
    address: string;
    designation: string;
    educationalQualification: string;
    dateOfJoining: string;
    status: 'Active' | 'Inactive';
    dateOfLeaving: string;
    specializations: string[];
    emergencyContactName: string;
    emergencyContactPhone: string;
    notes: string;
    password: string;
  } | null>(null);
  const [isUpdatingCoach, setIsUpdatingCoach] = useState(false);
  const [deletingCoachId, setDeletingCoachId] = useState<string | null>(null);
  const [coachSearchQuery, setCoachSearchQuery] = useState('');
  const [coachStatusFilter, setCoachStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [coachDesignationFilter, setCoachDesignationFilter] = useState<string>('All');

  // Coach Assignment Screen State
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCoachFilter, setAssignmentCoachFilter] = useState<string>('All');
  const [assignmentGradeFilter, setAssignmentGradeFilter] = useState<string>('All');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [updatingStudentCoachId, setUpdatingStudentCoachId] = useState<string | null>(null);
  const [quickCoachAssignStudent, setQuickCoachAssignStudent] = useState<StudentProfile | null>(null);

  // Alerts & Demo Bookings State
  const [demoBookings, setDemoBookings] = useState<DemoBooking[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'All' | 'New' | 'Contacted' | 'Scheduled' | 'Enrolled'>('All');
  const [selectedBookingForNotes, setSelectedBookingForNotes] = useState<DemoBooking | null>(null);
  const [bookingNotesText, setBookingNotesText] = useState('');
  const [bookingToDelete, setBookingToDelete] = useState<DemoBooking | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);

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
  const [errorMessageBanner, setErrorMessageBanner] = useState<string | null>(null);
  const [coachFormError, setCoachFormError] = useState<string | null>(null);
  const [editCoachError, setEditCoachError] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
    loadAlertsAndBookings();
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
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
  };

  const loadStudents = async () => {
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
  };

  const loadAlertsAndBookings = async () => {
    setAlertsLoading(true);
    try {
      const [bookingsData, alertsData] = await Promise.all([
        api.getDemoBookings(),
        api.getAlerts()
      ]);
      setDemoBookings(bookingsData);
      setAlerts(alertsData);
    } catch (err: any) {
      console.error('Failed to load alerts/bookings:', err);
      setErrorMessageBanner(err.message || 'Failed to load alerts and bookings');
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
    try {
      setIsDeletingBooking(true);
      await api.deleteDemoBooking(id);
      setBookingToDelete(null);
      setNotificationBanner('Demo booking inquiry deleted successfully');
      await loadAlertsAndBookings();
      setTimeout(() => setNotificationBanner(null), 3000);
    } catch (err: any) {
      setNotificationBanner(err.message || 'Failed to delete booking inquiry');
      setTimeout(() => setNotificationBanner(null), 4000);
    } finally {
      setIsDeletingBooking(false);
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
        adminProperties.messages.attendanceMarkedSuccess.replace('{name}', quickAttendanceStudent.displayName)
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

  const handleAddSibling = (student: StudentProfile) => {
    setEditingStudent(null);
    setEnrollmentPrefillData({
      isSiblingEnrollment: true,
      siblingOfStudentId: student.id,
      siblingOfStudentName: student.displayName,
      parentName: student.parentName,
      contactNumber: student.whatsappMobile || student.emergencyContactPhone || (student as any).phone || '',
      email: student.email || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || (student as any).emergencyPhone || '',
      residentialArea: student.residentialArea || '',
    });
    setActiveTab('studentEnrollment');
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
        status: 'Paid',
        paidDate: new Date().toISOString().split('T')[0],
        receiptNumber: quickFeeReceiptNo || `REC-${quickFeeStudent.id.replace('std-', '')}-${Date.now().toString().slice(-4)}`,
        paymentMethod: 'In-Person Reception Card/UPI',
        notes: quickFeeNotes.trim() || undefined,
      });
      setNotificationBanner(
        adminProperties.messages.feeMarkedSuccess.replace('{name}', quickFeeStudent.displayName)
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

  const handleCreateCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoachFormError(null);
    setErrorMessageBanner(null);

    const firstName = coachForm.firstName.trim();
    const lastName = coachForm.lastName.trim();
    const calculatedDisplayName = coachForm.displayName.trim() || `${firstName} ${lastName}`.trim();

    const handleCoachValidationError = (msg: string, elementId?: string) => {
      setCoachFormError(msg);
      if (elementId) {
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
            el.focus({ preventScroll: true });
          }
        }
      }
    };

    if (!firstName && !calculatedDisplayName) {
      handleCoachValidationError('Coach first name and display name are required.', 'input-coach-first-name');
      return;
    }
    if (!coachForm.email.trim()) {
      handleCoachValidationError(adminProperties.messages.coachValidationEmail || 'Coach email address is required.', 'input-coach-email');
      return;
    }
    if (!coachForm.phoneNumber.trim()) {
      handleCoachValidationError(adminProperties.messages.coachValidationPhone || 'Primary phone number is required.', 'input-coach-phone');
      return;
    }
    if (!coachForm.password || coachForm.password.trim().length < 8) {
      handleCoachValidationError(adminProperties.messages.coachValidationPasswordLength || 'Initial password must be at least 8 characters.', 'input-coach-password');
      return;
    }
    if (coachForm.dateOfJoining && coachForm.dateOfLeaving && new Date(coachForm.dateOfLeaving) < new Date(coachForm.dateOfJoining)) {
      handleCoachValidationError('Date of leaving cannot be earlier than date of joining.', 'input-coach-date-leaving');
      return;
    }

    setIsSubmittingCoach(true);
    try {
      const newCoach = await api.createCoach({
        firstName: firstName,
        lastName: lastName,
        displayName: calculatedDisplayName,
        email: coachForm.email.toLowerCase().trim(),
        phoneNumber: coachForm.phoneNumber.trim(),
        address: coachForm.address.trim() || undefined,
        designation: coachForm.designation,
        educationalQualification: coachForm.educationalQualification.trim() || undefined,
        dateOfJoining: coachForm.dateOfJoining || new Date().toISOString().split('T')[0],
        status: coachForm.status,
        dateOfLeaving: coachForm.dateOfLeaving || undefined,
        specializations: coachForm.specializations,
        emergencyContactName: coachForm.emergencyContactName.trim() || undefined,
        emergencyContactPhone: coachForm.emergencyContactPhone.trim() || undefined,
        notes: coachForm.notes.trim() || undefined,
        password: coachForm.password.trim()
      });

      const enrolledName = newCoach.displayName;
      const enrolledDesignation = newCoach.designation || 'Coach';
      const enrolledEmail = newCoach.email;
      const enrolledPhone = newCoach.phoneNumber;

      setNotificationBanner(
        adminProperties.messages.coachCreatedSuccess
          .replace('{name}', enrolledName)
          .replace('{designation}', enrolledDesignation)
      );
      setCoachFormError(null);
      setIsCoachDisplayNameTouched(false);
      setCoachForm({
        firstName: '',
        lastName: '',
        displayName: '',
        email: '',
        phoneNumber: '',
        address: '',
        designation: 'Executive Tutor',
        educationalQualification: '',
        dateOfJoining: new Date().toISOString().split('T')[0],
        status: 'Active',
        dateOfLeaving: '',
        specializations: [],
        emergencyContactName: '',
        emergencyContactPhone: '',
        notes: '',
        password: ''
      });

      // Show confirmation popup
      setEnrolledCoachSuccessModal({
        name: enrolledName,
        designation: enrolledDesignation,
        email: enrolledEmail,
        phoneNumber: enrolledPhone
      });

      // Switch to Coach Directory screen and refresh coaches
      setActiveTab('coaches');
      await loadCoaches();

      // Anchor / scroll smoothly to the coaches table
      setTimeout(() => {
        const tableEl = document.getElementById('coach-directory-table');
        if (tableEl) {
          tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 250);

      setTimeout(() => setNotificationBanner(null), 5000);
    } catch (err: any) {
      console.error('[AdminDashboardPage] Error enrolling coach:', err);
      const msg = err.message || 'Failed to enroll coach. Please try again.';
      setCoachFormError(msg);
      setErrorMessageBanner(msg);
      setTimeout(() => setErrorMessageBanner(null), 8000);
    } finally {
      setIsSubmittingCoach(false);
    }
  };

  const handleOpenEditCoach = (coach: CoachProfile) => {
    setEditCoachError(null);
    setEditingCoach(coach);
    setEditCoachForm({
      firstName: coach.firstName || coach.displayName.split(' ')[0] || '',
      lastName: coach.lastName || coach.displayName.split(' ').slice(1).join(' ') || '',
      displayName: coach.displayName || '',
      email: coach.email || '',
      phoneNumber: coach.phoneNumber || '',
      address: coach.address || '',
      designation: coach.designation || 'Executive Tutor',
      educationalQualification: coach.educationalQualification || '',
      dateOfJoining: coach.dateOfJoining || '',
      status: coach.status || 'Active',
      dateOfLeaving: coach.dateOfLeaving || '',
      specializations: coach.specializations || [],
      emergencyContactName: coach.emergencyContactName || '',
      emergencyContactPhone: coach.emergencyContactPhone || '',
      notes: coach.notes || '',
      password: ''
    });
  };

  const handleUpdateCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoach || !editCoachForm) return;
    setEditCoachError(null);

    const firstName = editCoachForm.firstName.trim();
    const lastName = editCoachForm.lastName.trim();
    const calculatedDisplayName = editCoachForm.displayName.trim() || `${firstName} ${lastName}`.trim();

    if (!firstName && !calculatedDisplayName) {
      setEditCoachError('Coach first name and display name are required.');
      return;
    }
    if (!editCoachForm.email.trim()) {
      setEditCoachError('Coach email address is required.');
      return;
    }
    if (!editCoachForm.phoneNumber.trim()) {
      setEditCoachError('Coach phone number is required.');
      return;
    }
    if (editCoachForm.dateOfJoining && editCoachForm.dateOfLeaving && new Date(editCoachForm.dateOfLeaving) < new Date(editCoachForm.dateOfJoining)) {
      setEditCoachError('Date of leaving cannot be earlier than date of joining.');
      return;
    }

    setIsUpdatingCoach(true);
    try {
      const updated = await api.updateCoach(editingCoach.id, {
        firstName: firstName,
        lastName: lastName,
        displayName: calculatedDisplayName,
        email: editCoachForm.email.toLowerCase().trim(),
        phoneNumber: editCoachForm.phoneNumber.trim(),
        address: editCoachForm.address.trim() || undefined,
        designation: editCoachForm.designation,
        educationalQualification: editCoachForm.educationalQualification.trim() || undefined,
        dateOfJoining: editCoachForm.dateOfJoining || undefined,
        status: editCoachForm.status,
        dateOfLeaving: editCoachForm.dateOfLeaving || undefined,
        specializations: editCoachForm.specializations,
        emergencyContactName: editCoachForm.emergencyContactName.trim() || undefined,
        emergencyContactPhone: editCoachForm.emergencyContactPhone.trim() || undefined,
        notes: editCoachForm.notes.trim() || undefined,
        password: editCoachForm.password.trim() || undefined
      });

      setNotificationBanner(`Coach profile for ${updated.displayName} successfully updated!`);
      setEditingCoach(null);
      setEditCoachForm(null);
      setEditCoachError(null);
      await loadCoaches();
      setTimeout(() => setNotificationBanner(null), 4000);
    } catch (err: any) {
      console.error('[AdminDashboardPage] Error updating coach:', err);
      setEditCoachError(err.message || 'Failed to update coach');
    } finally {
      setIsUpdatingCoach(false);
    }
  };

  const handleToggleStudentStatus = async (student: StudentProfile) => {
    if (isCoach) return;
    const isCurrentlyActive = student.status === 'Active';
    if (isCurrentlyActive) {
      const today = new Date().toISOString().split('T')[0];
      if (!confirm(`Deactivate student "${student.displayName}"?\n\n• Status will be set to Inactive\n• Date of Leaving will be recorded as today (${today})\n• Student will not be able to login\n• Coaches will no longer manage this student\n• All historical records (attendance, fees, works) will be permanently preserved.`)) {
        return;
      }
      try {
        await api.updateStudent(student.id, { status: 'Inactive', dateOfLeaving: today });
        setNotificationBanner(`Student ${student.displayName} has been deactivated (soft delete). Historical records preserved.`);
        loadStudents();
        setTimeout(() => setNotificationBanner(null), 4000);
      } catch (err: any) {
        alert(err.message || 'Failed to deactivate student');
      }
    } else {
      if (!confirm(`Reactivate student "${student.displayName}"?\n\n• Status will be restored to Active\n• Date of Leaving will be cleared\n• Student login access will be restored.`)) {
        return;
      }
      try {
        await api.updateStudent(student.id, { status: 'Active', dateOfLeaving: null as any });
        setNotificationBanner(`Student ${student.displayName} has been reactivated to Active status.`);
        loadStudents();
        setTimeout(() => setNotificationBanner(null), 4000);
      } catch (err: any) {
        alert(err.message || 'Failed to reactivate student');
      }
    }
  };

  const handleToggleCoachStatus = async (coach: CoachProfile) => {
    const isCurrentlyActive = coach.status === 'Active';
    if (isCurrentlyActive) {
      const today = new Date().toISOString().split('T')[0];
      if (!confirm(`Deactivate coach "${coach.displayName}"?\n\n• Status will be set to Inactive\n• Date of Leaving will be recorded as today (${today})\n• Coach will not be able to login\n• Any assigned students will be unassigned\n• All historical attendance and records are permanently preserved.`)) {
        return;
      }
      setDeletingCoachId(coach.id);
      try {
        await api.deleteCoach(coach.id); // Soft deactivates on backend
        setNotificationBanner(`Coach ${coach.displayName} has been deactivated (soft delete). Historical records are preserved.`);
        loadCoaches();
        loadStudents();
        setTimeout(() => setNotificationBanner(null), 4000);
      } catch (err: any) {
        alert(err.message || 'Failed to deactivate coach');
      } finally {
        setDeletingCoachId(null);
      }
    } else {
      if (!confirm(`Reactivate coach "${coach.displayName}"?\n\n• Status will be set to Active\n• Date of Leaving will be cleared\n• Coach login access will be restored.`)) {
        return;
      }
      setDeletingCoachId(coach.id);
      try {
        await api.updateCoach(coach.id, { status: 'Active', dateOfLeaving: null as any });
        setNotificationBanner(`Coach ${coach.displayName} has been reactivated to Active status.`);
        loadCoaches();
        setTimeout(() => setNotificationBanner(null), 4000);
      } catch (err: any) {
        alert(err.message || 'Failed to reactivate coach');
      } finally {
        setDeletingCoachId(null);
      }
    }
  };

  const toggleFormSpecialization = (spec: string) => {
    setCoachForm(prev => {
      const exists = prev.specializations.includes(spec);
      return {
        ...prev,
        specializations: exists
          ? prev.specializations.filter(s => s !== spec)
          : [...prev.specializations, spec]
      };
    });
  };

  const toggleEditSpecialization = (spec: string) => {
    if (!editCoachForm) return;
    setEditCoachForm(prev => {
      if (!prev) return prev;
      const exists = prev.specializations.includes(spec);
      return {
        ...prev,
        specializations: exists
          ? prev.specializations.filter(s => s !== spec)
          : [...prev.specializations, spec]
      };
    });
  };

  const handleAssignCoach = async (studentId: string, coachId: string | null) => {
    setUpdatingStudentCoachId(studentId);
    try {
      const updated = await api.assignCoachToStudent(studentId, coachId);
      const studentName = students.find(s => s.id === studentId)?.displayName || 'Student';
      const assignedCoachName = coaches.find(c => c.id === coachId)?.displayName || updated.coachName;
      
      setNotificationBanner(
        coachId 
          ? `Assigned ${studentName} to Coach ${assignedCoachName}!`
          : `Unassigned coach for ${studentName}`
      );
      
      // Update local student roster state immediately
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, coachId: updated.coachId, coachName: updated.coachName } : s));
      loadCoaches();
      setQuickCoachAssignStudent(null);
      setTimeout(() => setNotificationBanner(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to assign coach');
    } finally {
      setUpdatingStudentCoachId(null);
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
        st.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.username.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'All' || st.status === statusFilter;
      const matchesGrade = gradeFilter === 'All' || st.gradeClass === gradeFilter;
      const matchesTiming = timingFilter === 'All' || st.preferredSlot === timingFilter;
      const matchesCoach = 
        rosterCoachFilter === 'All' ? true :
        rosterCoachFilter === 'Unassigned' ? !st.coachId :
        st.coachId === rosterCoachFilter;

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

  // Filter for Coach-to-Student Assignment Screen
  const assignmentStudents = students.filter((st) => {
    const matchesSearch = 
      !assignmentSearch.trim() ||
      st.displayName.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
      st.parentName.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
      st.whatsappMobile.includes(assignmentSearch) ||
      st.schoolName.toLowerCase().includes(assignmentSearch.toLowerCase());

    const matchesCoach = 
      assignmentCoachFilter === 'All' ? true :
      assignmentCoachFilter === 'Unassigned' ? !st.coachId :
      st.coachId === assignmentCoachFilter;

    const matchesGrade = assignmentGradeFilter === 'All' || st.gradeClass === assignmentGradeFilter;
    const matchesStatus = 
      assignmentStatusFilter === 'All' ? true :
      assignmentStatusFilter === 'Assigned' ? Boolean(st.coachId) :
      !st.coachId;

    return matchesSearch && matchesCoach && matchesGrade && matchesStatus;
  });

  const unassignedStudentsCount = students.filter(s => !s.coachId).length;
  const assignedStudentsCount = students.filter(s => Boolean(s.coachId)).length;

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
      {/* Heading: Admin Command Center / Coach Workspace */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isCoach ? 'Coach Workspace' : 'Admin Command Center'}
            </h1>
            {isCoach && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                Assigned Students
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-sans mt-0.5">
            {isCoach 
              ? 'Manage student profiles, handwriting evaluations, and progress logs for students assigned to you.' 
              : adminProperties.header.subtitle}
          </p>
        </div>

        {!isCoach && (
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <Button
              onClick={() => {
                setActiveTab('coachEnrollment');
              }}
              variant="primary"
              size="sm"
              id="btn-admin-enroll-coach"
            >
              <UserPlus className="w-4 h-4 text-orange-400" />
              <span>{adminProperties.header.newCoachEnrollBtn || '+ Enroll Coach'}</span>
            </Button>
            <Button
              onClick={() => {
                setEditingStudent(null);
                setEnrollmentPrefillData(null);
                setActiveTab('studentEnrollment');
              }}
              variant="accent"
              size="sm"
              id="btn-admin-enroll"
            >
              <UserPlus className="w-4 h-4" />
              <span>{adminProperties.header.newStudentEnrollBtn}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Notification Toast Banner */}
      {notificationBanner && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notificationBanner}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setNotificationBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 underline h-auto p-1"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessageBanner && (
        <div className="p-4 bg-red-50 border-2 border-red-300 text-red-800 text-xs font-bold rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessageBanner}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessageBanner(null)}
            className="text-red-700 hover:text-red-950 underline h-auto p-1"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Module Navigation Tabs (Roster vs Coach Assignment vs Coach Enrollment vs Alerts) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            onClick={() => setActiveTab('roster')}
            variant="ghost"
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto ${
              activeTab === 'roster'
                ? 'bg-[#0E3589] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
            id="tab-btn-student-roster"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>{isCoach ? 'My Assigned Students' : 'Student Roster'}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
              activeTab === 'roster' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#0E3589]'
            }`}>
              {students.length}
            </span>
          </Button>

          {!isCoach && (
            <>
              <Button
                onClick={() => setActiveTab('assignment')}
                variant="ghost"
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto ${
                  activeTab === 'assignment'
                    ? 'bg-[#0E3589] text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                id="tab-btn-coach-assignment"
              >
                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col items-center sm:items-start leading-tight">
                  <span>Coach Assignment</span>
                  {unassignedStudentsCount > 0 ? (
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full mt-0.5 ${
                      activeTab === 'assignment' ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {unassignedStudentsCount} Unassigned
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                      activeTab === 'assignment' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      All Assigned
                    </span>
                  )}
                </div>
              </Button>

              <Button
                onClick={() => {
                  setActiveTab('coaches');
                  loadCoaches();
                }}
                variant="ghost"
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto ${
                  activeTab === 'coaches'
                    ? 'bg-[#0E3589] text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                id="tab-btn-coach-directory"
              >
                <ShieldCheck className="w-4 h-4 text-[#F46E20] shrink-0" />
                <span>Coach Directory</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                  activeTab === 'coaches' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {coaches.length}
                </span>
              </Button>

              <Button
                onClick={() => {
                  setActiveTab('alerts');
                  loadAlertsAndBookings();
                }}
                variant="ghost"
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer relative w-full sm:w-auto ${
                  activeTab === 'alerts'
                    ? 'bg-[#F46E20] text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                id="tab-btn-admin-alerts"
              >
                <BellRing className="w-4 h-4 shrink-0" />
                <span>Alerts &amp; Demos</span>
                {(unreadAlertsCount > 0 || newBookingsCount > 0) && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold animate-pulse shrink-0 ${
                    activeTab === 'alerts' ? 'bg-white text-[#F46E20]' : 'bg-red-500 text-white'
                  }`}>
                    {newBookingsCount > 0 ? `${newBookingsCount} New` : unreadAlertsCount}
                  </span>
                )}
              </Button>
            </>
          )}
        </div>

        <Button
          onClick={handleExportCSV}
          variant="outline"
          size="sm"
          id="btn-export-excel"
          title="Export Roster (CSV)"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">{adminProperties.header.exportExcelBtn}</span>
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STUDENT ROSTER VIEW                                                */}
      {/* ========================================================================= */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
              {/* Search Input */}
              <div className="md:col-span-4">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={adminProperties.filters.searchPlaceholder}
                  leftIcon={<Search className="w-4 h-4" />}
                  id="input-roster-search"
                />
              </div>

              {/* Status Filter */}
              <div className="md:col-span-2">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  id="select-roster-status"
                >
                  <option value="All">All Statuses ({students.length})</option>
                  <option value="Active">Active ({activeCount})</option>
                  <option value="Inactive">Inactive ({inactiveCount})</option>
                </Select>
              </div>

              {/* Coach Filter (Only visible to Admin) */}
              {!isCoach && (
                <div className="md:col-span-2">
                  <Select
                    value={rosterCoachFilter}
                    onChange={(e) => setRosterCoachFilter(e.target.value)}
                    id="select-roster-coach"
                  >
                    <option value="All">All Coaches</option>
                    <option value="Unassigned">?? Unassigned ({unassignedStudentsCount})</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>Coach {c.displayName}</option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Grade Filter */}
              <div className="md:col-span-2">
                <Select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  id="select-roster-grade"
                >
                  <option value="All">All Grades</option>
                  {uniqueGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </div>

              {/* Timing Filter */}
              <div className="md:col-span-2">
                <Select
                  value={timingFilter}
                  onChange={(e) => setTimingFilter(e.target.value)}
                  id="select-roster-timing"
                >
                  <option value="All">All Slots</option>
                  {uniqueTimings.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Sort Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-500">
                <ArrowUpDown className="w-4 h-4 text-[#0E3589]" />
                <span className="font-bold text-slate-700">{adminProperties.filters.sortByLabel}:</span>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'createdDate') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('createdDate'); setSortOrder('desc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors h-auto ${
                      sortBy === 'createdDate' ? 'bg-blue-100 text-[#0E3589]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {adminProperties.filters.sortCreatedDate} {sortBy === 'createdDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('name'); setSortOrder('asc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors h-auto ${
                      sortBy === 'name' ? 'bg-blue-100 text-[#0E3589]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {adminProperties.filters.sortName} {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'grade') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('grade'); setSortOrder('asc'); }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors h-auto ${
                      sortBy === 'grade' ? 'bg-blue-100 text-[#0E3589]' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {adminProperties.filters.sortCurrentClass} {sortBy === 'grade' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </Button>
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
                      <th className="py-3.5 px-4">Assigned Coach</th>
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
                                {student.displayName.charAt(0)}
                              </div>
                              <div>
                                <Button
                                  variant="ghost"
                                  onClick={() => onNavigate('studentDetail', student.id, 1)}
                                  className="font-extrabold text-sm text-[#0E3589] hover:underline text-left p-0 h-auto inline-flex"
                                >
                                  {student.displayName}
                                </Button>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {student.age ? `Age: ${student.age} yrs • ` : ''}{student.gradeClass ? `${formatGradeClass(student.gradeClass)} • ` : ''}{formatDominantHand(student.dominantHand)} • <span className="font-semibold text-slate-700">{student.modeOfLearning || 'In-person'}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Parent & Contact */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-800">
                                {student.parentName} {student.relationship ? `(${student.relationship})` : ''}
                              </p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#F46E20]" />
                                <a href={`tel:${student.whatsappMobile}`} className="hover:underline">{student.whatsappMobile}</a>
                              </p>
                              <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                {student.email}
                              </p>
                            </div>
                          </td>

                          {/* Assigned Coach */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {student.coachId ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#0E3589] border border-blue-200">
                                    <ShieldCheck className="w-3 h-3 text-[#0E3589]" />
                                    {student.coachName || 'Assigned'}
                                  </span>
                                  {!isCoach && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setQuickCoachAssignStudent(student)}
                                      className="text-[10px] text-slate-400 hover:text-[#0E3589] underline p-0 h-auto"
                                    >
                                      Change Coach
                                    </Button>
                                  )}
                                </div>
                              ) : isCoach ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-500">
                                  Unassigned
                                </span>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setQuickCoachAssignStudent(student)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 h-auto"
                                >
                                  <BadgeAlert className="w-3 h-3 text-amber-600" />
                                  <span>Assign Coach</span>
                                </Button>
                              )}
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

                          {/* Status & Date of Leaving */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col items-start gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isCoach}
                                onClick={() => !isCoach && handleToggleStudentStatus(student)}
                                title={!isCoach ? (student.status === 'Active' ? 'Click to deactivate student' : 'Click to reactivate student') : 'Student Status'}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold h-auto ${
                                  isCoach ? 'cursor-default' : 'cursor-pointer hover:shadow-xs hover:scale-105 active:scale-95'
                                } ${
                                  student.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                }`}
                                id={`badge-student-status-${student.id}`}
                              >
                                {student.status === 'Active' ? (
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-slate-400" />
                                )}
                                <span>{student.status}</span>
                              </Button>
                              {student.dateOfLeaving && (
                                <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap pl-1" title="Date of Leaving">
                                  Left: {student.dateOfLeaving}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Mark Attendance */}
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={student.status === 'Inactive'}
                                onClick={() => student.status !== 'Inactive' && setQuickAttendanceStudent(student)}
                                title={student.status === 'Inactive' ? 'Attendance disabled: Student is Inactive (Read-Only Archive)' : adminProperties.actions.markAttendance}
                                className={`rounded-lg ${
                                  student.status === 'Inactive'
                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : 'bg-blue-50 hover:bg-blue-100 text-[#0E3589]'
                                }`}
                              >
                                <Calendar className="w-4 h-4" />
                              </Button>

                              {/* 2. Mark Fee Paid (8-Class Cycle) */}
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={student.status === 'Inactive'}
                                onClick={() => student.status !== 'Inactive' && handleOpenQuickFee(student)}
                                title={student.status === 'Inactive' ? 'Fee payment disabled: Student is Inactive (Read-Only Archive)' : (hasPendingFeeAlert ? '8 Classes Completed • Fee Receipt Due (₹1,600)' : adminProperties.actions.markFeePaid)}
                                className={`rounded-lg relative ${
                                  student.status === 'Inactive'
                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                    : hasPendingFeeAlert
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
                              </Button>

                              {/* Edit Student Details */}
                              {!isCoach && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingStudent(student);
                                    setEnrollmentPrefillData(null);
                                    setActiveTab('studentEnrollment');
                                  }}
                                  title={`Edit Student Details for ${student.displayName}`}
                                  className="bg-blue-50 hover:bg-blue-100 text-[#0E3589] border border-blue-200/80 rounded-lg"
                                  id={`btn-edit-student-${student.id}`}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              )}

                              {/* Add a Sibling Quick Action */}
                              {!isCoach && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleAddSibling(student)}
                                  title={`${adminProperties.actions.addSibling} for ${student.displayName}`}
                                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-lg"
                                  id={`btn-add-sibling-${student.id}`}
                                >
                                  <UserPlus className="w-4 h-4" />
                                </Button>
                              )}

                              {/* 3. View Student Details */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onNavigate('studentDetail', student.id, 1)}
                                title={adminProperties.actions.viewStudentDetails}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {/* 4. Preview Parent Portal */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onNavigate('parentPortal', student.id)}
                                title={`Preview Parent Portal for ${student.displayName}`}
                                className="bg-orange-50 hover:bg-orange-100 text-[#F46E20] border border-orange-200/80 rounded-lg"
                              >
                                <GraduationCap className="w-4 h-4" />
                              </Button>
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
      {/* TAB 2: COACH-TO-STUDENT ASSIGNMENT WORKFLOW (ADMIN ONLY)                   */}
      {/* ========================================================================= */}
      {activeTab === 'assignment' && (
        <div className="space-y-6">
          {/* Workload Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <StatCard
              icon={<ShieldCheck className="w-4 h-4" />}
              value={coaches.length}
              label="Registered Coaches"
              colorScheme="blue"
            />
            <StatCard
              icon={<UserCheck className="w-4 h-4" />}
              value={assignedStudentsCount}
              label="Students Assigned to Coaches"
              colorScheme="emerald"
            />
            <StatCard
              icon={<BadgeAlert className="w-4 h-4" />}
              value={unassignedStudentsCount}
              label="Students Pending Assignment"
              colorScheme="amber"
            />
          </div>

          {/* Assignment Search & Filter Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
              {/* Search */}
              <div className="md:col-span-5">
                <Input
                  type="text"
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  placeholder="Search by student name, parent, phone, school..."
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>

              {/* Assignment Status Filter */}
              <div className="md:col-span-3">
                <Select
                  value={assignmentStatusFilter}
                  onChange={(e) => setAssignmentStatusFilter(e.target.value as any)}
                >
                  <option value="All">All Students ({students.length})</option>
                  <option value="Unassigned">⚠️ Unassigned Only ({unassignedStudentsCount})</option>
                  <option value="Assigned">✓ Assigned Only ({assignedStudentsCount})</option>
                </Select>
              </div>

              {/* Coach Filter */}
              <div className="md:col-span-4">
                <Select
                  value={assignmentCoachFilter}
                  onChange={(e) => setAssignmentCoachFilter(e.target.value)}
                >
                  <option value="All">Filter by Assigned Coach (All)</option>
                  <option value="Unassigned">⚠️ Not Assigned to Any Coach</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>Coach {c.displayName} ({c.studentCount || 0} students)</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Showing <strong>{assignmentStudents.length}</strong> students</span>
              <span>Select any coach from the dropdown to instantly reassign</span>
            </div>
          </div>

          {/* Students Assignment Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md">
            {assignmentStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-base font-bold text-slate-700">No students found matching current filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Student &amp; School</th>
                      <th className="py-3.5 px-4">Parent Contact</th>
                      <th className="py-3.5 px-4">Slot &amp; Progress</th>
                      <th className="py-3.5 px-4">Current Assigned Coach</th>
                      <th className="py-3.5 px-4">Assign / Reassign Coach</th>
                      <th className="py-3.5 px-4 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignmentStudents.map((student) => {
                      const isUpdating = updatingStudentCoachId === student.id;
                      const attendedCount = student.attendanceHistory?.filter((a) => a.status === 'Present').length || 0;

                      return (
                        <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                          {/* Student Info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0E3589] to-[#0084F4] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                                {student.displayName.charAt(0)}
                              </div>
                              <div>
                                <Button
                                  variant="ghost"
                                  onClick={() => onNavigate('studentDetail', student.id, 1)}
                                  className="font-extrabold text-sm text-[#0E3589] hover:underline text-left p-0 h-auto inline-flex"
                                >
                                  {student.displayName}
                                </Button>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {student.gradeClass ? `${formatGradeClass(student.gradeClass)} • ` : ''}{student.schoolName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Parent & Phone */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-800">{student.parentName}</p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#F46E20]" />
                                <a href={`tel:${student.whatsappMobile}`} className="hover:underline">{student.whatsappMobile}</a>
                              </p>
                            </div>
                          </td>

                          {/* Slot & Progress */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-800">{student.preferredSlot}</p>
                              <p className="text-[11px] text-slate-500">{attendedCount} classes completed</p>
                            </div>
                          </td>

                          {/* Current Status Badge */}
                          <td className="py-3.5 px-4">
                            {student.coachId ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-[#0E3589] border border-blue-200">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#0E3589]" />
                                {student.coachName || 'Assigned'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                                <BadgeAlert className="w-3.5 h-3.5 text-amber-600" />
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Instant 1-Click Assignment Dropdown */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <Select
                                disabled={isUpdating}
                                value={student.coachId || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleAssignCoach(student.id, val ? val : null);
                                }}
                              >
                                <option value="">-- No Coach Assigned --</option>
                                {coaches.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    Coach {c.displayName} ({c.designation})
                                  </option>
                                ))}
                              </Select>
                              {isUpdating && <RefreshCw className="w-4 h-4 animate-spin text-[#0E3589]" />}
                            </div>
                          </td>

                          {/* Quick Dossier link */}
                          <td className="py-3.5 px-4 text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onNavigate('studentDetail', student.id, 1)}
                              title="Open Student Profile"
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
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
      {/* SCREEN: EMBEDDED STUDENT ENROLLMENT & EDIT SCREEN (ADMIN COMMAND CENTER)  */}
      {/* ========================================================================= */}
      {activeTab === 'studentEnrollment' && !isCoach && (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
          <EnrollmentPage
            mode={editingStudent ? 'edit' : 'enroll'}
            studentToEdit={editingStudent}
            initialData={enrollmentPrefillData}
            onSuccess={(student, isEdit) => {
              loadStudents();
              setNotificationBanner(
                isEdit
                  ? `✅ Student profile for ${student?.displayName || 'student'} has been successfully saved! Update notification dispatched to parent & admin.`
                  : `🎉 Student ${student?.displayName || 'student'} has been successfully enrolled! Access credentials dispatched to parent & admin.`
              );
              setEditingStudent(null);
              setEnrollmentPrefillData(null);
              setActiveTab('roster');
            }}
            onCancel={() => {
              setEditingStudent(null);
              setEnrollmentPrefillData(null);
              setActiveTab('roster');
            }}
            onNavigate={(view, studentId, defaultSection) => {
              if (view === 'studentDetail' && studentId) {
                onNavigate('studentDetail', studentId, defaultSection);
              } else if (view === 'parentPortal' && studentId) {
                onNavigate('parentPortal', studentId);
              } else {
                setEditingStudent(null);
                setEnrollmentPrefillData(null);
                setActiveTab('roster');
              }
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN: DEDICATED COACH ENROLLMENT SCREEN (ADMIN ONLY)                    */}
      {/* ========================================================================= */}
      {activeTab === 'coachEnrollment' && !isCoach && (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
          {/* Header & Back Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveTab('coaches');
                  loadCoaches();
                }}
                className="rounded-xl shadow-2xs font-bold"
                title="Return to Coach Directory"
                id="btn-back-to-coach-directory"
                leftIcon={<ArrowLeft className="w-4 h-4 text-slate-700" />}
              >
                Coach Directory
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Enroll New Coach
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-[#0E3589]">
                    Admin Only
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register a handwriting coach or tutor with complete profile credentials, specializations, and login access.
                </p>
              </div>
            </div>
          </div>

          {/* Expanded Enrollment Form */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
            <form onSubmit={handleCreateCoach} className="space-y-5">
              {/* Inline Coach Error Alert */}
              {coachFormError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-red-900">Enrollment Error</p>
                    <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{coachFormError}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCoachFormError(null)}
                    className="text-red-500 hover:text-red-800 text-xs font-bold p-1 min-h-[32px] min-w-[32px]"
                  >
                    ×
                  </Button>
                </div>
              )}

              {/* Name Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={coachForm.firstName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCoachForm({
                        ...coachForm,
                        firstName: val,
                        displayName: !isCoachDisplayNameTouched ? `${val} ${coachForm.lastName}`.trim() : coachForm.displayName
                      });
                    }}
                    placeholder="e.g. Deepthy"
                    id="input-coach-first-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={coachForm.lastName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCoachForm({
                        ...coachForm,
                        lastName: val,
                        displayName: !isCoachDisplayNameTouched ? `${coachForm.firstName} ${val}`.trim() : coachForm.displayName
                      });
                    }}
                    placeholder="e.g. Rock"
                    id="input-coach-last-name"
                  />
                </div>
              </div>

              {/* Display Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Shown in rosters &amp; applet</span>
                </div>
                <Input
                  type="text"
                  required
                  value={coachForm.displayName}
                  onChange={(e) => {
                    setIsCoachDisplayNameTouched(true);
                    setCoachForm({ ...coachForm, displayName: e.target.value });
                  }}
                  placeholder="e.g. Deepthy Rock"
                  id="input-coach-display-name"
                />
              </div>

              {/* Contact Section - Email and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    value={coachForm.email}
                    onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                    placeholder="e.g. coach@smartpen.in"
                    id="input-coach-email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Primary Phone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    required
                    value={coachForm.phoneNumber}
                    onChange={(e) => setCoachForm({ ...coachForm, phoneNumber: e.target.value })}
                    placeholder="e.g. 8861751000"
                    id="input-coach-phone"
                  />
                </div>
              </div>

              {/* Professional & Qualifications */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Designation
                    </label>
                    <Select
                      value={coachForm.designation}
                      onChange={(e) => setCoachForm({ ...coachForm, designation: e.target.value })}
                      id="select-coach-designation"
                    >
                      <option value="Principal Tutor">Principal Tutor (Master Instructor)</option>
                      <option value="Executive Tutor">Executive Tutor (Senior Coach)</option>
                      <option value="Senior Master Coach">Senior Master Coach</option>
                      <option value="Associate Tutor">Associate Tutor (Junior Coach)</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status
                    </label>
                    <Select
                      value={coachForm.status}
                      onChange={(e) => setCoachForm({ ...coachForm, status: e.target.value as 'Active' | 'Inactive' })}
                      id="select-coach-status"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Educational Qualification
                  </label>
                  <Input
                    type="text"
                    value={coachForm.educationalQualification}
                    onChange={(e) => setCoachForm({ ...coachForm, educationalQualification: e.target.value })}
                    placeholder="e.g. M.Ed, Certified Master Calligrapher, B.A. Literature"
                    id="input-coach-qualification"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Date of Joining
                    </label>
                    <Input
                      type="date"
                      value={coachForm.dateOfJoining}
                      onChange={(e) => setCoachForm({ ...coachForm, dateOfJoining: e.target.value })}
                      id="input-coach-joining-date"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Date of Leaving <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <Input
                      type="date"
                      min={coachForm.dateOfJoining || undefined}
                      value={coachForm.dateOfLeaving}
                      onChange={(e) => setCoachForm({ ...coachForm, dateOfLeaving: e.target.value })}
                      id="input-coach-leaving-date"
                    />
                  </div>
                </div>
              </div>

              {/* Communication Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Residential / Communication Address
                </label>
                <Textarea
                  rows={2}
                  value={coachForm.address}
                  onChange={(e) => setCoachForm({ ...coachForm, address: e.target.value })}
                  placeholder="e.g. #42, 5th Cross, Indiranagar, Bangalore - 560038"
                  className="resize-none"
                  id="textarea-coach-address"
                />
              </div>

              {/* Specializations & Teaching Focus */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Specializations &amp; Teaching Focus
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Cursive Writing',
                    'Print Script Mastery',
                    'Speed Enhancement',
                    'Motor Grip Correction',
                    'Devanagari / Hindi',
                    'Dysgraphia Support',
                    'Exam Presentation'
                  ].map((spec) => {
                    const isSelected = coachForm.specializations.includes(spec);
                    return (
                      <Button
                        type="button"
                        key={spec}
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => toggleFormSpecialization(spec)}
                        className={`rounded-lg text-xs font-bold ${
                          isSelected
                            ? 'bg-[#0E3589] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {spec} {isSelected ? '✓' : '+'}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emergency Contact Person
                  </label>
                  <Input
                    type="text"
                    value={coachForm.emergencyContactName}
                    onChange={(e) => setCoachForm({ ...coachForm, emergencyContactName: e.target.value })}
                    placeholder="e.g. Spouse / Relative"
                    id="input-coach-emergency-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emergency Phone
                  </label>
                  <Input
                    type="tel"
                    value={coachForm.emergencyContactPhone}
                    onChange={(e) => setCoachForm({ ...coachForm, emergencyContactPhone: e.target.value })}
                    placeholder="e.g. 9845012345"
                    id="input-coach-emergency-phone"
                  />
                </div>
              </div>

              {/* Bio & Internal Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Professional Notes / Bio
                </label>
                <Input
                  type="text"
                  value={coachForm.notes}
                  onChange={(e) => setCoachForm({ ...coachForm, notes: e.target.value })}
                  placeholder="e.g. 8+ years experience in handwriting transformation"
                  id="input-coach-notes"
                />
              </div>

              {/* Initial Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Login Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    type="text"
                    required
                    value={coachForm.password}
                    onChange={(e) => setCoachForm({ ...coachForm, password: e.target.value })}
                    placeholder="e.g. Coach@Secure2026 (min 8 chars)"
                    className="pl-10 font-mono"
                    id="input-coach-password"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">The coach will use this password along with their email/phone to log in.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setActiveTab('coaches');
                    loadCoaches();
                  }}
                  className="w-full sm:w-auto"
                  id="btn-cancel-coach-enrollment"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingCoach}
                  disabled={isSubmittingCoach}
                  className="w-full sm:w-auto"
                  id="btn-submit-coach-enrollment"
                  leftIcon={!isSubmittingCoach ? <CheckCircle className="w-4 h-4" /> : undefined}
                >
                  {isSubmittingCoach ? 'Enrolling Coach...' : 'Enroll Coach & Create Credentials'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN: DEDICATED COACH DIRECTORY SCREEN                                  */}
      {/* ========================================================================= */}
      {activeTab === 'coaches' && (
        <div id="coach-directory-table" className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Coach Directory &amp; Roster
                  </h2>
                  <span className="px-3 py-1 bg-blue-50 text-[#0E3589] rounded-xl text-xs font-extrabold border border-blue-100">
                    {coaches.length} Enrolled
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Manage profiles, educational credentials, and student assignments for all tutors.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {!isCoach && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('coachEnrollment')}
                    className="font-extrabold"
                    id="btn-directory-enroll-coach"
                    leftIcon={<UserPlus className="w-3.5 h-3.5 text-orange-400" />}
                  >
                    + Enroll Coach
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadCoaches}
                  title="Refresh directory"
                  className="p-2"
                  id="btn-refresh-coaches"
                  aria-label="Refresh directory"
                >
                  <RefreshCw className={`w-4 h-4 ${coachesLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by name, email, phone, qualification..."
                  value={coachSearchQuery}
                  onChange={(e) => setCoachSearchQuery(e.target.value)}
                  className="pl-9"
                  id="input-search-coaches"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={coachStatusFilter}
                  onChange={(e) => setCoachStatusFilter(e.target.value as any)}
                  className="font-bold text-slate-700"
                  id="select-coach-status-filter"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active Only</option>
                  <option value="Inactive">Inactive Only</option>
                </Select>

                <Select
                  value={coachDesignationFilter}
                  onChange={(e) => setCoachDesignationFilter(e.target.value)}
                  className="font-bold text-slate-700"
                  id="select-coach-designation-filter"
                >
                  <option value="All">All Designations</option>
                  <option value="Principal Tutor">Principal Tutor</option>
                  <option value="Executive Tutor">Executive Tutor</option>
                  <option value="Senior Master Coach">Senior Master Coach</option>
                  <option value="Associate Tutor">Associate Tutor</option>
                </Select>
              </div>
            </div>

            {/* Filtered Coaches List */}
            {(() => {
              const filtered = coaches.filter(c => {
                const matchSearch = coachSearchQuery === '' ||
                  c.displayName.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
                  c.email.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
                  c.phoneNumber.includes(coachSearchQuery) ||
                  (c.educationalQualification && c.educationalQualification.toLowerCase().includes(coachSearchQuery.toLowerCase())) ||
                  (c.specializations && c.specializations.some(s => s.toLowerCase().includes(coachSearchQuery.toLowerCase())));
                const matchStatus = coachStatusFilter === 'All' || (c.status || 'Active') === coachStatusFilter;
                const matchDesignation = coachDesignationFilter === 'All' || c.designation === coachDesignationFilter;
                return matchSearch && matchStatus && matchDesignation;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-10 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-2xl">
                    <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-600">No coaches match your filters</p>
                    <p className="text-xs text-slate-400">Try adjusting your search keywords or status filter.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3.5">
                  {filtered.map((coach) => {
                    const isCurrentUserAdminMatch = coach.designation?.toLowerCase().includes('principal') || coach.role === 'admin';
                    const isInactive = coach.status === 'Inactive';

                    return (
                      <div
                        key={coach.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isInactive 
                            ? 'bg-slate-100/70 border-slate-300 opacity-80' 
                            : isCurrentUserAdminMatch 
                            ? 'bg-gradient-to-br from-blue-50/70 to-orange-50/40 border-[#0E3589]/30 shadow-xs' 
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0E3589] to-[#0084F4] text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                                {coach.displayName.charAt(0)}
                              </div>
                              <span 
                                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                  isInactive ? 'bg-slate-400' : 'bg-emerald-500'
                                }`}
                                title={isInactive ? 'Inactive' : 'Active'}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="font-black text-sm text-slate-900">
                                  {coach.displayName}
                                </h3>
                                {isCurrentUserAdminMatch && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-orange-100 text-[#F46E20] border border-orange-200">
                                    Admin
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100/70 text-[#0E3589]">
                                  {coach.designation || 'Tutor'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                  isInactive ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                                }`}
                                >
                                  {coach.status || 'Active'}
                                </span>
                              </div>

                              {coach.educationalQualification && (
                                <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>{coach.educationalQualification}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-start">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditCoach(coach)}
                              title="Edit Coach Details"
                              className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border-slate-200 rounded-lg text-xs font-bold"
                              leftIcon={<Edit2 className="w-3.5 h-3.5 text-[#0E3589]" />}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deletingCoachId === coach.id}
                              isLoading={deletingCoachId === coach.id}
                              onClick={() => handleToggleCoachStatus(coach)}
                              title={coach.status === 'Active' ? 'Deactivate Coach (Soft Delete)' : 'Reactivate Coach'}
                              className={`p-1.5 rounded-lg text-xs font-bold ${
                                coach.status === 'Active'
                                  ? 'bg-white hover:bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                              id={`btn-toggle-coach-${coach.id}`}
                              leftIcon={
                                deletingCoachId !== coach.id ? (
                                  coach.status === 'Active' ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )
                                ) : undefined
                              }
                            >
                              {coach.status === 'Active' ? (
                                <span className="hidden sm:inline">Deactivate</span>
                              ) : (
                                <span className="hidden sm:inline">Reactivate</span>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Contact & Date Details Grid */}
                        <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <a href={`mailto:${coach.email}`} className="truncate hover:text-[#0E3589] hover:underline">
                              {coach.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <a href={`tel:${coach.phoneNumber}`} className="hover:text-[#0E3589] hover:underline font-semibold">
                              {coach.phoneNumber}
                            </a>
                          </div>
                          {coach.dateOfJoining && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Joined: <strong>{coach.dateOfJoining}</strong></span>
                              {coach.dateOfLeaving && (
                                <span className="text-rose-600 font-semibold">(Left: {coach.dateOfLeaving})</span>
                              )}
                            </div>
                          )}
                          {coach.address && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{coach.address}</span>
                            </div>
                          )}
                        </div>

                        {/* Specializations & Workload Footer */}
                        {coach.specializations && coach.specializations.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {coach.specializations.map((spec) => (
                              <span key={spec} className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-md text-[10px] font-semibold">
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-xs font-extrabold text-emerald-800">
                              {coach.studentCount || 0} Students Assigned
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAssignmentCoachFilter(coach.id);
                              setActiveTab('assignment');
                            }}
                            className="text-[11px] font-bold text-[#0E3589] hover:underline p-1 min-h-[32px]"
                            rightIcon={<ChevronRight className="w-3 h-3" />}
                          >
                            Assign Students
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Information Callout */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">🔑 How Coach Authentication Works</p>
              <p>
                When coaches log in on the Smartpen portal, they choose <strong>Coach / Tutor</strong> role and provide their email or phone number along with their password. They will only see the assessment and attendance records for the students specifically assigned to them by the Admin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP: ENROLLED COACH SUCCESS CONFIRMATION MODAL                          */}
      {/* ========================================================================= */}
      {enrolledCoachSuccessModal && (
      <Modal
        isOpen={Boolean(enrolledCoachSuccessModal)}
        onClose={() => {
          setEnrolledCoachSuccessModal(null);
          setTimeout(() => {
            const tableElement = document.getElementById('coach-directory-table');
            if (tableElement) {
              tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }}
        size="lg"
        showCloseButton={true}
      >
        <div className="space-y-6 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEnrolledCoachSuccessModal(null);
                setTimeout(() => {
                  const tableElement = document.getElementById('coach-directory-table');
                  if (tableElement) {
                    tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-xl text-sm font-bold"
              id="btn-close-coach-success-modal"
              aria-label="Close"
            >
              ✕
            </Button>

            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-black border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Coach Enrolled Successfully!</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {enrolledCoachSuccessModal.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Registered as <strong className="text-[#0E3589] font-bold">{enrolledCoachSuccessModal.designation}</strong> in SmartPen Academy.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Designation</span>
                <span className="font-bold text-[#0E3589]">{enrolledCoachSuccessModal.designation}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Login Email</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">{enrolledCoachSuccessModal.email}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Phone Number</span>
                <span className="font-semibold text-slate-800">{enrolledCoachSuccessModal.phoneNumber}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              The coach can now sign in using the <strong>Coach / Tutor</strong> role with their email/phone and established password.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  setEnrolledCoachSuccessModal(null);
                  setTimeout(() => {
                    const tableElement = document.getElementById('coach-directory-table');
                    if (tableElement) {
                      tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className="flex-1 py-3"
                id="btn-confirm-coach-view-directory"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                View in Coach Directory
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEnrolledCoachSuccessModal(null);
                  setActiveTab('coachEnrollment');
                }}
                className="py-3 px-4"
                id="btn-confirm-coach-enroll-another"
              >
                Enroll Another Coach
              </Button>
            </div>
        </div>
      </Modal>
      )}

      {/* Quick Coach Reassign Modal */}
      {quickCoachAssignStudent && (
      <Modal
        isOpen={Boolean(quickCoachAssignStudent)}
        onClose={() => setQuickCoachAssignStudent(null)}
        size="md"
        showCloseButton={false}
      >
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#0E3589]">
                <ShieldCheck className="w-5 h-5 text-[#0E3589]" />
                <h3 className="font-black text-sm">Assign Coach to Student</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuickCoachAssignStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 min-h-[32px] min-w-[32px]"
                aria-label="Close"
              >
                ✕
              </Button>
            </div>

            <div>
              <p className="text-xs text-slate-500">Student Name</p>
              <p className="text-sm font-extrabold text-slate-900">{quickCoachAssignStudent.displayName}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {quickCoachAssignStudent.gradeClass ? `${formatGradeClass(quickCoachAssignStudent.gradeClass)} • ` : ''}
                {quickCoachAssignStudent.schoolName}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Select Coach</label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <Button
                  type="button"
                  variant={!quickCoachAssignStudent.coachId ? 'primary' : 'outline'}
                  onClick={() => handleAssignCoach(quickCoachAssignStudent.id, null)}
                  className={`w-full p-3 rounded-xl border text-left text-xs font-bold justify-between ${
                    !quickCoachAssignStudent.coachId
                      ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BadgeAlert className="w-4 h-4 text-amber-600" />
                    <span>No Coach (Unassigned)</span>
                  </span>
                  {!quickCoachAssignStudent.coachId && <Check className="w-4 h-4 text-amber-600" />}
                </Button>

                {coaches.map((c) => {
                  const isCurrent = quickCoachAssignStudent.coachId === c.id;
                  return (
                    <Button
                      key={c.id}
                      type="button"
                      variant={isCurrent ? 'primary' : 'outline'}
                      onClick={() => handleAssignCoach(quickCoachAssignStudent.id, c.id)}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-bold justify-between ${
                        isCurrent
                          ? 'bg-blue-50 border-[#0E3589] text-[#0E3589] hover:bg-blue-100'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="text-left">
                        <p className="font-extrabold text-xs">Coach {c.displayName}</p>
                        <p className="text-[10px] text-slate-500 font-normal">{c.designation} • {c.studentCount || 0} students assigned</p>
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
                onClick={() => setQuickCoachAssignStudent(null)}
                className="px-4 py-2"
              >
                Close
              </Button>
            </div>
        </div>
      </Modal>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALERTS & FREE DEMO CLASS BOOKINGS MODULE                            */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Alerts Header & Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              value={demoBookings.length}
              label={adminProperties.alertsModule.stats.totalBookings}
              colorScheme="orange"
            />
            <StatCard
              icon={<AlertCircle className="w-4 h-4" />}
              value={newBookingsCount}
              label={adminProperties.alertsModule.stats.newBookings}
              colorScheme="red"
            />
            <StatCard
              icon={<CalendarCheck className="w-4 h-4" />}
              value={demoBookings.filter(b => b.status === 'Scheduled').length}
              label={adminProperties.alertsModule.stats.scheduled}
              colorScheme="blue"
            />
            <StatCard
              icon={<CheckCircle className="w-4 h-4" />}
              value={demoBookings.filter(b => b.status === 'Enrolled').length}
              label={adminProperties.alertsModule.stats.enrolled}
              colorScheme="emerald"
            />
          </div>

          {/* Quick Filter & Actions Toolbar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Pills */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500">Filter Inquiries:</span>
              <div className="flex items-center gap-1 sm:gap-2 flex-nowrap w-full sm:w-auto">
                {(['All', 'New', 'Contacted', 'Scheduled', 'Enrolled'] as const).map((filterOpt) => (
                  <Button
                    key={filterOpt}
                    type="button"
                    variant={alertFilter === filterOpt ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setAlertFilter(filterOpt)}
                    className={`rounded-xl text-[11px] sm:text-xs font-bold !px-1.5 sm:!px-3 py-1 sm:py-1.5 flex-1 sm:flex-initial text-center justify-center ${
                      alertFilter === filterOpt
                        ? 'bg-[#0E3589] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filterOpt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadAlertsAndBookings}
                className="rounded-xl font-bold"
                title="Refresh latest inquiries"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${alertsLoading ? 'animate-spin' : ''}`} />}
              >
                {adminProperties.alertsModule.refreshBtn}
              </Button>

              {unreadAlertsCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAlertsRead}
                  className="rounded-xl font-bold bg-blue-50 hover:bg-blue-100 text-[#0E3589] border-blue-200"
                  leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
                >
                  {adminProperties.alertsModule.markAllReadBtn}
                </Button>
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
                  const targetStudent = students.find((s) => s.id === al.studentId || s.displayName === al.metadata?.studentName);

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
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenQuickFee(targetStudent, al.metadata?.cycleLabel)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-2xs py-1 px-2.5 min-h-[28px]"
                            >
                              Record ₹1,600 Receipt
                            </Button>
                            {targetStudent.whatsappMobile && (
                              <a
                                href={`https://wa.me/${targetStudent.whatsappMobile.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                  `Hello! This is Mrs. Deepthy Rock from SmartPen Handwriting Academy. ${targetStudent.displayName} has completed 8 classes (${al.metadata?.cycleLabel || '8 classes'}). The coaching fee of ₹1,600 is now due. Please record the payment at your earliest convenience. Thank you!`
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAlertRead(al.id)}
                            className="p-1 hover:bg-blue-50 text-[#0E3589] rounded-lg min-h-[28px] min-w-[28px]"
                            title="Mark read"
                            aria-label="Mark read"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAlert(al.id)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg min-h-[28px] min-w-[28px]"
                          title="Delete alert"
                          aria-label="Delete alert"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
                          .replace('{date}', booking.preferredDate)
                          .replace('{time}', booking.preferredTimeSlot)
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
                                <p className="text-[11px] font-semibold text-slate-600">
                                  Parent: {booking.parentName || 'Parent'}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="inline-block px-2 py-0.5 bg-blue-50 text-[#0E3589] text-[10px] font-bold rounded-md">
                                    Age: {String(booking.age || '').replace(/\s*(years?|yrs)\b/gi, '').trim() || 'N/A'} yrs
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                    booking.modeOfLearning === 'Online'
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {booking.modeOfLearning === 'Online' ? '💻 Online' : '🏫 In-person'}
                                  </span>
                                </div>
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

                          {/* Preferred Date & Timeslot */}
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-[#0E3589] rounded-lg font-bold text-xs">
                                <Calendar className="w-3.5 h-3.5 text-[#0E3589]" />
                                <span>{booking.preferredDate}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-700 text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5 text-[#F46E20]" />
                                <span>{booking.preferredTimeSlot}</span>
                              </div>
                            </div>
                          </td>

                          {/* Booking Status Dropdown */}
                          <td className="py-4 px-4">
                            <Select
                              value={booking.status}
                              onChange={(e) => handleUpdateBookingStatus(booking.id, e.target.value as any)}
                              className={`font-bold ${
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
                            </Select>
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedBookingForNotes(booking);
                                  setBookingNotesText(booking.notes || '');
                                }}
                                title="Add Assessment Note"
                                className="p-2 bg-blue-50 hover:bg-blue-100 text-[#0E3589] rounded-xl"
                                aria-label="Add Assessment Note"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>

                              {/* Fast-Track Enroll */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  onNavigate('enroll', undefined, 'alerts', {
                                    studentName: booking.studentName,
                                    parentName: booking.parentName,
                                    contactNumber: booking.contactNumber,
                                    age: String(booking.age || '').replace(/\s*(years?|yrs)\b/gi, '').trim(),
                                    modeOfLearning: booking.modeOfLearning,
                                    notes: booking.notes,
                                    fromDemoBookingId: booking.id,
                                  });
                                }}
                                title="Fast-Track Enroll this Student"
                                className="p-2 bg-orange-50 hover:bg-orange-100 text-[#F46E20] rounded-xl"
                                aria-label="Fast-Track Enroll this Student"
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setBookingToDelete(booking)}
                                title="Delete Inquiry"
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl"
                                aria-label="Delete Inquiry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

      {/* Booking Assessment Notes Editor Modal */}
      {selectedBookingForNotes && (
      <Modal
        isOpen={Boolean(selectedBookingForNotes)}
        onClose={() => setSelectedBookingForNotes(null)}
        size="lg"
        showCloseButton={false}
      >
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#0E3589]">
                <Edit2 className="w-5 h-5 text-[#F46E20]" />
                <h3 className="font-extrabold text-sm sm:text-base">Demo Assessment Notes &amp; Comments</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBookingForNotes(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 min-h-[32px] min-w-[32px]"
                aria-label="Close"
              >
                ✕
              </Button>
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-[#0E3589] font-black text-sm">{selectedBookingForNotes.studentName}</span>
                <span className="text-slate-600">Age: {String(selectedBookingForNotes.age || '').replace(/\s*(years?|yrs)\b/gi, '').trim() || 'N/A'} yrs</span>
              </div>
              <p className="text-slate-600">
                Parent: <strong className="text-slate-900">{selectedBookingForNotes.parentName || 'N/A'}</strong> • Contact: <strong className="text-slate-900">{selectedBookingForNotes.contactNumber}</strong>
              </p>
              <p className="text-slate-600">
                Scheduled Demo: <strong className="text-slate-900">{selectedBookingForNotes.preferredDate} ({selectedBookingForNotes.preferredTimeSlot})</strong> • {selectedBookingForNotes.modeOfLearning === 'Online' ? 'Online' : 'In-person'}
              </p>
            </div>

            <form onSubmit={handleSaveBookingNotes} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  Parent Remarks &amp; Coach Assessment Notes
                </label>
                <Textarea
                  rows={5}
                  value={bookingNotesText}
                  onChange={(e) => setBookingNotesText(e.target.value)}
                  placeholder="Enter full parent discussion notes, diagnostic observations, handwriting style concerns, or demo evaluation feedback here..."
                  className="leading-relaxed"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Notes entered here are fully accessible whenever you open this note editor, without truncation.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedBookingForNotes(null)}
                  className="w-1/3 py-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-2/3 py-2.5"
                >
                  Save Assessment Notes
                </Button>
              </div>
            </form>
        </div>
      </Modal>
      )}

      {/* Delete Demo Booking Inquiry Confirmation Modal */}
      {bookingToDelete && (
      <Modal
        isOpen={Boolean(bookingToDelete)}
        onClose={() => setBookingToDelete(null)}
        size="md"
        showCloseButton={false}
      >
        <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">Delete Booking Inquiry</h3>
                <p className="text-xs text-slate-500">This action permanently deletes this record.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-1">
              <p>
                Student: <strong className="text-slate-900">{bookingToDelete.studentName}</strong> (Age {String(bookingToDelete.age || '').replace(/\s*(years?|yrs)\b/gi, '').trim() || 'N/A'} yrs)
              </p>
              <p>
                Parent: <strong className="text-slate-900">{bookingToDelete.parentName || 'N/A'}</strong> • Contact: <strong className="text-slate-900">{bookingToDelete.contactNumber}</strong>
              </p>
              <p>
                Scheduled: <strong className="text-slate-900">{bookingToDelete.preferredDate} ({bookingToDelete.preferredTimeSlot})</strong>
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this demo inquiry? All associated alerts will also be cleaned up.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                disabled={isDeletingBooking}
                onClick={() => setBookingToDelete(null)}
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isDeletingBooking}
                isLoading={isDeletingBooking}
                onClick={() => handleDeleteBooking(bookingToDelete.id)}
                className="px-4 py-2"
                leftIcon={!isDeletingBooking ? <Trash2 className="w-3.5 h-3.5" /> : undefined}
              >
                Delete Inquiry
              </Button>
            </div>
        </div>
      </Modal>
      )}

      {/* Quick Attendance Modal */}
      {quickAttendanceStudent && (
      <Modal
        isOpen={Boolean(quickAttendanceStudent)}
        onClose={() => setQuickAttendanceStudent(null)}
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
                onClick={() => setQuickAttendanceStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 min-h-[32px] min-w-[32px]"
                aria-label="Close"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-slate-600">
              Recording session for <strong className="text-slate-900">{quickAttendanceStudent.displayName}</strong>
            </p>

            <form onSubmit={handleQuickAttendanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <Input
                  type="date"
                  required
                  value={quickAttendanceDate}
                  onChange={(e) => setQuickAttendanceDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Present', 'Absent', 'Late'] as const).map((st) => (
                    <Button
                      key={st}
                      type="button"
                      variant={quickAttendanceStatus === st ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setQuickAttendanceStatus(st)}
                      className={`py-2 text-xs font-bold rounded-xl ${
                        quickAttendanceStatus === st
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
                  onClick={() => setQuickAttendanceStudent(null)}
                  className="w-1/3 py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingAttendance}
                  disabled={isSubmittingAttendance}
                  className="w-2/3 py-2"
                >
                  {isSubmittingAttendance ? 'Saving...' : 'Confirm Attendance'}
                </Button>
              </div>
            </form>
        </div>
      </Modal>
      )}

      {/* Quick Fee Modal */}
      {quickFeeStudent && (
      <Modal
        isOpen={Boolean(quickFeeStudent)}
        onClose={() => setQuickFeeStudent(null)}
        size="md"
        showCloseButton={false}
      >
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-800">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm">Issue 8-Class Fee Receipt (₹1,600)</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuickFeeStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 min-h-[32px] min-w-[32px]"
                aria-label="Close"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-slate-600">
              Recording payment receipt for <strong className="text-slate-900">{quickFeeStudent.displayName}</strong>
            </p>

            <form onSubmit={handleQuickFeeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fee Milestone / Month</label>
                <Input
                  type="text"
                  required
                  value={quickFeePeriod}
                  onChange={(e) => setQuickFeePeriod(e.target.value)}
                  placeholder="e.g. August 2026 or September Milestone"
                  className="font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Number</label>
                <Input
                  type="text"
                  value={quickFeeReceiptNo}
                  onChange={(e) => setQuickFeeReceiptNo(e.target.value)}
                  placeholder="e.g. REC-101-C1"
                  className="font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹ INR)</label>
                <Input
                  type="number"
                  required
                  value={quickFeeAmount}
                  onChange={(e) => setQuickFeeAmount(Number(e.target.value))}
                  className="font-bold text-emerald-800"
                  id="input-quick-fee-amount"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <Input
                  type="text"
                  value={quickFeeNotes}
                  onChange={(e) => setQuickFeeNotes(e.target.value)}
                  placeholder="e.g. In-Person Cash / UPI Reference / Bank Transfer details"
                  className="font-medium text-slate-900"
                  id="input-quick-fee-notes"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setQuickFeeStudent(null)}
                  className="w-1/3 py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingFee}
                  disabled={isSubmittingFee}
                  className="w-2/3 py-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSubmittingFee ? 'Saving...' : 'Issue & Mark Paid (₹1,600)'}
                </Button>
              </div>
            </form>
        </div>
      </Modal>
      )}

      {/* Edit Coach Profile Modal */}
      {editingCoach && editCoachForm && (
      <Modal
        isOpen={Boolean(editingCoach && editCoachForm)}
        onClose={() => {
          setEditingCoach(null);
          setEditCoachForm(null);
        }}
        size="2xl"
        showCloseButton={false}
      >
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-[#0E3589]">
                <Edit2 className="w-5 h-5" />
                <div>
                  <h3 className="font-black text-base text-slate-900">Edit Coach Profile</h3>
                  <p className="text-xs text-slate-500">{editingCoach.displayName} ({editingCoach.email})</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setEditingCoach(null);
                  setEditCoachForm(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 min-h-[32px] min-w-[32px]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleUpdateCoach} className="space-y-4">
              {/* Inline Edit Error Alert */}
              {editCoachError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-2xl flex items-start gap-2.5 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-red-900">Update Error</p>
                    <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{editCoachError}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditCoachError(null)}
                    className="text-red-500 hover:text-red-800 text-xs font-bold p-1 min-h-[32px] min-w-[32px]"
                  >
                    ×
                  </Button>
                </div>
              )}

              {/* Name Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={editCoachForm.firstName}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={editCoachForm.lastName}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  value={editCoachForm.displayName}
                  onChange={(e) => setEditCoachForm({ ...editCoachForm, displayName: e.target.value })}
                  placeholder="e.g. Deepthy Rock"
                />
              </div>

              {/* Contact Section - Email and Phone in one row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    value={editCoachForm.email}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Primary Phone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    required
                    value={editCoachForm.phoneNumber}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, phoneNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Role & Qualification */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Designation
                    </label>
                    <Select
                      value={editCoachForm.designation}
                      onChange={(e) => setEditCoachForm({ ...editCoachForm, designation: e.target.value })}
                      className="font-bold"
                    >
                      <option value="Principal Tutor">Principal Tutor (Master Instructor)</option>
                      <option value="Executive Tutor">Executive Tutor (Senior Coach)</option>
                      <option value="Senior Master Coach">Senior Master Coach</option>
                      <option value="Associate Tutor">Associate Tutor (Junior Coach)</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Status
                    </label>
                    <Select
                      value={editCoachForm.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as 'Active' | 'Inactive';
                        setEditCoachForm({
                          ...editCoachForm,
                          status: newStatus,
                          dateOfLeaving: newStatus === 'Inactive' && !editCoachForm.dateOfLeaving
                            ? new Date().toISOString().split('T')[0]
                            : newStatus === 'Active'
                            ? ''
                            : editCoachForm.dateOfLeaving
                        });
                      }}
                      className="font-bold"
                      id="select-edit-coach-status"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Educational Qualification
                  </label>
                  <Input
                    type="text"
                    value={editCoachForm.educationalQualification}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, educationalQualification: e.target.value })}
                    placeholder="e.g. M.Ed, Certified Master Calligrapher"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Date of Joining
                    </label>
                    <Input
                      type="date"
                      value={editCoachForm.dateOfJoining}
                      onChange={(e) => setEditCoachForm({ ...editCoachForm, dateOfJoining: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Date of Leaving <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <Input
                      type="date"
                      min={editCoachForm.dateOfJoining || undefined}
                      value={editCoachForm.dateOfLeaving}
                      onChange={(e) => setEditCoachForm({ ...editCoachForm, dateOfLeaving: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Residential / Communication Address
                </label>
                <Textarea
                  rows={2}
                  value={editCoachForm.address}
                  onChange={(e) => setEditCoachForm({ ...editCoachForm, address: e.target.value })}
                  placeholder="Address details..."
                  className="resize-none"
                />
              </div>

              {/* Specializations */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Specializations & Teaching Focus
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Cursive Writing',
                    'Print Script Mastery',
                    'Speed Enhancement',
                    'Motor Grip Correction',
                    'Devanagari / Hindi',
                    'Dysgraphia Support',
                    'Exam Presentation'
                  ].map((spec) => {
                    const isSelected = editCoachForm.specializations.includes(spec);
                    return (
                      <Button
                        type="button"
                        key={spec}
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => toggleEditSpecialization(spec)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isSelected
                            ? 'bg-[#0E3589] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {spec} {isSelected ? '✓' : '+'}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emergency Contact Person
                  </label>
                  <Input
                    type="text"
                    value={editCoachForm.emergencyContactName}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, emergencyContactName: e.target.value })}
                    placeholder="e.g. Spouse / Relative"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emergency Phone
                  </label>
                  <Input
                    type="tel"
                    value={editCoachForm.emergencyContactPhone}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, emergencyContactPhone: e.target.value })}
                    placeholder="e.g. 9845012345"
                  />
                </div>
              </div>

              {/* Bio / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Professional Notes / Bio
                </label>
                <Input
                  type="text"
                  value={editCoachForm.notes}
                  onChange={(e) => setEditCoachForm({ ...editCoachForm, notes: e.target.value })}
                  placeholder="e.g. Senior tutor notes..."
                />
              </div>

              {/* Password update option */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reset Password <span className="text-slate-400 font-normal">(Leave blank to keep existing password)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    type="text"
                    value={editCoachForm.password}
                    onChange={(e) => setEditCoachForm({ ...editCoachForm, password: e.target.value })}
                    placeholder="Enter new password (min 8 chars)"
                    className="pl-9 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingCoach(null);
                    setEditCoachForm(null);
                  }}
                  className="w-1/3 py-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUpdatingCoach}
                  disabled={isUpdatingCoach}
                  className="w-2/3 py-2.5"
                  leftIcon={!isUpdatingCoach ? <Check className="w-4 h-4" /> : undefined}
                >
                  {isUpdatingCoach ? 'Saving Changes...' : 'Save Coach Profile'}
                </Button>
              </div>
            </form>
        </div>
      </Modal>
      )}
    </div>
  );
};
