import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Layers,
  BellRing,
  Download,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../components/ui';
import { StudentProfile, CoachProfile, DemoBooking } from '../types';
import { adminProperties } from '../properties/admin.properties';
import { EnrollmentPage } from './EnrollmentPage';

// Modular Admin Components
import { useAdminDashboardData } from '../components/admin/hooks/useAdminDashboardData';
import {
  StudentsTab,
  CoachAssignmentTab,
  CoachesTab,
  CoachEnrollmentTab,
  AlertsTab,
  TestimonialsTab,
} from '../components/admin/tabs';
import {
  QuickAttendanceModal,
  QuickFeeModal,
  QuickCoachAssignModal,
  EditCoachModal,
  BookingNotesModal,
  DeleteBookingModal,
  EnrolledCoachSuccessModal,
} from '../components/admin/modals';

interface AdminDashboardPageProps {
  onNavigate: (view: string, studentId?: string, defaultSection?: any, prefillData?: any) => void;
  initialTab?: 'roster' | 'assignment' | 'coaches' | 'coachEnrollment' | 'studentEnrollment' | 'alerts' | 'testimonials';
  initialPrefillData?: any;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onNavigate,
  initialTab,
  initialPrefillData,
}) => {
  const data = useAdminDashboardData();
  const { user, isAdmin, isCoach } = data;

  // Active Tab & Sub-Screen Routing
  const [activeTab, setActiveTab] = useState<
    'roster' | 'assignment' | 'coaches' | 'coachEnrollment' | 'studentEnrollment' | 'alerts' | 'testimonials'
  >(initialTab || 'roster');

  // Student Enrollment / Edit Sub-Screen State
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [enrollmentPrefillData, setEnrollmentPrefillData] = useState<any | null>(
    initialPrefillData || null
  );

  // Modals Local State
  const [quickAttendanceStudent, setQuickAttendanceStudent] = useState<StudentProfile | null>(null);
  const [quickFeeStudent, setQuickFeeStudent] = useState<StudentProfile | null>(null);
  const [quickFeeDefaultCycle, setQuickFeeDefaultCycle] = useState<string | undefined>();
  const [quickCoachAssignStudent, setQuickCoachAssignStudent] = useState<StudentProfile | null>(null);
  const [editingCoach, setEditingCoach] = useState<CoachProfile | null>(null);
  const [selectedBookingForNotes, setSelectedBookingForNotes] = useState<DemoBooking | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<DemoBooking | null>(null);
  const [enrolledCoachSuccess, setEnrolledCoachSuccess] = useState<{
    name: string;
    designation: string;
    email: string;
    phoneNumber: string;
  } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (initialTab === 'studentEnrollment' && initialPrefillData) {
        setEnrollmentPrefillData(initialPrefillData);
        setEditingStudent(null);
      }
    }
  }, [initialTab, initialPrefillData]);

  const handleEnrollSibling = (student: StudentProfile) => {
    setEditingStudent(null);
    setEnrollmentPrefillData({
      isSiblingEnrollment: true,
      siblingOfStudentId: student.id,
      siblingOfStudentName: student.firstName,
      parentName: student.parentName,
      contactNumber:
        student.whatsappMobile ||
        student.emergencyContactPhone ||
        (student as any).phone ||
        '',
      email: student.email || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone:
        student.emergencyContactPhone || (student as any).emergencyPhone || '',
      residentialArea: student.residentialArea || '',
    });
    setActiveTab('studentEnrollment');
  };

  const handleOpenQuickFee = (student: StudentProfile, defaultCycle?: string) => {
    setQuickFeeStudent(student);
    setQuickFeeDefaultCycle(defaultCycle);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {adminProperties.header.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isCoach
              ? `Coach Command Center • Signed in as Coach ${user?.name || ''}`
              : adminProperties.header.subtitle}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setActiveTab('coachEnrollment')}
              variant="outline"
              size="sm"
              id="btn-admin-enroll-coach"
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs font-bold"
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
      {data.notificationBanner && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{data.notificationBanner}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => data.setNotificationBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 underline h-auto p-1"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {data.errorMessageBanner && (
        <div className="p-4 bg-red-50 border-2 border-red-300 text-red-800 text-xs font-bold rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{data.errorMessageBanner}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => data.setErrorMessageBanner(null)}
            className="text-red-700 hover:text-red-950 underline h-auto p-1"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Module Navigation Tabs */}
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
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                activeTab === 'roster' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#0E3589]'
              }`}
            >
              {data.students.length}
            </span>
          </Button>

          {/* Coach Directory Tab */}
          <Button
            onClick={() => {
              setActiveTab('coaches');
              data.loadCoaches();
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
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                activeTab === 'coaches' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {data.coaches.length}
            </span>
          </Button>

          {isAdmin && (
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
                  {data.unassignedStudentsCount > 0 ? (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full mt-0.5 ${
                        activeTab === 'assignment'
                          ? 'bg-amber-400 text-slate-900'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {data.unassignedStudentsCount} Unassigned
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                        activeTab === 'assignment'
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      All Assigned
                    </span>
                  )}
                </div>
              </Button>

              <Button
                onClick={() => {
                  setActiveTab('alerts');
                  data.loadAlertsAndBookings();
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
                {(data.unreadAlertsCount > 0 || data.newBookingsCount > 0) && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-extrabold animate-pulse shrink-0 ${
                      activeTab === 'alerts' ? 'bg-white text-[#F46E20]' : 'bg-red-500 text-white'
                    }`}
                  >
                    {data.newBookingsCount > 0
                      ? `${data.newBookingsCount} New`
                      : data.unreadAlertsCount}
                  </span>
                )}
              </Button>

              {/* Testimonial & Review Moderation Tab */}
              <Button
                onClick={() => setActiveTab('testimonials')}
                variant="ghost"
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto ${
                  activeTab === 'testimonials'
                    ? 'bg-[#0E3589] text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                id="tab-btn-admin-testimonials"
              >
                <MessageSquare className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Reviews</span>
              </Button>
            </>
          )}
        </div>

        <Button
          onClick={data.handleExportCSV}
          variant="outline"
          size="sm"
          id="btn-export-excel"
          title="Export Roster (CSV)"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">{adminProperties.header.exportExcelBtn}</span>
        </Button>
      </div>

      {/* Screen 1: Student Roster View */}
      {activeTab === 'roster' && (
        <StudentsTab
          students={data.filteredStudents}
          allStudents={data.students}
          coaches={data.coaches}
          isLoading={data.isLoading}
          searchQuery={data.searchQuery}
          setSearchQuery={data.setSearchQuery}
          statusFilter={data.statusFilter}
          setStatusFilter={data.setStatusFilter}
          gradeFilter={data.gradeFilter}
          setGradeFilter={data.setGradeFilter}
          timingFilter={data.timingFilter}
          setTimingFilter={data.setTimingFilter}
          rosterCoachFilter={data.rosterCoachFilter}
          setRosterCoachFilter={data.setRosterCoachFilter}
          sortBy={data.sortBy}
          setSortBy={data.setSortBy}
          sortOrder={data.sortOrder}
          setSortOrder={data.setSortOrder}
          uniqueGrades={data.uniqueGrades}
          uniqueTimings={data.uniqueTimings}
          unassignedStudentsCount={data.unassignedStudentsCount}
          isAdmin={isAdmin}
          isCoach={isCoach}
          onNavigate={onNavigate}
          onMarkAttendance={(student) => setQuickAttendanceStudent(student)}
          onCollectFee={(student) => handleOpenQuickFee(student)}
          onEditStudent={(student) => {
            setEditingStudent(student);
            setEnrollmentPrefillData(null);
            setActiveTab('studentEnrollment');
          }}
          onAddSibling={handleEnrollSibling}
          onAssignCoachModal={(student) => setQuickCoachAssignStudent(student)}
          onToggleStatus={data.handleToggleStudentStatus}
        />
      )}

      {/* Screen 2: Coach Assignment Screen */}
      {activeTab === 'assignment' && (
        <CoachAssignmentTab
          students={data.assignmentStudents}
          allStudents={data.activeStudents}
          coaches={data.coaches}
          assignmentSearch={data.assignmentSearch}
          setAssignmentSearch={data.setAssignmentSearch}
          assignmentStatusFilter={data.assignmentStatusFilter}
          setAssignmentStatusFilter={data.setAssignmentStatusFilter}
          assignmentCoachFilter={data.assignmentCoachFilter}
          setAssignmentCoachFilter={data.setAssignmentCoachFilter}
          assignedStudentsCount={data.assignedStudentsCount}
          unassignedStudentsCount={data.unassignedStudentsCount}
          updatingStudentCoachId={data.updatingStudentCoachId}
          onAssignCoach={data.handleAssignCoach}
          onNavigate={onNavigate}
        />
      )}

      {/* Screen 3: Embedded Student Enrollment & Edit Screen */}
      {activeTab === 'studentEnrollment' && isAdmin && (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
          <EnrollmentPage
            mode={editingStudent ? 'edit' : 'enroll'}
            studentToEdit={editingStudent}
            initialData={enrollmentPrefillData}
            onSuccess={(student, isEdit) => {
              data.loadStudents();
              data.showNotification(
                isEdit
                  ? `✅ Student profile for ${student?.firstName || 'student'} has been successfully saved! Update notification dispatched to parent & admin.`
                  : `🎉 Student ${student?.firstName || 'student'} has been successfully enrolled! Access credentials dispatched to parent & admin.`
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

      {/* Screen 4: Dedicated Coach Enrollment Screen */}
      {activeTab === 'coachEnrollment' && isAdmin && (
        <CoachEnrollmentTab
          onSuccess={(coachData) => {
            data.loadCoaches();
            setEnrolledCoachSuccess(coachData);
          }}
          onCancel={() => {
            setActiveTab('coaches');
            data.loadCoaches();
          }}
        />
      )}

      {/* Screen 5: Dedicated Coach Directory Screen */}
      {activeTab === 'coaches' && (
        <CoachesTab
          coaches={data.coaches}
          coachesLoading={data.coachesLoading}
          coachSearchQuery={data.coachSearchQuery}
          setCoachSearchQuery={data.setCoachSearchQuery}
          coachStatusFilter={data.coachStatusFilter}
          setCoachStatusFilter={data.setCoachStatusFilter}
          coachDesignationFilter={data.coachDesignationFilter}
          setCoachDesignationFilter={data.setCoachDesignationFilter}
          deletingCoachId={data.deletingCoachId}
          isAdmin={isAdmin}
          onRefresh={data.loadCoaches}
          onEnrollCoach={() => setActiveTab('coachEnrollment')}
          onEditCoach={(coach) => setEditingCoach(coach)}
          onToggleStatus={data.handleToggleCoachStatus}
          onAssignStudents={(coachId) => {
            data.setAssignmentCoachFilter(coachId);
            setActiveTab('assignment');
          }}
        />
      )}

      {/* Screen 6: Alerts & Free Demo Class Bookings */}
      {activeTab === 'alerts' && (
        <AlertsTab
          demoBookings={data.demoBookings}
          filteredBookings={data.filteredBookings}
          alerts={data.alerts}
          alertsLoading={data.alertsLoading}
          alertFilter={data.alertFilter}
          setAlertFilter={data.setAlertFilter}
          unreadAlertsCount={data.unreadAlertsCount}
          newBookingsCount={data.newBookingsCount}
          students={data.students}
          onRefresh={data.loadAlertsAndBookings}
          onMarkAlertRead={data.handleMarkAlertRead}
          onMarkAllAlertsRead={data.handleMarkAllAlertsRead}
          onDeleteAlert={data.handleDeleteAlert}
          onUpdateBookingStatus={data.handleUpdateBookingStatus}
          onOpenBookingNotes={(booking) => setSelectedBookingForNotes(booking)}
          onFastTrackEnroll={(booking) => {
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
          onDeleteBookingPrompt={(booking) => setBookingToDelete(booking)}
          onOpenQuickFee={handleOpenQuickFee}
        />
      )}

      {/* Screen 7: Parent Reviews & Testimonial Moderation */}
      {activeTab === 'testimonials' && isAdmin && (
        <TestimonialsTab />
      )}

      {/* ========================================================================= */}
      {/* MODALS LAYER                                                              */}
      {/* ========================================================================= */}

      {/* Quick Attendance Modal */}
      <QuickAttendanceModal
        student={quickAttendanceStudent}
        onClose={() => setQuickAttendanceStudent(null)}
        onSuccess={(name) => {
          data.showNotification(
            adminProperties.messages.attendanceMarkedSuccess.replace('{name}', name)
          );
          data.loadStudents();
        }}
      />

      {/* Quick Fee Modal */}
      <QuickFeeModal
        student={quickFeeStudent}
        defaultCycle={quickFeeDefaultCycle}
        onClose={() => {
          setQuickFeeStudent(null);
          setQuickFeeDefaultCycle(undefined);
        }}
        onSuccess={(name) => {
          data.showNotification(
            adminProperties.messages.feeMarkedSuccess.replace('{name}', name)
          );
          data.loadStudents();
          data.loadAlertsAndBookings();
        }}
      />

      {/* Quick Coach Assign Modal */}
      <QuickCoachAssignModal
        student={quickCoachAssignStudent}
        coaches={data.coaches}
        onClose={() => setQuickCoachAssignStudent(null)}
        onAssign={async (studentId, coachId) => {
          await data.handleAssignCoach(studentId, coachId);
          setQuickCoachAssignStudent(null);
        }}
      />

      {/* Edit Coach Profile Modal */}
      <EditCoachModal
        coach={editingCoach}
        onClose={() => setEditingCoach(null)}
        onSuccess={(coachName) => {
          data.showNotification(`Coach profile for "${coachName}" updated successfully.`);
          data.loadCoaches();
        }}
      />

      {/* Booking Assessment Notes Modal */}
      <BookingNotesModal
        booking={selectedBookingForNotes}
        onClose={() => setSelectedBookingForNotes(null)}
        onSave={async (id, notes) => {
          await data.handleSaveBookingNotes(id, notes);
        }}
      />

      {/* Delete Demo Booking Inquiry Modal */}
      <DeleteBookingModal
        booking={bookingToDelete}
        onClose={() => setBookingToDelete(null)}
        onConfirm={async (id) => {
          await data.handleDeleteBooking(id);
        }}
      />

      {/* Enrolled Coach Success Modal */}
      <EnrolledCoachSuccessModal
        coachData={enrolledCoachSuccess}
        onClose={() => {
          setEnrolledCoachSuccess(null);
          setActiveTab('coaches');
        }}
        onEnrollAnother={() => {
          setEnrolledCoachSuccess(null);
          setActiveTab('coachEnrollment');
        }}
      />
    </div>
  );
};
