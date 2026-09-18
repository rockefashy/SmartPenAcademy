import type { ToolCallResult } from '../aiAgent.ts';
import { User, ROLES } from '../../src/types.ts';

/**
 * Evaluates deterministic fast-path intents (pure greetings, enrollment navigation) before calling LLM.
 * Returns an immediate response if a fast-path intent matches, or null to proceed to LLM reasoning.
 */
export function detectIntent(
  userMessage: string,
  userContext?: User | null
): { reply: string; toolResults: ToolCallResult[] } | null {
  if (!userMessage) return null;

  const clean = userMessage.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  // 1. PURE GREETING FLOW
  const isGreeting = [
    /^(hi|hello|hey|hola|namaste|greetings)$/i,
    /^(hi|hello|hey)\s+(there|smartpen|academy|assistant|bot|coach|deepthy|mam|madam|sir)$/i,
    /^(good\s+(morning|afternoon|evening|day))$/i,
    /^(good\s+(morning|afternoon|evening|day))\s+(all|mam|madam|sir|everyone|there)$/i
  ].some(p => p.test(clean));

  if (isGreeting) {
    const firstName = userContext?.firstName?.trim() || userContext?.displayName?.trim();

    let reply = 'Hello! Welcome to SmartPen Academy. How can I assist you today? Feel free to ask about our handwriting courses, 7-module curriculum, fee structure, or booking a free trial demo class!';
    if (userContext?.role === ROLES.ADMIN) {
      reply = `Hello ${firstName || 'Administrator'}! How can I assist you with academy administration, student records, or coach management today?`;
    } else if (userContext?.role === ROLES.COACH) {
      reply = `Hello${firstName ? ` Coach ${firstName}` : ' Coach'}! How can I assist you with your assigned students, coaching schedule, or attendance today?`;
    } else if (userContext?.role === ROLES.STUDENT) {
      reply = `Hello${firstName ? ` ${firstName}` : ''}! Welcome back to SmartPen Academy. How can I assist you with your handwriting lessons, schedule, or progress today?`;
    }

    return { reply, toolResults: [] };
  }

  // 2. ENROLLMENT FLOW
  const isCoachEnrollment = [
    /\b(enroll|register|add|create|new|hire|onboard)\s+(a\s+|an\s+)?(coach|tutor|teacher|instructor)\b/i,
    /\b(coach|tutor|teacher)\s+(enrollment|registration|creation|admission)\b/i,
    /\b(add|create|register|enroll)\s+(new\s+)?coach\b/i
  ].some(p => p.test(clean));

  const isStudentEnrollment = [
    /\b(enroll|register|admit|add|new|onboard)\s+(a\s+|an\s+)?(student|child|kid|admission)\b/i,
    /\b(student|child|admission)\s+(enrollment|registration|form)\b/i,
    /\b(enroll|register|admit)\s+(new\s+)?student\b/i,
    /\b(want\s+to|how\s+to|can\s+i)\s+(enroll|register|admit)\b/i,
    /\b(student|child)\s+admission\b/i,
    /^(enroll|register|admission)$/i
  ].some(p => p.test(clean));

  if (isCoachEnrollment || isStudentEnrollment) {
    if (userContext?.role === ROLES.ADMIN) {
      const target = isCoachEnrollment ? 'coachEnrollment' : 'enroll';
      return {
        reply: `Opening the ${isCoachEnrollment ? 'Coach' : 'Student'} Registration & Enrollment page...`,
        toolResults: [{
          toolName: 'navigateToPage',
          args: { target },
          result: { target, success: true },
          summary: `Navigate to ${target}`,
          success: true
        }]
      };
    }
    return {
      reply: "Restricted only to Admin.",
      toolResults: []
    };
  }

  // 3. NO FAST-PATH INTENT -> PROCEED TO LLM
  return null;
}
