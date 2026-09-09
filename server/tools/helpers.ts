import { db } from '../supabaseDb.ts';
import { User, StudentProfile } from '../../src/types';

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
