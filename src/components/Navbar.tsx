import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  ShieldCheck, 
  GraduationCap, 
  Sparkles,
  Phone,
  Mail,
  MapPin,
  MessageSquareQuote,
  Menu,
  X,
  ChevronRight,
  BookOpen,
  Home,
  Info,
  CalendarCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { commonProperties } from '../properties/common.properties';
import { SmartPenLogo } from './SmartPenLogo';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, extraId?: string) => void;
  onOpenDemoBooking?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onOpenDemoBooking }) => {
  const { user, isAuthenticated, logout, openLoginModal, switchStudent } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on view change or window resize to desktop
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentView]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = (view: string) => {
    setIsMobileMenuOpen(false);
    onNavigate(view);
  };

  const scrollToSection = (sectionId: string) => {
    setIsMobileMenuOpen(false);
    if (currentView !== 'landing') {
      handleNavClick('landing');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Announcement & Direct Contact Strip */}
      <div className="bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] text-white text-[11px] sm:text-xs py-1.5 px-3 sm:px-6 font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Free Demo Class Announcement */}
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 text-amber-300">
              Free Demo Class
            </span>
            <span className="font-bold text-white tracking-wide truncate">
              Book for a Free Demo Class • All Days (4:00 PM – 7:00 PM)
            </span>
            {onOpenDemoBooking && (
              <button
                onClick={onOpenDemoBooking}
                className="hidden sm:inline-flex ml-1 px-2.5 py-0.5 bg-white text-[#0E3589] hover:bg-amber-100 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs shrink-0"
                id="btn-topstrip-book-demo"
              >
                BOOK YOUR SLOT NOW →
              </button>
            )}
          </div>

          {/* Right: Contact Details */}
          <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs whitespace-nowrap shrink-0">
            <a
              href={`tel:${commonProperties.contact.phone}`}
              className="flex items-center gap-1 hover:text-amber-200 transition-colors font-bold text-amber-300"
              title="Call or WhatsApp SmartPen Academy"
            >
              <Phone className="w-3 h-3 text-amber-300" />
              <span>{commonProperties.contact.phone}</span>
            </a>
            
            <span className="text-white/40 hidden md:inline">|</span>
            
            <a
              href={`mailto:${commonProperties.contact.email}`}
              className="hidden md:flex items-center gap-1 hover:text-amber-200 transition-colors text-white/90"
              title="Email Mrs. Deepthy Rock"
            >
              <Mail className="w-3 h-3 text-blue-200" />
              <span>{commonProperties.contact.email}</span>
            </a>

            <span className="text-white/40 hidden lg:inline">|</span>

            <div className="hidden lg:flex items-center gap-1 text-white/90 text-[11px]">
              <MapPin className="w-3 h-3 text-orange-200 shrink-0" />
              <span className="truncate max-w-xs">{commonProperties.contact.location}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header Area - Logo on top-left, Permanent Enroll Now & Menu button on top-right */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-3">
          {/* SmartPen Academy Logo */}
          <button
            onClick={() => handleNavClick('landing')}
            className="flex items-center cursor-pointer text-left focus:outline-none group transition-transform active:scale-98 py-1"
            id="nav-brand-logo"
            aria-label="SmartPen Academy Home"
          >
            <SmartPenLogo size="lg" />
          </button>

          {/* Top Right Header Action Controls - Sign In & Navigation controls visible across all screen sizes */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Permanent Sign In / Account Controls (Visible on Mobile & Web) */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {user?.role === 'student' && user.siblingStudents && user.siblingStudents.length > 1 && (
                    <div className="hidden sm:block">
                      <select
                        value={user.studentId || ''}
                        onChange={(e) => switchStudent(e.target.value)}
                        className="bg-orange-50 hover:bg-orange-100 text-[#F46E20] text-[11px] font-bold py-1 px-2.5 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer transition-colors shadow-2xs"
                        title="Switch Student Profile"
                        id="select-navbar-switch-student"
                      >
                        {user.siblingStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            Viewing: {s.displayName} {s.age ? `(${s.age}y)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 hover:bg-slate-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-2xl border border-slate-200/90 shadow-2xs transition-colors">
                    {user?.role === 'admin' ? (
                      <button
                        type="button"
                        onClick={() => handleNavClick('admin')}
                        className="flex items-center gap-1.5 sm:gap-2 text-left cursor-pointer group focus:outline-none"
                        title="Go to Admin Portal"
                        id="link-nav-admin-portal"
                      >
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 bg-[#0E3589] group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                          {user?.displayName.charAt(0) || 'A'}
                        </div>
                        <div className="text-left hidden sm:block">
                          <p className="text-xs font-extrabold text-slate-800 leading-tight truncate max-w-[120px] group-hover:text-[#0E3589] transition-colors">
                            {user?.displayName}
                          </p>
                          <p className="text-[10px] font-bold text-[#0E3589] group-hover:underline inline-flex items-center gap-0.5 leading-tight">
                            <span>Admin Portal</span>
                            <span className="text-[9px]">↗</span>
                          </p>
                        </div>
                      </button>
                    ) : user?.role === 'coach' ? (
                      <button
                        type="button"
                        onClick={() => handleNavClick('admin')}
                        className="flex items-center gap-1.5 sm:gap-2 text-left cursor-pointer group focus:outline-none"
                        title="Go to Coach Portal"
                        id="link-nav-coach-portal"
                      >
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 bg-amber-600 group-hover:ring-2 group-hover:ring-amber-400 transition-all">
                          {user?.displayName.charAt(0) || 'C'}
                        </div>
                        <div className="text-left hidden sm:block">
                          <p className="text-xs font-extrabold text-slate-800 leading-tight truncate max-w-[120px] group-hover:text-amber-700 transition-colors">
                            {user?.displayName}
                          </p>
                          <p className="text-[10px] font-bold text-amber-700 group-hover:underline inline-flex items-center gap-0.5 leading-tight">
                            <span>Coach Portal</span>
                            <span className="text-[9px]">↗</span>
                          </p>
                        </div>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleNavClick('parentPortal')}
                        className="flex items-center gap-1.5 sm:gap-2 text-left cursor-pointer group focus:outline-none"
                        title="Go to Student Portal"
                        id="link-nav-student-portal"
                      >
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 bg-[#F46E20] group-hover:ring-2 group-hover:ring-orange-400 transition-all">
                          {user?.displayName.charAt(0) || 'U'}
                        </div>
                        <div className="text-left hidden sm:block">
                          <p className="text-xs font-extrabold text-slate-800 leading-tight truncate max-w-[120px] group-hover:text-[#F46E20] transition-colors">
                            {user?.displayName}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-500 capitalize leading-tight">
                            Student
                          </p>
                        </div>
                      </button>
                    )}
                    <button
                      onClick={logout}
                      className="p-1 sm:p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer ml-0.5"
                      title={commonProperties.nav.logout}
                      id="btn-logout"
                    >
                      <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => openLoginModal()}
                  className="px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-[#0E3589] hover:bg-blue-50 border border-blue-200 rounded-xl transition-all cursor-pointer shadow-2xs min-h-[38px] sm:min-h-[42px] flex items-center gap-1.5"
                  id="btn-nav-signin"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0E3589]" />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-[#0E3589] hover:bg-blue-50 border border-slate-200 transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Navigation Menu'}
              id="btn-mobile-menu-toggle"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-[#0E3589]" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Links Row (Visible on lg and larger screens) */}
        <div className="hidden lg:flex mt-3 pt-2.5 border-t border-slate-100 items-center justify-between gap-2">
          <nav className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
            <button
              onClick={() => handleNavClick('landing')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentView === 'landing'
                  ? 'text-[#0E3589] bg-blue-50 font-bold border border-blue-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-[#0E3589] hover:bg-slate-50'
              }`}
              id="nav-link-home"
            >
              {commonProperties.nav.home}
            </button>

            <button
              onClick={() => handleNavClick('about')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentView === 'about'
                  ? 'text-[#0E3589] bg-blue-50 font-bold border border-blue-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-[#0E3589] hover:bg-slate-50'
              }`}
              id="nav-link-about"
            >
              {commonProperties.nav.about}
            </button>

            <a
              href="#syllabus-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('syllabus-section');
              }}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#0E3589] hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
              id="nav-link-curriculum"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0E3589]" />
              <span>{commonProperties.nav.syllabus}</span>
            </a>

            <a
              href="#workshops-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('workshops-section');
              }}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#0E3589] hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
              id="nav-link-workshops"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F46E20]" />
              <span>{commonProperties.nav.workshops}</span>
            </a>

            <a
              href="#testimonials-section"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('testimonials-section');
              }}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#0E3589] hover:bg-slate-50 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
              id="nav-link-testimonials"
            >
              <MessageSquareQuote className="w-3.5 h-3.5 text-[#0084F4]" />
              <span>{commonProperties.nav.testimonials}</span>
            </a>

            {/* Conditional Portal Links: Show Admin / Coach Portal if staff, Student Portal if student */}
            {isAuthenticated && (user?.role === 'admin' || user?.role === 'coach') && (
              <button
                onClick={() => handleNavClick('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  currentView === 'admin' || currentView === 'studentDetail'
                    ? 'text-[#0E3589] bg-blue-50 font-bold border border-blue-200/60 shadow-2xs'
                    : 'text-slate-600 hover:text-[#0E3589] hover:bg-slate-50'
                }`}
                id="nav-link-admin"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#0E3589]" />
                <span>{user?.role === 'coach' ? 'Coach Portal' : commonProperties.nav.adminDashboard}</span>
              </button>
            )}

            {isAuthenticated && user?.role === 'student' && (
              <button
                onClick={() => handleNavClick('parentPortal')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  currentView === 'parentPortal'
                    ? 'text-[#F46E20] bg-orange-50 font-bold border border-orange-200/60 shadow-2xs'
                    : 'text-slate-600 hover:text-[#F46E20] hover:bg-orange-50/50'
                }`}
                id="nav-link-parent-portal"
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#F46E20]" />
                <span>{commonProperties.nav.parentPortal}</span>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile Drawer Menu (Visible when hamburger is toggled on mobile & tablet) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[calc(100%)] bg-white/98 backdrop-blur-xl border-b border-slate-200 shadow-2xl z-50 max-h-[85vh] overflow-y-auto animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="px-4 py-4 space-y-3">
            {/* User Info Bar if Logged In on Mobile */}
            {isAuthenticated && (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {user?.role === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => handleNavClick('admin')}
                    className="flex items-center gap-3 text-left group cursor-pointer"
                    title="Go to Admin Portal"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shadow-xs bg-[#0E3589] group-hover:ring-2 group-hover:ring-blue-400">
                      {user?.displayName.charAt(0) || 'A'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight group-hover:text-[#0E3589]">
                        {user?.displayName}
                      </p>
                      <span className="text-xs font-bold text-[#0E3589] group-hover:underline inline-flex items-center gap-0.5">
                        Admin Portal <span className="text-[9px]">↗</span>
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shadow-xs ${
                      user?.role === 'coach' ? 'bg-amber-600' : 'bg-[#F46E20]'
                    }`}>
                      {user?.displayName.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {user?.displayName}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {user?.role === 'coach' ? (user.designation || 'Coach') : 'Student'}
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}

            {/* Mobile Navigation Links */}
            <div className="space-y-1 pt-1 border-t border-slate-100">
              <button
                onClick={() => handleNavClick('landing')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                  currentView === 'landing'
                    ? 'bg-blue-50 text-[#0E3589] border border-blue-200/80 shadow-xs'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Home className="w-4 h-4 text-[#0E3589]" />
                  <span>{commonProperties.nav.home}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => handleNavClick('about')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                  currentView === 'about'
                    ? 'bg-blue-50 text-[#0E3589] border border-blue-200/80 shadow-xs'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Info className="w-4 h-4 text-[#0E3589]" />
                  <span>{commonProperties.nav.about}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => scrollToSection('syllabus-section')}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-[#0E3589]" />
                  <span>{commonProperties.nav.syllabus}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => scrollToSection('workshops-section')}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-[#F46E20]" />
                  <span>{commonProperties.nav.workshops}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => scrollToSection('testimonials-section')}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <MessageSquareQuote className="w-4 h-4 text-[#0084F4]" />
                  <span>{commonProperties.nav.testimonials}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Conditional Portal Links: Show Admin / Coach Portal if staff, Student Portal if student */}
              {isAuthenticated && (user?.role === 'admin' || user?.role === 'coach') && (
                <button
                  onClick={() => {
                    handleNavClick('admin');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                    currentView === 'admin' || currentView === 'studentDetail'
                      ? 'bg-blue-50 text-[#0E3589] border border-blue-200 shadow-xs'
                      : 'text-slate-700 hover:bg-blue-50/50'
                  }`}
                  id="mobile-nav-admin"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#0E3589]" />
                    <span>{user?.role === 'coach' ? 'Coach Portal' : commonProperties.nav.adminDashboard}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {isAuthenticated && user?.role === 'student' && (
                <button
                  onClick={() => {
                    handleNavClick('parentPortal');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                    currentView === 'parentPortal'
                      ? 'bg-orange-50 text-[#F46E20] border border-orange-200 shadow-xs'
                      : 'text-slate-700 hover:bg-orange-50/50'
                  }`}
                  id="mobile-nav-parent-portal"
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4 text-[#F46E20]" />
                    <span>{commonProperties.nav.parentPortal}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

