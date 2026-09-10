import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { sendDemoBookingAlert } from '../email.ts';
import { createDemoBookingSchema } from '../schemas.ts';

export const bookDemoClassDeclaration: FunctionDeclaration = {
  name: 'bookDemoClass',
  description: 'Directly schedule and book a Free Trial Demo Class for a prospective student, or inspect available demo class slots (4:00 PM – 7:00 PM all days).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      childName: {
        type: Type.STRING,
        description: 'Name of the student attending the trial class.'
      },
      childAge: {
        type: Type.INTEGER,
        description: 'Age of the child (ages 4 to 18).'
      },
      parentName: {
        type: Type.STRING,
        description: 'Full name of parent or guardian.'
      },
      parentPhone: {
        type: Type.STRING,
        description: 'Parent phone or WhatsApp number.'
      },
      preferredDate: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format (e.g. "2026-09-10").'
      },
      preferredTimeSlot: {
        type: Type.STRING,
        description: 'Preferred slot between 4:00 PM and 7:00 PM (e.g. "04:00 PM", "05:00 PM", "06:00 PM").'
      },
      modeOfLearning: {
        type: Type.STRING,
        description: '"In-person" or "Online". Default is "In-person".'
      },
      notes: {
        type: Type.STRING,
        description: 'Child handwriting challenges or areas of concern (e.g. grip, speed, exam neatness).'
      }
    }
  }
};

export const bookDemoClassTool: AgentTool = {
  name: 'bookDemoClass',
  declaration: bookDemoClassDeclaration,
  rateLimit: { maxCalls: 10, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const { childName, childAge, parentName, parentPhone, preferredDate, preferredTimeSlot, modeOfLearning, notes } = args || {};

    if (childName && parentName && parentPhone) {
      const targetDate = preferredDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const targetSlot = preferredTimeSlot || '04:00 PM';
      const ageVal = parseInt(String(childAge || '8').replace(/\D/g, ''), 10) || 8;
      const sName = String(childName || (args as any)?.studentName || '').trim();

      const bookingPayload = {
        studentName: sName,
        age: ageVal,
        parentName: String(parentName).trim(),
        contactNumber: String(parentPhone).trim(),
        preferredDate: targetDate,
        preferredTimeSlot: targetSlot,
        modeOfLearning: modeOfLearning === 'Online' ? 'Online' : 'In-person',
        notes: notes ? String(notes).trim() : 'Booked via SmartPen AI Assistant'
      };

      // Authoritative Zod schema validation (parity with POST /api/demo-bookings)
      const parsed = createDemoBookingSchema.safeParse(bookingPayload);
      if (!parsed.success) {
        return {
          result: null,
          summary: `Validation Error: ${parsed.error.issues[0]?.message || 'Invalid demo booking payload.'}`,
          success: false
        };
      }

      const { booking } = await db.createDemoBooking(parsed.data);

      // Fire & forget Resend email alert to Admin (parity with POST /api/demo-bookings)
      sendDemoBookingAlert({
        studentName: booking.studentName,
        parentName: booking.parentName,
        age: booking.age,
        contactNumber: booking.contactNumber,
        preferredDate: booking.preferredDate,
        preferredTimeSlot: booking.preferredTimeSlot,
        notes: booking.notes
      }).catch(err => {
        console.warn('[Resend Background Notice] AI Demo booking alert dispatch failed:', err.message || err);
      });

      return {
        result: booking,
        summary: `🎉 **Free Demo Class Booked Successfully!**\n\n• **Student**: ${booking.studentName} (Age ${booking.age})\n• **Parent**: ${booking.parentName} (${booking.contactNumber})\n• **Scheduled Date**: **${booking.preferredDate}**\n• **Time Slot**: **${booking.preferredTimeSlot}**\n• **Mode**: ${booking.modeOfLearning}\n\nHead Coach **Mrs. Deepthy Rock** will connect with you on WhatsApp/Phone shortly to confirm your session.\n\n*Looking forward to welcoming ${booking.studentName} to SmartPen Academy!*`,
        success: true
      };
    }

    const timePresets = ["04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM"];
    return {
      result: { availableSlots: timePresets },
      summary: `📅 **Free Demo Class Information & Available Slots**:\n\n• **Timing**: Available All Days • 1-on-1 Personalized Slots\n• **Available Slots**: ${timePresets.join(', ')}\n• **Ages**: 4 to 18 years (Preschool to Grade 12)\n• **Session Includes**: Handwriting speed assessment, kinetic pencil grip diagnosis, and personalized learning plan by Mrs. Deepthy Rock.\n\nTo book right now in chat, please provide:\n1. **Child's Name & Age**\n2. **Parent Name & Contact Number**\n3. **Preferred Date (YYYY-MM-DD) & Time Slot** (e.g. 04:00 PM)\n\n*(Or ask me to "Open demo booking" to fill the quick form on your screen!)*`,
      success: true
    };
  }
};
