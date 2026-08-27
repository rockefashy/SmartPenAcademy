export const studentDetailProperties = {
  header: {
    backToRoster: "← Back to Admin Roster",
    backBtn: "Return to Admin Roster",
    title: "Student Management & Growth Dossier",
    badgeActive: "Active Enrolled Student",
    badgeInactive: "Inactive Student Record",
    tabs: {
      section1: "1. Student Profile & Status",
      section2: "2. Attendance Tracker",
      section3: "3. Fee Ledger & Reminders",
      section4: "4. Camera Writing Capture",
      section5: "5. Progress Tracker & Report Cards"
    }
  },

  section1: {
    title: "Section 1: Student Profile & Access Credentials",
    subtitle: "View and edit all enrollment information, contact parameters, schedules, coach diagnostics, username/password, and active status.",
    editBtn: "Edit Profile Fields",
    saveBtn: "Save Profile Changes",
    cancelBtn: "Cancel Editing",
    statusLabel: "Enrollment Status:",
    activeOption: "Active Student",
    inactiveOption: "Inactive Student",
    saveSuccess: "Student profile updated successfully!",
    credentialsBoxTitle: "Portal Login Access (Shared with Parent & Admin):",
    usernameLabel: "Username:",
    passwordLabel: "Password:",
    emailCredentialsBtn: "Email Credentials to Parent"
  },

  section2: {
    title: "Section 2: Attendance Tracker",
    subtitle: "Mark attendance against each day / each class session with detailed coach notes. Every 8 completed classes trigger a ₹1,600 fee cycle audit.",
    classNumberLabel: "Class / Session #",
    dateLabel: "Session Date",
    statusLabel: "Attendance Status",
    statusPresent: "Present",
    statusAbsent: "Absent",
    statusLate: "Late",
    notesLabel: "Class Drill & Session Notes",
    markAttendanceBtn: "Record Session Attendance",
    saveSuccess: "Class attendance recorded successfully!",
    noRecords: "No attendance sessions logged yet for this student."
  },

  section3: {
    title: "Section 3: Fee Ledger & Reminders",
    subtitle: "Track payments month-wise and raise fee requests with in-person reception settlement and instant WhatsApp reminders.",
    periodLabel: "Period / Milestone",
    dateLabel: "Request Date",
    amountLabel: "Fee Amount (₹ INR)",
    receiptLabel: "Receipt Number",
    statusLabel: "Receipt Status",
    statusPaid: "Paid (Receipt Issued)",
    statusUnpaid: "Pending / Due",
    methodLabel: "Payment Method",
    inPersonNotice: "₹1,600 Coaching Fee • In-Person Reception Cash / UPI",
    recordFeeBtn: "Raise Fee Request",
    saveSuccess: "Fee request raised & WhatsApp reminder prepared!",
    updateSuccess: "Fee record updated successfully!",
    deleteSuccess: "Fee record deleted successfully!",
    sendWhatsAppReminderBtn: "Send WhatsApp Reminder",
    sendingBtn: "Preparing Reminder...",
    noRecords: "No raised fee requests or payment receipts recorded yet."
  },

  section4Camera: {
    title: "Section 4: Student Handwriting Camera Capture & Work Gallery",
    subtitle: "Capture real-time snapshots of the student's writing worksheets, notebook pages, and exam papers using your device camera, or upload saved photos to /student_works/.",
    openCameraBtn: "Capture Handwriting Photo",
    startCameraBtn: "Open Device Camera",
    capturePhotoBtn: "Snap Photo",
    stopCameraBtn: "Close Camera",
    retakeBtn: "Retake Photo",
    uploadAlternativeBtn: "Or Choose Image File",
    dateLabel: "Sample Date",
    categoryLabel: "Work Category",
    categoryOptions: ["Before (Baseline)", "After (Transformed)", "Practice Sheet", "Exam Answer Page"],
    commentsLabel: "Sample Notes & Observations",
    commentsPlaceholder: "e.g., Notice baseline curvature in paragraph 2, improved capital loops...",
    savePhotoBtn: "Save Writing Photo to /student_works/",
    saveSuccess: "Writing sample saved to /student_works/ archive!",
    galleryTitle: "Student Writing Samples Archive",
    viewFullBtn: "Zoom Sample",
    deletePhotoBtn: "Delete Photo",
    noWorks: "No writing samples uploaded yet.",
    noPhotosMessage: "No writing samples uploaded yet. Use the camera above to document student's handwriting journey.",
    folderNote: "All photos are organized under /student_works/ directory."
  },

  section5Progress: {
    title: "Section 5: Handwriting Progress Tracker & Report Cards",
    subtitle: "Ability to create new progress report cards. Refer to Progress tracker.jpeg to capture each section and values.",
    createReportBtn: "+ Create New Progress Report",
    newReportTitle: "Evaluate Student & Build Certified Report Card",
    saveSuccess: "Official Progress Report Card generated and archived successfully!",
    emailReportBtn: "Email Progress Report to Parent",
    noReports: "No progress report cards generated yet."
  }
};
