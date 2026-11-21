import React from 'react';
import { AlertCircle, CheckCircle2, HeartHandshake, RefreshCw, Compass } from 'lucide-react';
import type { CrisisResources } from '../types';

export function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/80 dark:border-indigo-950/70 bg-white dark:bg-[#0D1326] p-6 animate-pulse"
        >
          <div className="h-3 w-36 rounded bg-slate-200 dark:bg-indigo-950/80 mb-4" />
          <div className="h-5 w-4/5 rounded bg-slate-200 dark:bg-indigo-900/60 mb-2.5" />
          <div className="h-4 w-full rounded bg-slate-100 dark:bg-indigo-950/50 mb-2" />
          <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-indigo-950/50" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title = 'No questions here yet.',
  subtitle = 'Someone might need your perspective today.',
  actionLabel,
  onAction,
}: {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-indigo-950/70 bg-white/80 dark:bg-[#0D1326]/70 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
        <Compass className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {subtitle}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong. Your content is safe. Try again.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-6 py-8 text-center"
    >
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 dark:border-indigo-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}

export function SuccessConfirmation({
  title = 'All Set!',
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title?: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-teal-500/30 bg-white dark:bg-[#0D1326] p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-300">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-white text-balance">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-300">
        {message}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="min-h-[44px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function CrisisSupportBanner({ resources }: { resources?: CrisisResources | null }) {
  const notice =
    resources?.notice ||
    'Stranger’s Wisdom is not a substitute for professional medical, mental-health, legal, or emergency support. If you or someone else is in immediate danger, please reach out right away.';
  const hotlines = resources?.hotlines || [
    { name: '988 Suicide & Crisis Lifeline', contact: 'Call or text 988 (24/7, free)' },
    { name: 'Crisis Text Line', contact: 'Text HOME to 741741' },
    { name: 'International Support', contact: 'Visit findahelpline.com or call local emergency services' },
  ];

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-left">
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-amber-200">
            Supportive Care Resources
          </h4>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {notice}
          </p>
          <ul className="space-y-1.5 pt-1 text-xs text-slate-700 dark:text-slate-200">
            {hotlines.map((h) => (
              <li key={h.name}>
                <span className="font-semibold">{h.name}:</span> {h.contact}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070B19] p-6">
          <div className="max-w-md w-full">
            <ErrorState
              message="Something unexpected occurred. Your data remains safe."
              onRetry={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
            />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
