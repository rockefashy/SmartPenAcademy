import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { 
  StudentProfile, 
  AttendanceRecord, 
  FeeRecord, 
  ProgressTracker, 
  StudentWorkImage, 
  ProgressReport, 
  FeeReminder,
  User,
  DemoBooking,
  AdminAlert,
  DemoBookingStatus,
  Testimonial,
  ToolAuditLog
} from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'smartpen_db.json');

interface DatabaseState {
  users: (User & { passwordHash: string; rawPassword?: string })[];
  students: StudentProfile[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  progressTrackers: ProgressTracker[];
  studentWorks: StudentWorkImage[];
  progressReports: ProgressReport[];
  feeReminders: FeeReminder[];
  demoBookings: DemoBooking[];
  alerts: AdminAlert[];
  testimonials?: Testimonial[];
  toolAuditLogs?: ToolAuditLog[];
}

// Initial Realistic Seed Data
const initialSeedData = (): DatabaseState => {
  const adminPasswordHash = bcrypt.hashSync('password123', 8);
  const studentPasswordHash = bcrypt.hashSync('password123', 8);

  const initialStudents: StudentProfile[] = [
    {
      id: 'std-101',
      fullName: 'Khwaish Sharma',
      dateOfBirth: '2016-04-12',
      gender: 'Female',
      gradeClass: 'Grade 5-A',
      dominantHand: 'Right',
      schoolName: "St. Joseph's Convent School",
      instructionMedium: 'English',
      parentName: 'Mrs. Sunita Sharma',
      relationship: 'Mother',
      whatsappMobile: '+91 98402 11234',
      email: 'parent.khwaish@gmail.com',
      residentialArea: 'Anna Nagar, Chennai',
      scriptsRequired: ['Print / Block Script', 'Cursive Writing'],
      academicModules: ['Exam Speed & Layouts', 'Math/Science Layout Alignment'],
      diagnosticObservations: [
        'Letters are floating off lines or inconsistent in size',
        'Writing speed is too slow during exams/tests',
        'Awkward grip / complains of hand fatigue or pain'
      ],
      preferredDays: 'Mon / Wed / Fri',
      preferredSlot: '5:00 - 6:00 PM',
      practiceCommitment: true,
      feePolicyAccepted: true,
      mediaConsent: true,
      gripClassification: 'Tripod',
      initialPressureLevel: 'Heavy',
      baselineSpeedWpm: 16,
      recommendedLevel: 'Level 2 - Cursive & Speed Foundation',
      coachRemarks: 'Initial grip showed tight distal joint flexion with heavy pressure. Moving to relaxed dynamic tripod with 4-line guides.',
      username: 'student_khwaish',
      password: 'password123',
      status: 'Active',
      enrollmentDate: '2026-06-01',
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-08-20T14:30:00.000Z'
    },
    {
      id: 'std-102',
      fullName: 'Aarav Mehta',
      dateOfBirth: '2013-09-22',
      gender: 'Male',
      gradeClass: 'Grade 8-B',
      dominantHand: 'Right',
      schoolName: 'Delhi Public School',
      instructionMedium: 'English',
      parentName: 'Dr. Rajesh Mehta',
      relationship: 'Father',
      whatsappMobile: '+91 98840 55678',
      email: 'dr.rajesh.mehta@gmail.com',
      residentialArea: 'Nungambakkam, Chennai',
      scriptsRequired: ['Cursive Writing', 'English + Hindi Combination'],
      academicModules: ['Exam Speed & Layouts', 'Diagram Labelling & Neatness'],
      diagnosticObservations: [
        'Writing speed is too slow during exams/tests',
        'Messy layout in Math formulas & numericals'
      ],
      preferredDays: 'Tue / Thu / Sat',
      preferredSlot: '5:30 - 6:30 PM',
      practiceCommitment: true,
      feePolicyAccepted: true,
      mediaConsent: true,
      gripClassification: 'Quadropod',
      initialPressureLevel: 'Heavy',
      baselineSpeedWpm: 18,
      recommendedLevel: 'Level 3 - Exam Presentation & Speed Mastery',
      coachRemarks: 'High intelligence and good vocabulary; handwriting suffers under exam time limits. Focus on stroke flow.',
      username: 'student_aarav',
      password: 'password123',
      status: 'Active',
      enrollmentDate: '2026-06-15',
      createdAt: '2026-06-15T11:00:00.000Z',
      updatedAt: '2026-08-22T09:15:00.000Z'
    },
    {
      id: 'std-103',
      fullName: 'Ananya Raghavan',
      dateOfBirth: '2018-02-14',
      gender: 'Female',
      gradeClass: 'Grade 3',
      dominantHand: 'Right',
      schoolName: 'The Pupil International School',
      instructionMedium: 'English',
      parentName: 'Mrs. Pooja Raghavan',
      relationship: 'Mother',
      whatsappMobile: '+91 97910 88231',
      email: 'pooja.raghavan@gmail.com',
      residentialArea: 'Adyar, Chennai',
      scriptsRequired: ['Cursive Writing'],
      academicModules: ['Fine Motor & Grip (Ages 4-6)'],
      diagnosticObservations: [
        'Uneven word spacing / crowded text',
        'Dislikes writing tasks / lacks confidence'
      ],
      preferredDays: 'Mon / Wed / Fri',
      preferredSlot: '6:00 - 7:00 PM',
      practiceCommitment: true,
      feePolicyAccepted: true,
      mediaConsent: true,
      gripClassification: 'Tripod',
      initialPressureLevel: 'Light',
      baselineSpeedWpm: 12,
      recommendedLevel: 'Level 1 - Junior Cursive Flow',
      coachRemarks: 'Enthusiastic child. Needs confidence in cursive connecting loops.',
      username: 'student_ananya',
      password: 'password123',
      status: 'Active',
      enrollmentDate: '2026-07-01',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-08-23T11:00:00.000Z'
    },
    {
      id: 'std-104',
      fullName: 'Siddharth Iyer',
      dateOfBirth: '2011-11-05',
      gender: 'Male',
      gradeClass: 'Grade 10-C',
      dominantHand: 'Right',
      schoolName: 'Chettinad Vidyashram',
      instructionMedium: 'English',
      parentName: 'Venkatesh Iyer',
      relationship: 'Father',
      whatsappMobile: '+91 94440 33412',
      email: 'v.iyer@gmail.com',
      residentialArea: 'R.A. Puram, Chennai',
      scriptsRequired: ['Print / Block Script', 'English + Hindi Combination'],
      academicModules: ['Exam Speed & Layouts', 'Math/Science Layout Alignment'],
      diagnosticObservations: [
        'Writing speed is too slow during exams/tests',
        'Awkward grip / complains of hand fatigue or pain'
      ],
      preferredDays: 'Tue / Thu / Sat',
      preferredSlot: '6:00 - 7:00 PM',
      practiceCommitment: true,
      feePolicyAccepted: true,
      mediaConsent: true,
      gripClassification: 'Tripod',
      initialPressureLevel: 'Optimal',
      baselineSpeedWpm: 21,
      recommendedLevel: 'Level 4 - Board Exam Speed Polishing',
      coachRemarks: 'Preparing for 10th ICSE Boards. Focus on bulleting, equations and underline presentation.',
      username: 'student_siddharth',
      password: 'password123',
      status: 'Active',
      enrollmentDate: '2026-07-10',
      createdAt: '2026-07-10T14:00:00.000Z',
      updatedAt: '2026-08-20T16:00:00.000Z'
    },
    {
      id: 'std-105',
      fullName: 'Rhea Nambiar',
      dateOfBirth: '2020-08-19',
      gender: 'Female',
      gradeClass: 'UKG / Kindergarten',
      dominantHand: 'Left',
      schoolName: 'Little Millennium Play School',
      instructionMedium: 'English',
      parentName: 'Deepa Nambiar',
      relationship: 'Mother',
      whatsappMobile: '+91 99620 44556',
      email: 'deepa.nambiar@gmail.com',
      residentialArea: 'Besant Nagar, Chennai',
      scriptsRequired: ['Print / Block Script'],
      academicModules: ['Fine Motor & Grip (Ages 4-6)'],
      diagnosticObservations: [
        'Awkward grip / complains of hand fatigue or pain',
        'Letters are floating off lines or inconsistent in size'
      ],
      preferredDays: 'Mon / Wed / Fri',
      preferredSlot: '5:00 - 6:00 PM',
      practiceCommitment: true,
      feePolicyAccepted: true,
      mediaConsent: true,
      gripClassification: 'Tripod',
      initialPressureLevel: 'Light',
      baselineSpeedWpm: 9,
      recommendedLevel: 'Early Scribbler - Left Hand Grip Adaptation',
      coachRemarks: 'Left hand writer. Paper angle positioned at +35 degrees to avoid wrist hook.',
      username: 'student_rhea',
      password: 'password123',
      status: 'Inactive',
      enrollmentDate: '2026-05-15',
      createdAt: '2026-05-15T09:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z'
    }
  ];

  const initialUsers: (User & { passwordHash: string; rawPassword?: string })[] = [
    {
      id: 'usr-admin',
      username: 'admin',
      role: 'admin',
      passwordHash: adminPasswordHash,
      rawPassword: 'password123',
      fullName: 'Mrs. Deepthy Rock (Principal Coach)',
      email: 'rockefashy@gmail.com'
    },
    ...initialStudents.map((s) => ({
      id: `usr-${s.id}`,
      username: s.username,
      role: 'student' as const,
      studentId: s.id,
      passwordHash: studentPasswordHash,
      rawPassword: s.password || 'password123',
      fullName: s.fullName,
      email: s.email
    }))
  ];

  // Seed August 2026 attendance for active students
  const initialAttendance: AttendanceRecord[] = [
    // Khwaish (10 attended sessions in August 2026)
    { id: 'att-1', studentId: 'std-101', date: '2026-08-03', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-2', studentId: 'std-101', date: '2026-08-05', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-3', studentId: 'std-101', date: '2026-08-07', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-4', studentId: 'std-101', date: '2026-08-10', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-5', studentId: 'std-101', date: '2026-08-12', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-6', studentId: 'std-101', date: '2026-08-14', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-7', studentId: 'std-101', date: '2026-08-17', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-8', studentId: 'std-101', date: '2026-08-19', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-9', studentId: 'std-101', date: '2026-08-21', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-10', studentId: 'std-101', date: '2026-08-24', yearMonth: '2026-08', status: 'Present' },

    // Aarav (8 attended in August 2026)
    { id: 'att-11', studentId: 'std-102', date: '2026-08-04', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-12', studentId: 'std-102', date: '2026-08-06', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-13', studentId: 'std-102', date: '2026-08-08', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-14', studentId: 'std-102', date: '2026-08-11', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-15', studentId: 'std-102', date: '2026-08-13', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-16', studentId: 'std-102', date: '2026-08-18', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-17', studentId: 'std-102', date: '2026-08-20', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-18', studentId: 'std-102', date: '2026-08-22', yearMonth: '2026-08', status: 'Present' },

    // Ananya (9 attended in August 2026)
    { id: 'att-19', studentId: 'std-103', date: '2026-08-03', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-20', studentId: 'std-103', date: '2026-08-05', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-21', studentId: 'std-103', date: '2026-08-07', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-22', studentId: 'std-103', date: '2026-08-10', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-23', studentId: 'std-103', date: '2026-08-12', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-24', studentId: 'std-103', date: '2026-08-14', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-25', studentId: 'std-103', date: '2026-08-17', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-26', studentId: 'std-103', date: '2026-08-19', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-27', studentId: 'std-103', date: '2026-08-21', yearMonth: '2026-08', status: 'Present' },

    // Siddharth (8 attended in August 2026)
    { id: 'att-28', studentId: 'std-104', date: '2026-08-04', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-29', studentId: 'std-104', date: '2026-08-06', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-30', studentId: 'std-104', date: '2026-08-11', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-31', studentId: 'std-104', date: '2026-08-13', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-32', studentId: 'std-104', date: '2026-08-18', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-33', studentId: 'std-104', date: '2026-08-20', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-34', studentId: 'std-104', date: '2026-08-22', yearMonth: '2026-08', status: 'Present' },
    { id: 'att-35', studentId: 'std-104', date: '2026-08-24', yearMonth: '2026-08', status: 'Present' },

    // June & July Historical Records for Khwaish
    { id: 'att-june-1', studentId: 'std-101', date: '2026-06-03', yearMonth: '2026-06', status: 'Present' },
    { id: 'att-june-2', studentId: 'std-101', date: '2026-06-10', yearMonth: '2026-06', status: 'Present' },
    { id: 'att-july-1', studentId: 'std-101', date: '2026-07-06', yearMonth: '2026-07', status: 'Present' },
    { id: 'att-july-2', studentId: 'std-101', date: '2026-07-13', yearMonth: '2026-07', status: 'Present' },
    { id: 'att-july-3', studentId: 'std-101', date: '2026-07-20', yearMonth: '2026-07', status: 'Present' }
  ];

  // Seed Fee Records (Month-wise milestone tracking with in-person reception settlement)
  const initialFees: FeeRecord[] = [
    // Khwaish (August 2026 Paid)
    { id: 'fee-1', studentId: 'std-101', date: '2026-08-04', yearMonth: 'August 2026', milestone: 'August 2026', isPaid: true, status: 'Paid', paidDate: '2026-08-04', amount: 1600, receiptNumber: 'REC-101-AUG26', receiptNo: 'REC-101-AUG26', paymentMethod: 'In-Person Reception - UPI / GPay' },
    
    // Aarav (August 2026 Paid)
    { id: 'fee-2', studentId: 'std-102', date: '2026-08-05', yearMonth: 'August 2026', milestone: 'August 2026', isPaid: true, status: 'Paid', paidDate: '2026-08-05', amount: 1600, receiptNumber: 'REC-102-AUG26', receiptNo: 'REC-102-AUG26', paymentMethod: 'In-Person Reception - Cash' },
    
    // Ananya (August 2026 Unpaid / Due)
    { id: 'fee-3', studentId: 'std-103', date: '2026-08-20', yearMonth: 'August 2026', milestone: 'August 2026', isPaid: false, status: 'Pending', amount: 1600, receiptNumber: 'REC-103-AUG26', receiptNo: 'REC-103-AUG26', paymentMethod: 'In-Person Reception - Cash' },
    
    // Siddharth (August 2026 Paid)
    { id: 'fee-4', studentId: 'std-104', date: '2026-08-02', yearMonth: 'August 2026', milestone: 'August 2026', isPaid: true, status: 'Paid', paidDate: '2026-08-02', amount: 1600, receiptNumber: 'REC-104-AUG26', receiptNo: 'REC-104-AUG26', paymentMethod: 'In-Person Reception - Card / POS' }
  ];

  // Seed Progress Tracker (Exact copy of the attached progress tracker.jpeg for Khwaish)
  const initialProgressTrackers: ProgressTracker[] = [
    {
      id: 'prog-1',
      studentId: 'std-101',
      evaluationDate: '2026-08-20',
      evaluationTitle: 'After 10 Classes',
      completedClasses: 10,
      totalClasses: 12,
      skills: [
        {
          skillKey: 'letterFormation',
          skillName: 'Letter Formation',
          beforeStars: 2,
          afterStars: 3,
          progressNote: 'Good improvement in letter shapes and clarity'
        },
        {
          skillKey: 'letterSizeSpacing',
          skillName: 'Letter Size & Spacing',
          beforeStars: 2,
          afterStars: 3,
          progressNote: 'More consistent size and better spacing'
        },
        {
          skillKey: 'lineAlignment',
          skillName: 'Line Alignment',
          beforeStars: 2,
          afterStars: 3,
          progressNote: 'Letters are mostly on the line'
        },
        {
          skillKey: 'pencilControl',
          skillName: 'Pencil Control',
          beforeStars: 2,
          afterStars: 3,
          progressNote: 'Better control and smoother writing'
        },
        {
          skillKey: 'overallPresentation',
          skillName: 'Overall Presentation',
          beforeStars: 2,
          afterStars: 4,
          progressNote: 'Neater, cleaner and more confident writing'
        }
      ],
      overallStars: 3,
      overallRemark: 'Significant improvement within star range. Keep practicing!',
      teacherFeedback: 'Khwaish has shown fantastic dedication over her first 10 classes! Moving from 2 stars to a solid 3-4 stars reflects great foundation-building in letter formation, spacing, alignment, and overall handwriting. With consistent home practice and completion of the remaining classes, we will achieve even more neatness, consistency and confidence!',
      nextSteps: [
        'Maintain consistent practice at home',
        'Focus on neatness and line alignment',
        'Apply the same handwriting in schoolwork'
      ],
      comments: 'Regular 10 mins daily warmups recommended.',
      createdAt: '2026-08-20T12:00:00.000Z'
    }
  ];

  // Seed sample writing works
  const initialStudentWorks: StudentWorkImage[] = [
    {
      id: 'work-1',
      studentId: 'std-101',
      imageData: '/student_works/khwaish_before.png',
      captureDate: '2026-06-03',
      category: 'Before',
      comments: 'Baseline diagnostic sample. Notice uneven baseline and inconsistent letter sizing.',
      createdAt: '2026-06-03T10:00:00.000Z'
    },
    {
      id: 'work-2',
      studentId: 'std-101',
      imageData: '/student_works/khwaish_after.png',
      captureDate: '2026-08-20',
      category: 'After',
      comments: 'After 10 classes sample. Crisp uniform slant, tight baseline alignment, and neat spacing.',
      createdAt: '2026-08-20T11:30:00.000Z'
    }
  ];

  // Seed generated progress report
  const initialReports: ProgressReport[] = [
    {
      id: 'rep-1',
      studentId: 'std-101',
      reportDate: '2026-08-20',
      reportTitle: 'SMART PEN ACADEMY HANDWRITING PROGRESS REPORT',
      milestoneTitle: 'After 10 Classes',
      completedClasses: 10,
      totalClasses: 12,
      skills: initialProgressTrackers[0].skills,
      overallStars: 3,
      overallRemark: initialProgressTrackers[0].overallRemark,
      teacherFeedback: initialProgressTrackers[0].teacherFeedback,
      nextSteps: initialProgressTrackers[0].nextSteps,
      beforePhotoId: 'work-1',
      beforePhotoData: '/student_works/khwaish_before.png',
      afterPhotoId: 'work-2',
      afterPhotoData: '/student_works/khwaish_after.png',
      comments: 'Official report issued by SmartPen Academy.',
      savedToFolder: '/progress_reports/',
      createdAt: '2026-08-20T14:00:00.000Z',
      emailedToParentAt: '2026-08-20T14:05:00.000Z'
    }
  ];

  const initialDemoBookings: DemoBooking[] = [
    {
      id: 'demo-201',
      studentName: 'Rohan Varma',
      age: '9 years (Grade 4)',
      contactNumber: '8861751000',
      preferredSlot: 'All days: 5:00 PM - 6:00 PM',
      status: 'New',
      notes: 'Parent inquiring for cursive grip guidance and exam writing speed before term exams.',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'demo-202',
      studentName: 'Meera Nambiar',
      age: '6 years (UKG / Grade 1)',
      contactNumber: '9900145672',
      preferredSlot: 'All days: 4:00 PM - 5:00 PM',
      status: 'Contacted',
      notes: 'Beginner fine motor tripod grip camp inquiry at Electronic City Bangalore center.',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 43200000).toISOString(),
    }
  ];

  const initialAlerts: AdminAlert[] = [
    {
      id: 'alt-1',
      type: 'demo_booking',
      title: 'New Free Demo Class Booking',
      message: 'Rohan Varma (9 yrs) requested slot All days: 5:00 PM - 6:00 PM. Contact: 8861751000',
      demoBookingId: 'demo-201',
      isRead: false,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'alt-2',
      type: 'demo_booking',
      title: 'Free Demo Class Inquiry',
      message: 'Meera Nambiar (6 yrs) requested slot All days: 4:00 PM - 5:00 PM. Contact: 9900145672',
      demoBookingId: 'demo-202',
      isRead: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ];

  const initialTestimonials: Testimonial[] = [
    {
      id: 'test-1',
      studentId: 'std-101',
      studentName: 'Khwaish Sharma',
      parentName: 'Mrs. Sunita Sharma',
      grade: 'Grade 5, St. Joseph\'s',
      schoolName: 'St. Joseph\'s Convent School',
      relationship: 'Mother',
      rating: 5,
      title: 'Miraculous transformation in just 10 classes!',
      review: 'Khwaish\'s handwriting improved miraculously in just 10 classes! Earlier, teachers struggled to read her exam answers. Now her notebook is showcased as an example in class.',
      beforeAfterTag: 'From 2 Stars to 5 Stars',
      mediaConsent: true,
      status: 'Featured',
      createdAt: '2026-07-15T10:00:00.000Z'
    },
    {
      id: 'test-2',
      studentId: 'std-102',
      studentName: 'Aarav Mehta',
      parentName: 'Dr. Rajesh Mehta',
      grade: 'Grade 8, DPS',
      schoolName: 'Delhi Public School',
      relationship: 'Father',
      rating: 5,
      title: 'Exam fatigue eliminated completely!',
      review: 'Aarav used to suffer terrible wrist pain during unit tests and couldn\'t finish papers. Mrs. Deepthy Rock\'s grip correction and speed techniques solved everything!',
      beforeAfterTag: 'Speed increased by 14 WPM',
      mediaConsent: true,
      status: 'Featured',
      createdAt: '2026-07-20T14:30:00.000Z'
    },
    {
      id: 'test-3',
      studentId: 'std-103',
      studentName: 'Ananya Raghavan',
      parentName: 'Pooja Raghavan',
      grade: 'Grade 3, Cambridge Intl',
      schoolName: 'Cambridge International School',
      relationship: 'Mother',
      rating: 5,
      title: 'Beautiful cursive with so much pride!',
      review: 'The progress tracker report with before/after photos gave us complete visibility into Ananya\'s daily growth. She now writes cursive with so much pride.',
      beforeAfterTag: 'Flawless Cursive Flow',
      mediaConsent: true,
      status: 'Featured',
      createdAt: '2026-07-28T09:15:00.000Z'
    }
  ];

  return {
    users: initialUsers,
    students: initialStudents,
    attendance: initialAttendance,
    fees: initialFees,
    progressTrackers: initialProgressTrackers,
    studentWorks: initialStudentWorks,
    progressReports: initialReports,
    feeReminders: [],
    demoBookings: initialDemoBookings,
    alerts: initialAlerts,
    testimonials: initialTestimonials
  };
};

// Database Singleton
class Database {
  private state: DatabaseState;

  constructor() {
    this.ensureDirectory();
    this.state = this.loadData();
  }

  private ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const uploadsDirs = [
      path.join(process.cwd(), 'public', 'student_works'),
      path.join(process.cwd(), 'public', 'progress_reports'),
      path.join(process.cwd(), 'public', 'app_images'),
      path.join(process.cwd(), 'public', 'testimonials')
    ];
    uploadsDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private loadData(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading DB file, reinitializing default seed:', e);
    }
    const seed = initialSeedData();
    this.saveData(seed);
    return seed;
  }

  private saveData(data?: DatabaseState) {
    try {
      const dataToSave = data || this.state;
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist DB file:', e);
    }
  }

  // Users & Auth
  findUserByUsername(username: string) {
    return this.state.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  }

  findUserByEmailOrUsername(query: string) {
    const q = query.toLowerCase().trim();
    return this.state.users.find(u => u.username.toLowerCase() === q || u.email.toLowerCase() === q);
  }

  createUser(user: User & { passwordHash: string; rawPassword?: string }) {
    this.state.users.push(user);
    this.saveData();
    return user;
  }

  // Students
  getAllStudents() {
    // Sort active students first, then by fullName
    return [...this.state.students].sort((a, b) => {
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (a.status !== 'Active' && b.status === 'Active') return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }

  getStudentById(id: string) {
    return this.state.students.find(s => s.id === id);
  }

  createStudent(profile: StudentProfile) {
    this.state.students.push(profile);
    
    // Also create matching user account
    const password = profile.password || 'password123';
    const passwordHash = bcrypt.hashSync(password, 8);
    
    this.state.users.push({
      id: `usr-${profile.id}`,
      username: profile.username,
      role: 'student',
      studentId: profile.id,
      passwordHash,
      rawPassword: password,
      fullName: profile.fullName,
      email: profile.email
    });

    this.saveData();
    return profile;
  }

  updateStudent(id: string, updates: Partial<StudentProfile>) {
    const idx = this.state.students.findIndex(s => s.id === id);
    if (idx === -1) return null;

    this.state.students[idx] = {
      ...this.state.students[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Update matching user if username, password, or email updated
    const userIdx = this.state.users.findIndex(u => u.studentId === id);
    if (userIdx !== -1) {
      if (updates.username) this.state.users[userIdx].username = updates.username;
      if (updates.email) this.state.users[userIdx].email = updates.email;
      if (updates.fullName) this.state.users[userIdx].fullName = updates.fullName;
      if (updates.password) {
        this.state.users[userIdx].rawPassword = updates.password;
        this.state.users[userIdx].passwordHash = bcrypt.hashSync(updates.password, 8);
      }
    }

    this.saveData();
    return this.state.students[idx];
  }

  // Attendance
  getAttendanceByMonth(yearMonth: string) {
    return this.state.attendance.filter(a => a.yearMonth === yearMonth);
  }

  getAttendanceByStudent(studentId: string) {
    return this.state.attendance.filter(a => a.studentId === studentId);
  }

  saveAttendanceBatch(records: Omit<AttendanceRecord, 'id'>[]) {
    records.forEach(rec => {
      const existingIdx = this.state.attendance.findIndex(
        a => a.studentId === rec.studentId && a.date === rec.date
      );
      if (existingIdx !== -1) {
        this.state.attendance[existingIdx] = { ...this.state.attendance[existingIdx], ...rec };
      } else {
        this.state.attendance.push({
          ...rec,
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        });
      }
    });
    this.checkAndGenerateFeeAlerts();
    this.saveData();
    return true;
  }

  deleteAttendance(studentId: string, date: string) {
    this.state.attendance = this.state.attendance.filter(
      a => !(a.studentId === studentId && a.date === date)
    );
    this.checkAndGenerateFeeAlerts();
    this.saveData();
    return true;
  }

  // Fees (₹1,600 per 8-class cycle)
  getFeesByMonth(yearMonth: string) {
    return this.state.fees.filter(f => f.yearMonth === yearMonth);
  }

  getFeesByStudent(studentId: string) {
    return this.state.fees
      .filter(f => f.studentId === studentId)
      .sort((a, b) => new Date(b.date || b.paidDate || '2026-01-01').getTime() - new Date(a.date || a.paidDate || '2026-01-01').getTime());
  }

  saveFeeRecord(fee: Omit<FeeRecord, 'id'> & { id?: string }) {
    const isPaid = fee.isPaid ?? (fee.status === 'Paid');
    const status = fee.status || (isPaid ? 'Paid' : 'Pending');
    const milestone = fee.milestone || fee.yearMonth || 'August 2026';
    const date = fee.date || fee.paidDate || new Date().toISOString().split('T')[0];
    const receiptNumber = fee.receiptNumber || fee.receiptNo || (isPaid ? `REC-${Date.now().toString().slice(-6)}` : undefined);

    let savedRecord: FeeRecord;

    if (fee.id) {
      const existingIdx = this.state.fees.findIndex(f => f.id === fee.id);
      if (existingIdx !== -1) {
        this.state.fees[existingIdx] = {
          ...this.state.fees[existingIdx],
          ...fee,
          date,
          yearMonth: milestone,
          milestone,
          isPaid,
          status,
          receiptNumber,
          receiptNo: receiptNumber,
          updatedAt: new Date().toISOString()
        };
        savedRecord = this.state.fees[existingIdx];
      } else {
        const newRec: FeeRecord = {
          ...fee,
          id: fee.id,
          date,
          yearMonth: milestone,
          milestone,
          isPaid,
          status,
          receiptNumber,
          receiptNo: receiptNumber,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.state.fees.push(newRec);
        savedRecord = newRec;
      }
    } else {
      const newRec: FeeRecord = {
        ...fee,
        id: `fee-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        date,
        yearMonth: milestone,
        milestone,
        isPaid,
        status,
        receiptNumber,
        receiptNo: receiptNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.fees.push(newRec);
      savedRecord = newRec;
    }

    // If marked paid, mark matching fee alerts as read
    if (savedRecord.isPaid) {
      if (!this.state.alerts) this.state.alerts = [];
      this.state.alerts.forEach(a => {
        if (a.type === 'fee_due' && a.studentId === savedRecord.studentId) {
          if (!a.metadata?.cycleLabel || a.metadata.cycleLabel === savedRecord.yearMonth || a.metadata.cycleLabel === savedRecord.milestone) {
            a.isRead = true;
          }
        }
      });
    }

    this.checkAndGenerateFeeAlerts();
    this.saveData();
    return savedRecord;
  }

  updateFeeRecord(id: string, updates: Partial<FeeRecord>) {
    const idx = this.state.fees.findIndex(f => f.id === id);
    if (idx === -1) return null;

    const isPaid = updates.isPaid !== undefined 
      ? updates.isPaid 
      : (updates.status ? updates.status === 'Paid' : this.state.fees[idx].isPaid);
    const status = updates.status || (isPaid ? 'Paid' : 'Pending');
    const milestone = updates.milestone || updates.yearMonth || this.state.fees[idx].milestone || this.state.fees[idx].yearMonth;
    const receiptNumber = updates.receiptNumber || updates.receiptNo || this.state.fees[idx].receiptNumber || this.state.fees[idx].receiptNo;

    this.state.fees[idx] = {
      ...this.state.fees[idx],
      ...updates,
      milestone,
      yearMonth: milestone,
      isPaid,
      status,
      receiptNumber,
      receiptNo: receiptNumber,
      paidDate: isPaid ? (updates.paidDate || this.state.fees[idx].paidDate || updates.date || new Date().toISOString().split('T')[0]) : undefined,
      updatedAt: new Date().toISOString()
    };

    if (isPaid) {
      if (!this.state.alerts) this.state.alerts = [];
      this.state.alerts.forEach(a => {
        if (a.type === 'fee_due' && a.studentId === this.state.fees[idx].studentId) {
          a.isRead = true;
        }
      });
    }

    this.checkAndGenerateFeeAlerts();
    this.saveData();
    return this.state.fees[idx];
  }

  deleteFeeRecord(id: string) {
    const initialLen = this.state.fees.length;
    this.state.fees = this.state.fees.filter(f => String(f.id) !== String(id));
    this.checkAndGenerateFeeAlerts();
    this.saveData();
    return this.state.fees.length < initialLen;
  }

  // Fee Due Alert Generator (Fires when 8 classes attendance are completed and no fee receipt is made)
  checkAndGenerateFeeAlerts() {
    if (!this.state.alerts) this.state.alerts = [];
    if (!this.state.students || !this.state.attendance) return;

    let hasChanges = false;

    this.state.students.forEach(student => {
      // Get all 'Present' classes sorted chronologically
      const presentRecords = this.state.attendance
        .filter(a => a.studentId === student.id && a.status === 'Present')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const attendedCount = presentRecords.length;
      if (attendedCount < 8) return;

      const completedCycles = Math.floor(attendedCount / 8);
      const studentFees = this.state.fees.filter(f => f.studentId === student.id);

      for (let k = 1; k <= completedCycles; k++) {
        const cycleLabel = `Classes ${(k - 1) * 8 + 1} - ${k * 8}`;
        const eighthClassRecord = presentRecords[k * 8 - 1];
        const eighthClassDate = eighthClassRecord ? eighthClassRecord.date : '';

        // Check if there is a paid fee record for this cycle (or k-th paid record)
        const hasPaidReceipt = studentFees.some(f => f.isPaid && f.yearMonth === cycleLabel) ||
          (studentFees.filter(f => f.isPaid).length >= k);

        const alertId = `alt-fee-${student.id}-c${k}`;
        const existingAlertIdx = this.state.alerts.findIndex(
          a => a.id === alertId || (a.type === 'fee_due' && a.studentId === student.id && a.metadata?.cycle === k)
        );

        if (!hasPaidReceipt) {
          if (existingAlertIdx === -1) {
            const feeAlert: AdminAlert = {
              id: alertId,
              type: 'fee_due',
              title: `Fee Due: 8 Classes Completed (₹1,600)`,
              message: `${student.fullName} has completed 8 classes in sequence (${cycleLabel})${eighthClassDate ? ` on ${eighthClassDate}` : ''}. No fee receipt of ₹1,600 has been recorded. Please issue receipt.`,
              studentId: student.id,
              isRead: false,
              createdAt: eighthClassDate ? new Date(eighthClassDate + 'T18:00:00.000Z').toISOString() : new Date().toISOString(),
              metadata: {
                studentId: student.id,
                studentName: student.fullName,
                parentName: student.parentName,
                whatsappMobile: student.whatsappMobile,
                cycle: k,
                cycleLabel,
                amount: 1600,
                completedOn: eighthClassDate,
                attendedCount
              }
            };
            this.state.alerts.unshift(feeAlert);
            hasChanges = true;
          }
        } else {
          // If paid, mark alert read if still unread
          if (existingAlertIdx !== -1 && !this.state.alerts[existingAlertIdx].isRead) {
            this.state.alerts[existingAlertIdx].isRead = true;
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      this.saveData();
    }
  }

  // Progress Trackers
  getProgressTrackersByStudent(studentId: string) {
    return this.state.progressTrackers.filter(p => p.studentId === studentId);
  }

  saveProgressTracker(tracker: Omit<ProgressTracker, 'id' | 'createdAt'> & { id?: string }) {
    if (tracker.id) {
      const idx = this.state.progressTrackers.findIndex(p => p.id === tracker.id);
      if (idx !== -1) {
        this.state.progressTrackers[idx] = {
          ...this.state.progressTrackers[idx],
          ...tracker
        };
        this.saveData();
        return this.state.progressTrackers[idx];
      }
    }
    const newTracker: ProgressTracker = {
      ...tracker,
      id: tracker.id || `prog-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.state.progressTrackers.push(newTracker);
    this.saveData();
    return newTracker;
  }

  deleteProgressTracker(id: string) {
    this.state.progressTrackers = this.state.progressTrackers.filter(p => p.id !== id);
    this.saveData();
    return true;
  }

  // Student Works (Camera captures & samples)
  getStudentWorks(studentId: string) {
    return this.state.studentWorks.filter(w => w.studentId === studentId);
  }

  saveStudentWork(work: Omit<StudentWorkImage, 'id' | 'createdAt'>) {
    const newWork: StudentWorkImage = {
      ...work,
      id: `work-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.state.studentWorks.push(newWork);
    this.saveData();
    return newWork;
  }

  deleteStudentWork(id: string) {
    this.state.studentWorks = this.state.studentWorks.filter(w => w.id !== id);
    this.saveData();
    return true;
  }

  // Progress Reports
  getProgressReports(studentId: string) {
    return this.state.progressReports.filter(r => r.studentId === studentId);
  }

  saveProgressReport(report: Omit<ProgressReport, 'id' | 'createdAt'> & { id?: string }) {
    if (report.id) {
      const idx = this.state.progressReports.findIndex(r => r.id === report.id);
      if (idx !== -1) {
        this.state.progressReports[idx] = {
          ...this.state.progressReports[idx],
          ...report
        };
        this.saveData();
        return this.state.progressReports[idx];
      }
    }
    const newReport: ProgressReport = {
      ...report,
      id: report.id || `rep-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    this.state.progressReports.push(newReport);
    this.saveData();
    return newReport;
  }

  deleteProgressReport(id: string) {
    this.state.progressReports = this.state.progressReports.filter(r => r.id !== id);
    this.saveData();
    return true;
  }

  // Fee Reminders
  saveFeeReminder(reminder: Omit<FeeReminder, 'id' | 'sentDate'>) {
    const newRem: FeeReminder = {
      ...reminder,
      id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sentDate: new Date().toISOString()
    };
    this.state.feeReminders.push(newRem);
    this.saveData();
    return newRem;
  }

  getFeeReminders(studentId: string) {
    return this.state.feeReminders.filter(r => r.studentId === studentId);
  }

  // Demo Bookings
  getDemoBookings() {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    return [...this.state.demoBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createDemoBooking(bookingData: { studentName: string; age: string; contactNumber: string; preferredSlot: string; notes?: string }) {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    if (!this.state.alerts) this.state.alerts = [];

    const newBooking: DemoBooking = {
      id: `demo-${Date.now()}`,
      studentName: bookingData.studentName,
      age: bookingData.age,
      contactNumber: bookingData.contactNumber,
      preferredSlot: bookingData.preferredSlot,
      status: 'New',
      notes: bookingData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.demoBookings.unshift(newBooking);

    // Create Admin Alert
    const newAlert: AdminAlert = {
      id: `alt-${Date.now()}`,
      type: 'demo_booking',
      title: 'New Free Demo Class Booking',
      message: `${newBooking.studentName} (${newBooking.age}) booked preferred slot: ${newBooking.preferredSlot}. Phone: ${newBooking.contactNumber}`,
      demoBookingId: newBooking.id,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.state.alerts.unshift(newAlert);

    this.saveData();
    return { booking: newBooking, alert: newAlert };
  }

  updateDemoBooking(id: string, updates: Partial<DemoBooking>) {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    const idx = this.state.demoBookings.findIndex(b => b.id === id);
    if (idx === -1) return null;

    this.state.demoBookings[idx] = {
      ...this.state.demoBookings[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.state.demoBookings[idx];
  }

  deleteDemoBooking(id: string) {
    if (!this.state.demoBookings) this.state.demoBookings = [];
    this.state.demoBookings = this.state.demoBookings.filter(b => b.id !== id);
    if (this.state.alerts) {
      this.state.alerts = this.state.alerts.filter(a => a.demoBookingId !== id);
    }
    this.saveData();
    return true;
  }

  // Alerts
  getAlerts() {
    if (!this.state.alerts) this.state.alerts = [];
    this.checkAndGenerateFeeAlerts();
    return [...this.state.alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  markAlertAsRead(id: string) {
    if (!this.state.alerts) this.state.alerts = [];
    const alert = this.state.alerts.find(a => a.id === id);
    if (alert) {
      alert.isRead = true;
      this.saveData();
      return alert;
    }
    return null;
  }

  markAllAlertsAsRead() {
    if (!this.state.alerts) this.state.alerts = [];
    this.state.alerts.forEach(a => { a.isRead = true; });
    this.saveData();
    return true;
  }

  deleteAlert(id: string) {
    if (!this.state.alerts) this.state.alerts = [];
    this.state.alerts = this.state.alerts.filter(a => a.id !== id);
    this.saveData();
    return true;
  }

  // Testimonials
  getTestimonials(studentId?: string, status?: string) {
    if (!this.state.testimonials) this.state.testimonials = [];
    let list = [...this.state.testimonials];
    if (studentId) {
      list = list.filter(t => t.studentId === studentId);
    }
    if (status) {
      list = list.filter(t => t.status === status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTestimonialById(id: string) {
    if (!this.state.testimonials) this.state.testimonials = [];
    return this.state.testimonials.find(t => t.id === id);
  }

  saveTestimonial(testimonyData: Omit<Testimonial, 'id' | 'createdAt'> & { id?: string }) {
    if (!this.state.testimonials) this.state.testimonials = [];
    if (!this.state.alerts) this.state.alerts = [];

    const newTestimonial: Testimonial = {
      ...testimonyData,
      id: testimonyData.id || `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: testimonyData.status || 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.state.testimonials.unshift(newTestimonial);

    // Create an Admin Alert
    const newAlert: AdminAlert = {
      id: `alt-${Date.now()}`,
      type: 'testimony',
      title: 'New Parent Testimony Added',
      message: `${newTestimonial.parentName} submitted a ${newTestimonial.rating}-star review for student ${newTestimonial.studentName}: "${newTestimonial.title || newTestimonial.review.substring(0, 40)}..."`,
      studentId: newTestimonial.studentId,
      isRead: false,
      createdAt: new Date().toISOString(),
      metadata: { testimonialId: newTestimonial.id, rating: newTestimonial.rating }
    };
    this.state.alerts.unshift(newAlert);

    this.saveData();
    return newTestimonial;
  }

  updateTestimonial(id: string, updates: Partial<Testimonial>) {
    if (!this.state.testimonials) this.state.testimonials = [];
    const idx = this.state.testimonials.findIndex(t => t.id === id);
    if (idx === -1) return null;

    this.state.testimonials[idx] = {
      ...this.state.testimonials[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.state.testimonials[idx];
  }

  deleteTestimonial(id: string) {
    if (!this.state.testimonials) this.state.testimonials = [];
    this.state.testimonials = this.state.testimonials.filter(t => t.id !== id);
    this.saveData();
    return true;
  }

  // Tool Audit Logging
  recordToolAuditLog(log: Omit<ToolAuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): ToolAuditLog {
    if (!this.state.toolAuditLogs) this.state.toolAuditLogs = [];

    const newLog: ToolAuditLog = {
      ...log,
      id: log.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || new Date().toISOString()
    };

    this.state.toolAuditLogs.unshift(newLog);
    // Keep max 1000 logs in storage
    if (this.state.toolAuditLogs.length > 1000) {
      this.state.toolAuditLogs = this.state.toolAuditLogs.slice(0, 1000);
    }
    this.saveData();
    return newLog;
  }

  getToolAuditLogs(limit: number = 50, actorId?: string): ToolAuditLog[] {
    if (!this.state.toolAuditLogs) this.state.toolAuditLogs = [];
    let logs = [...this.state.toolAuditLogs];
    if (actorId) {
      logs = logs.filter(l => l.actorId === actorId || l.actorStudentId === actorId);
    }
    return logs.slice(0, limit);
  }
}

export const db = new Database();
