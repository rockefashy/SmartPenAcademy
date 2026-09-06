export const adminProperties = {
  header: {
    title: "Admin Command Center",
    subtitle: "Manage student rosters, live monthly attendance sheets, fee collection logs, and evaluation reports.",
    academyInfo: "SmartPen Academy Management Portal • Founded by Mrs. Deepthy Rock",
    exportExcelBtn: "Export Roster (CSV)",
    newCoachEnrollBtn: "+ Enroll Coach",
    newStudentEnrollBtn: "+ Enroll New Student",
    quickStats: {
      totalEnrolled: "Total Students",
      activeStudents: "Active Learners",
      classesThisMonth: "Classes Conducted",
      feesCollected: "8-Class Fee Cycles"
    }
  },

  filters: {
    searchPlaceholder: "Search student name, school, grade, or parent mobile...",
    statusAll: "All Learners",
    statusActive: "Active Only",
    statusInactive: "Inactive Only",
    filterGradeLabel: "Filter by Grade",
    filterBatchLabel: "Filter by Schedule",
    filterGripLabel: "Filter by Grip Type",
    sortByLabel: "Sort By",
    sortCreatedDate: "Enrollment Date",
    sortName: "Student Name",
    sortModifiedDate: "Last Active",
    sortCurrentClass: "Grade / Class",
  },

  messages: {
    attendanceMarkedSuccess: "Session attendance recorded for {name}!",
    feeMarkedSuccess: "Fee payment receipt (₹1,600 / 8 Classes) recorded for {name}!",
    coachCreatedSuccess: "Coach \"{name}\" ({designation}) enrolled successfully!",
    coachValidationName: "Please enter the coach's full name.",
    coachValidationEmail: "Please enter a valid email address for the coach.",
    coachValidationPhone: "Please enter a valid phone number for the coach.",
    coachValidationPassword: "Initial coach password is required (minimum 8 characters).",
    coachValidationPasswordLength: "Coach password must be at least 8 characters long."
  },

  tabs: {
    roster: "Student Roster (Section 1)",
    attendance: "Attendance Tracker (Section 2)",
    fees: "8-Class Fee Tracker (Section 3)"
  },

  table: {
    loadingText: "Loading enrolled student directory...",
    noStudents: "No enrolled students match your filter criteria.",
    colStudent: "Student Name & Info",
    colContactParent: "Parent & Contact",
    colBatchTiming: "Class Schedule & Timing",
    colClassesAttended: "Classes Attended",
    colStatus: "Status",
    colActions: "Quick Actions",
    studentName: "Student Name",
    enrollmentDate: "Enrollment Date",
    ageGrade: "Age / Grade",
    timeSlot: "Training Timeslot",
    classesAttended: "Classes Attended",
    feePaid: "Fee Receipt (₹1,600 / 8 Cls)",
    status: "Status",
    actions: "Actions"
  },

  actions: {
    openDetail: "Open Full Profile",
    markAttendance: "Mark Attendance",
    markFeePaid: "Record ₹1,600 Fee Receipt",
    recordProgress: "Progress Report",
    viewStudentDetails: "Student Dossier",
    viewFees: "View Fees",
    progressReport: "Progress Report",
    addSibling: "Add a Sibling"
  },

  section1Roster: {
    title: "Section 1: Enrolled Student Roster",
    subtitle: "Active students are automatically sorted and listed first. Click on any student's name to open their dedicated Detail & Progress Screen.",
    searchPlaceholder: "Search by student name, grade, or parent contact...",
    filterAll: "All Students",
    filterActive: "Active Only",
    filterInactive: "Inactive Only",
    columns: {
      studentName: "Student Name",
      enrollmentDate: "Enrollment Date",
      ageGrade: "Age / Grade",
      timeSlot: "Training Timeslot",
      classesAttended: "Classes Attended",
      feeStatus: "Fee Status (₹1,600 / 8 Classes)",
      status: "Status",
      action: "Actions"
    },
    emptyMessage: "No enrolled students found matching your filter criteria.",
    activeBadge: "Active",
    inactiveBadge: "Inactive",
    feePaidBadge: "Receipt Issued",
    feeUnpaidBadge: "Fee Due",
    openProfileTooltip: "Click to open full student management screen"
  },

  section2Attendance: {
    title: "Section 2: Daily Attendance Tracker",
    subtitle: "Record and update daily student presence. Every 8 completed classes form a billing cycle (₹1,600 per 8 classes).",
    selectMonthLabel: "Calendar Month:",
    prevMonth: "Previous Month",
    nextMonth: "Next Month",
    markAllPresent: "Mark All Present Today",
    saveAttendanceBtn: "Save Attendance Records",
    editAttendanceBtn: "Edit Attendance",
    savingText: "Saving Attendance Records...",
    savedSuccessText: "Attendance saved successfully! System has audited 8-class fee thresholds.",
    legendPresent: "P = Present",
    legendAbsent: "A = Absent",
    columns: {
      studentName: "Active Student",
      scheduleDays: "Schedule Days",
      slot: "Slot",
      totalAttended: "Total Present",
      attendanceRatio: "Attendance %"
    },
    clickToToggleNote: "Click any date cell (P / A) to toggle attendance status for that day."
  },

  section3Fees: {
    title: "Section 3: 8-Class Period Fee Ledger (₹1,600 / 8 Classes)",
    subtitle: "Fee is tracked per 8 classes completed (₹1,600). When 8 classes are completed in sequence, a fee receipt must be issued; otherwise an automated alert is flagged.",
    selectMonthLabel: "Filter by Period:",
    columns: {
      studentName: "Student Name",
      parentContact: "Parent / WhatsApp",
      timeslot: "Timeslot",
      monthlyFeeAmount: "Fee Amount (₹1,600)",
      isFeePaid: "Receipt Recorded? (Y/N)",
      feeReceivedDate: "Receipt / Payment Date",
      action: "Update / Save"
    },
    saveFeeBtn: "Save Fee Receipt",
    editFeeBtn: "Edit Records",
    paidOption: "Yes - Receipt Issued",
    unpaidOption: "No - Fee Due",
    sendReminderQuickBtn: "Send Fee Reminder",
    savedSuccessText: "Fee collection status updated successfully!"
  },

  alertsModule: {
    title: "Alerts & Free Demo Class Bookings",
    subtitle: "Real-time inquiries submitted by parents for Free Demo Classes (All days 4–7 PM) with Mrs. Deepthy Rock.",
    tabs: {
      allAlerts: "All Alerts & Inquiries",
      demoBookings: "Demo Bookings (4 - 7 PM)",
      unread: "New / Unread Only",
    },
    stats: {
      totalBookings: "Total Demo Inquiries",
      newBookings: "New / Pending Action",
      scheduled: "Demos Scheduled",
      enrolled: "Converted to Enrolled",
    },
    columns: {
      studentName: "Student & Age",
      contact: "Parent Mobile / WhatsApp",
      slot: "Preferred Date & Timeslot",
      status: "Booking Status",
      receivedAt: "Received Date & Time",
      actions: "Quick Actions",
    },
    emptyAlerts: "No demo class bookings or alerts found.",
    markAllReadBtn: "Mark All Alerts as Read",
    refreshBtn: "Refresh Inquiries",
    whatsappFollowupText: "Hello! Mrs. Deepthy Rock from SmartPen Academy regarding your Free Demo Class booking for {name}. Are you available for the session on {date} at {time}?",
  }
};
