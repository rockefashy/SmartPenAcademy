import React from 'react';
import {
  Search,
  ArrowUpDown,
  Calendar,
  DollarSign,
  Edit3,
  UserPlus,
  Eye,
  GraduationCap,
  Users,
  ShieldCheck,
  BadgeAlert,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { Button, Input, Select } from '../../ui';
import { Avatar } from '../../ui/Avatar';
import { StudentProfile, StudentStatus, CoachProfile, formatPreferredDays } from '../../../types';
import { adminProperties } from '../../../properties/admin.properties';
import { formatGradeClass, formatDominantHand } from '../../../utils/formatters';
import { calculateStudentCycleStatus } from '../../../utils/cycleCalculations';

interface StudentsTabProps {
  students: StudentProfile[];
  allStudents: StudentProfile[];
  coaches: CoachProfile[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: 'All' | StudentStatus;
  setStatusFilter: (status: 'All' | StudentStatus) => void;
  gradeFilter: string;
  setGradeFilter: (grade: string) => void;
  timingFilter: string;
  setTimingFilter: (timing: string) => void;
  rosterCoachFilter: string;
  setRosterCoachFilter: (coachId: string) => void;
  sortBy: 'name' | 'createdDate' | 'modifiedDate' | 'age' | 'grade';
  setSortBy: (sort: 'name' | 'createdDate' | 'modifiedDate' | 'age' | 'grade') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  uniqueGrades: string[];
  uniqueTimings: string[];
  unassignedStudentsCount: number;
  isAdmin: boolean;
  isCoach: boolean;
  onNavigate: (view: string, studentId?: string, defaultSection?: any) => void;
  onMarkAttendance: (student: StudentProfile) => void;
  onCollectFee: (student: StudentProfile) => void;
  onEditStudent: (student: StudentProfile) => void;
  onAddSibling: (student: StudentProfile) => void;
  onAssignCoachModal: (student: StudentProfile) => void;
  onToggleStatus: (student: StudentProfile) => void;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
  allStudents,
  coaches,
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
  uniqueGrades,
  uniqueTimings,
  unassignedStudentsCount,
  isAdmin,
  isCoach,
  onNavigate,
  onMarkAttendance,
  onCollectFee,
  onEditStudent,
  onAddSibling,
  onAssignCoachModal,
  onToggleStatus,
}) => {
  const activeCount = allStudents.filter((s) => s.status === 'Active').length;
  const inactiveCount = allStudents.filter((s) => s.status === 'Inactive').length;

  return (
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
              <option value="All">All Statuses ({allStudents.length})</option>
              <option value="Active">Active ({activeCount})</option>
              <option value="Inactive">Inactive ({inactiveCount})</option>
            </Select>
          </div>

          {/* Coach Filter (Only visible to Admin) */}
          {isAdmin && (
            <div className="md:col-span-2">
              <Select
                value={rosterCoachFilter}
                onChange={(e) => setRosterCoachFilter(e.target.value)}
                id="select-roster-coach"
              >
                <option value="All">All Coaches</option>
                <option value="Unassigned">⚠️ Unassigned ({unassignedStudentsCount})</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>Coach {c.firstName}</option>
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
            Showing <strong className="text-slate-800">{students.length}</strong> of {allStudents.length} students
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
        ) : students.length === 0 ? (
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
                {students.map((student) => {
                  const {
                    cycleSize,
                    cycleFee,
                    attendedCount,
                    currentCycle: currentCycleIndex,
                    currentCycleProgress: cycleProgress,
                    paidCyclesCount,
                    isFeeDue: hasPendingFeeAlert,
                  } = calculateStudentCycleStatus(student, student.attendanceHistory, student.feeHistory);

                  return (
                    <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.firstName} size="md" />
                          <div>
                            <Button
                              variant="ghost"
                              onClick={() => onNavigate('studentDetail', student.id, 1)}
                              className="font-extrabold text-sm text-[#0E3589] hover:underline text-left p-0 h-auto inline-flex"
                            >
                              {student.firstName}
                            </Button>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {student.age ? `Age: ${student.age} yrs • ` : ''}
                              {student.gradeClass ? `${formatGradeClass(student.gradeClass)} • ` : ''}
                              {formatDominantHand(student.dominantHand)} •{' '}
                              <span className="font-semibold text-slate-700">
                                {student.modeOfLearning || 'In-person'}
                              </span>
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
                            <a href={`tel:${student.whatsappMobile}`} className="hover:underline">
                              {student.whatsappMobile}
                            </a>
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
                              {isAdmin && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onAssignCoachModal(student)}
                                  className="text-[10px] text-slate-400 hover:text-[#0E3589] underline p-0 h-auto"
                                >
                                  Change Coach
                                </Button>
                              )}
                            </div>
                          ) : !isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-500">
                              Unassigned
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onAssignCoachModal(student)}
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
                          <p className="font-bold text-slate-800">
                            {formatPreferredDays(student.preferredDays, ' • ') || 'Not set'}
                          </p>
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
                              Cycle {currentCycleIndex} ({cycleProgress}/{cycleSize})
                            </span>
                          </div>
                          <div className="w-28 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                hasPendingFeeAlert ? 'bg-amber-500' : 'bg-[#F46E20]'
                              }`}
                              style={{ width: `${(cycleProgress / cycleSize) * 100}%` }}
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
                            disabled={!isAdmin}
                            onClick={() => isAdmin && onToggleStatus(student)}
                            title={
                              isAdmin
                                ? student.status === 'Active'
                                  ? 'Click to deactivate student'
                                  : 'Click to reactivate student'
                                : 'Student Status'
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold h-auto ${
                              !isAdmin
                                ? 'cursor-default'
                                : 'cursor-pointer hover:shadow-xs hover:scale-105 active:scale-95'
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
                            <span
                              className="text-[10px] text-slate-500 font-medium whitespace-nowrap pl-1"
                              title="Date of Leaving"
                            >
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
                            onClick={() => student.status !== 'Inactive' && onMarkAttendance(student)}
                            title={
                              student.status === 'Inactive'
                                ? 'Attendance disabled: Student is Inactive (Read-Only Archive)'
                                : adminProperties.actions.markAttendance
                            }
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
                            onClick={() => student.status !== 'Inactive' && onCollectFee(student)}
                            title={
                              student.status === 'Inactive'
                                ? 'Fee payment disabled: Student is Inactive (Read-Only Archive)'
                                : hasPendingFeeAlert
                                ? `${cycleSize} Classes Completed • Fee Receipt Due (₹${cycleFee.toLocaleString()})`
                                : adminProperties.actions.markFeePaid
                            }
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
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onEditStudent(student)}
                              title={`Edit Student Details for ${student.firstName}`}
                              className="bg-blue-50 hover:bg-blue-100 text-[#0E3589] border border-blue-200/80 rounded-lg"
                              id={`btn-edit-student-${student.id}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Add a Sibling Quick Action */}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onAddSibling(student)}
                              title={`${adminProperties.actions.addSibling} for ${student.firstName}`}
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
                            title={`Preview Parent Portal for ${student.firstName}`}
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
  );
};
