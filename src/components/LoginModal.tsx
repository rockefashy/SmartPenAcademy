import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, User as UserIcon, Mail, Key, CheckCircle, AlertCircle, ArrowRight, ShieldCheck, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { authProperties } from '../properties/auth.properties';
import { SmartPenLogo } from './SmartPenLogo';
import { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password State
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setForgotSuccessMessage(null);
      setIsForgotPasswordView(false);
      // Default to empty or keep previous username
      if (!username) {
        setUsername('admin');
        setPassword('password123');
      }
    }
  }, [isOpen]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await api.login({
        username: username.trim(),
        password: password.trim(),
      });

      login(response.token, response.user);
      if (onLoginSuccess) {
        onLoginSuccess(response.user);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || authProperties.invalidCredentials);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setErrorMessage('Please enter your username or registered email.');
      return;
    }

    setIsSendingForgot(true);
    setErrorMessage(null);
    setForgotSuccessMessage(null);

    try {
      const res = await api.forgotPassword(forgotIdentifier.trim());
      setForgotSuccessMessage(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || authProperties.forgotPasswordModal.userNotFound);
    } finally {
      setIsSendingForgot(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm">
        <div className="min-h-full w-full flex items-center justify-center p-3 sm:p-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col text-left"
          >
            {/* Top Decorative Header */}
            <div className="shrink-0 bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] px-6 py-5 text-white text-center relative shadow-xs">
              <button
                onClick={onClose}
                className="absolute top-3.5 right-3.5 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex justify-center mb-1.5">
                <div className="bg-white p-1.5 rounded-2xl shadow-md">
                  <SmartPenLogo size="sm" />
                </div>
              </div>
              <h2 className="text-xl font-bold font-sans">
                {isForgotPasswordView
                  ? authProperties.forgotPasswordModal.title
                  : authProperties.loginModal.title}
              </h2>
              <p className="text-xs text-blue-100 mt-1">
                {isForgotPasswordView
                  ? 'Direct Password Dispatch to Email'
                  : authProperties.loginModal.subtitle}
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

              {!isForgotPasswordView ? (
                /* Single Unified Sign In Form */
                <div className="space-y-5">
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {authProperties.loginModal.usernameLabel}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder={authProperties.loginModal.usernamePlaceholder}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          {authProperties.loginModal.passwordLabel}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPasswordView(true);
                            setErrorMessage(null);
                            setForgotIdentifier(username);
                          }}
                          className="text-xs font-medium text-[#F46E20] hover:text-[#d3540e] hover:underline cursor-pointer"
                        >
                          {authProperties.loginModal.forgotPassword}
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={authProperties.loginModal.passwordPlaceholder}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    {/* Quick 1-Click Testing Helper Chips */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <p className="text-[11px] font-bold text-slate-600">Quick Test Credentials:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuickFill('admin', 'password123')}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                            username === 'admin'
                              ? 'bg-blue-50 border-[#0E3589] text-[#0E3589]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#0E3589] shrink-0" />
                          <span className="truncate">Admin Account</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickFill('student_khwaish', 'password123')}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                            username === 'student_khwaish'
                              ? 'bg-orange-50 border-[#F46E20] text-[#F46E20]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <GraduationCap className="w-3.5 h-3.5 text-[#F46E20] shrink-0" />
                          <span className="truncate">Student</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-[#0E3589] to-[#0084F4] hover:from-[#0a2766] hover:to-[#0070d1] text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      {isLoading ? (
                        <span>{authProperties.loginModal.loggingIn}</span>
                      ) : (
                        <>
                          <span>{authProperties.loginModal.submitBtn}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Forgot Password Screen */
                <div className="space-y-4">
                  {forgotSuccessMessage ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-emerald-800">
                        {authProperties.forgotPasswordModal.successTitle}
                      </h3>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        {forgotSuccessMessage}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsForgotPasswordView(false)}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow transition-colors cursor-pointer"
                      >
                        {authProperties.forgotPasswordModal.closeBtn}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {authProperties.forgotPasswordModal.description}
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {authProperties.forgotPasswordModal.inputLabel}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            required
                            value={forgotIdentifier}
                            onChange={(e) => setForgotIdentifier(e.target.value)}
                            placeholder={authProperties.forgotPasswordModal.inputPlaceholder}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F46E20] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsForgotPasswordView(false)}
                          className="w-1/3 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSendingForgot}
                          className="w-2/3 py-2.5 px-3 bg-[#F46E20] hover:bg-[#d8580f] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 disabled:opacity-70 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>
                            {isSendingForgot
                              ? authProperties.forgotPasswordModal.sendingBtn
                              : authProperties.forgotPasswordModal.submitBtn}
                          </span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
