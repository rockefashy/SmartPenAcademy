export const authProperties = {
  loginModal: {
    title: "Sign In to SmartPen Academy",
    subtitle: "Enter your username or email and password to access your portal",
    usernameLabel: "Username or Email",
    usernamePlaceholder: "Enter your username or registered email",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your account password",
    rememberMe: "Remember session",
    forgotPassword: "Forgot Password?",
    submitBtn: "Sign In to Portal",
    loggingIn: "Authenticating...",
    adminHint: "Admin: admin / password123",
    studentHint: "Student: student_khwaish / password123",
  },
  
  forgotPasswordModal: {
    title: "Retrieve Your Account Password",
    description: "Enter your registered username or email address. We will verify your account and dispatch your password directly to your registered email address.",
    inputLabel: "Username or Registered Email",
    inputPlaceholder: "e.g., admin or parent@example.com",
    submitBtn: "Send Password to Registered Email",
    sendingBtn: "Locating & Dispatched...",
    successTitle: "✅ Password Dispatched!",
    successMessage: "Your password has been successfully sent to your registered email address. Please check your inbox (and spam folder) to sign in.",
    closeBtn: "Back to Login",
    userNotFound: "No registered account found matching that username or email."
  },

  sessionExpired: "Your session has expired. Please sign in again.",
  invalidCredentials: "Invalid username or password. Please verify and try again.",
  logoutSuccess: "You have been signed out."
};
