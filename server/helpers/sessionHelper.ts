import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../supabaseDb.ts';
import { getJwtSecret } from '../config/env.ts';
import { resolveStudentContext } from './studentContext.ts';

/**
 * Helper to issue login JWT token, set secure httpOnly cookie, and respond with user session.
 */
export async function issueUserSession(user: any, res: Response, targetStudentId?: string) {
  const {
    activeStudentId,
    activeFirstName,
    activeLastName,
    siblingStudents
  } = await resolveStudentContext(user, targetStudentId);

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    studentId: activeStudentId,
    coachId: user.coachId || user.coach_id,
    firstName: activeFirstName,
    lastName: activeLastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    designation: user.designation,
    siblingStudents,
    // Embed current token_version so authenticateJwt detects post-password-change tokens
    tokenVersion: typeof user.tokenVersion === 'number'
      ? user.tokenVersion
      : (typeof user.token_version === 'number'
        ? user.token_version
        : ((await db.findUserTokenVersion(user.id)) ?? 1))
  };

  const jwtSecret = getJwtSecret();
  const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  // Set secure, httpOnly, SameSite=strict cookie
  res.cookie('smartpen_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({ token, user: payload });
}
