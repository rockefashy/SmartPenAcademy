import { DemoBooking, AdminAlert } from '../../src/types';
import { getSupabase, applyRowCeiling } from './client.ts';
import { mapAlertRow } from './alerts.db.ts';

export function mapDemoBookingRow(row: any): DemoBooking {
  const cleanAge = String(row.student_age !== undefined && row.student_age !== null ? row.student_age : '').replace(/\s*(years?|yrs)\b/gi, '').trim();

  return {
    id: row.id,
    studentName: row.student_name || '',
    parentName: row.parent_name || '',
    studentAge: Number(row.student_age) || 0,
    age: cleanAge,
    contactNumber: row.parent_phone || '',
    preferredDate: row.preferred_date || '',
    preferredTimeSlot: row.preferred_time_slot || '',
    modeOfLearning: (row.mode_of_learning === 'Online' ? 'Online' : 'In-person') as 'Online' | 'In-person',
    status: row.status || 'New',
    notes: row.parent_notes || row.coach_notes || '',
    createdAt: row.created_at || ''
  };
}

export class DemoBookingsDatabase {
  async getDemoBookings(): Promise<DemoBooking[]> {
    const supabase = getSupabase();
    const { data, error } = await applyRowCeiling(
      supabase
        .from('demo_bookings')
        .select('*')
        .order('created_at', { ascending: false })
    );

    if (error) {
      throw new Error(`Failed to fetch demo bookings: ${error.message}`);
    }
    return (data || []).map(mapDemoBookingRow);
  }

  async createDemoBooking(booking: any): Promise<{ booking: DemoBooking; alert: AdminAlert }> {
    const supabase = getSupabase();

    // Strict requirement validation without silent fallbacks
    const childName = booking.studentName?.trim();
    const parentName = booking.parentName?.trim();
    const contactNumber = booking.contactNumber?.trim();
    const ageStr = String(booking.age || '').replace(/\D/g, '');
    const preferredDate = booking.preferredDate?.trim();
    const preferredTimeSlot = booking.preferredTimeSlot?.trim();

    if (!childName) throw new Error("Student name is required for demo booking.");
    if (!parentName) throw new Error("Parent name is required for demo booking.");
    if (!contactNumber) throw new Error("Contact number is required for demo booking.");
    if (!ageStr) throw new Error("Valid child age is required for demo booking.");
    if (!preferredDate) throw new Error("Preferred date is required for demo booking.");
    if (!preferredTimeSlot) throw new Error("Preferred time slot is required for demo booking.");

    const id = crypto.randomUUID();
    const ageNum = parseInt(ageStr, 10);

    const row: any = {
      id,
      student_name: childName,
      student_age: ageNum,
      parent_name: parentName,
      parent_phone: contactNumber,
      preferred_date: preferredDate,
      preferred_time_slot: preferredTimeSlot,
      mode_of_learning: booking.modeOfLearning === 'Online' ? 'Online' : 'In-person',
      status: booking.status || 'Scheduled',
      parent_notes: booking.notes?.trim() || null,
      coach_notes: booking.notes?.trim() || null,
      created_at: new Date().toISOString()
    };

    const { data: bookingData, error: bookingError } = await supabase
      .from('demo_bookings')
      .insert(row)
      .select()
      .single();

    if (bookingError) {
      throw new Error(`Failed to create demo booking: ${bookingError.message}`);
    }

    // Create system alert for admin
    const alertId = crypto.randomUUID();
    const alertRow = {
      id: alertId,
      title: `New Demo Booking: ${childName}`,
      message: `Parent: ${parentName}, Phone: ${contactNumber}, Age: ${ageStr}, Mode: ${booking.modeOfLearning || 'In-person'}, Date: ${preferredDate}, Time: ${preferredTimeSlot}`,
      alert_type: 'demo_booking',
      target_audience: 'admin',
      is_read: false,
      created_at: new Date().toISOString()
    };

    const { data: alertData, error: alertError } = await supabase
      .from('alerts')
      .insert(alertRow)
      .select()
      .single();

    if (alertError) {
      console.warn(`[DemoBookingsDatabase] Warning creating alert for demo booking: ${alertError.message}`);
    }

    return {
      booking: mapDemoBookingRow(bookingData),
      alert: alertData ? mapAlertRow(alertData) : {
        id: alertId,
        title: alertRow.title,
        message: alertRow.message,
        type: 'demo_booking',
        isRead: false,
        createdAt: alertRow.created_at
      }
    };
  }

  async updateDemoBooking(id: string, updates: Partial<DemoBooking>): Promise<DemoBooking | null> {
    const supabase = getSupabase();
    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.studentName !== undefined) updateData.student_name = updates.studentName;
    if (updates.notes !== undefined) {
      updateData.coach_notes = updates.notes;
      updateData.parent_notes = updates.notes;
    }
    if (updates.preferredDate !== undefined) updateData.preferred_date = updates.preferredDate;
    if (updates.preferredTimeSlot !== undefined) updateData.preferred_time_slot = updates.preferredTimeSlot;
    if (updates.modeOfLearning !== undefined) updateData.mode_of_learning = updates.modeOfLearning;

    const { data, error } = await supabase
      .from('demo_bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update demo booking ${id}: ${error.message}`);
    }

    return data ? mapDemoBookingRow(data) : null;
  }

  async deleteDemoBooking(id: string): Promise<void> {
    const supabase = getSupabase();
    // Attempt to delete any associated demo alert
    try {
      const escapedId = id.replace(/[%_\\]/g, '\\$&');
      await supabase.from('alerts').delete().ilike('action_url', `%${escapedId}%`);
    } catch {
      // ignore if not found
    }

    const { error } = await supabase
      .from('demo_bookings')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete demo booking: ${error.message}`);
    }
  }
}

export const demoBookingsDb = new DemoBookingsDatabase();
