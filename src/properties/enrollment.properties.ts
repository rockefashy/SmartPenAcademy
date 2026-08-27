export const enrollmentProperties = {
  header: {
    academyName: "SMART PEN ACADEMY",
    tagline: "Transforming Handwriting into Academic Excellence • Ages 4 to 18",
    formTitle: "Student Registration Form",
    freeDiagnosticBanner: "✨ BOOK FOR A FREE DEMO CLASS (ALL DAYS 4–7 PM) — Experience the SmartPen Method with Mrs. Deepthy Rock! Call/WhatsApp: 8861751000 ✨",
  },

  section1: {
    title: "SECTION 1: STUDENT PROFILE",
    fullName: "Full Name",
    fullNamePlaceholder: "Enter student's full name",
    dateOfBirth: "Date of Birth",
    gender: "Gender",
    genderOptions: ["Male", "Female", "Other"],
    gradeClass: "Grade / Class",
    gradePlaceholder: "e.g., Grade 4, Class 7-B",
    dominantHand: "Dominant Hand",
    dominantHandOptions: ["Right", "Left"],
    schoolName: "School Name",
    schoolPlaceholder: "Enter school / institution name",
    instructionMedium: "Instruction Medium",
    instructionMediumPlaceholder: "e.g., English, Bilingual",
  },

  section2: {
    title: "SECTION 2: PARENT / GUARDIAN CONTACT DETAILS",
    parentName: "Parent / Guardian Name",
    parentNamePlaceholder: "Enter parent or guardian's name",
    relationship: "Relationship",
    relationshipPlaceholder: "e.g., Mother, Father, Guardian",
    whatsappMobile: "WhatsApp Mobile",
    whatsappMobilePlaceholder: "+91 98765 43210",
    emailAddress: "Email Address",
    emailAddressPlaceholder: "parent.name@example.com",
    residentialArea: "Residential Area / Locality",
    residentialAreaPlaceholder: "Enter city, locality or area",
  },

  section3: {
    title: "SECTION 3: PROGRAM SELECTION & SKILL GOALS",
    scriptsTitle: "A. HANDWRITING SCRIPTS REQUIRED",
    scriptsOptions: [
      "Print / Block Script",
      "Cursive Writing",
      "Hindi Devanagari Script",
      "English + Hindi Combination"
    ],
    modulesTitle: "B. ACADEMIC & SKILL MODULES",
    modulesOptions: [
      "Fine Motor & Grip (Ages 4-6)",
      "Exam Speed & Layouts",
      "Math/Science Layout Alignment",
      "Diagram Labelling & Neatness"
    ]
  },

  section4: {
    title: "SECTION 4: HANDWRITING DIAGNOSTIC CHECKLIST (PARENT OBSERVATIONS)",
    diagnosticItems: [
      "Awkward grip / complains of hand fatigue or pain",
      "Writing speed is too slow during exams/tests",
      "Letters are floating off lines or inconsistent in size",
      "Uneven word spacing / crowded text",
      "Messy layout in Math formulas & numericals",
      "Dislikes writing tasks / lacks confidence"
    ]
  },

  section5: {
    title: "SECTION 5: PREFERRED SCHEDULE",
    preferredDays: "Preferred Days (Select any 2 days in a week)",
    preferredDaysHint: "Choose exactly 2 days per week for batch alignment",
    preferredDaysOptions: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ],
    preferredSlot: "Preferred Time Slot",
    preferredSlotHint: "1-Hour session slot (4:00 PM to 7:00 PM)",
    preferredSlotOptions: [
      "4:00 - 5:00 PM",
      "4:30 - 5:30 PM",
      "5:00 - 6:00 PM",
      "5:30 - 6:30 PM",
      "6:00 - 7:00 PM"
    ]
  },

  section6: {
    title: "SECTION 6: CONSENT & DECLARATION",
    practiceCommitment: "Practice Commitment: Parents agree to support 10 minutes of daily guided home practice recommended by the academy.",
    feePolicy: "Fee Policy: Course fees are payable in advance. Rescheduling missed classes requires 4-hour prior notice.",
    mediaConsent: "Media Consent: I consent to anonymized handwriting samples (Before/After) being used for progress tracking and educational portfolios."
  },

  section7: {
    title: "SECTION 7: STUDENT LOGIN CREDENTIALS",
    username: "Portal Username",
    usernamePlaceholder: "e.g., student_khwaish",
    password: "Password",
    passwordPlaceholder: "Enter strong student portal password",
    statusBadge: "Active",
    statusAdminNotice: "Enrolled students are set to 'Active' by default. Status changes to 'Inactive' are strictly restricted to Academy Administrators.",
    emailNotificationNotice: "📧 Once enrolled, student profile & login credentials will be automatically dispatched to Parent's registered email and Academy Admin."
  },

  // Backwards compatibility alias
  section8: {
    title: "SECTION 7: STUDENT LOGIN CREDENTIALS",
    username: "Portal Username",
    usernamePlaceholder: "e.g., student_khwaish",
    password: "Password",
    passwordPlaceholder: "Enter strong student portal password",
    status: "Student Status",
    statusOptions: ["Active"],
    statusHint: "Enrolled students are 'Active' by default. Inactive status can only be set by Admin.",
    emailNotificationNotice: "📧 Once enrolled, student profile & login credentials will be automatically dispatched to Parent's registered email and Academy Admin."
  },

  submitButton: "Complete Student Enrollment",
  submittingText: "Creating Student Profile & Sending Credentials...",
  
  modalSuccess: {
    title: "🎉 Enrollment Successful!",
    message: "The student has been successfully registered in the SmartPen Academy roster. Login credentials and registration summary have been dispatched to the parent and admin email addresses.",
    credentialsHeader: "Account Access Details:",
    usernameLabel: "Username:",
    passwordLabel: "Password:",
    statusLabel: "Status:",
    parentEmailLabel: "Parent Email:",
    viewStudentDetailsBtn: "Open Student Dashboard",
    goToAdminRosterBtn: "Go to Admin Roster",
    enrollAnotherBtn: "Enroll Another Student"
  }
};
