import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MessageCircle } from 'lucide-react';
import { formatStatusLabel, formatTimeAgo } from '../lib/format';
import type { QuestionCardItem } from '../types';

export function QuestionCard({
  question,
  onToggleSave,
  compact = false,
}: {
  question: QuestionCardItem;
  onToggleSave?: (question: QuestionCardItem) => void;
  compact?: boolean;
}) {
  return (
    <article className="group rounded-2xl border border-slate-200/90 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] p-5 sm:p-6 transition-colors hover:border-cyan-500/40 dark:hover:border-cyan-500/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-cyan-700 dark:text-cyan-400">
            {question.category}
          </span>
          <span aria-hidden="true">·</span>
          <span>{question.questionType}</span>
          <span aria-hidden="true">·</span>
          <span className="font-tabular">{formatTimeAgo(question.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatStatusLabel(question.status)}</span>
        </div>

        {onToggleSave && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSave(question);
            }}
            aria-label={question.isSaved ? 'Remove saved question' : 'Save question'}
            className={`min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              question.isSaved
                ? 'text-amber-500'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Bookmark
              className="h-4 w-4"
              fill={question.isSaved ? 'currentColor' : 'none'}
            />
          </button>
        )}
      </div>

      <Link to={`/questions/${question.id}`} className="block mt-2.5 focus:outline-none">
        <h3 className="font-wisdom text-lg sm:text-xl font-medium leading-snug text-slate-900 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors text-balance">
          {question.title}
        </h3>

        {!compact && question.body && (
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
            {question.body}
          </p>
        )}
      </Link>

      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-indigo-950/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-tabular">
            <MessageCircle className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            {question.answerCount === 0
              ? 'Waiting for a first perspective'
              : `${question.answerCount} ${question.answerCount === 1 ? 'answer' : 'answers'}`}
          </span>
          {question.tags && question.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[200px]">
                {question.tags.slice(0, 3).join(' · ')}
              </span>
            </>
          )}
        </div>

        <Link
          to={`/questions/${question.id}`}
          className="font-medium text-cyan-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
        >
          {question.answerCount === 0 ? 'Share perspective' : 'Read thread'}
        </Link>
      </div>
    </article>
  );
}
