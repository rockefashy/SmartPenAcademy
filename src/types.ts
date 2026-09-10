export type UserRole = 'admin' | 'coach' | 'student';

export interface User {
  id: string;
  role: UserRole;
  username?: string;
  studentId?: string;
  coachId?: string | null;
  email: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  isActive?: boolean;
  designation?: string | null;
  authorizedStudentIds?: string[];
  siblingStudents?: { id: string; displayName?: string; age?: number }[];
}

export type CoachStatus = 'Active' | 'Inactive';

export interface CoachProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  address?: string;
  dateOfJoining?: string;
  status: CoachStatus;
  dateOfLeaving?: string;
  educationalQualification?: string;
  designation: 'Executive Tutor' | 'Principal Tutor' | 'Associate Tutor' | string;
  specializations?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  assignedStudentCount?: number;
  activeStudentsCount?: number;
  studentCount?: number;
  userId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type StudentStatus = 'Active' | 'Inactive';
export type DominantHand = 'Right' | 'Left';
export type Gender = 'Male' | 'Female' | 'Other';
export type ModeOfLearning = 'In-person' | 'Online';

export interface StudentProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  age?: number;
  dateOfBirth?: string;
  gender?: Gender;
  gradeClass?: string;
  dominantHand?: DominantHand;
  modeOfLearning?: ModeOfLearning;
  schoolName?: string;
  instructionMedium?: string;
  
  // Coach assignment (references users.id where role = 'coach')
  coachId?: string | null;
  coachName?: string | null;
  
  // Parent details
  parentName?: string;
  relationship?: string;
  whatsappMobile?: string;
  email?: string;
  residentialArea?: string;
  emergencyPhone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  // Program selection
  scriptsRequired?: string[]; // e.g. 'Print / Block Script', 'Cursive Writing', 'Hindi Devanagari Script', 'English + Hindi Combination'
  academicModules?: string[]; // e.g. 'Fine Motor & Grip (Ages 4-6)', 'Exam Speed & Layouts', 'Math/Science Layout Alignment', 'Diagram Labelling & Neatness'

  // Diagnostic checklist
  diagnosticObservations?: string[];

  // Preferred schedule
  preferredDays?: string; // e.g. 'Mon / Wed / Fri' or 'Tue / Thu / Sat'
  preferredSlot?: string; // e.g. '5:00 - 6:00 PM', '5:30 - 6:30 PM', '6:00 - 7:00 PM'

  // Consents
  practiceCommitment?: boolean;
  feePolicyAccepted?: boolean;
  mediaConsent?: boolean;

  // Demo day / coach assessment
  gripClassification?: 'Tripod' | 'Quadropod' | 'Other';
  initialPressureLevel?: 'Light' | 'Optimal' | 'Heavy';
  baselineSpeedWpm?: number;
  recommendedLevel?: string;
  coachRemarks?: string;

  // Account & system info
  userId?: string;
  username?: string;
  password?: string;
  status: StudentStatus;
  enrollmentDate: string;
  dateOfLeaving?: string;
  totalClasses?: number;
  attendedClasses?: number;
  notes?: string;
  avatarUrl?: string;
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
  yearMonth?: string; // YYYY-MM or Cycle identifier
  classNumber?: number;
  status: 'Present' | 'Absent';
  notes?: string;
  coachNotes?: string;
  markedBy?: string;
  createdAt?: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  date?: string; // YYYY-MM-DD
  yearMonth?: string; // Period / Milestone identifier (e.g. "August 2026")
  milestone?: string;
  period?: string;
  cycleNumber?: number;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Waived';
  paidDate?: string; // YYYY-MM-DD
  amount: number;
  paymentMethod?: string;
  receiptNumber?: string;
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
  evaluationDate?: string; // YYYY-MM-DD or Month Year
  evaluationTitle: string; // e.g., "After 10 Classes", "Baseline Assessment", "Final Review"
  milestoneTitle?: string;
  completedClasses?: number;
  totalClasses?: number;
  skills?: SkillRating[];
  overallStars: number;
  formationStars?: number;
  spacingStars?: number;
  alignmentStars?: number;
  speedStars?: number;
  gripPostureStars?: number;
  overallRemark: string;
  teacherFeedback?: string;
  nextSteps?: string[];
  targetScore?: number;
  currentScore?: number;
  speedWpm?: number;
  baselineSpeedWpm?: number;
  pressureLevel?: string;
  beforePhotoData?: string;
  afterPhotoData?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  isUnlocked?: boolean;
  comments?: string;
  emailedToParentAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentWorkImage {
  id: string;
  studentId: string;
  imageData: string; // Base64 data URL or path in /student_works/
  captureDate: string; // YYYY-MM-DD
  comments: string;
  category?: 'Before' | 'After' | 'Practice' | 'Exam Sheet' | string;
  createdAt?: string;
}

export interface ProgressReport {
  id: string;
  studentId: string;
  reportDate: string; // YYYY-MM-DD
  reportTitle?: string; // e.g. "SmartPen Academy Handwriting Progress Report"
  milestoneTitle?: string; // e.g. "After 10 Classes"
  completedClasses: number;
  totalClasses: number;
  
  // Progress tracker data
  skills?: SkillRating[];
  overallStars: number;
  overallRemark: string;
  teacherFeedback?: string;
  nextSteps?: string[];
  
  // Photos
  beforePhotoId?: string;
  beforePhotoData?: string;
  afterPhotoId?: string;
  afterPhotoData?: string;
  
  comments?: string;
  savedToFolder?: string; // e.g. '/progress_reports/'
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
  sentAt?: string;
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

export type DemoBookingStatus = 'Scheduled' | 'Contacted' | 'Completed' | 'Enrolled' | 'Cancelled';

export interface DemoBooking {
  id: string;
  studentName: string;
  parentName: string;
  age: string;
  contactNumber: string;
  preferredDate: string; // e.g. "2026-09-02"
  preferredTimeSlot: string; // e.g. "04:00 PM"
  modeOfLearning?: ModeOfLearning;
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

export type AuditExecutionMode = 'remote_gemini' | 'local_agent' | 'direct_api';

export interface ToolAuditLog {
  id: string;
  timestamp?: string;
  actorId?: string;
  actorUsername?: string;
  actorRole?: UserRole;
  actorStudentId?: string;
  userId?: string;
  userRole?: string;
  toolName: string;
  arguments: Record<string, any>;
  result: Record<string, any> | null;
  summary?: string;
  actionSummary?: string;
  status?: string;
  success?: boolean;
  executionMode?: AuditExecutionMode;
  ipAddress?: string;
  createdAt?: string;
}

export interface StudentOption {
  id: string;
  studentId: string;
  displayName: string;
  age?: number;
  gradeClass?: string;
  schoolName?: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
  requiresRoleSelection?: boolean;
  requiresStudentSelection?: boolean;
  selectionToken?: string;
  availableRoles?: UserRole[];
  availableStudents?: StudentOption[];
  message?: string;
}


