import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Eye, EyeOff, Infinity as InfinityIcon, KeyRound, Lock, Mail, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B19] text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 sanctuary-glow">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <Link to="/home" className="flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-400">
            <InfinityIcon className="h-4 w-4" />
            Stranger’s Wisdom
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200/90 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          {children}
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Your email and private alias are never shown publicly on questions or answers.
        </p>
      </div>
    </div>
  );
}

export function SignUpPage() {
  const { registerWithEmail, loginWithGoogle, continueAnonymously } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = await registerWithEmail(
        email.trim(),
        password,
        alias.trim() || undefined
      );
      setRecoveryCode(res.recoveryCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setBusy(false);
    }
  };

  if (recoveryCode) {
    return (
      <AuthShell
        title="Save Your Recovery Code"
        subtitle="Keep this private code somewhere safe in case you ever need to reset your password."
      >
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            One-time account recovery code
          </p>
          <p className="font-tabular text-2xl font-bold tracking-widest text-slate-900 dark:text-white">
            {recoveryCode}
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(recoveryCode);
              setCopied(true);
            }}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-amber-500/40 px-4 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="w-full min-h-[46px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 cursor-pointer"
        >
          Enter Stranger’s Wisdom
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create Account"
      subtitle="Join safely. Your public questions and answers remain anonymous."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-email" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] pl-10 pr-4 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Password (8+ characters)
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              id="signup-password"
              type={showPass ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] pl-10 pr-11 text-sm focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="signup-alias" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Private Alias (optional, only visible to you)
          </label>
          <input
            id="signup-alias"
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g. Quiet Listener"
            className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[46px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {busy ? 'Creating account...' : 'Create Private Account'}
        </button>
      </form>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-indigo-950" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-[#0D1326] px-3 text-slate-400">or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              await loginWithGoogle();
              navigate('/home');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Google sign-in failed.');
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
        >
          Continue with Google
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              await continueAnonymously();
              navigate('/home');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to start guest session.');
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-indigo-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
        >
          <UserCheck className="h-3.5 w-3.5" />
          Anonymous Guest
        </button>
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/signin" className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}

export function SignInPage() {
  const { loginWithEmail, loginWithGoogle, continueAnonymously } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginWithEmail(email.trim(), password);
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Sign in to sync your saved wisdom, drafts, and private conversations."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signin-email" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              id="signin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] pl-10 pr-4 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="signin-password" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              id="signin-password"
              type={showPass ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] pl-10 pr-11 text-sm focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[46px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {busy ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-indigo-950" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-[#0D1326] px-3 text-slate-400">or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              await loginWithGoogle();
              navigate('/home');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Google sign-in failed.');
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
        >
          Continue with Google
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              await continueAnonymously();
              navigate('/home');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Guest session failed.');
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-indigo-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
        >
          <UserCheck className="h-3.5 w-3.5" />
          Anonymous Guest
        </button>
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Don’t have an account?{' '}
        <Link to="/signup" className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline">
          Sign Up
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [copiedNewCode, setCopiedNewCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.requestPasswordReset(email.trim());
      setInfo(res.message);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start reset.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.confirmPasswordReset({
        email: email.trim(),
        recoveryCode: recoveryCode.trim(),
        newPassword,
      });
      setInfo(res.message);
      setNewRecoveryCode(res.newRecoveryCode || null);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Restore private access to your Stranger's Wisdom library."
    >
      {step === 'request' && (
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Account Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[46px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 cursor-pointer"
          >
            {busy ? 'Checking...' : 'Continue Reset'}
          </button>
        </form>
      )}

      {step === 'confirm' && (
        <form onSubmit={handleConfirm} className="space-y-4">
          {info && (
            <p className="text-xs leading-relaxed text-teal-700 dark:text-teal-300 bg-teal-500/10 rounded-xl p-3">
              {info}
            </p>
          )}
          <div>
            <label htmlFor="recovery-code" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Recovery Code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                id="recovery-code"
                type="text"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="12-character code"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] pl-10 pr-4 text-sm font-tabular focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="new-pw" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              New Password (8+ characters)
            </label>
            <input
              id="new-pw"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[46px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 cursor-pointer"
          >
            {busy ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-teal-700 dark:text-teal-300">{info}</p>
          {newRecoveryCode && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Your new recovery code (your previous code has expired)
              </p>
              <p className="font-tabular text-2xl font-bold tracking-widest text-slate-900 dark:text-white">
                {newRecoveryCode}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(newRecoveryCode).catch(() => undefined);
                  setCopiedNewCode(true);
                }}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-amber-500/40 px-4 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 cursor-pointer"
              >
                {copiedNewCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedNewCode ? 'Copied' : 'Copy New Code'}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate('/signin')}
            className="w-full min-h-[46px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 cursor-pointer"
          >
            Return to Sign In
          </button>
        </div>
      )}
    </AuthShell>
  );
}
