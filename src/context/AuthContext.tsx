import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseAuthService } from '../services/supabaseAuthService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
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
      // 1. Check Supabase Auth Session First
      if (isSupabaseConfigured && supabase) {
        try {
          const supabaseUser = await supabaseAuthService.getCurrentUser();
          const { data: { session } } = await supabase.auth.getSession();
          if (supabaseUser && session) {
            setUser(supabaseUser);
            setToken(session.access_token);
            setSessionExpired(false);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('[AUTH] Supabase session check:', e);
        }

        // Subscribe to auth state changes from Supabase
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const current = await supabaseAuthService.getCurrentUser();
            if (current) {
              setUser(current);
              setToken(session.access_token);
              setSessionExpired(false);
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setToken(null);
          }
        });
        authListener = data;
      }

      // 2. Check Local/Server Stored Session
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
        } else if (res.status === 401) {
          const errData = await res.json().catch(() => ({}));
          if (errData.isExpired || savedToken || savedUser) {
            console.warn('[AUTH] Token/Session expired. Prompting re-auth.');
            setSessionExpired(true);
          }
          localStorage.removeItem('smartpen_token');
          localStorage.removeItem('smartpen_user');
          setToken(null);
          setUser(null);
        }
      } catch (e) {
        localStorage.removeItem('smartpen_token');
        localStorage.removeItem('smartpen_user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    validateStoredSession();

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

