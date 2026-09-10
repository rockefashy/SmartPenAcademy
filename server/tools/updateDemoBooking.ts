import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { patchDemoBookingSchema } from '../schemas.ts';

export const updateDemoBookingDeclaration: FunctionDeclaration = {
  name: 'updateDemoBooking',
  description: 'Update the status or notes of a Free Trial Demo Class booking (e.g. mark as Contacted, Scheduled, or Completed).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      bookingIdOrStudentName: {
        type: Type.STRING,
        description: 'Booking ID or student name.'
      },
      status: {
        type: Type.STRING,
        description: '"Scheduled", "Contacted", "Completed", "Enrolled", or "Cancelled".'
      },
      notes: {
        type: Type.STRING,
        description: 'Coach or administrative follow-up notes.'
      }
    },
    required: ['bookingIdOrStudentName']
  }
};

export const updateDemoBookingTool: AgentTool = {
  name: 'updateDemoBooking',
  declaration: updateDemoBookingDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can manage demo class bookings.',
  rateLimit: { maxCalls: 20, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const bookings = await db.getDemoBookings();
    const query = String(args?.bookingIdOrStudentName || '').toLowerCase().trim();
    const booking = bookings.find(b => b.id === query || b.studentName.toLowerCase().includes(query));

    if (!booking) {
      return {
        result: null,
        summary: `Could not find trial booking matching "${args?.bookingIdOrStudentName}".`,
        success: false
      };
    }

    const updates: any = {};
    if (args.status) updates.status = args.status;
    if (args.notes) updates.notes = args.notes;

    const parsed = patchDemoBookingSchema.safeParse(updates);
    if (!parsed.success) {
      return {
        result: null,
        summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid booking updates'}`,
        success: false
      };
    }

    const updated = await db.updateDemoBooking(booking.id, parsed.data);
    return {
      result: updated,
      summary: `✓ Updated Demo Class booking for **${booking.studentName}** (Status: **${updated?.status || booking.status}**)!`,
      success: true
    };
  }
};
