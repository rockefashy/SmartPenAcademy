import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Lock, 
  Mail, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  Users, 
  GraduationCap, 
  Award,
  Phone,
  User as UserIcon,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { authProperties } from '../properties/auth.properties';
import { SmartPenLogo } from './SmartPenLogo';
import { User, UserRole, StudentOption } from '../types';
import { formatGradeClass } from '../utils/formatters';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: User) => void;
  initialResetToken?: string;
}

type AuthView = 'login' | 'select-role' | 'select-student' | 'forgot' | 'reset-token' | 'change';

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialResetToken,
}) => {
  const { login, logout, user } = useAuth();
  const [currentView, setCurrentView] = useState<AuthView>('login');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Multi-account / Role Selection State
  const [selectionToken, setSelectionToken] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [selectionMessage, setSelectionMessage] = useState<string>('');

  // Forgot Password State
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  // Token Reset State
  const [resetToken, setResetToken] = useState(initialResetToken || '');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Change Password State
  const [changeEmail, setChangeEmail] = useState('');
  const [changeCurrentPassword, setChangeCurrentPassword] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('');
  const [changeSuccessMessage, setChangeSuccessMessage] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordScope, setPasswordScope] = useState<'all' | 'single'>('all');
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [familyStudents, setFamilyStudents] = useState<Array<{ id: string; studentId: string; displayName: string; age?: number }>>([]);
  const [isCheckingFamily, setIsCheckingFamily] = useState(false);

  const checkFamilyMembers = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes('@')) return;
    try {
      setIsCheckingFamily(true);
      const res = await api.getFamilyStudents(emailToCheck.trim());
      if (res.students && res.students.length > 1) {
        setFamilyStudents(res.students);
        setTargetStudentId(res.students[0].id);
      } else {
        setFamilyStudents([]);
      }
    } catch {
      setFamilyStudents([]);
    } finally {
      setIsCheckingFamily(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setForgotSuccessMessage(null);
      setResetSuccessMessage(null);
      setChangeSuccessMessage(null);
      if (user?.email) {
        setChangeEmail(user.email);
        checkFamilyMembers(user.email);
      }
      if (initialResetToken) {
        setResetToken(initialResetToken);
        setCurrentView('reset-token');
      } else {
        setCurrentView('login');
      }
    }
  }, [isOpen, initialResetToken, user]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await api.login({
        identifier: identifier.trim(),
        password: password.trim(),
      });

      if (response.requiresRoleSelection && response.selectionToken) {
        setSelectionToken(response.selectionToken);
        setAvailableRoles(response.availableRoles || []);
        setSelectionMessage(response.message || 'Multiple roles associated with this account. Please select your active portal.');
        setCurrentView('select-role');
        return;
      }

      if (response.requiresStudentSelection && response.selectionToken) {
        setSelectionToken(response.selectionToken);
        setAvailableStudents(response.availableStudents || []);
        setSelectionMessage(response.message || 'Multiple student profiles registered under this phone number. Please select which student to access:');
        setCurrentView('select-student');
        return;
      }

      if (response.token && response.user) {
        login(response.token, response.user);
        if (onLoginSuccess) {
          onLoginSuccess(response.user);
        }
        onClose();
      } else {
        throw new Error('Invalid authentication response from server.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || authProperties.invalidCredentials);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelection = async (selectedRole: UserRole) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await api.selectRole({
        selectionToken,
        selectedRole,
      });

      if (response.requiresStudentSelection && response.selectionToken) {
        setSelectionToken(response.selectionToken);
        setAvailableStudents(response.availableStudents || []);
        setSelectionMessage(response.message || 'Please select the student profile you wish to sign into:');
        setCurrentView('select-student');
        return;
      }

      if (response.token && response.user) {
        login(response.token, response.user);
        if (onLoginSuccess) {
          onLoginSuccess(response.user);
        }
        onClose();
      } else {
        throw new Error('Failed to establish session for selected role.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select role.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentSelection = async (selectedUserId: string) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await api.selectStudent({
        selectionToken,
        selectedUserId,
      });

      if (response.token && response.user) {
        login(response.token, response.user);
        if (onLoginSuccess) {
          onLoginSuccess(response.user);
        }
        onClose();
      } else {
        throw new Error('Failed to establish session for selected student.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select student.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setErrorMessage('Please enter your registered email address or phone number.');
      return;
    }

    setIsSendingForgot(true);
    setErrorMessage(null);
    setForgotSuccessMessage(null);

    try {
      const res = await api.forgotPassword(forgotIdentifier.trim());
      setForgotSuccessMessage(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
    } catch (err: any) {
      setErrorMessage(err.message || authProperties.forgotPasswordModal.userNotFound);
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleResetTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessMessage(null);

    if (!resetToken.trim()) {
      setErrorMessage('Reset token is required.');
      return;
    }

    if (resetNewPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsResettingPassword(true);

    try {
      const res = await api.resetPasswordWithToken({
        token: resetToken.trim(),
        newPassword: resetNewPassword.trim(),
      });

      setResetSuccessMessage(res.message || 'Password successfully reset! You can now log in.');
      setPassword(resetNewPassword.trim());
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password. The link or token may have expired.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setChangeSuccessMessage(null);

    if (!changeEmail.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    if (changeNewPassword.length < 8) {
      setErrorMessage(authProperties.changePasswordModal.passwordTooShort);
      return;
    }

    if (changeNewPassword !== changeConfirmPassword) {
      setErrorMessage(authProperties.changePasswordModal.passwordMismatch);
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const res = await api.changePassword({
        email: changeEmail.trim(),
        currentPassword: changeCurrentPassword.trim() || undefined,
        newPassword: changeNewPassword.trim(),
        applyToAll: passwordScope === 'all',
        targetStudentId: passwordScope === 'single' ? targetStudentId : undefined,
      });

      if (res.loggedOut) {
        logout();
      }

      setChangeSuccessMessage(res.message || authProperties.changePasswordModal.successMessage);
      setIdentifier(changeEmail.trim());
      setPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password. Please check your credentials.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={false}
      className="p-0 border-0 overflow-hidden"
      bodyClassName="p-0 flex flex-col"
      id="login-modal-overlay"
    >
            {/* Top Decorative Header */}
            <div className="shrink-0 bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] px-6 py-5 text-white text-center relative shadow-xs">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-3.5 right-3.5 text-white/80 hover:text-white rounded-full hover:bg-white/10"
                aria-label="Close"
                id="btn-close-login-modal"
              >
                <X className="w-5 h-5" />
              </Button>
              <div className="flex justify-center mb-1.5">
                <div className="bg-white p-1.5 rounded-2xl shadow-md">
                  <SmartPenLogo size="sm" />
                </div>
              </div>
              <h2 className="text-xl font-bold font-sans">
                {currentView === 'login' && 'Academy Portal Login'}
                {currentView === 'select-role' && 'Select Your Portal'}
                {currentView === 'select-student' && 'Which student would you like to view?'}
                {currentView === 'forgot' && 'Reset Your Password'}
                {currentView === 'reset-token' && 'Set New Password'}
                {currentView === 'change' && authProperties.changePasswordModal.title}
              </h2>
              <p className="text-xs text-blue-100 mt-1">
                {currentView === 'login' && 'Sign in with your Email, Username, or Phone Number'}
                {currentView === 'select-role' && 'Choose your access role for this session'}
                {currentView === 'select-student' && 'Select student profile to continue'}
                {currentView === 'forgot' && 'We will send a secure password reset link to your email'}
                {currentView === 'reset-token' && 'Enter your secure token and choose a new password'}
                {currentView === 'change' && authProperties.changePasswordModal.subtitle}
              </p>
            </div>

            <div className="p-6 overflow-y-auto flex-1 overscroll-contain">
              {/* Error Message Display */}
              {errorMessage && (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* VIEW 1: UNIFIED SIGN IN */}
              {currentView === 'login' && (
                <div className="space-y-5">
                  <form onSubmit={handleLoginSubmit} className="space-y-4" id="form-unified-login">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email, Username, or Phone Number
                      </label>
                      <Input
                        id="input-login-identifier"
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. parent@example.com, coach_anil, or 9876543210"
                        leftIcon={<UserIcon className="w-4 h-4" />}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Coaches, Parents, and Students sign in through this unified form.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Password
                      </label>
                      <Input
                        id="input-login-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your account password"
                        leftIcon={<Lock className="w-4 h-4" />}
                      />
                    </div>

                    {/* Links: Forgot Password & Change Password */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCurrentView('forgot');
                          setErrorMessage(null);
                          setForgotIdentifier(identifier);
                        }}
                        className="font-medium text-[#F46E20] hover:text-[#d3540e] hover:underline p-0 min-h-[44px] hover:bg-transparent"
                        id="btn-goto-forgot-password"
                      >
                        Forgot Password?
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCurrentView('change');
                          setErrorMessage(null);
                          setChangeEmail(identifier);
                        }}
                        className="font-medium text-[#0E3589] hover:text-[#0a2766] hover:underline flex items-center gap-1 cursor-pointer p-0 min-h-[44px] hover:bg-transparent"
                        id="btn-goto-change-password"
                        leftIcon={<Key className="w-3 h-3" />}
                      >
                        Change Password
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={isLoading}
                      loadingText="Verifying Credentials..."
                      id="btn-submit-login"
                      className="mt-2"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Sign In to Portal
                    </Button>
                  </form>
                </div>
              )}

              {/* VIEW 2: MULTI-ROLE SELECTION */}
              {currentView === 'select-role' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed bg-blue-50 p-3 rounded-xl border border-blue-100">
                    {selectionMessage}
                  </p>

                  <div className="space-y-2.5">
                    {availableRoles.map((role) => (
                      <Button
                        key={role}
                        type="button"
                        variant="outline"
                        size="md"
                        fullWidth
                        onClick={() => handleRoleSelection(role)}
                        disabled={isLoading}
                        className="p-3.5 border-slate-200 hover:border-[#0E3589] bg-white hover:bg-slate-50 rounded-2xl justify-between text-left h-auto min-h-[44px]"
                        id={`btn-select-role-${role}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0E3589] flex items-center justify-center font-bold">
                            {role === 'admin' && <ShieldCheck className="w-5 h-5" />}
                            {role === 'coach' && <Award className="w-5 h-5" />}
                            {role === 'student' && <GraduationCap className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 capitalize">
                              {role === 'admin' ? 'Institute Administration' : role === 'coach' ? 'Coach / Instructor Portal' : 'Student & Parent Portal'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {role === 'admin' ? 'Manage institute, students, coaches, and fees' : role === 'coach' ? 'Manage attendance and progress of assigned students' : 'Track handwriting progress, evaluations, and attendance'}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#0E3589] group-hover:translate-x-0.5 transition-all" />
                      </Button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      setCurrentView('login');
                      setErrorMessage(null);
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 mt-2"
                    leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                  >
                    Back to login form
                  </Button>
                </div>
              )}

              {/* VIEW 3: MULTI-STUDENT SELECTION (e.g. Siblings Sharing Phone Number) */}
              {currentView === 'select-student' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 p-3 rounded-xl border border-amber-100 text-amber-900">
                    {selectionMessage}
                  </p>

                  <div className="space-y-2.5">
                    {availableStudents.map((std) => (
                      <Button
                        key={std.id}
                        type="button"
                        variant="outline"
                        size="md"
                        fullWidth
                        onClick={() => handleStudentSelection(std.id)}
                        disabled={isLoading}
                        className="p-3.5 border-slate-200 hover:border-[#F46E20] bg-white hover:bg-orange-50/50 rounded-2xl justify-between text-left h-auto min-h-[44px]"
                        id={`btn-select-student-${std.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#F46E20] flex items-center justify-center font-bold">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {std.displayName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {std.age ? `Age: ${std.age} yrs • ` : ''}{formatGradeClass(std.gradeClass) || 'Student'}{std.schoolName ? ` • ${std.schoolName}` : ''}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#F46E20] group-hover:translate-x-0.5 transition-all" />
                      </Button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      setCurrentView('login');
                      setErrorMessage(null);
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 mt-2"
                    leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                  >
                    Back to login form
                  </Button>
                </div>
              )}

              {/* VIEW 4: FORGOT PASSWORD */}
              {currentView === 'forgot' && (
                <div className="space-y-4">
                  {forgotSuccessMessage ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-emerald-800">
                        Reset Link Dispatched
                      </h3>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        {forgotSuccessMessage}
                      </p>
                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-1/2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                          onClick={() => {
                            setCurrentView('reset-token');
                            setErrorMessage(null);
                          }}
                        >
                          Have a Token?
                        </Button>
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          className="w-1/2"
                          onClick={() => {
                            setCurrentView('login');
                            setErrorMessage(null);
                          }}
                          id="btn-back-from-forgot-success"
                        >
                          Back to Login
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" id="form-forgot-password">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Enter your registered email address or phone number. We will dispatch a secure password reset link to your email immediately.
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Registered Email or Phone
                        </label>
                        <Input
                          id="input-forgot-email"
                          type="text"
                          required
                          value={forgotIdentifier}
                          onChange={(e) => setForgotIdentifier(e.target.value)}
                          placeholder="e.g. parent@example.com or 9876543210"
                          leftIcon={<Mail className="w-4 h-4" />}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          className="w-1/3"
                          onClick={() => {
                            setCurrentView('login');
                            setErrorMessage(null);
                          }}
                          id="btn-cancel-forgot"
                          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          variant="accent"
                          size="md"
                          className="w-2/3"
                          isLoading={isSendingForgot}
                          loadingText="Sending Link..."
                          id="btn-submit-forgot"
                          leftIcon={<Key className="w-3.5 h-3.5" />}
                        >
                          Send Reset Link
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* VIEW 5: RESET PASSWORD WITH TOKEN */}
              {currentView === 'reset-token' && (
                <div className="space-y-4">
                  {resetSuccessMessage ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-emerald-800">
                        Password Reset Successfully
                      </h3>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        {resetSuccessMessage}
                      </p>
                      <Button
                        type="button"
                        variant="success"
                        size="md"
                        fullWidth
                        onClick={() => {
                          setCurrentView('login');
                          setErrorMessage(null);
                        }}
                        id="btn-back-from-reset-success"
                      >
                        Sign In with New Password
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleResetTokenSubmit} className="space-y-3.5" id="form-reset-password">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Enter the reset token received in your email and configure your new secure password.
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Reset Token
                        </label>
                        <Input
                          id="input-reset-token"
                          type="text"
                          required
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          placeholder="Enter 64-character token from email"
                          className="font-mono text-xs"
                          leftIcon={<Key className="w-4 h-4" />}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          New Password
                        </label>
                        <Input
                          id="input-reset-new-password"
                          type="password"
                          required
                          minLength={8}
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          leftIcon={<Lock className="w-4 h-4" />}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Confirm New Password
                        </label>
                        <Input
                          id="input-reset-confirm-password"
                          type="password"
                          required
                          minLength={8}
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          leftIcon={<Lock className="w-4 h-4" />}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          className="w-1/3"
                          onClick={() => {
                            setCurrentView('login');
                            setErrorMessage(null);
                          }}
                          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="md"
                          className="w-2/3"
                          isLoading={isResettingPassword}
                          loadingText="Updating..."
                          id="btn-submit-token-reset"
                          leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                        >
                          Save Password
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* VIEW 6: CHANGE PASSWORD */}
              {currentView === 'change' && (
                <div className="space-y-4">
                  {changeSuccessMessage ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-emerald-800">
                        {authProperties.changePasswordModal.successTitle}
                      </h3>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        {changeSuccessMessage}
                      </p>
                      <Button
                        type="button"
                        variant="success"
                        size="md"
                        fullWidth
                        onClick={() => {
                          setCurrentView('login');
                          setErrorMessage(null);
                        }}
                        id="btn-back-from-change-success"
                      >
                        {authProperties.changePasswordModal.closeBtn}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5" id="form-change-password">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {authProperties.changePasswordModal.description}
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {authProperties.changePasswordModal.emailLabel}
                        </label>
                        <Input
                          id="input-change-email"
                          type="email"
                          required
                          value={changeEmail}
                          onChange={(e) => {
                            setChangeEmail(e.target.value);
                            if (e.target.value.includes('@')) {
                              checkFamilyMembers(e.target.value);
                            }
                          }}
                          onBlur={() => checkFamilyMembers(changeEmail)}
                          placeholder={authProperties.changePasswordModal.emailPlaceholder}
                          leftIcon={<Mail className="w-4 h-4" />}
                        />
                      </div>

                      {familyStudents.length > 1 && (
                        <div className="bg-orange-50/80 border border-orange-200 rounded-xl p-3 space-y-2" id="box-sibling-password-scope">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#F46E20]">
                            <Users className="w-4 h-4" />
                            <span>Family Account Detected ({familyStudents.length} Students)</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-tight">
                            Choose whether to update credentials for the entire family or grant individual access to a specific student:
                          </p>
                          <div className="space-y-1.5 pt-1">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                              <input
                                type="radio"
                                name="passwordScope"
                                value="all"
                                checked={passwordScope === 'all'}
                                onChange={() => setPasswordScope('all')}
                                className="text-[#0E3589] focus:ring-[#0E3589]"
                                id="radio-scope-all"
                              />
                              <span>Change password for all students (Default)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                              <input
                                type="radio"
                                name="passwordScope"
                                value="single"
                                checked={passwordScope === 'single'}
                                onChange={() => setPasswordScope('single')}
                                className="text-[#0E3589] focus:ring-[#0E3589]"
                                id="radio-scope-single"
                              />
                              <span>Change password for a specific student:</span>
                            </label>
                            {passwordScope === 'single' && (
                              <div className="pl-5 pt-1">
                                <Select
                                  value={targetStudentId}
                                  onChange={(e) => setTargetStudentId(e.target.value)}
                                  id="select-target-student-password"
                                >
                                  {familyStudents.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.displayName} {s.age ? `(Age ${s.age})` : ''}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {authProperties.changePasswordModal.currentPasswordLabel}
                        </label>
                        <Input
                          id="input-change-current-password"
                          type="password"
                          value={changeCurrentPassword}
                          onChange={(e) => setChangeCurrentPassword(e.target.value)}
                          placeholder={authProperties.changePasswordModal.currentPasswordPlaceholder}
                          leftIcon={<Key className="w-4 h-4" />}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {authProperties.changePasswordModal.newPasswordLabel}
                        </label>
                        <Input
                          id="input-change-new-password"
                          type="password"
                          required
                          minLength={8}
                          value={changeNewPassword}
                          onChange={(e) => setChangeNewPassword(e.target.value)}
                          placeholder={authProperties.changePasswordModal.newPasswordPlaceholder}
                          leftIcon={<Lock className="w-4 h-4" />}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {authProperties.changePasswordModal.confirmPasswordLabel}
                        </label>
                        <Input
                          id="input-change-confirm-password"
                          type="password"
                          required
                          minLength={8}
                          value={changeConfirmPassword}
                          onChange={(e) => setChangeConfirmPassword(e.target.value)}
                          placeholder={authProperties.changePasswordModal.confirmPasswordPlaceholder}
                          leftIcon={<Lock className="w-4 h-4" />}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          className="w-1/3"
                          onClick={() => {
                            setCurrentView('login');
                            setErrorMessage(null);
                          }}
                          id="btn-cancel-change"
                          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="md"
                          className="w-2/3"
                          isLoading={isUpdatingPassword}
                          loadingText={authProperties.changePasswordModal.updatingBtn}
                          id="btn-submit-change-password"
                        >
                          {authProperties.changePasswordModal.submitBtn}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
    </Modal>
  );
};
