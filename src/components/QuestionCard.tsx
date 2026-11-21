import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, ExternalLink, MessageCircle } from 'lucide-react';
import { getQuestionShareUrl } from '../lib/clipboard';
import { formatStatusLabel, formatTimeAgo } from '../lib/format';
import type { QuestionCardItem } from '../types';
import { CardContextMenu, type ContextMenuItem } from './CardContextMenu';

export function QuestionCard({
  question,
  onToggleSave,
  compact = false,
}: {
  question: QuestionCardItem;
  onToggleSave?: (question: QuestionCardItem) => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();

  const menuItems: ContextMenuItem[] = [
    {
      label: 'Open thread',
      icon: <ExternalLink className="h-4 w-4 text-slate-400" />,
      onClick: () => navigate(`/questions/${question.id}`),
    },
  ];

  if (onToggleSave) {
    menuItems.push({
      label: question.isSaved ? 'Remove from saved' : 'Save question',
      icon: (
        <Bookmark
          className="h-4 w-4 text-amber-500"
          fill={question.isSaved ? 'currentColor' : 'none'}
        />
      ),
      onClick: () => onToggleSave(question),
    });
  }

  return (
    <article className="group min-w-0 rounded-2xl border border-slate-200/90 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] p-5 sm:p-6 transition-colors hover:border-cyan-500/40 dark:hover:border-cyan-500/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 min-w-0">
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

        <div className="flex items-center gap-0.5 shrink-0 -mt-2 -mr-2">
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave(question);
              }}
              aria-label={question.isSaved ? 'Remove saved question' : 'Save question'}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer shrink-0 ${
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
          <CardContextMenu
            triggerLabel="Question options"
            shareUrl={getQuestionShareUrl(question.id)}
            items={menuItems}
          />
        </div>
      </div>

      <Link to={`/questions/${question.id}`} className="block mt-2.5 focus:outline-none">
        <h3 className="font-wisdom text-lg sm:text-xl font-medium leading-snug text-slate-900 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors text-balance break-words">
          {question.title}
        </h3>

        {!compact && question.body && (
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2 break-words">
            {question.body}
          </p>
        )}
      </Link>

      <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-indigo-950/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0 max-w-full">
          <span className="inline-flex items-center gap-1.5 font-tabular">
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
            {question.answerCount === 0
              ? 'Waiting for a first perspective'
              : `${question.answerCount} ${question.answerCount === 1 ? 'answer' : 'answers'}`}
          </span>
          {question.tags && question.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-full">
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
