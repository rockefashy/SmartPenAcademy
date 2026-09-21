import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';
import { ROLES, User } from '../../src/types.ts';
import { getJwtSecret } from '../config/env.ts';
import { AuthenticationError, AuthorizationError, ValidationError } from '../errors.ts';
import { recordAudit } from '../helpers/audit.ts';

export interface LoginCredentials {
  identifier: string;
  password: string;
  role?: 'admin' | 'coach' | 'student';
}

export interface StudentOption {
  id: string;
  studentId: string;
  firstName: string;
  displayName: string;
  age?: number;
  gender?: string;
  gradeClass?: string;
  schoolName?: string;
  avatarUrl?: string;
}

export type AuthenticationResult =
  | {
      type: 'SESSION';
      user: any;
    }
  | {
      type: 'STUDENT_SELECTION';
      selectionToken: string;
      parentName?: string;
      students: StudentOption[];
    }
  | {
      type: 'ROLE_SELECTION';
      selectionToken: string;
      roles: string[];
      users: Array<{ id: string; role: string; firstName: string; lastName?: string }>;
    };

export class AuthService {
  /**
   * Validates if a coach account is active in both users and coaches tables.
   */
  async isCoachActive(userObj: any): Promise<boolean> {
    if (userObj.isActive === false) return false;
    const coachProfile = await db.getCoachById(userObj.coachId || userObj.id);
    return coachProfile ? coachProfile.status === 'Active' : true;
  }

