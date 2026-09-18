import { db } from '../supabaseDb.ts';
import { ROLES } from '../../src/types.ts';

export interface SiblingStudentSummary {
  id: string;
  firstName: string;
  lastName?: string;
  age?: number;
  gradeClass?: string;
  schoolName?: string;
}

export interface ResolvedStudentContext {
  activeStudentId?: string;
  activeFirstName: string;
  activeLastName?: string;
  siblingStudents?: SiblingStudentSummary[];
}

/**
 * Resolves active student identity and sibling student summaries for a given user.
 * Preserves multi-child / sibling relationships and accurately handles student switching.
 */
export async function resolveStudentContext(
  user: any,
  targetStudentId?: string
): Promise<ResolvedStudentContext> {
  let siblingStudents: SiblingStudentSummary[] | undefined = undefined;
  let activeStudentId = targetStudentId || user.studentId;
  let activeFirstName = user.firstName;
  let activeLastName = user.lastName;

  if (user?.role === ROLES.STUDENT) {
    const rawSiblings = await db.getSiblingStudentsForUser(user);
    siblingStudents = rawSiblings.map(s => ({
      id: s.id,
      firstName: s.firstName || 'Student',
      lastName: s.lastName || undefined,
      age: s.age,
      gradeClass: s.gradeClass,
      schoolName: s.schoolName
    }));

    if (activeStudentId) {
      const activeSibling = rawSiblings.find(s => s.id === activeStudentId);
      if (activeSibling) {
        activeFirstName = activeSibling.firstName || activeFirstName;
        activeLastName = activeSibling.lastName || activeLastName;
      }
    } else if (rawSiblings.length === 1) {
      activeStudentId = rawSiblings[0].id;
      activeFirstName = rawSiblings[0].firstName || activeFirstName;
      activeLastName = rawSiblings[0].lastName || activeLastName;
    }
  }

  return {
    activeStudentId,
    activeFirstName,
    activeLastName,
    siblingStudents
  };
}
