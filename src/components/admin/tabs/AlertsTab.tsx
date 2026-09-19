import React from 'react';
import {
  Clock,
  AlertCircle,
  CalendarCheck,
  CheckCircle,
  RefreshCw,
  CheckCheck,
  Bell,
  Trash2,
  Sparkles,
  Phone,
  MessageCircle,
  Calendar,
  Edit2,
  UserPlus,
} from 'lucide-react';
import { Button, Select, StatCard } from '../../ui';
import { Avatar } from '../../ui/Avatar';
import { DemoBooking, AdminAlert, StudentProfile } from '../../../types';
import { adminProperties } from '../../../properties/admin.properties';
import { buildWhatsAppUrl } from '../../../utils/whatsapp';

interface AlertsTabProps {
  demoBookings: DemoBooking[];
  filteredBookings: DemoBooking[];
  alerts: AdminAlert[];
  alertsLoading: boolean;
  alertFilter: string;
  setAlertFilter: (filter: string) => void;
  unreadAlertsCount: number;
  newBookingsCount: number;
  students: StudentProfile[];
  onRefresh: () => void;
  onMarkAlertRead: (id: string) => void;
  onMarkAllAlertsRead: () => void;
  onDeleteAlert: (id: string) => void;
  onUpdateBookingStatus: (id: string, newStatus: DemoBooking['status']) => void;
  onOpenBookingNotes: (booking: DemoBooking) => void;
  onFastTrackEnroll: (booking: DemoBooking) => void;
  onDeleteBookingPrompt: (booking: DemoBooking) => void;
  onOpenQuickFee: (student: StudentProfile, cycleLabel?: string) => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  demoBookings,
  filteredBookings,
  alerts,
  alertsLoading,
  alertFilter,
  setAlertFilter,
  unreadAlertsCount,
  newBookingsCount,
  students,
  onRefresh,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onDeleteAlert,
  onUpdateBookingStatus,
  onOpenBookingNotes,
  onFastTrackEnroll,
  onDeleteBookingPrompt,
  onOpenQuickFee,
}) => {
  return (
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
          value={demoBookings.filter((b) => b.status === 'Scheduled').length}
          label={adminProperties.alertsModule.stats.scheduled}
          colorScheme="blue"
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" />}
          value={demoBookings.filter((b) => b.status === 'Enrolled').length}
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
            onClick={onRefresh}
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
              onClick={onMarkAllAlertsRead}
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
              const targetStudent = students.find(
                (s) => s.id === al.studentId || s.displayName === al.metadata?.studentName
              );

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
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isFeeDue ? 'bg-amber-600' : 'bg-[#F46E20]'
                          }`}
                        />
                      )}
                      {isFeeDue && targetStudent && (
                        <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 font-extrabold text-[9px] rounded-md uppercase tracking-wider">
                          {(targetStudent.classesPerCycle || 8)} Classes Fee Due (₹
                          {(targetStudent.feePerCycle || 1600).toLocaleString()})
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
                          onClick={() => onOpenQuickFee(targetStudent, al.metadata?.cycleLabel)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-2xs py-1 px-2.5 min-h-[28px]"
                        >
                          Record ₹{(targetStudent.feePerCycle || 1600).toLocaleString()} Receipt
                        </Button>
                        {targetStudent.whatsappMobile && (
                          <a
                            href={buildWhatsAppUrl(
                              targetStudent.whatsappMobile,
                              `Hello! This is Mrs. Deepthy Rock from SmartPen Handwriting Academy. ${targetStudent.firstName} has completed ${targetStudent.classesPerCycle || 8} classes (${al.metadata?.cycleLabel || `${targetStudent.classesPerCycle || 8} classes`}). The coaching fee of ₹${(targetStudent.feePerCycle || 1600).toLocaleString()} is now due. Please record the payment at your earliest convenience. Thank you!`
                            )}
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
                        onClick={() => onMarkAlertRead(al.id)}
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
                      onClick={() => onDeleteAlert(al.id)}
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
                  const whatsappText = adminProperties.alertsModule.whatsappFollowupText
                    .replace('{name}', booking.studentName)
                    .replace('{date}', booking.preferredDate)
                    .replace('{time}', booking.preferredTimeSlot);
                  const whatsappUrl = buildWhatsAppUrl(booking.contactNumber, whatsappText);

                  return (
                    <tr key={booking.id} className="hover:bg-orange-50/30 transition-colors">
                      {/* Student & Age */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={booking.studentName} size="md" />
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
                              <span
                                className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                  booking.modeOfLearning === 'Online'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
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
                          onChange={(e) =>
                            onUpdateBookingStatus(booking.id, e.target.value as any)
                          }
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
                          <p className="font-semibold">
                            {new Date(booking.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(booking.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Add / Edit Note */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenBookingNotes(booking)}
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
                            onClick={() => onFastTrackEnroll(booking)}
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
                            onClick={() => onDeleteBookingPrompt(booking)}
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
  );
};