  /**
   * Authenticates user credentials and resolves either a single session,
   * a multi-sibling disambiguation, or a dual-role disambiguation.
   */
  async authenticateUser(credentials: LoginCredentials): Promise<AuthenticationResult> {
    const { identifier, password, role } = credentials;

    if (!identifier || !password) {
      recordAudit({
        actorId: 'anonymous',
        action: 'auth_login_failed',
        summary: 'Login attempt rejected: Missing identifier or password',
        arguments: { identifier },
        status: 'failed'
      });
      throw new ValidationError('Registered email address and password are required.');
    }

    // 1. Look up candidate users matching email, username, or phone
    const candidateUsers = await db.findUsersByIdentifier(identifier);
    if (!candidateUsers || candidateUsers.length === 0) {
      recordAudit({
        actorId: 'anonymous',
        action: 'auth_login_failed',
        summary: `Login failed: No account found for identifier ${identifier}`,
        arguments: { identifier },
        status: 'failed'
      });
      throw new AuthenticationError('Invalid login credentials. No account found.');
    }

    // 2. Filter candidates where password matches asynchronously
    const passwordMatchResults = await Promise.all(
      candidateUsers.map(async (u) => ({
        user: u,
        matches: Boolean(u.passwordHash && await bcrypt.compare(password, u.passwordHash))
      }))
    );
    const validPasswordUsers = passwordMatchResults
      .filter(r => r.matches)
      .map(r => r.user);

    if (validPasswordUsers.length === 0) {
      recordAudit({
        actorId: candidateUsers[0]?.id || 'anonymous',
        actorUsername: candidateUsers[0]?.username,
        actorRole: candidateUsers[0]?.role,
        action: 'auth_login_failed',
        summary: `Login failed: Invalid password supplied for ${identifier}`,
        arguments: { identifier },
        status: 'failed'
      });
      throw new AuthenticationError('Invalid password. Please verify your password.');
    }

    // 3. Handle explicit role filter if supplied
    if (role) {
      const roleMatched = validPasswordUsers.filter(u => u.role === role);
      if (roleMatched.length === 1) {
        const loggedUser = roleMatched[0];

        if (loggedUser.role === 'coach') {
          const active = await this.isCoachActive(loggedUser);
          if (!active) {
            recordAudit({
              actorId: loggedUser.id,
              action: 'auth_login_rejected_inactive_coach',
              summary: `Login rejected: Coach account ${loggedUser.email} is inactive`,
              arguments: { identifier },
              status: 'failed'
            });
            throw new AuthorizationError('Your coach account is currently inactive. Please contact administration.');
          }
        }

        recordAudit({
          actorId: loggedUser.id,
          actorUsername: loggedUser.username,
          actorRole: loggedUser.role,
          actorStudentId: loggedUser.studentId,
          action: 'auth_login',
          summary: `User ${loggedUser.firstName} (${loggedUser.username || loggedUser.email}) logged in successfully as ${loggedUser.role}`,
          arguments: { identifier, role: loggedUser.role },
          result: { userId: loggedUser.id, role: loggedUser.role }
        });

        return { type: 'SESSION', user: loggedUser };
      }
    }

    // 4. Scenario A: Single user match
    if (validPasswordUsers.length === 1) {
      const loggedUser = validPasswordUsers[0];

      if (loggedUser.role === 'coach') {
        const active = await this.isCoachActive(loggedUser);
        if (!active) {
          recordAudit({
            actorId: loggedUser.id,
            action: 'auth_login_rejected_inactive_coach',
            summary: `Login rejected: Coach account ${loggedUser.email} is inactive`,
            arguments: { identifier },
            status: 'failed'
          });
          throw new AuthorizationError('Your coach account is currently inactive. Please contact administration.');
        }
      }

      // Check for multi-child sibling disambiguation under parent account
      if (loggedUser.role === ROLES.STUDENT) {
        const siblings = await db.getSiblingStudentsForUser(loggedUser);
        if (siblings && siblings.length > 1) {
          const jwtSecret = getJwtSecret();
          const selectionToken = jwt.sign(
            {
              type: 'STUDENT_SELECTION',
              userId: loggedUser.id,
              candidateUserIds: [loggedUser.id]
            },
            jwtSecret,
            { expiresIn: '15m' }
          );

          recordAudit({
            actorId: loggedUser.id,
            actorUsername: loggedUser.username,
            actorRole: loggedUser.role,
            action: 'auth_login_disambiguation_students',
            summary: `Login required sibling selection for parent ${loggedUser.firstName} (${siblings.length} children linked)`,
            arguments: { identifier, studentCount: siblings.length }
          });

          const studentOptions: StudentOption[] = siblings.map(s => ({
            id: s.id,
            studentId: s.id,
            firstName: s.firstName || 'Student',
            displayName: s.displayName || s.firstName || 'Student',
            age: s.age,
            gender: s.gender,
            gradeClass: s.gradeClass,
            schoolName: s.schoolName,
            avatarUrl: s.avatarUrl
          }));

          return {
            type: 'STUDENT_SELECTION',
            selectionToken,
            parentName: loggedUser.firstName,
            students: studentOptions
          };
        }
      }

      recordAudit({
        actorId: loggedUser.id,
        actorUsername: loggedUser.username,
        actorRole: loggedUser.role,
        actorStudentId: loggedUser.studentId,
        action: 'auth_login',
        summary: `User ${loggedUser.firstName} (${loggedUser.username || loggedUser.email}) logged in successfully as ${loggedUser.role}`,
        arguments: { identifier, role: loggedUser.role },
        result: { userId: loggedUser.id, role: loggedUser.role }
      });

      return { type: 'SESSION', user: loggedUser };
    }

    // 5. Scenario B: Multiple accounts share this identifier
    const distinctRoles = Array.from(new Set(validPasswordUsers.map(u => u.role)));

    // Dual-Role selection
    if (distinctRoles.length > 1) {
      const jwtSecret = getJwtSecret();
      const selectionToken = jwt.sign(
        {
          type: 'ROLE_SELECTION',
          candidateUserIds: validPasswordUsers.map(u => u.id)
        },
        jwtSecret,
        { expiresIn: '15m' }
      );

      recordAudit({
        actorId: validPasswordUsers[0]?.id || 'anonymous',
        action: 'auth_login_disambiguation_roles',
        summary: `Login required role selection for ${identifier} (${distinctRoles.join(', ')})`,
        arguments: { identifier, roles: distinctRoles }
      });

      return {
        type: 'ROLE_SELECTION',
        selectionToken,
        roles: distinctRoles,
        users: validPasswordUsers.map(u => ({
          id: u.id,
          role: u.role,
          firstName: u.firstName,
          lastName: u.lastName
        }))
      };
    }

    // Sibling accounts sharing the same email/phone
    if (distinctRoles[0] === ROLES.STUDENT) {
      const allLinkedStudents: any[] = [];
      for (const u of validPasswordUsers) {
        const sibs = await db.getSiblingStudentsForUser(u);
        allLinkedStudents.push(...sibs);
      }

      // Deduplicate student records
      const uniqueStudents = Array.from(
        new Map(allLinkedStudents.map(s => [s.id, s])).values()
      );

      const jwtSecret = getJwtSecret();
      const selectionToken = jwt.sign(
        {
          type: 'STUDENT_SELECTION',
          userId: validPasswordUsers[0]?.id,
          candidateUserIds: validPasswordUsers.map(u => u.id)
        },
        jwtSecret,
        { expiresIn: '15m' }
      );

      recordAudit({
        actorId: validPasswordUsers[0]?.id || 'anonymous',
        action: 'auth_login_disambiguation_siblings',
        summary: `Login required sibling selection for parent account ${identifier} (${uniqueStudents.length} sibling profiles linked)`,
        arguments: { identifier, candidateCount: validPasswordUsers.length, studentCount: uniqueStudents.length }
      });

      const studentOptions: StudentOption[] = uniqueStudents.map(s => ({
        id: s.id,
        studentId: s.id,
        firstName: s.firstName || 'Student',
        displayName: s.displayName || s.firstName || 'Student',
        age: s.age,
        gender: s.gender,
        gradeClass: s.gradeClass,
        schoolName: s.schoolName,
        avatarUrl: s.avatarUrl
      }));

      return {
        type: 'STUDENT_SELECTION',
        selectionToken,
        parentName: validPasswordUsers[0]?.firstName,
        students: studentOptions
      };
    }

    // Default fallback: log into the first matched user account
    const fallbackUser = validPasswordUsers[0];
    recordAudit({
      actorId: fallbackUser.id,
      actorUsername: fallbackUser.username,
      actorRole: fallbackUser.role,
      action: 'auth_login_fallback',
      summary: `User ${fallbackUser.firstName} (${fallbackUser.email}) logged in via candidate fallback`,
      arguments: { identifier, role: fallbackUser.role }
    });

    return { type: 'SESSION', user: fallbackUser };
  }
}

export const authService = new AuthService();
