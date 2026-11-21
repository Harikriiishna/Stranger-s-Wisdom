import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { auth, googleAuthProvider } from '../lib/firebase';
import { authApi, profileApi, setInMemoryToken } from '../lib/api';
import type { UserProfile } from '../types';

type ThemeMode = 'dark' | 'light' | 'system';

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    password: string,
    privateAlias?: string
  ) => Promise<{ recoveryCode: string }>;
  loginWithGoogle: () => Promise<void>;
  continueAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateLocalProfile: (p: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const queryClient = useQueryClient();

  const applyAndStoreProfile = useCallback((next: UserProfile | null) => {
    setProfile(next);
    if (next?.theme) {
      setThemeState(next.theme);
      applyThemeClass(next.theme);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await authApi.session();
      if (res.authenticated && res.profile) {
        if (res.token) setInMemoryToken(res.token);
        applyAndStoreProfile(res.profile);
      } else {
        setInMemoryToken(null);
        applyAndStoreProfile(null);
      }
    } catch {
      setInMemoryToken(null);
      applyAndStoreProfile(null);
    } finally {
      setLoading(false);
    }
  }, [applyAndStoreProfile]);

  useEffect(() => {
    applyThemeClass(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') applyThemeClass('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    void refreshSession();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const res = await authApi.google(idToken);
          setInMemoryToken(res.token);
          applyAndStoreProfile(res.profile);
          setLoading(false);
        } catch {
          // Handled cleanly
        }
      }
    });

    return () => unsub();
  }, [refreshSession, applyAndStoreProfile]);

  const loginWithEmail = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setInMemoryToken(res.token);
    applyAndStoreProfile(res.profile);
    queryClient.invalidateQueries();
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    privateAlias?: string
  ) => {
    const res = await authApi.register({ email, password, privateAlias });
    setInMemoryToken(res.token);
    applyAndStoreProfile(res.profile);
    queryClient.invalidateQueries();
    return { recoveryCode: res.recoveryCode };
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    const res = await authApi.google(idToken);
    setInMemoryToken(res.token);
    applyAndStoreProfile(res.profile);
    queryClient.invalidateQueries();
  };

  const continueAnonymously = async () => {
    const res = await authApi.anonymous();
    setInMemoryToken(res.token);
    applyAndStoreProfile(res.profile);
    queryClient.invalidateQueries();
  };

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    await signOut(auth).catch(() => undefined);
    setInMemoryToken(null);
    applyAndStoreProfile(null);
    queryClient.clear();
  };

  const setTheme = async (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    applyThemeClass(nextTheme);
    if (profile) {
      const res = await profileApi.update({ theme: nextTheme });
      setProfile(res.profile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        theme,
        setTheme,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        continueAnonymously,
        logout,
        refreshSession,
        updateLocalProfile: applyAndStoreProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
