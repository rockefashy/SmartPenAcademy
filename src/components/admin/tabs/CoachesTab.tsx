import React from 'react';
import {
  UserPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  GraduationCap,
  Edit2,
  UserX,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
} from 'lucide-react';
import { Button, Input, Select } from '../../ui';
import { Avatar } from '../../ui/Avatar';
import { CoachProfile, ROLES } from '../../../types';

interface CoachesTabProps {
  coaches: CoachProfile[];
  coachesLoading: boolean;
  coachSearchQuery: string;
  setCoachSearchQuery: (query: string) => void;
  coachStatusFilter: 'All' | 'Active' | 'Inactive';
  setCoachStatusFilter: (status: 'All' | 'Active' | 'Inactive') => void;
  coachDesignationFilter: string;
  setCoachDesignationFilter: (designation: string) => void;
  deletingCoachId: string | null;
  isAdmin: boolean;
  onRefresh: () => void;
  onEnrollCoach: () => void;
  onEditCoach: (coach: CoachProfile) => void;
  onToggleStatus: (coach: CoachProfile) => void;
  onAssignStudents: (coachId: string) => void;
}

export const CoachesTab: React.FC<CoachesTabProps> = ({
  coaches,
  coachesLoading,
  coachSearchQuery,
  setCoachSearchQuery,
  coachStatusFilter,
  setCoachStatusFilter,
  coachDesignationFilter,
  setCoachDesignationFilter,
  deletingCoachId,
  isAdmin,
  onRefresh,
  onEnrollCoach,
  onEditCoach,
  onToggleStatus,
  onAssignStudents,
}) => {
  const filtered = coaches.filter((c) => {
    const matchSearch =
      coachSearchQuery === '' ||
      c.firstName.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
      c.phoneNumber.includes(coachSearchQuery) ||
      (c.educationalQualification &&
        c.educationalQualification.toLowerCase().includes(coachSearchQuery.toLowerCase())) ||
      (c.specializations &&
        c.specializations.some((s) => s.toLowerCase().includes(coachSearchQuery.toLowerCase())));
    const matchStatus = coachStatusFilter === 'All' || (c.status || 'Active') === coachStatusFilter;
    const matchDesignation =
      coachDesignationFilter === 'All' || c.designation === coachDesignationFilter;
    return matchSearch && matchStatus && matchDesignation;
  });

  return (
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
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={onEnrollCoach}
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
              onClick={onRefresh}
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
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-2xl">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">No coaches match your filters</p>
            <p className="text-xs text-slate-400">Try adjusting your search keywords or status filter.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filtered.map((coach) => {
              const isCurrentUserAdminMatch =
                coach.designation?.toLowerCase().includes('principal') || coach.role === ROLES.ADMIN;
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
                        <Avatar name={coach.firstName} size="lg" />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            isInactive ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                          title={isInactive ? 'Inactive' : 'Active'}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-black text-sm text-slate-900">{coach.firstName}</h3>
                          {isCurrentUserAdminMatch && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-orange-100 text-[#F46E20] border border-orange-200">
                              Admin
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100/70 text-[#0E3589]">
                            {coach.designation || 'Tutor'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              isInactive
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-800'
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

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 self-end sm:self-start">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditCoach(coach)}
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
                          onClick={() => onToggleStatus(coach)}
                          title={
                            coach.status === 'Active'
                              ? 'Deactivate Coach (Soft Delete)'
                              : 'Reactivate Coach'
                          }
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
                    )}
                  </div>

                  {/* Contact & Date Details Grid */}
                  <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a
                        href={`mailto:${coach.email}`}
                        className="truncate hover:text-[#0E3589] hover:underline"
                      >
                        {coach.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a
                        href={`tel:${coach.phoneNumber}`}
                        className="hover:text-[#0E3589] hover:underline font-semibold"
                      >
                        {coach.phoneNumber}
                      </a>
                    </div>
                    {coach.dateOfJoining && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Joined: <strong>{coach.dateOfJoining}</strong>
                        </span>
                        {coach.dateOfLeaving && (
                          <span className="text-rose-600 font-semibold">
                            (Left: {coach.dateOfLeaving})
                          </span>
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
                        <span
                          key={spec}
                          className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-md text-[10px] font-semibold"
                        >
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

                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAssignStudents(coach.id)}
                        className="text-[11px] font-bold text-[#0E3589] hover:underline p-1 min-h-[32px]"
                        rightIcon={<ChevronRight className="w-3 h-3" />}
                      >
                        Assign Students
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Information Callout - Admin only */}
        {isAdmin && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">🔑 How Coach Authentication Works</p>
            <p>
              When coaches log in on the Smartpen portal, they choose <strong>Coach / Tutor</strong>{' '}
              role and provide their email or phone number along with their password. They will only see
              the assessment and attendance records for the students specifically assigned to them by the
              Admin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
