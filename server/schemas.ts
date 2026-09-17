import { z } from 'zod';

// ============================================================================
// SHARED AUTHORITATIVE ZOD SCHEMAS
// (Shared between Express API routes in server.ts and AI tools in server/tools/)
// ============================================================================

// 1. Attendance Schemas
export const attendanceItemSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'Student ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  yearMonth: z.string().optional(),
  classNumber: z.number().int().positive().optional(),
  status: z.enum(['Present', 'Absent', 'Excused', 'Late']).default('Present'),
  notes: z.string().optional().nullable(),
  coachNotes: z.string().optional().nullable(),
  markedBy: z.string().optional().nullable()
}).passthrough();

export const attendanceBatchSchema = z.object({
  records: z.array(attendanceItemSchema).min(1, 'Records array must contain at least one attendance record.')
});

// 2. Fee Schemas
export const createFeeSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  amount: z.coerce.number().positive('amount must be a positive number'),
  date: z.string().optional(),
  paidDate: z.string().optional(),
  yearMonth: z.string().optional(),
  milestone: z.string().optional(),
  status: z.enum(['Paid', 'Pending', 'Overdue', 'Waived']).optional().default('Paid'),
  receiptNumber: z.string().optional(),
  paymentMethod: z.string().optional().default('GPAY'),
  notes: z.string().optional()
}).passthrough();

export const updateFeeSchema = z.object({
  studentId: z.string().optional(),
  amount: z.coerce.number().positive('amount must be a positive number').optional(),
  date: z.string().optional(),
  paidDate: z.string().optional(),
  yearMonth: z.string().optional(),
  milestone: z.string().optional(),
  status: z.enum(['Paid', 'Pending', 'Overdue', 'Waived']).optional(),
  receiptNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional()
}).passthrough();

// 3. Demo Booking Schemas
export const createDemoBookingSchema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  parentName: z.string().optional().default('Parent'),
  age: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(n => !isNaN(n) && n >= 4 && n <= 18, 'Age must be between 4 and 18'),
  contactNumber: z.string().min(10, 'A valid 10-digit mobile number is required'),
  preferredDate: z.string().min(1, 'Preferred date is required'),
  preferredTimeSlot: z.string().min(1, 'Preferred time slot is required'),
  modeOfLearning: z.enum(['In-person', 'Online', 'In-Person', 'Hybrid']).optional().default('In-person'),
  notes: z.string().optional()
});

export const patchDemoBookingSchema = z.object({
  status: z.enum(['Scheduled', 'Contacted', 'Completed', 'Enrolled', 'Cancelled']).optional(),
  notes: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTimeSlot: z.string().optional()
});

// 4. Student Management Schemas
export const enrollStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'Student first name is required.'),
  lastName: z.string().trim().optional(),
  parentName: z.string().min(1, 'Parent/Guardian name is required.'),
  email: z.string().email('Valid parent contact email is required.'),
  age: z.coerce.number().int().min(4, 'Student age must be a valid number between 4 and 18.').max(18, 'Student age must be a valid number between 4 and 18.'),
  whatsappMobile: z.string().optional(),
  phoneNumber: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().optional(),
  isSiblingEnrollment: z.boolean().optional(),
  siblingOfStudentName: z.string().optional(),
  modeOfLearning: z.enum(['In-person', 'Online']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  enrollmentDate: z.string().optional(),
  gradeClass: z.string().optional(),
  schoolName: z.string().optional(),
  handwritingStyle: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  preferredDays: z.union([z.array(z.string()), z.string()]).optional(),
  preferredSlot: z.string().optional(),
  classesPerCycle: z.coerce.number().int().min(1, 'Classes per cycle must be at least 1.').max(50, 'Classes per cycle cannot exceed 50.').optional().default(8),
  feePerCycle: z.coerce.number().min(0, 'Fee per cycle must be non-negative.').optional().default(1600),
  notes: z.string().optional()
}).passthrough();

export const updateStudentSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  displayName: z.string().optional(),
  parentName: z.string().optional(),
  email: z.string().email().optional(),
  age: z.coerce.number().int().min(4).max(18).optional(),
  whatsappMobile: z.string().optional(),
  phoneNumber: z.string().optional(),
  phone: z.string().optional(),
  gradeClass: z.string().optional(),
  schoolName: z.string().optional(),
  handwritingStyle: z.string().optional(),
  modeOfLearning: z.enum(['In-person', 'Online']).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  enrollmentDate: z.string().optional(),
  dateOfLeaving: z.string().optional().nullable(),
  coachId: z.string().optional().nullable(),
  coachName: z.string().optional().nullable(),
  address: z.string().optional(),
  city: z.string().optional(),
  preferredDays: z.union([z.array(z.string()), z.string()]).optional(),
  preferredSlot: z.string().optional(),
  classesPerCycle: z.coerce.number().int().min(1, 'Classes per cycle must be at least 1.').max(50, 'Classes per cycle cannot exceed 50.').optional(),
  feePerCycle: z.coerce.number().min(0, 'Fee per cycle must be non-negative.').optional(),
  notes: z.string().optional()
}).passthrough();

