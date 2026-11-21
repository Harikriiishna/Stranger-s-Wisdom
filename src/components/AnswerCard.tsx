import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  Edit3,
  Flag,
  FolderPlus,
  Heart,
  Trash2,
} from 'lucide-react';
import { formatTimeAgo, REACTION_TYPES } from '../lib/format';
import type { AnswerItem, CollectionItem } from '../types';

export function AnswerCard({
  answer,
  onReact,
  onToggleSave,
  onReport,
  onEdit,
  onDelete,
  collections,
  onAddToCollection,
}: {
  answer: AnswerItem;
  onReact?: (answerId: string, reactionType: string) => void;
  onToggleSave?: (answer: AnswerItem) => void;
  onReport?: (answerId: string) => void;
  onEdit?: (answer: AnswerItem, newBody: string, newType: string) => Promise<void>;
  onDelete?: (answerId: string) => Promise<void>;
  collections?: CollectionItem[];
  onAddToCollection?: (collectionId: string, answerId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(answer.body);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [addedCollectionId, setAddedCollectionId] = useState<string | null>(null);

  const handleSaveEdit = async () => {
    if (!onEdit || editBody.trim().length < 20) return;
    setSavingEdit(true);
    try {
      await onEdit(answer, editBody.trim(), answer.answerType);
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200/90 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-violet-700 dark:text-violet-300">
            {answer.answerType}
          </span>
          <span aria-hidden="true">·</span>
          <span>{answer.authorLabel || 'Anonymous Stranger'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-tabular">{formatTimeAgo(answer.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1">
          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(answer)}
              aria-label={answer.isSaved ? 'Remove from Saved Wisdom' : 'Save wisdom'}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                answer.isSaved
                  ? 'text-amber-500'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Bookmark
                className="h-4 w-4"
                fill={answer.isSaved ? 'currentColor' : 'none'}
              />
            </button>
          )}
          {collections && collections.length > 0 && onAddToCollection && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCollections((v) => !v)}
                aria-label="Add to collection"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
              {showCollections && (
                <div className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#111936] p-2 shadow-xl">
                  <p className="px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Add to collection
                  </p>
                  {collections.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={async () => {
                        await onAddToCollection(col.id, answer.id);
                        setAddedCollectionId(col.id);
                        setTimeout(() => setShowCollections(false), 600);
                      }}
                      className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/70 cursor-pointer"
                    >
                      <span className="truncate">{col.name}</span>
                      {(addedCollectionId === col.id ||
                        col.answerIds.includes(answer.id)) && (
                        <Check className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {answer.isOwner && onEdit && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-label="Edit answer"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          {answer.isOwner && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(answer.id)}
              aria-label="Delete answer"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {!answer.isOwner && onReport && (
            <button
              type="button"
              onClick={() => onReport(answer.id)}
              aria-label="Report answer"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
            >
              <Flag className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] p-3 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[40px] rounded-xl px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingEdit || editBody.trim().length < 20}
              onClick={handleSaveEdit}
              className="min-h-[40px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 disabled:opacity-50 cursor-pointer"
            >
              {savingEdit ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3.5 font-wisdom text-[15.5px] sm:text-base leading-[1.75] text-slate-800 dark:text-slate-200 whitespace-pre-line">
          {answer.body}
        </div>
      )}

      {onReact && (
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-indigo-950/60 flex flex-wrap gap-2">
          {REACTION_TYPES.map((rx) => {
            const active = answer.userReactions?.includes(rx.id);
            const total = answer.reactionCounts?.[rx.id] ?? 0;
            return (
              <button
                key={rx.id}
                type="button"
                onClick={() => onReact(answer.id, rx.id)}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-teal-500/60 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                    : 'border-slate-200 dark:border-indigo-950/90 bg-slate-50/70 dark:bg-[#0A0F20] text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Heart
                  className="h-3.5 w-3.5"
                  fill={active ? 'currentColor' : 'none'}
                />
                <span>{rx.label}</span>
                {total > 0 && (
                  <span className="font-tabular opacity-80">· {total}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
