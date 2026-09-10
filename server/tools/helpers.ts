import { z } from 'zod';
import { db } from '../supabaseDb.ts';
import { User, StudentProfile, CoachProfile } from '../../src/types';
import { AgentToolResult } from './types.ts';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: z.ZodIssue[];
  };
  summary?: string;
}

/**
 * Validates untrusted tool input against an authoritative Zod schema,
 * returning the project-standard ValidationError shape.
 */
export function validateWithSchema<T>(
  schema: z.ZodType<T, any, any>,
  data: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const primaryMessage = parsed.error.issues[0]?.message || 'Validation failed';
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: primaryMessage,
      details: parsed.error.issues
    },
    summary: `Validation Error: ${primaryMessage}`
  };
}

/**
 * Authoritative Zod schema for optional tool limit.
 * Strictly positive integer between 1 and 20.
 * Invalid values (0, negative, decimals, non-integer strings, >20) fail validation.
 */
export const toolLimitSchema: z.ZodType<number | undefined> = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (/^-?\d+$/.test(trimmed)) {
        return Number(trimmed);
      }
      return NaN;
    }
    return val;
  },
  z.number({ message: 'Limit must be a valid integer between 1 and 20' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(20, 'Limit cannot exceed 20')
    .optional()
);

/**
 * Authoritative Zod schema for calendar month period (YYYY-MM).
 */
export const yearMonthSchema: z.ZodType<string | undefined> = z.preprocess(
  (val) => (val === undefined || val === null || val === '' ? undefined : String(val).trim()),
  z.string({ message: 'Period must be a string in YYYY-MM format' })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be a valid calendar month in YYYY-MM format (e.g., "2026-09")')
    .optional()
);

export interface FilterOrLimitConfig<T> {
  items: T[];
  requestedLimit?: number;
  entityLabel: string;
  suggestedFilters: string[];
}

export interface FilterOrLimitResult<T> {
  isOversized: boolean;
  totalCount: number;
  items: T[];
  toolResult?: AgentToolResult;
}

/**
 * Unified filter-or-limit helper for AI tools returning result sets.
 * 1. Counts the final authorized and filtered items.
 * 2. If total > 20, returns an actionable oversized-set prompt requiring narrowing filters (no partial records).
 * 3. If total <= 20, returns real records up to requestedLimit (if supplied).
 */
export function applyFilterOrLimit<T>(config: FilterOrLimitConfig<T>): FilterOrLimitResult<T> {
  const total = config.items.length;

  if (total > 20) {
    const filterBullets = config.suggestedFilters.map(f => `• **${f}**`).join('\n');
    return {
      isOversized: true,
      totalCount: total,
      items: [],
      toolResult: {
        result: { totalFound: total, limitRequired: true },
        summary: `⚠️ **Oversized Result Set (${total} ${config.entityLabel} found)**:\n\nTo keep response clear and actionable, please narrow your request by specifying:\n${filterBullets}\n• **Or request a smaller batch**: e.g. *"Show recent 5 records"*`,
        success: true
      }
    };
  }

  const effectiveItems = config.requestedLimit !== undefined
    ? config.items.slice(0, config.requestedLimit)
    : config.items;

  return {
    isOversized: false,
    totalCount: total,
    items: effectiveItems
  };
}

// Shared helper to check user access to student records in tool execution
export function verifyToolStudentAccess(
  userContext: User | null,
  student?: StudentProfile | { id: string; coachId?: string | null } | null
): boolean {
  if (!userContext) return false;
  if (!student || !student.id) return false;

  if (userContext.role === 'admin') return true;
  if (userContext.role === 'coach') {
    if (!student.coachId) return false;
    const coachKeys = new Set([userContext.id, userContext.coachId].filter(Boolean));
    return coachKeys.has(student.coachId);
  }
  if (userContext.role === 'student') {
    return userContext.studentId === student.id;
  }
  return false;
}

// Backwards-compatible alias for existing call sites
export function canCoachAccessStudent(userContext: User | null, student: StudentProfile): boolean {
  return verifyToolStudentAccess(userContext, student);
}

// Helper to find student by fuzzy name or ID with defensive null-safety
export async function findStudent(query?: string): Promise<StudentProfile | undefined> {
  if (!query || typeof query !== 'string') return undefined;

  const students = await db.getAllStudents();
  const cleanQ = query.toLowerCase().trim().replace(/^(student|std|the student)\s+/i, '');
  if (!cleanQ) return undefined;

  // Exact ID
  let match = students.find(s => s.id.toLowerCase() === cleanQ);
  if (match) return match;

  // Exact Name
  match = students.find(s => s.displayName.toLowerCase() === cleanQ);
  if (match) return match;

  // Partial Name Match
  match = students.find(s => s.displayName.toLowerCase().includes(cleanQ) || cleanQ.includes(s.displayName.toLowerCase()));
  if (match) return match;

  // First name match
  match = students.find(s => {
    const firstName = s.displayName.toLowerCase().split(' ')[0];
    return cleanQ.includes(firstName) || firstName.includes(cleanQ);
  });
  if (match) return match;

  // Match by student 1, student 2 (1-based index)
  const indexMatch = query.match(/student\s*(\d+)/i);
  if (indexMatch) {
    const idx = parseInt(indexMatch[1], 10) - 1;
    if (idx >= 0 && idx < students.length) {
      return students[idx];
    }
  }

  return undefined;
}

// Helper to find coach by fuzzy name, ID, or email with defensive null-safety
export async function findCoach(query?: string): Promise<CoachProfile | undefined> {
  if (!query || typeof query !== 'string') return undefined;

  const coaches = await db.getAllCoaches();
  const cleanQ = query.toLowerCase().trim().replace(/^(coach|tutor|the coach)\s+/i, '');
  if (!cleanQ || cleanQ === 'none' || cleanQ === 'null') return undefined;

  // Exact ID
  let match = coaches.find(c => c.id.toLowerCase() === cleanQ);
  if (match) return match;

  // Exact Name
  match = coaches.find(c => c.displayName.toLowerCase() === cleanQ);
  if (match) return match;

  // Partial Name Match
  match = coaches.find(c => c.displayName.toLowerCase().includes(cleanQ) || cleanQ.includes(c.displayName.toLowerCase()));
  if (match) return match;

  // First name match
  match = coaches.find(c => {
    const firstName = c.displayName.toLowerCase().split(' ')[0];
    return cleanQ.includes(firstName) || firstName.includes(cleanQ);
  });
  if (match) return match;

  // Email match
  match = coaches.find(c => c.email && c.email.toLowerCase() === cleanQ);
  if (match) return match;

  return undefined;
}
