import React, { useEffect, useRef, useState } from 'react';
import { Check, Link2, MoreHorizontal, Share2 } from 'lucide-react';
import {
  buildShareSnippet,
  canUseNativeShare,
  copyTextToClipboard,
  shareContent,
} from '../lib/clipboard';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

export function CardContextMenu({
  shareUrl,
  shareTitle,
  shareText,
  triggerLabel = 'More options',
  items = [],
  onCopied,
  onShared,
  buttonClassName = '',
}: {
  shareUrl: string;
  shareTitle?: string;
  shareText?: string;
  triggerLabel?: string;
  items?: ContextMenuItem[];
  onCopied?: () => void;
  onShared?: () => void;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'shared' | 'copied'>('idle');
  const [shareError, setShareError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const sanitizedSnippet = buildShareSnippet(shareText);
  const nativeShareAvailable = canUseNativeShare({
    url: shareUrl,
    ...(shareTitle?.trim() ? { title: shareTitle.trim() } : {}),
    ...(sanitizedSnippet ? { text: sanitizedSnippet } : {}),
  });

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const scheduleFeedbackReset = (nextFeedback: 'shared' | 'copied') => {
    setFeedback(nextFeedback);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);

    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 850);
    resetTimerRef.current = window.setTimeout(() => {
      setFeedback('idle');
    }, 2000);
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareError(false);

    const outcome = await shareContent({
      title: shareTitle || "Stranger's Wisdom",
      text: shareText,
      url: shareUrl,
    });

    if (outcome === 'shared') {
      onShared?.();
      scheduleFeedbackReset('shared');
    } else if (outcome === 'copied') {
      onCopied?.();
      scheduleFeedbackReset('copied');
    } else if (outcome === 'failed') {
      setShareError(true);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShareError(false);

    const ok = await copyTextToClipboard(shareUrl);
    if (!ok) {
      setShareError(true);
      return;
    }

    onCopied?.();
    scheduleFeedbackReset('copied');
  };

  const hasSuccessFeedback = feedback !== 'idle';

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShareError(false);
          setOpen((v) => !v);
        }}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
          hasSuccessFeedback
            ? 'text-teal-500'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-indigo-950/60'
        } ${buttonClassName}`}
      >
        {hasSuccessFeedback ? <Check className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={triggerLabel}
          className="absolute right-0 top-11 z-30 w-52 rounded-2xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#111936] p-1.5 shadow-xl"
        >
          {nativeShareAvailable && (
            <button
              type="button"
              role="menuitem"
              onClick={handleNativeShare}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-indigo-950/70 transition-colors cursor-pointer"
            >
              {feedback === 'shared' ? (
                <>
                  <Check className="h-4 w-4 text-teal-500 shrink-0" />
                  <span className="text-teal-600 dark:text-teal-300 font-semibold">
                    Shared
                  </span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span>Share</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-indigo-950/70 transition-colors cursor-pointer"
          >
            {feedback === 'copied' ? (
              <>
                <Check className="h-4 w-4 text-teal-500 shrink-0" />
                <span className="text-teal-600 dark:text-teal-300 font-semibold">
                  Link copied
                </span>
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {shareError && (
            <p className="px-3 py-1.5 text-[11px] text-rose-500" role="alert">
              Unable to share or copy automatically.
            </p>
          )}

          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                item.tone === 'danger'
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/70'
              }`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
