export const authProperties = {
  loginModal: {
    title: "Sign In to SmartPen Academy",
    subtitle: "Enter your registered email address and password to access your portal",
    emailLabel: "Email Address (Login ID)",
    emailPlaceholder: "Enter your registered email address",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your account password",
    rememberMe: "Remember session",
    forgotPassword: "Forgot Password?",
    changePassword: "Change Password",
    submitBtn: "Sign In to Portal",
    loggingIn: "Authenticating...",
  },
  
  validation: {
    identifierRequired: "Please provide your registered email, username, or phone number.",
    passwordRequired: "Password is required, minimum 8 characters.",
    passwordMinLength: "Password must be at least 8 characters long.",
    invalidCredentials: "Invalid credentials or password. Please verify and try again.",
    accountNotFound: "No account found matching this identifier.",
    roleRequired: "Please select a valid portal role.",
    studentRequired: "Please select a student profile.",
    coachNameRequired: "Coach full name is required.",
    coachEmailRequired: "Coach email address is required.",
    coachPhoneRequired: "Coach phone number is required.",
    coachPasswordRequired: "Coach initial login password is required (minimum 8 characters)."
  },
  
  forgotPasswordModal: {
    title: "Retrieve Your Account Password",
    description: "Enter your registered email address. We will verify your account and dispatch your password directly to your inbox.",
    inputLabel: "Registered Email Address",
    inputPlaceholder: "e.g., student@example.com or parent@example.com",
    submitBtn: "Send Password to Registered Email",
    sendingBtn: "Locating & Dispatching...",
    successTitle: "✅ Password Dispatched!",
    successMessage: "Your password has been successfully sent to your registered email address. Please check your inbox (and spam folder) to sign in.",
    closeBtn: "Back to Sign In",
    userNotFound: "No registered account found matching that email address."
  },

  changePasswordModal: {
    title: "Change Account Password",
    subtitle: "Update your portal access credentials securely",
    description: "Enter your registered email, current password, and your new password (minimum 8 characters).",
    emailLabel: "Registered Email Address",
    emailPlaceholder: "Enter your registered email",
    currentPasswordLabel: "Current Password",
    currentPasswordPlaceholder: "Enter your current password",
    newPasswordLabel: "New Password (8+ characters)",
    newPasswordPlaceholder: "Enter new password (min 8 chars)",
    confirmPasswordLabel: "Confirm New Password",
    confirmPasswordPlaceholder: "Re-enter new password",
    submitBtn: "Update Password",
    updatingBtn: "Updating Password...",
    successTitle: "✅ Password Updated Successfully!",
    successMessage: "Your password has been updated. You can now sign in using your new password.",
    closeBtn: "Back to Sign In",
    passwordMismatch: "New passwords do not match. Please verify and try again.",
    passwordTooShort: "New password must be at least 8 characters long."
  },

  sessionExpired: "Your session has expired. Please sign in again.",
  invalidCredentials: "Invalid email address or password. Please verify and try again.",
  logoutSuccess: "You have been signed out."
};
