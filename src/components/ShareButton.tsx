import React, { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { shareContent } from '../lib/clipboard';

export function ShareButton({
  title,
  text,
  url,
  variant = 'subtle',
  ariaLabel,
  className = '',
}: {
  title?: string;
  text?: string;
  url: string;
  variant?: 'subtle' | 'outline';
  ariaLabel?: string;
  className?: string;
}) {
  const [feedback, setFeedback] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const outcome = await shareContent({
      title: title || "Stranger's Wisdom",
      text,
      url,
    });

    if (outcome === 'cancelled') return;

    setFeedback(outcome);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setFeedback('idle');
    }, 2000);
  };

  const labelText =
    feedback === 'shared'
      ? 'Shared'
      : feedback === 'copied'
      ? 'Link copied'
      : feedback === 'failed'
      ? 'Unable to share'
      : 'Share';

  const baseStyles =
    variant === 'outline'
      ? 'min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]'
      : 'min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]';

  const toneStyles =
    feedback === 'shared' || feedback === 'copied'
      ? variant === 'outline'
        ? 'border-teal-500/50 bg-teal-500/10 text-teal-700 dark:text-teal-300'
        : 'text-teal-600 dark:text-teal-400 bg-teal-500/10'
      : feedback === 'failed'
      ? variant === 'outline'
        ? 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-300'
        : 'text-rose-600 dark:text-rose-400'
      : variant === 'outline'
      ? 'border-slate-200 dark:border-indigo-900 bg-white/60 dark:bg-[#0A0F20]/70 text-slate-700 dark:text-slate-200 hover:border-cyan-500/40 hover:bg-slate-100 dark:hover:bg-indigo-950/60'
      : 'text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-slate-100/80 dark:hover:bg-indigo-950/50';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={`${baseStyles} ${toneStyles} ${className}`}
    >
      {feedback === 'shared' || feedback === 'copied' ? (
        <Check className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Share2 className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{labelText}</span>
    </button>
  );
}
