import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { auth, googleAuthProvider } from '../lib/firebase';
import { ApiError, authApi, profileApi, registerAuthExpiredHandler, setInMemoryToken } from '../lib/api';
import {
  clearUserOfflineData,
  readOfflineSession,
  saveOfflineSession,
} from '../lib/offlineCache';
import { applyThemeToDocument, isValidThemeMode } from '../lib/themes';
import type { ThemeMode, UserProfile } from '../types';

const LOCAL_THEME_KEY = 'sw_theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'social-pulse';
  try {
    const saved = window.localStorage.getItem(LOCAL_THEME_KEY);
    if (isValidThemeMode(saved)) {
      applyThemeToDocument(saved);
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  applyThemeToDocument('social-pulse');
  return 'social-pulse';
}

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const queryClient = useQueryClient();
  const profileIdRef = useRef<string | null>(null);

  const applyAndStoreProfile = useCallback((next: UserProfile | null) => {
    profileIdRef.current = next?.id ?? null;
    setProfile(next);
    if (next) {
      saveOfflineSession(next);
    }
    if (next?.theme && isValidThemeMode(next.theme)) {
      setThemeState(next.theme);
      applyThemeToDocument(next.theme);
      try {
        window.localStorage.setItem(LOCAL_THEME_KEY, next.theme);
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  useEffect(() => {
    registerAuthExpiredHandler(() => {
      setInMemoryToken(null);
      void clearUserOfflineData();
      applyAndStoreProfile(null);
      queryClient.removeQueries({ predicate: (q) => ['my-questions', 'my-answers', 'my-received', 'drafts', 'saved', 'notifications', 'profile-stats', 'one-voice', 'moderation-status', 'moderation-dashboard'].includes(String(q.queryKey[0])) });
    });
  }, [applyAndStoreProfile, queryClient]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await authApi.session();
      if (res.authenticated && res.profile) {
        if (res.token) setInMemoryToken(res.token);
        applyAndStoreProfile(res.profile);
      } else {
        setInMemoryToken(null);
        void clearUserOfflineData();
        applyAndStoreProfile(null);
      }
    } catch (err) {
      const isNetworkOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof ApiError && (err.status === 0 || err.status === 408));
      if (isNetworkOffline) {
        const offlineProfile = readOfflineSession();
        if (offlineProfile) {
          applyAndStoreProfile(offlineProfile);
          return;
        }
      }
      setInMemoryToken(null);
      applyAndStoreProfile(null);
    } finally {
      setLoading(false);
    }
  }, [applyAndStoreProfile]);

  useEffect(() => {
    applyThemeToDocument(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') applyThemeToDocument('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    void refreshSession();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && profileIdRef.current !== firebaseUser.uid) {
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

    const onOnline = () => {
      void refreshSession();
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('online', onOnline);
      unsub();
    };
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
    await clearUserOfflineData();
    applyAndStoreProfile(null);
    queryClient.clear();
  };

  const setTheme = async (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    applyThemeToDocument(nextTheme);
    try {
      window.localStorage.setItem(LOCAL_THEME_KEY, nextTheme);
    } catch {
      // Ignore storage errors
    }
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
