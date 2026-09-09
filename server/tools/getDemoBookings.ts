import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';

export const getDemoBookingsDeclaration: FunctionDeclaration = {
  name: 'getDemoBookings',
  description: 'List recent Free Demo Class trial bookings submitted by prospective parents.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const getDemoBookingsTool: AgentTool = {
  name: 'getDemoBookings',
  declaration: getDemoBookingsDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can access prospective trial bookings.',
  rateLimit: { maxCalls: 30, windowMs: 60 * 1000 },
  async execute(_args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const bookings = await db.getDemoBookings();
    return {
      result: { count: bookings.length, bookings },
      summary: `📅 **Free Demo Class Bookings (${bookings.length})**:\n${bookings.length === 0 ? 'No trial bookings yet.' : bookings.map(b => `• **${b.studentName}** (Age ${b.age}) - Date: ${b.preferredDate} (${b.preferredTimeSlot}) - Contact: ${b.contactNumber} [${b.status}]`).join('\n')}`,
      success: true
    };
  }
};
