import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SessionUser, ROLES } from '../types';
import { api } from '../services/api';

export type AuthModalView = 'login' | 'select-role' | 'select-student' | 'forgot' | 'reset-token' | 'change';

interface AuthContextType {
  user: SessionUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCoach: boolean;
  isStudent: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (token: string, user: SessionUser) => void;
  logout: () => Promise<void>;
  switchStudent: (studentId: string) => Promise<void>;
  isLoginModalOpen: boolean;
  loginModalInitialView: AuthModalView;
  openLoginModal: (initialView?: AuthModalView) => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => typeof window !== 'undefined');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalInitialView, setLoginModalInitialView] = useState<AuthModalView>('login');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const validateStoredSession = async () => {
      // Check Server Stored Session via httpOnly cookie or stored access token
      const savedToken = localStorage.getItem('smartpen_token');
      const savedUser = localStorage.getItem('smartpen_user');

      try {
        const headers: HeadersInit = {};
        if (savedToken) {
          headers['Authorization'] = `Bearer ${savedToken}`;
        }

        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          headers
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            if (savedToken) setToken(savedToken);
            setSessionExpired(false);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('[AUTH] Error checking session:', e);
      }

      // If no valid session found, clear stale credentials
      if (savedToken || savedUser) {
        localStorage.removeItem('smartpen_token');
        localStorage.removeItem('smartpen_user');
      }
      setToken(null);
      setUser(null);
      setIsLoading(false);
    };

    const sessionTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    validateStoredSession().finally(() => {
      clearTimeout(sessionTimer);
    });
  }, []);

  const login = (newToken: string, newUser: SessionUser) => {
    setToken(newToken);
    setUser(newUser);
    setSessionExpired(false);
    localStorage.setItem('smartpen_token', newToken);
    localStorage.setItem('smartpen_user', JSON.stringify(newUser));
    setIsLoginModalOpen(false);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      }).catch(() => {});
    } catch (err) {
      console.error('Logout error:', err);
    }
    setToken(null);
    setUser(null);
    setSessionExpired(false);
    localStorage.removeItem('smartpen_token');
    localStorage.removeItem('smartpen_user');
  };

  const switchStudent = async (studentId: string) => {
    try {
      const response = await api.switchStudent(studentId);
      if (response.token && response.user) {
        setToken(response.token);
        setUser(response.user);
        setSessionExpired(false);
        localStorage.setItem('smartpen_token', response.token);
        localStorage.setItem('smartpen_user', JSON.stringify(response.user));
      }
    } catch (err) {
      console.error('Failed to switch student profile:', err);
      throw err;
    }
  };

  const openLoginModal = (view: AuthModalView = 'login') => {
    setLoginModalInitialView(view);
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const isAdmin = user?.role === ROLES.ADMIN;
  const isCoach = user?.role === ROLES.COACH;
  const isStudent = user?.role === ROLES.STUDENT;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin,
        isCoach,
        isStudent,
        isLoading,
        sessionExpired,
        login,
        logout,
        switchStudent,
        isLoginModalOpen,
        loginModalInitialView,
        openLoginModal,
        closeLoginModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

