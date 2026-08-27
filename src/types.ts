export type UserRole = 'admin' | 'student';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  studentId?: string;
  email: string;
  fullName: string;
}

export type StudentStatus = 'Active' | 'Inactive';
export type DominantHand = 'Right' | 'Left';
export type Gender = 'Male' | 'Female' | 'Other';

export interface StudentProfile {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  gradeClass: string;
  dominantHand: DominantHand;
  schoolName: string;
  instructionMedium: string;
  
  // Parent details
  parentName: string;
  relationship: string;
  whatsappMobile: string;
  email: string;
  residentialArea: string;

  // Program selection
  scriptsRequired: string[]; // e.g. 'Print / Block Script', 'Cursive Writing', 'Hindi Devanagari Script', 'English + Hindi Combination'
  academicModules: string[]; // e.g. 'Fine Motor & Grip (Ages 4-6)', 'Exam Speed & Layouts', 'Math/Science Layout Alignment', 'Diagram Labelling & Neatness'

  // Diagnostic checklist
  diagnosticObservations: string[];

  // Preferred schedule
  preferredDays: string; // e.g. 'Mon / Wed / Fri' or 'Tue / Thu / Sat'
  preferredSlot: string; // e.g. '5:00 - 6:00 PM', '5:30 - 6:30 PM', '6:00 - 7:00 PM'

  // Consents
  practiceCommitment: boolean;
  feePolicyAccepted: boolean;
  mediaConsent: boolean;

  // Demo day / coach assessment
  gripClassification?: 'Tripod' | 'Quadropod' | 'Other';
  initialPressureLevel?: 'Light' | 'Optimal' | 'Heavy';
  baselineSpeedWpm?: number;
  recommendedLevel?: string;
  coachRemarks?: string;

  // Account & system info
  username: string;
  password?: string;
  status: StudentStatus;
  enrollmentDate: string;
  createdAt: string;
  updatedAt: string;

  // Attached records
  attendanceHistory?: AttendanceRecord[];
  feeHistory?: FeeRecord[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM or Cycle identifier
  status: 'Present' | 'Absent';
  notes?: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  date?: string; // YYYY-MM-DD
  yearMonth: string; // Period / Milestone identifier (e.g. "August 2026")
  milestone?: string;
  period?: string;
  cycleNumber?: number;
  isPaid: boolean;
  status?: 'Paid' | 'Pending';
  paidDate?: string; // YYYY-MM-DD
  amount: number;
  paymentMethod?: string;
  receiptNumber?: string;
  receiptNo?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillRating {
  skillKey: string;
  skillName: string;
  beforeStars: number; // 1 to 5
  afterStars: number;  // 1 to 5
  progressNote: string;
}

export interface ProgressTracker {
  id: string;
  studentId: string;
  evaluationDate: string; // YYYY-MM-DD or Month Year
  evaluationTitle: string; // e.g., "After 10 Classes"
  completedClasses: number;
  totalClasses: number;
  skills: SkillRating[];
  overallStars: number;
  overallRemark: string;
  teacherFeedback: string;
  nextSteps: string[];
  comments?: string;
  createdAt: string;
}

export interface StudentWorkImage {
  id: string;
  studentId: string;
  imageData: string; // Base64 data URL or path in /student_works/
  captureDate: string; // YYYY-MM-DD
  comments: string;
  category?: 'Before' | 'After' | 'Practice' | 'Exam Sheet';
  createdAt: string;
}

export interface ProgressReport {
  id: string;
  studentId: string;
  reportDate: string; // YYYY-MM-DD
  reportTitle: string; // e.g. "SmartPen Academy Handwriting Progress Report"
  milestoneTitle: string; // e.g. "After 10 Classes"
  completedClasses: number;
  totalClasses: number;
  
  // Progress tracker data
  skills: SkillRating[];
  overallStars: number;
  overallRemark: string;
  teacherFeedback: string;
  nextSteps: string[];
  
  // Photos
  beforePhotoId?: string;
  beforePhotoData?: string;
  afterPhotoId?: string;
  afterPhotoData?: string;
  
  comments?: string;
  savedToFolder: string; // e.g. '/progress_reports/'
  createdAt: string;
  emailedToParentAt?: string;
}

export interface FeeReminder {
  id: string;
  studentId: string;
  parentEmail: string;
  parentName: string;
  studentName: string;
  amount: number;
  month: string;
  gpayLink: string;
  sentDate: string;
  status: 'Sent' | 'Failed';
}

export interface UpcomingWorkshop {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  date: string;
  duration: string;
  ageGroup: string;
  highlights: string[];
  image: string;
  enrollActionText: string;
}

export type DemoBookingStatus = 'New' | 'Contacted' | 'Demo Scheduled' | 'Enrolled' | 'Archived';

export interface DemoBooking {
  id: string;
  studentName: string;
  age: string;
  contactNumber: string;
  preferredSlot: string; // e.g. "All days (4 - 7 PM)"
  status: DemoBookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminAlert {
  id: string;
  type: 'demo_booking' | 'fee_due' | 'attendance_alert' | 'enrollment' | 'testimony';
  title: string;
  message: string;
  demoBookingId?: string;
  studentId?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export type TestimonyStatus = 'Pending' | 'Approved' | 'Featured';

export interface Testimonial {
  id: string;
  studentId: string;
  studentName: string;
  parentName: string;
  grade?: string;
  schoolName?: string;
  relationship?: string;
  rating: number; // 1 to 5
  title?: string;
  review: string;
  beforeAfterTag?: string;
  image?: string;
  mediaConsent: boolean;
  status: TestimonyStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface ToolAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorUsername: string;
  actorRole: UserRole;
  actorStudentId?: string;
  toolName: string;
  arguments: Record<string, any>;
  result: Record<string, any> | null;
  summary: string;
  success: boolean;
  executionMode: 'remote_gemini' | 'local_agent' | 'direct_api';
  ipAddress?: string;
}

