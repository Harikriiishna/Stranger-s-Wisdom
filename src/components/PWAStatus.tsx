import React, { useState } from 'react';
import {
  ArrowDown,
  Check,
  Download,
  RefreshCw,
  Share,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { PullToRefreshStatus } from '../hooks/usePullToRefresh';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({
  variant = 'sidebar',
}: {
  variant?: 'sidebar' | 'compact' | 'settings';
}) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleAction = () => {
    if (isInstallable) {
      void install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const label = isInstallable ? 'Install App' : 'Install on iOS';

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleAction}
          aria-label={label}
          title={label}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40 cursor-pointer"
        >
          <Download className="h-5 w-5" />
        </button>
      ) : variant === 'settings' ? (
        <button
          type="button"
          onClick={handleAction}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400 transition-colors cursor-pointer"
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAction}
          className="w-full min-h-[40px] flex items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#0D1326] p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="ios-install-title"
                  className="text-base font-semibold text-slate-900 dark:text-white"
                >
                  Install on iPhone or iPad
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Save Stranger’s Wisdom to your home screen for offline reading.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close install instructions"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  1
                </span>
                <span>
                  Tap the <Share className="inline h-4 w-4 mx-0.5 text-cyan-500" />{' '}
                  <strong>Share</strong> button in Safari’s toolbar.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  2
                </span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[42px] rounded-xl bg-slate-100 dark:bg-indigo-950/70 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-indigo-900/70 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator({
  justReconnected = false,
  onManualRefresh,
  onDismissReconnected,
  isRefreshing = false,
}: {
  justReconnected?: boolean;
  onManualRefresh?: () => void;
  onDismissReconnected?: () => void;
  isRefreshing?: boolean;
}) {
  const isOnline = useOnlineStatus();

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="shrink-0 md:sticky md:top-0 z-20 border-b border-amber-500/30 bg-amber-500/12 dark:bg-amber-950/60 backdrop-blur-md px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2 text-center"
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          Offline Mode — Viewing previously loaded questions &amp; saved wisdom.
        </span>
      </div>
    );
  }

  if (justReconnected && onManualRefresh) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-reconnected-banner="true"
        className="shrink-0 md:sticky md:top-0 z-20 border-b border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/55 backdrop-blur-md px-4 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex flex-wrap items-center justify-center gap-2.5 text-center"
      >
        <span className="inline-flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Back online — pull down to refresh latest discussions</span>
        </span>
        <button
          type="button"
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 underline underline-offset-2 hover:opacity-80 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing…' : 'Refresh now'}</span>
        </button>
        {onDismissReconnected && (
          <button
            type="button"
            onClick={onDismissReconnected}
            aria-label="Dismiss online notice"
            className="p-0.5 rounded text-emerald-700/75 dark:text-emerald-300/75 hover:text-emerald-900 dark:hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return null;
}

export function PullToRefreshIndicator({
  status,
  pullDistance,
  progress,
}: {
  status: PullToRefreshStatus;
  pullDistance: number;
  progress: number;
}) {
  const isVisible = pullDistance > 0 || status !== 'idle';

  const label =
    status === 'refreshing'
      ? 'Refreshing…'
      : status === 'ready'
        ? 'Release to refresh'
        : status === 'refreshed'
          ? 'Updated'
          : status === 'offline'
            ? 'Still offline — reconnect to refresh'
            : 'Pull down to refresh';

  return (
    <motion.div
      aria-live="polite"
      aria-hidden={!isVisible}
      data-pull-to-refresh={status}
      data-pull-distance={Math.round(pullDistance)}
      initial={false}
      animate={{
        height: isVisible ? pullDistance : 0,
        opacity: isVisible ? Math.min(1, 0.35 + progress * 0.65) : 0,
      }}
      transition={
        status === 'pulling' || status === 'ready'
          ? { duration: 0 }
          : { type: 'spring', stiffness: 360, damping: 32 }
      }
      className="overflow-hidden flex items-center justify-center select-none pointer-events-none"
    >
      {isVisible && (
        <div
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 ${
            status === 'offline'
              ? 'text-amber-700 dark:text-amber-300'
              : status === 'refreshed' || status === 'ready'
                ? 'text-cyan-700 dark:text-cyan-300'
                : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {status === 'refreshing' ? (
            <RefreshCw className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-400 shrink-0" />
          ) : status === 'refreshed' ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : status === 'offline' ? (
            <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <motion.span
              className="inline-flex"
              animate={{ rotate: status === 'ready' ? 180 : progress * 140 }}
              transition={{ duration: 0.12 }}
            >
              <ArrowDown className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            </motion.span>
          )}
          <span>{label}</span>
        </div>
      )}
    </motion.div>
  );
}
