import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseAuthService } from '../services/supabaseAuthService';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  switchStudent: (studentId: string) => Promise<void>;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;

    const validateStoredSession = async () => {
      // 1. Check Server Stored Session via httpOnly cookie first
      const savedToken = localStorage.getItem('smartpen_token');
      const savedUser = localStorage.getItem('smartpen_user');

      try {
        const headers: HeadersInit = {};
        if (savedToken) {
          headers['Authorization'] = `Bearer ${savedToken}`;
        }

        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers
        });

        if (res.ok) {
          const verifiedUser = await res.json();
          setUser(verifiedUser);
          if (savedToken) setToken(savedToken);
          setSessionExpired(false);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('[AUTH] Error checking /api/auth/me:', e);
      }

      // 2. Check Supabase Auth Session Fallback & Harmonize with Backend
      if (isSupabaseConfigured && supabase) {
        try {
          const supabaseUser = await supabaseAuthService.getCurrentUser();
          const { data: { session } } = await supabase.auth.getSession();
          if (supabaseUser && session && supabaseUser.email) {
            // Exchange with backend to establish httpOnly cookie & custom backend JWT
            const exchangeRes = await fetch('/api/auth/supabase-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                supabaseToken: session.access_token,
                email: supabaseUser.email,
                displayName: supabaseUser.displayName,
                role: supabaseUser.role,
                studentId: supabaseUser.studentId,
                id: supabaseUser.id,
                username: supabaseUser.username
              })
            });

            if (exchangeRes.ok) {
              const sessionData = await exchangeRes.json();
              setUser(sessionData.user);
              setToken(sessionData.token);
              localStorage.setItem('smartpen_token', sessionData.token);
              localStorage.setItem('smartpen_user', JSON.stringify(sessionData.user));
              setSessionExpired(false);
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('[AUTH] Supabase session check:', e);
        }

        // Subscribe to auth state changes from Supabase
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user && session.user.email) {
            const current = await supabaseAuthService.getCurrentUser();
            if (current) {
              try {
                const exchangeRes = await fetch('/api/auth/supabase-session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    supabaseToken: session.access_token,
                    email: current.email,
                    displayName: current.displayName,
                    role: current.role,
                    studentId: current.studentId,
                    id: current.id,
                    username: current.username
                  })
                });
                if (exchangeRes.ok) {
                  const sessionData = await exchangeRes.json();
                  setUser(sessionData.user);
                  setToken(sessionData.token);
                  localStorage.setItem('smartpen_token', sessionData.token);
                  localStorage.setItem('smartpen_user', JSON.stringify(sessionData.user));
                  setSessionExpired(false);
                }
              } catch (err) {
                console.warn('[AUTH] Supabase session sync error:', err);
              }
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setToken(null);
          }
        });
        authListener = data;
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

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setSessionExpired(false);
    localStorage.setItem('smartpen_token', newToken);
    localStorage.setItem('smartpen_user', JSON.stringify(newUser));
    setIsLoginModalOpen(false);
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
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

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        sessionExpired,
        login,
        logout,
        switchStudent,
        isLoginModalOpen,
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

