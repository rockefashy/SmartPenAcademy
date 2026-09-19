import React from 'react';
import {
  ShieldCheck,
  UserCheck,
  BadgeAlert,
  Search,
  Users,
  Phone,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Button, Input, Select, StatCard } from '../../ui';
import { Avatar } from '../../ui/Avatar';
import { StudentProfile, CoachProfile } from '../../../types';
import { formatGradeClass } from '../../../utils/formatters';
import { calculateStudentCycleStatus } from '../../../utils/cycleCalculations';

interface CoachAssignmentTabProps {
  students: StudentProfile[];
  allStudents: StudentProfile[];
  coaches: CoachProfile[];
  assignmentSearch: string;
  setAssignmentSearch: (query: string) => void;
  assignmentStatusFilter: 'All' | 'Assigned' | 'Unassigned';
  setAssignmentStatusFilter: (status: 'All' | 'Assigned' | 'Unassigned') => void;
  assignmentCoachFilter: string;
  setAssignmentCoachFilter: (coachId: string) => void;
  assignedStudentsCount: number;
  unassignedStudentsCount: number;
  updatingStudentCoachId: string | null;
  onAssignCoach: (studentId: string, coachId: string | null) => Promise<void>;
  onNavigate: (view: string, studentId?: string, defaultSection?: any) => void;
}

export const CoachAssignmentTab: React.FC<CoachAssignmentTabProps> = ({
  students,
  allStudents,
  coaches,
  assignmentSearch,
  setAssignmentSearch,
  assignmentStatusFilter,
  setAssignmentStatusFilter,
  assignmentCoachFilter,
  setAssignmentCoachFilter,
  assignedStudentsCount,
  unassignedStudentsCount,
  updatingStudentCoachId,
  onAssignCoach,
  onNavigate,
}) => {
  return (
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
              <option value="All">All Students ({allStudents.length})</option>
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
                <option key={c.id} value={c.id}>
                  Coach {c.firstName} ({c.studentCount || 0} students)
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>Showing <strong>{students.length}</strong> students</span>
          <span>Select any coach from the dropdown to instantly reassign</span>
        </div>
      </div>

      {/* Students Assignment Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-md">
        {students.length === 0 ? (
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
                {students.map((student) => {
                  const isUpdating = updatingStudentCoachId === student.id;
                  const { attendedCount } = calculateStudentCycleStatus(
                    student,
                    student.attendanceHistory,
                    student.feeHistory
                  );

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
                              {student.gradeClass ? `${formatGradeClass(student.gradeClass)} • ` : ''}
                              {student.schoolName}
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
                            <a href={`tel:${student.whatsappMobile}`} className="hover:underline">
                              {student.whatsappMobile}
                            </a>
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
                              onAssignCoach(student.id, val ? val : null);
                            }}
                          >
                            <option value="">-- No Coach Assigned --</option>
                            {coaches.map((c) => (
                              <option key={c.id} value={c.id}>
                                Coach {c.firstName} ({c.designation})
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
  );
};
