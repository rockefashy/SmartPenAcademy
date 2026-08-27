/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { DemoBookingModal } from './components/DemoBookingModal';
import { LandingPage } from './pages/LandingPage';
import { AboutUsPage } from './pages/AboutUsPage';
import { EnrollmentPage } from './pages/EnrollmentPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { ParentPortalPage } from './pages/ParentPortalPage';
import { AIAgentChatWidget } from './components/AIAgentChatWidget';
import { ChatMessage } from './components/SmartPenAIAgentCore';
import { ShieldCheck, Lock, GraduationCap, ArrowRight, UserCheck, Sparkles, Loader2 } from 'lucide-react';

function MainApp() {
  const { 
    isLoginModalOpen, 
    closeLoginModal, 
    openLoginModal, 
    user, 
    token,
    isAuthenticated,
    isLoading,
    sessionExpired,
    logout 
  } = useAuth();
  
  // Navigation State
  const [currentView, setCurrentView] = useState<string>('landing');
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [studentDetailSection, setStudentDetailSection] = useState<number>(1);
  
  // Free Demo Class Booking Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

  // Shared Persistent Chat History across Home and Popup Assistant
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-init',
      sender: 'bot',
      text: `👋 Hello **Khwaish Sharma**! I am your SmartPen Assistant.\n\nYou can ask me:\n\n• *"I want to enroll / register my child"*\n• *"Book a free demo class"*\n• *"How to GPAY coaching fee to coach?"*\n• *"What is my attendance summary and fee status?"*`,
      timestamp: '01:45 PM',
    }
  ]);

  // Sync route on hash change if user uses browser back/forward or deep link
  const handleNavigate = (view: string, extraId?: string, defaultSection: number = 1) => {
    setCurrentView(view);
    if (extraId) {
      setSelectedStudentId(extraId);
    }
    setStudentDetailSection(defaultSection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render Loading Spinner while validating stored JWT session on first load
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#0E3589] animate-spin" />
          <p className="text-xs font-bold text-slate-600 tracking-wide uppercase">
            Verifying SmartPen Session...
          </p>
        </div>
      </div>
    );
  }

  // Render current view with JWT session guards
  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return (
          <LandingPage
            onNavigate={handleNavigate}
            onOpenLogin={openLoginModal}
            onOpenDemoBooking={() => setIsDemoModalOpen(true)}
            currentUser={user}
            messages={chatMessages}
            setMessages={setChatMessages}
          />
        );

      case 'about':
        return (
          <AboutUsPage
            onNavigate={handleNavigate}
            onOpenDemoBooking={() => setIsDemoModalOpen(true)}
          />
        );

      case 'enroll':
        return (
          <EnrollmentPage
            onNavigate={(view, studentId) => handleNavigate(view, studentId)}
            onOpenDemoModal={() => setIsDemoModalOpen(true)}
          />
        );

      case 'admin':
        // JWT Auth Guard: Must be signed in as Admin
        if (!isAuthenticated || !token) {
          return (
            <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
              <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-blue-200 shadow-xl shadow-blue-900/5 space-y-6">
                <div className="w-16 h-16 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-center justify-center mx-auto text-[#0E3589] shadow-inner">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-extrabold border border-amber-200">
                    <Lock className="w-3.5 h-3.5" />
                    <span>JWT Protected Route</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Admin Portal Sign In Required
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    The Administrator Dashboard is restricted to authorized Academy Staff. A valid JWT session is required to manage student registrations, batch schedules, attendance, and fee ledgers.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => openLoginModal()}
                    className="w-full sm:w-auto px-6 py-3 bg-[#0E3589] hover:bg-[#092666] text-white font-extrabold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleNavigate('landing')}
                    className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          );
        }

        if (user?.role !== 'admin') {
          return (
            <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
              <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-red-200 shadow-xl space-y-6">
                <div className="w-16 h-16 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-center mx-auto text-red-600">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-slate-900">
                    Administrator Privileges Required
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    You are currently authenticated as a student account (<span className="font-bold text-slate-800">{user.username}</span>). Administrator privileges are required to access this dashboard.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      logout();
                      openLoginModal();
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-[#0E3589] hover:bg-[#092666] text-white font-extrabold rounded-xl text-sm transition-all shadow-md cursor-pointer"
                  >
                    Switch Account
                  </button>
                  <button
                    onClick={() => handleNavigate('parentPortal')}
                    className="w-full sm:w-auto px-5 py-3 bg-[#F46E20] hover:bg-[#e05c10] text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Go to My Student Portal
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <AdminDashboardPage
            onNavigate={(view, studentId, defaultSection) =>
              handleNavigate(view, studentId, defaultSection)
            }
          />
        );

      case 'studentDetail':
        // Guard student detail: Must be admin or authenticated
        if (!isAuthenticated || !token) {
          return (
            <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
              <div className="bg-white rounded-3xl p-8 border-2 border-blue-200 shadow-xl space-y-5">
                <div className="w-14 h-14 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto text-[#0E3589]">
                  <Lock className="w-7 h-7" />
                </div>
                <h1 className="text-xl font-extrabold text-slate-900">
                  Authentication Required
                </h1>
                <p className="text-xs text-slate-600">
                  Please log in with verified administrator credentials to review or edit this student file.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => openLoginModal()}
                    className="px-5 py-2.5 bg-[#0E3589] text-white font-bold rounded-xl text-xs cursor-pointer shadow"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => handleNavigate('landing')}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs"
                  >
                    Home
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <StudentDetailPage
            studentId={selectedStudentId || user?.studentId || 'std-1'}
            initialSection={studentDetailSection}
            onBack={() => handleNavigate(user?.role === 'admin' ? 'admin' : 'parentPortal')}
            onNavigate={handleNavigate}
          />
        );

      case 'parentPortal':
        // JWT Auth Guard: Must be signed in as Student (or Admin previewing)
        if (!isAuthenticated || !token) {
          return (
            <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
              <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-orange-200 shadow-xl shadow-orange-900/5 space-y-6">
                <div className="w-16 h-16 bg-orange-50 border-2 border-orange-200 rounded-2xl flex items-center justify-center mx-auto text-[#F46E20] shadow-inner">
                  <GraduationCap className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#0E3589] rounded-full text-xs font-extrabold border border-blue-200">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Student Portal</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Sign In Required
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    Please log in to access your handwriting evaluation reports, homework worksheets, practice gallery, attendance history, and fee payment receipts.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => openLoginModal()}
                    className="w-full sm:w-auto px-6 py-3 bg-[#F46E20] hover:bg-[#e05c10] text-white font-extrabold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Sign In to Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsDemoModalOpen(true)}
                    className="w-full sm:w-auto px-5 py-3 bg-blue-50 hover:bg-blue-100 text-[#0E3589] font-bold rounded-xl text-sm transition-all cursor-pointer border border-blue-200"
                  >
                    Book Free Demo Class
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium">
                  💡 Credentials were sent to parent email upon student enrollment. For assistance, contact Academy Admin.
                </div>
              </div>
            </div>
          );
        }

        return (
          <ParentPortalPage
            studentId={user?.role === 'admin' ? selectedStudentId : (user?.studentId || selectedStudentId)}
            onNavigate={handleNavigate}
            onOpenLogin={openLoginModal}
          />
        );

      default:
        return (
          <LandingPage
            onNavigate={handleNavigate}
            onOpenLogin={openLoginModal}
            onOpenDemoBooking={() => setIsDemoModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-vibrant-mesh text-slate-800 font-sans antialiased selection:bg-[#F46E20]/20 selection:text-[#0E3589] relative">
      {/* Dynamic Background Ambient Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-gradient-to-br from-blue-400/20 via-sky-300/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-gradient-to-bl from-orange-400/20 via-amber-300/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-2/3 left-10 w-[500px] h-[500px] bg-gradient-to-tr from-sky-400/15 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-orange-500/15 via-pink-400/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
      </div>

      {/* Navigation Header (No hamburger, menu on the right, contact details included) */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => handleNavigate(view)}
        onOpenDemoBooking={() => setIsDemoModalOpen(true)}
      />

      {/* Session Expired Re-authentication Banner */}
      {sessionExpired && !isAuthenticated && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-between shadow-md relative z-30">
          <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Your secure session has expired. Please sign in again to continue accessing your SmartPen dashboard and AI Agent features.</span>
          </div>
          <button
            onClick={() => openLoginModal()}
            className="px-3 py-1 bg-white text-slate-900 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors shadow-xs shrink-0 cursor-pointer ml-3"
          >
            Sign In Now
          </button>
        </div>
      )}

      {/* Main Page Content */}
      <main className="flex-1">
        {renderView()}
      </main>

      {/* Global Footer */}
      <Footer onNavigate={(view) => handleNavigate(view)} />

      {/* Free Demo Class Booking Modal */}
      <DemoBookingModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onSuccess={() => {
          // Keep open to show success state, user can close or WhatsApp directly
        }}
      />

      {/* Authentication Modal (Single Unified Sign In Screen) */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onLoginSuccess={(loggedInUser) => {
          if (loggedInUser.role === 'admin') {
            handleNavigate('admin');
          } else {
            handleNavigate('parentPortal', loggedInUser.studentId);
          }
        }}
      />

      {/* Floating SmartPen AI Agent Chatbot (Hidden on Home/Landing where it is inline in Hero) */}
      <AIAgentChatWidget 
        currentUser={user}
        onNavigate={handleNavigate} 
        onOpenDemoBooking={() => setIsDemoModalOpen(true)}
        messages={chatMessages}
        setMessages={setChatMessages}
        hideFloatingTrigger={currentView === 'landing'}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
