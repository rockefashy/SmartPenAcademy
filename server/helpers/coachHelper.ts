import { db } from '../supabaseDb.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { User, StudentProfile } from '../../src/types.ts';

export interface CoachIdentifier {
  coachKey: string;
  coachAlt?: string;
}

export type CoachUser = User | AuthRequest['user'] | { id?: string; coachId?: string } | null | undefined;

/**
 * Extracts primary coach key and alternative identifier from an authenticated coach user.
 */
export function getCoachKeys(user: CoachUser): CoachIdentifier | null {
  if (!user || !user.id) return null;
  const coachKey = user.coachId || user.id;
  const coachAlt = user.coachId ? user.id : undefined;
  return { coachKey, coachAlt };
}

/**
 * Retrieves the list of student profiles assigned to a coach.
 */
export async function getCoachAssignedStudents(
  user: CoachUser,
  paginationOptions?: { page: number; limit: number }
): Promise<StudentProfile[]> {
  const keys = getCoachKeys(user);
  if (!keys) return [];
  return await db.getStudentsByCoachId(keys.coachKey, keys.coachAlt, paginationOptions);
}

/**
 * Retrieves array of student IDs assigned to a coach.
 */
export async function getCoachAssignedStudentIds(
  user: CoachUser
): Promise<string[]> {
  const students = await getCoachAssignedStudents(user);
  return students.map(s => s.id);
}