export const switchStudentSchema = z.object({
  studentId: z.string().min(1, 'Target studentId is required.')
});

// 5. Coach Management Schemas
export const createCoachSchema = z.object({
  firstName: z.string().trim().min(1, 'Coach first name is required'),
  lastName: z.string().trim().optional().default(''),
  email: z.string().email('Valid coach email address is required'),
  phoneNumber: z.string().min(10, 'A valid 10-digit phone number is required'),
  password: z.string().min(8, 'Coach initial password must be at least 8 characters'),
  address: z.string().optional().default(''),
  dateOfJoining: z.string().optional(),
  dateOfLeaving: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).optional().default('Active'),
  educationalQualification: z.string().optional().default(''),
  designation: z.string().optional().default('Associate Tutor'),
  specializations: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional().default(''),
  emergencyContactPhone: z.string().optional().default(''),
  notes: z.string().optional().default('')
}).refine(data => {
  if (data.dateOfJoining && data.dateOfLeaving) {
    return new Date(data.dateOfLeaving) >= new Date(data.dateOfJoining);
  }
  return true;
}, {
  message: 'Date of leaving cannot be earlier than date of joining.',
  path: ['dateOfLeaving']
});

export const updateCoachSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  displayName: z.string().optional(),
  email: z.string().email('Valid coach email address is required').optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  dateOfJoining: z.string().optional(),
  dateOfLeaving: z.string().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  educationalQualification: z.string().optional(),
  designation: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional()
}).refine(data => {
  if (data.dateOfJoining && data.dateOfLeaving) {
    return new Date(data.dateOfLeaving) >= new Date(data.dateOfJoining);
  }
  return true;
}, {
  message: 'Date of leaving cannot be earlier than date of joining.',
  path: ['dateOfLeaving']
});

export const assignCoachSchema = z.object({
  coachId: z.string().nullable().optional()
});

// 6. Progress Tracking & Student Works Schemas
export const progressTrackerSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'studentId is required'),
  evaluationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'evaluationDate must be in YYYY-MM-DD format'),
  gripScore: z.coerce.number().optional(),
  letterFormationScore: z.coerce.number().optional(),
  spacingScore: z.coerce.number().optional(),
  speedScore: z.coerce.number().optional(),
  postureScore: z.coerce.number().optional(),
  overallScore: z.coerce.number().optional(),
  remarks: z.string().optional(),
  coachNotes: z.string().optional()
}).passthrough();

export const studentWorkUploadSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  imageData: z.string().min(1, 'imageData is required'),
  captureDate: z.string().optional(),
  category: z.string().optional().default('Classwork'),
  comments: z.string().optional()
}).passthrough();

export const bulkDeleteWorksSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids array must contain at least one ID')
});

// 7. Testimonial Schemas
export const createTestimonialSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  studentName: z.string().min(1, 'studentName is required'),
  parentName: z.string().optional().default('Parent'),
  grade: z.string().optional().default(''),
  schoolName: z.string().optional().default(''),
  relationship: z.string().optional().default('Parent'),
  rating: z.union([z.number(), z.string()]).transform(v => Number(v)).refine(n => !isNaN(n) && n >= 1 && n <= 5, 'Rating must be between 1 and 5'),
  title: z.string().optional().default(''),
  review: z.string().min(1, 'review text is required'),
  beforeAfterTag: z.string().optional().default('5 Star Transformation'),
  image: z.string().optional(),
  mediaConsent: z.boolean().optional().default(true)
});

export const patchTestimonialSchema = z.object({
  status: z.enum(['Pending', 'Approved', 'Featured']).optional(),
  rating: z.number().min(1).max(5).optional(),
  title: z.string().optional(),
  review: z.string().optional(),
  beforeAfterTag: z.string().optional()
});

// 8. Audit Logs Schema
export const auditLogsQuerySchema = z.object({
  page: z.union([z.number(), z.string()]).optional().transform(v => v ? Number(v) : undefined),
  limit: z.union([z.number(), z.string()]).optional().transform(v => v ? Number(v) : 50)
});
