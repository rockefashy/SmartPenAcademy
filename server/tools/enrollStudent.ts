import crypto from 'crypto';
import { z } from 'zod';
import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { db } from '../supabaseDb.ts';
import { sendEnrollmentEmails } from '../email.ts';
import { validateWithSchema } from './helpers.ts';

export const enrollStudentDeclaration: FunctionDeclaration = {
  name: 'enrollStudent',
  description: 'Enroll a new student into Smart Pen Academy under a new or existing family account.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      studentName: {
        type: Type.STRING,
        description: "Child's full name (e.g. 'Aarav Sharma')."
      },
      age: {
        type: Type.INTEGER,
        description: "Child's age."
      },
      parentName: {
        type: Type.STRING,
        description: 'Parent or guardian full name.'
      },
      parentEmail: {
        type: Type.STRING,
        description: 'Family contact email address (used as authoritative family identifier).'
      },
      parentPhone: {
        type: Type.STRING,
        description: 'Family phone / WhatsApp number (10 digits).'
      },
      gradeClass: {
        type: Type.STRING,
        description: 'Grade or class (e.g. "Grade 4", "5th Standard").'
      },
      schoolName: {
        type: Type.STRING,
        description: 'School name.'
      },
      modeOfLearning: {
        type: Type.STRING,
        description: 'Mode of learning: "In-person" or "Online" (default "In-person").'
      },
      isSibling: {
        type: Type.BOOLEAN,
        description: 'Set to true if enrolling a sibling under an existing registered family account.'
      },
      password: {
        type: Type.STRING,
        description: 'Optional initial account password (min 8 characters). If omitted, an 8-character temporary password is auto-generated.'
      },
      notes: {
        type: Type.STRING,
        description: 'Optional notes, observations, or preferences.'
      }
    },
    required: ['studentName', 'parentName', 'parentEmail', 'parentPhone']
  }
};

const enrollStudentToolSchema = z.object({
  studentName: z.string({ message: 'Student name is required.' }).trim().min(1, 'Student name is required.'),
  age: z.coerce.number().int('Age must be an integer').optional(),
  parentName: z.string({ message: 'Parent/Guardian name is required.' }).trim().min(1, 'Parent/Guardian name is required.'),
  parentEmail: z.string({ message: 'Parent contact email is required.' }).trim().email('Valid parent contact email is required.'),
  parentPhone: z.string({ message: 'Parent phone number is required.' }).trim().min(1, 'Parent phone number is required.'),
  gradeClass: z.string().trim().optional(),
  schoolName: z.string().trim().optional(),
  modeOfLearning: z.enum(['In-person', 'Online']).optional().default('In-person'),
  isSibling: z.boolean().optional().default(false),
  password: z.string().min(8, 'Account password must be at least 8 characters long.').optional(),
  notes: z.string().trim().optional()
});

type EnrollStudentInput = z.infer<typeof enrollStudentToolSchema>;

export const enrollStudentTool: AgentTool = {
  name: 'enrollStudent',
  declaration: enrollStudentDeclaration,
  allowedRoles: ['admin'],
  accessDeniedMessage: 'Access Denied: Only administrators can enroll students.',
  rateLimit: { maxCalls: 15, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    // 1. Validate tool input against authoritative schema
    const validation = validateWithSchema<EnrollStudentInput>(enrollStudentToolSchema, args);
    if (!validation.success || !validation.data) {
      return {
        result: null,
        summary: validation.summary || 'Validation Error: Invalid student enrollment data.',
        success: false
      };
    }

    const data = validation.data;

    // Validate 10-digit phone
    const digitsOnly = data.parentPhone.replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 10) {
      return {
        result: null,
        summary: 'Validation Error: A valid 10-digit WhatsApp/Mobile number is required.',
        success: false
      };
    }

    // Derive first and last names
    const parts = data.studentName.trim().split(/\s+/);
    const firstName = parts[0] || 'Student';
    const lastName = parts.slice(1).join(' ') || '';

    const cleanEmail = data.parentEmail.toLowerCase().trim();
    const isSibling = Boolean(data.isSibling);
    let inheritedPasswordHash: string | undefined = undefined;
    let generatedPassword: string | undefined = undefined;

    // 2. Parent/Family Linkage (strictly by email/phone in users table)
    if (isSibling) {
      let existingUsers = await db.findUsersByIdentifier(cleanEmail);
      if (existingUsers.length === 0 && digitsOnly) {
        existingUsers = await db.findUsersByIdentifier(digitsOnly);
      }
      const parentUser = existingUsers.find(u => u.passwordHash);
      if (!parentUser?.passwordHash) {
        return {
          result: null,
          summary: 'Existing family account could not be located to inherit credentials for this sibling.',
          success: false
        };
      }
      inheritedPasswordHash = parentUser.passwordHash;
    } else {
      if (data.password && data.password.trim()) {
        generatedPassword = data.password.trim();
      } else {
        // Auto-generate 8-character temporary password according to system password policy
        generatedPassword = crypto.randomBytes(4).toString('hex');
      }
    }

    // 3. Duplicate Prevention
    const isDuplicate = await db.checkStudentDuplicate({
      firstName,
      lastName,
      phoneNumber: digitsOnly,
      email: cleanEmail,
      age: data.age
    });

    if (isDuplicate) {
      return {
        result: null,
        summary: 'A student with this name and contact already exists in the system.',
        success: false
      };
    }

    // 4. Construct record and execute shared DB write path
    const newId = `std-${Date.now()}`;
    const effectivePassword = isSibling ? undefined : generatedPassword;

    const newStudentPayload = {
      id: newId,
      firstName,
      lastName,
      parentName: data.parentName.trim(),
      email: cleanEmail,
      whatsappMobile: digitsOnly,
      age: data.age !== undefined && data.age !== null ? Number(data.age) : null,
      gradeClass: data.gradeClass?.trim() || undefined,
      schoolName: data.schoolName?.trim() || undefined,
      modeOfLearning: data.modeOfLearning || 'In-person',
      status: 'Active' as const,
      password: effectivePassword,
      passwordHash: inheritedPasswordHash,
      isSiblingEnrollment: isSibling,
      notes: data.notes?.trim() || undefined,
      enrollmentDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const created = await db.createStudent(newStudentPayload);

      // Dispatch enrollment notification email asynchronously (includes password for new families)
      sendEnrollmentEmails({
        firstName: created.firstName,
        age: created.age,
        gradeClass: created.gradeClass,
        schoolName: created.schoolName,
        parentName: created.parentName,
        whatsappMobile: digitsOnly,
        email: cleanEmail,
        password: effectivePassword,
        isSiblingEnrollment: isSibling
      }).catch(err => {
        console.warn('[Resend Background Notice] Student registration notification dispatch:', err?.message || err);
      });

      const passwordNotice = isSibling
        ? 'enrolled successfully under the existing family account.'
        : 'enrolled successfully. A temporary password has been emailed to the family.';

      const summary = `✓ Student "${created.firstName}" ${passwordNotice}\n\nWould you like to assign ${created.firstName} to a coach now? If yes, tell me the coach's name or ID.`;

      return {
        result: {
          student: created,
          isSibling
        },
        summary,
        success: true
      };
    } catch (err: any) {
      return {
        result: null,
        summary: `Enrollment Error: ${err.message || 'Failed to create student in database.'}`,
        success: false
      };
    }
  }
};
