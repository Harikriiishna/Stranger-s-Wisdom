import React, { useEffect, useRef, useState } from 'react';
import { Check, Link2, MoreHorizontal } from 'lucide-react';
import { copyTextToClipboard } from '../lib/clipboard';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

export function CardContextMenu({
  shareUrl,
  triggerLabel = 'More options',
  items = [],
  onCopied,
  buttonClassName = '',
}: {
  shareUrl: string;
  triggerLabel?: string;
  items?: ContextMenuItem[];
  onCopied?: () => void;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

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

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCopyError(false);

    const ok = await copyTextToClipboard(shareUrl);
    if (!ok) {
      setCopyError(true);
      return;
    }

    setCopied(true);
    onCopied?.();

    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);

    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 850);
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

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
          setCopyError(false);
          setOpen((v) => !v);
        }}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
          copied
            ? 'text-teal-500'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-indigo-950/60'
        } ${buttonClassName}`}
      >
        {copied ? <Check className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={triggerLabel}
          className="absolute right-0 top-11 z-30 w-52 rounded-2xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#111936] p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-indigo-950/70 transition-colors cursor-pointer"
          >
            {copied ? (
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

          {copyError && (
            <p className="px-3 py-1.5 text-[11px] text-rose-500" role="alert">
              Unable to copy automatically.
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
