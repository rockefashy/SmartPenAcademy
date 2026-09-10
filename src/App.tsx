/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Button } from './components/ui/Button';
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
import { Lock, Loader2 } from 'lucide-react';

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
  const getInitialView = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qToken = params.get('token');
      if (qToken) {
        try {
          localStorage.setItem('smartpen_token', qToken);
        } catch {}
      }
      const qView = params.get('view');
      if (qView && ['landing', 'about', 'enroll'].includes(qView)) {
        return qView;
      }
      if (qView && ['admin', 'parentPortal'].includes(qView)) {
        const storedToken = localStorage.getItem('smartpen_token');
        if (storedToken) return qView;
        return 'landing';
      }
      if (window.location.hash) {
        const hash = window.location.hash.replace('#', '');
        if (['landing', 'about', 'enroll'].includes(hash)) {
          return hash;
        }
        if (['admin', 'parentPortal'].includes(hash)) {
          const storedToken = localStorage.getItem('smartpen_token');
          if (storedToken) return hash;
          return 'landing';
        }
      }
    }
    return 'landing';
  };
  const [currentView, setCurrentView] = useState<string>(getInitialView);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['landing', 'about', 'enroll'].includes(hash)) {
        setCurrentView(hash);
      } else if (['admin', 'parentPortal'].includes(hash)) {
        const storedToken = localStorage.getItem('smartpen_token');
        if (storedToken) {
          setCurrentView(hash);
        } else {
          setCurrentView('landing');
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Proactively redirect to landing if user logs out or session is unauthenticated while on protected view
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (['admin', 'studentDetail', 'parentPortal'].includes(currentView)) {
        setCurrentView('landing');
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    }
  }, [isLoading, isAuthenticated, currentView]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [studentDetailSection, setStudentDetailSection] = useState<number>(1);
  const [adminInitialTab, setAdminInitialTab] = useState<'roster' | 'assignment' | 'coaches' | 'coachEnrollment' | 'studentEnrollment' | 'alerts'>('roster');
  const [enrollmentInitialData, setEnrollmentInitialData] = useState<any | null>(null);
  const [parentPortalInitialTab, setParentPortalInitialTab] = useState<'overview' | 'progress' | 'works' | 'attendance' | 'fees' | 'testimony'>('overview');
  
  // Free Demo Class Booking Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

  // Shared Persistent Chat History across Home and Popup Assistant
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-init',
      sender: 'bot',
      text: `👋 Hello & welcome to SmartPen Academy! I am your SmartPen Assistant.\n\nYou can ask me:\n\n• *"I want to enroll / register my child"*\n• *"Book a free demo class"*\n• *"How to GPAY coaching fee to coach?"*\n• *"What courses and batch timings are available?"*`,
      timestamp: '01:45 PM',
    }
  ]);

  // Sync route on hash change if user uses browser back/forward or deep link
  const handleNavigate = (view: string, extraId?: string, defaultSection?: any, prefillData?: any) => {
    if (view === 'landing') {
      setCurrentView('landing');
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (view === 'enroll') {
      setCurrentView('admin');
      setAdminInitialTab('studentEnrollment');
      setEnrollmentInitialData(prefillData || null);
      if (extraId) setSelectedStudentId(extraId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (view === 'portal' || view === 'parentPortal') {
      setCurrentView('parentPortal');
      if (extraId) setSelectedStudentId(extraId);
      if (typeof defaultSection === 'string' && ['overview', 'progress', 'works', 'attendance', 'fees', 'testimony'].includes(defaultSection)) {
        setParentPortalInitialTab(defaultSection as any);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentView(view);
    if (extraId) {
      setSelectedStudentId(extraId);
    }
    if (typeof defaultSection === 'number') {
      setStudentDetailSection(defaultSection);
    } else if (typeof defaultSection === 'string' && ['roster', 'assignment', 'coaches', 'coachEnrollment', 'studentEnrollment', 'alerts'].includes(defaultSection)) {
      setAdminInitialTab(defaultSection as any);
    }
    if (prefillData) {
      setEnrollmentInitialData(prefillData);
    }
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
            onNavigate={(view, studentId, defaultSection, prefillData) =>
              handleNavigate(view, studentId, defaultSection, prefillData)
            }
            onOpenDemoModal={() => setIsDemoModalOpen(true)}
            initialData={enrollmentInitialData}
            onBackToDemoBookings={() => {
              setEnrollmentInitialData(null);
              handleNavigate('admin', undefined, 'alerts');
            }}
          />
        );

      case 'admin':
        // Auth Guard: Must be signed in as Admin/Coach
        if (!isAuthenticated || !token) {
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
        }

        if (user?.role !== 'admin' && user?.role !== 'coach') {
          return (
            <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
              <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-red-200 shadow-xl space-y-6">
                <div className="w-16 h-16 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-center mx-auto text-red-600">
                  <Lock className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-slate-900">
                    Staff Privileges Required
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    You are currently authenticated as a student account (<span className="font-bold text-slate-800">{user?.username}</span>). Staff privileges (Administrator or Coach) are required to access this dashboard.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => {
                      logout();
                      openLoginModal();
                    }}
                    variant="primary"
                    size="md"
                    className="w-full sm:w-auto"
                  >
                    Switch Account
                  </Button>
                  <Button
                    onClick={() => handleNavigate('parentPortal')}
                    variant="accent"
                    size="md"
                    className="w-full sm:w-auto"
                  >
                    Go to My Student Portal
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <AdminDashboardPage
            onNavigate={(view, studentId, defaultSection, prefillData) =>
              handleNavigate(view, studentId, defaultSection, prefillData)
            }
            initialTab={adminInitialTab}
          />
        );

      case 'studentDetail':
        // Guard student detail: Must be admin, coach, or authenticated
        if (!isAuthenticated || !token) {
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
        }

        if (user?.role !== 'admin' && user?.role !== 'coach') {
          return (
            <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
              <div className="bg-white rounded-3xl p-8 border-2 border-red-200 shadow-xl space-y-5">
                <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto text-red-600">
                  <Lock className="w-7 h-7" />
                </div>
                <h1 className="text-xl font-extrabold text-slate-900">
                  Staff Privileges Required
                </h1>
                <p className="text-xs text-slate-600">
                  Access to student dossier and editing is restricted to administrators and assigned coaches.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={() => handleNavigate('parentPortal')}
                    variant="accent"
                    size="sm"
                  >
                    Go to My Student Portal
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <StudentDetailPage
            studentId={selectedStudentId || user?.studentId || 'std-1'}
            initialSection={studentDetailSection}
            onBack={() => handleNavigate(user?.role === 'student' ? 'parentPortal' : 'admin')}
            onNavigate={handleNavigate}
          />
        );

      case 'parentPortal':
        // Auth Guard: Must be signed in as Student (or Admin previewing)
        if (!isAuthenticated || !token) {
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
        }

        return (
          <ParentPortalPage
            studentId={user?.role === 'admin' ? selectedStudentId : (user?.studentId || selectedStudentId)}
            initialTab={parentPortalInitialTab}
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
            currentUser={user}
            messages={chatMessages}
            setMessages={setChatMessages}
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
          <Button
            onClick={() => openLoginModal()}
            variant="outline"
            size="sm"
            className="bg-white text-slate-900 border-transparent shadow-xs shrink-0 ml-3 py-1"
          >
            Sign In Now
          </Button>
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
          if (loggedInUser.role === 'admin' || loggedInUser.role === 'coach') {
            handleNavigate('admin');
          } else {
            handleNavigate('parentPortal', loggedInUser.studentId, parentPortalInitialTab);
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
