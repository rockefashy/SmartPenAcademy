export const enrollmentProperties = {
  header: {
    academyName: "SMART PEN ACADEMY",
    tagline: "Transforming Handwriting into Academic Excellence • Ages 4 to 18",
    formTitle: "Student Registration Form",
    enrollFormTitle: "Enroll New Student",
    editFormTitle: "Edit Student",
    editTagline: "Update student profile details, guardian contacts, schedules, and learning modules.",
    freeDiagnosticBanner: "✨ BOOK FOR A FREE DEMO CLASS (ALL DAYS 4–7 PM) — Experience the SmartPen Method with Mrs. Deepthy Rock! Call/WhatsApp: 8861751000 ✨",
  },

  section1: {
    title: "SECTION 1: STUDENT PROFILE",
    firstName: "First Name",
    firstNamePlaceholder: "e.g., Aarav",
    lastName: "Last Name",
    lastNamePlaceholder: "e.g., Sharma",
    fullName: "Full Name",
    fullNamePlaceholder: "Enter student's full name",
    modeOfLearning: "Mode of Learning",
    modeOfLearningOptions: ["In-person", "Online"],
    age: "Age (Numeric in Years)",
    agePlaceholder: "e.g., 8",
    gender: "Gender",
    genderOptions: ["Male", "Female", "Other"],
    gradeClass: "Grade / Class",
    gradePlaceholder: "e.g., Grade 4, Class 7-B",
    dominantHand: "Dominant Hand",
    dominantHandOptions: ["Right", "Left"],
    schoolName: "School Name",
    schoolPlaceholder: "Enter school / institution name",
  },

  section2: {
    title: "SECTION 2: PARENT / GUARDIAN CONTACT DETAILS",
    parentName: "Parent / Guardian Name",
    parentNamePlaceholder: "Enter parent or guardian's name",
    whatsappMobile: "WhatsApp Mobile",
    whatsappMobilePlaceholder: "+91 98765 43210",
    emergencyContactName: "Emergency Contact Person",
    emergencyContactNamePlaceholder: "e.g., Grandparent / Relative / Alternate Guardian",
    emergencyContactPhone: "Emergency Contact Phone",
    emergencyContactPhonePlaceholder: "+91 98765 00000",
    emailAddress: "Email Address (Login ID)",
    emailAddressPlaceholder: "parent.name@example.com",
    emailAddressHint: "Email address is the login id",
    password: "Password",
    passwordPlaceholder: "Enter password (minimum 8 characters)",
    passwordHint: "Minimum 8 characters",
    residentialArea: "Residential Area / Locality",
    residentialAreaPlaceholder: "Enter city, locality or area",
  },

  section3: {
    title: "SECTION 3: PROGRAM SELECTION & SKILL GOALS",
    scriptsTitle: "A. HANDWRITING SCRIPTS REQUIRED (Select at least one)",
    scriptsOptions: [
      "Print / Block Script",
      "Cursive Writing",
      "Hindi Devanagari Script",
      "English + Hindi Combination"
    ],
    modulesTitle: "B. ACADEMIC & SKILL MODULES (Select at least one)",
    modulesOptions: [
      "Fine Motor & Grip (Ages 4-6)",
      "Exam Speed & Layouts",
      "Math/Science Layout Alignment",
      "Diagram Labelling & Neatness"
    ]
  },

  // Section 4: Preferred Schedule
  section4: {
    title: "SECTION 4: PREFERRED SCHEDULE (Select 2 days & 1 time slot)",
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

  // Section 5: Areas of Concern (Parent Observations)
  section5: {
    title: "SECTION 5: AREAS OF CONCERN (PARENT OBSERVATIONS) (Select at least one)",
    diagnosticItems: [
      "Awkward grip / complains of hand fatigue or pain",
      "Writing speed is too slow during exams/tests",
      "Letters are floating off lines or inconsistent in size",
      "Uneven word spacing / crowded text",
      "Messy layout in Math formulas & numericals",
      "Dislikes writing tasks / lacks confidence"
    ]
  },

  section6: {
    title: "SECTION 6: CONSENT & DECLARATION",
    practiceCommitment: "Practice Commitment: Parents agree to support 10 minutes of daily guided home practice recommended by the academy.",
    feePolicy: "Fee Policy: Course fees are payable in advance. Rescheduling missed classes requires 4-hour prior notice.",
    mediaConsent: "Media Consent: I consent to anonymized handwriting samples (Before/After) being used for progress tracking and educational portfolios."
  },

  submitButton: "Enroll New Student",
  submittingText: "Enrolling Student & Sending Credentials...",
  editSubmitButton: "Save Student Details",
  editSubmittingText: "Saving Student Details & Sending Notifications...",
  
  validation: {
    fullNameRequired: "Student full name is required.",
    ageRequired: "Student age is required and must be a valid number between 3 and 25 years.",
    ageInvalid: "Please enter a valid numeric age in years (3 to 25).",
    parentNameRequired: "Parent / Guardian name is required.",
    phoneRequired: "WhatsApp mobile number is required (minimum 10 digits).",
    phoneInvalid: "Please enter a valid WhatsApp mobile number with at least 10 digits.",
    emailRequired: "Email address is required (this will be your login ID).",
    emailInvalid: "Please enter a valid email address (e.g., parent@example.com).",
    passwordRequired: "Password is required, minimum 8 characters.",
    passwordMinLength: "Password must be at least 8 characters long.",
    daysRequired: "Please select exactly 2 preferred days in a week (Section 4).",
    slotRequired: "Please select a preferred time slot in Section 4.",
    scriptRequired: "Please select at least one handwriting script in Section 3 (A).",
    moduleRequired: "Please select at least one academic module in Section 3 (B).",
    observationRequired: "Please select at least one area of concern in Section 5.",
    duplicateError: "A student named {name} (age {age}) is already enrolled with this phone number.",
    generalError: "Please fix the validation errors in the form before submitting."
  },

  modalSuccess: {
    title: "🎉 Enrollment Successful!",
    message: "The student has been successfully registered in the SmartPen Academy roster. Login credentials and registration summary have been dispatched to the registered parent email address and Academy Admin.",
    credentialsHeader: "Account Access Details:",
    emailLoginLabel: "Login ID (Email):",
    passwordLabel: "Password:",
    statusLabel: "Status:",
    parentEmailLabel: "Registered Email:",
    viewStudentDetailsBtn: "Open Student Dashboard",
    goToAdminRosterBtn: "Go to Admin Roster",
    enrollAnotherBtn: "Enroll Another Student"
  }
};
