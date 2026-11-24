import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Check,
  Edit3,
  ExternalLink,
  Flag,
  FolderPlus,
  Trash2,
} from 'lucide-react';
import { getAnswerShareUrl } from '../lib/clipboard';
import {
  ANSWER_TYPES,
  formatTimeAgo,
  LEGACY_REACTION_TYPES,
  REACTION_TYPES,
} from '../lib/format';
import type { AnswerItem, CollectionItem } from '../types';
import { CardContextMenu, type ContextMenuItem } from './CardContextMenu';
import { ShareButton } from './ShareButton';

export function AnswerReactionsBar({
  answerId,
  reactionCounts,
  userReactions,
  onReact,
  compact = false,
  align = 'start',
}: {
  answerId: string;
  reactionCounts?: Record<string, number>;
  userReactions?: string[];
  onReact: (answerId: string, reactionType: string) => void;
  compact?: boolean;
  align?: 'start' | 'center';
}) {
  const extraLegacy = LEGACY_REACTION_TYPES.filter(
    (rx) => (reactionCounts?.[rx.id] ?? 0) > 0 || userReactions?.includes(rx.id)
  );
  const allButtons = [...REACTION_TYPES, ...extraLegacy];

  return (
    <div
      className={`flex flex-wrap gap-1.5 sm:gap-2 ${
        align === 'center' ? 'justify-center' : 'justify-start'
      }`}
    >
      {allButtons.map((rx) => {
        const active = Boolean(userReactions?.includes(rx.id));
        const total = reactionCounts?.[rx.id] ?? 0;
        return (
          <button
            key={rx.id}
            type="button"
            aria-pressed={active}
            onClick={() => onReact(answerId, rx.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border font-medium transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] ${
              compact
                ? 'min-h-[34px] px-2.5 py-1 text-[11px]'
                : 'min-h-[38px] px-3 py-1.5 text-xs'
            } ${
              active
                ? 'border-teal-500/60 bg-teal-500/15 text-teal-700 dark:text-teal-300 shadow-sm'
                : 'border-slate-200 dark:border-indigo-950/90 bg-slate-50/70 dark:bg-[#0A0F20] text-slate-600 dark:text-slate-300 hover:border-cyan-500/45 hover:bg-slate-100/80 dark:hover:bg-indigo-950/50 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span aria-hidden="true" className={compact ? 'text-xs leading-none' : 'text-sm leading-none'}>
              {rx.emoji}
            </span>
            <span>{rx.label}</span>
            {total > 0 && (
              <span className="font-tabular opacity-85">· {total}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AnswerCard({
  answer,
  onReact,
  onToggleSave,
  onReport,
  onEdit,
  onDelete,
  collections,
  onAddToCollection,
  highlighted = false,
  focusMode = false,
}: {
  answer: AnswerItem;
  onReact?: (answerId: string, reactionType: string) => void;
  onToggleSave?: (answer: AnswerItem) => void;
  onReport?: (answerId: string) => void;
  onEdit?: (answer: AnswerItem, newBody: string, newType: string) => Promise<void>;
  onDelete?: (answerId: string) => Promise<void>;
  collections?: CollectionItem[];
  onAddToCollection?: (collectionId: string, answerId: string) => Promise<void>;
  highlighted?: boolean;
  focusMode?: boolean;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(answer.body);
  const [editType, setEditType] = useState(answer.answerType);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showCollections, setShowCollections] = useState(false);
  const [addedCollectionId, setAddedCollectionId] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveEdit = async () => {
    if (!onEdit) return;
    if (editBody.trim().length < 20) {
      setEditError('Please keep at least 20 characters in your answer.');
      return;
    }
    setEditError(null);
    setSavingEdit(true);
    try {
      await onEdit(answer, editBody.trim(), editType);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setEditError(null);
    try {
      await onDelete(answer.id);
      setConfirmDelete(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to delete answer.');
    } finally {
      setDeleting(false);
    }
  };

  const contextItems: ContextMenuItem[] = [
    {
      label: 'View thread',
      icon: <ExternalLink className="h-4 w-4 text-slate-400" />,
      onClick: () => navigate(`/questions/${answer.questionId}#answer-${answer.id}`),
    },
  ];
  if (onToggleSave) {
    contextItems.push({
      label: answer.isSaved ? 'Remove from saved' : 'Save wisdom',
      icon: (
        <Bookmark
          className="h-4 w-4 text-amber-500"
          fill={answer.isSaved ? 'currentColor' : 'none'}
        />
      ),
      onClick: () => onToggleSave(answer),
    });
  }
  if (!answer.isOwner && onReport) {
    contextItems.push({
      label: 'Report answer',
      icon: <Flag className="h-4 w-4 text-amber-500" />,
      onClick: () => onReport(answer.id),
    });
  }

  return (
    <article
      id={`answer-${answer.id}`}
      className={`rounded-2xl border bg-white dark:bg-[#0D1326] transition-shadow ${
        focusMode ? 'p-6 sm:p-9' : 'p-5 sm:p-6'
      } ${
        highlighted
          ? 'border-cyan-500/70 ring-2 ring-cyan-500/20'
          : 'border-slate-200/90 dark:border-indigo-950/80'
      }`}
    >
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-semibold text-violet-700 dark:text-violet-300">
            {answer.answerType}
          </span>
          <span aria-hidden="true">·</span>
          <span>{answer.authorLabel || 'Anonymous Stranger'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-tabular">{formatTimeAgo(answer.createdAt)}</span>
        </div>

        {!focusMode && (
        <div className="flex items-center gap-1 shrink-0">
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
                onClick={() => {
                  setCollectionError(null);
                  setShowCollections((v) => !v);
                }}
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
                  {collectionError && (
                    <p className="px-2.5 py-1 text-xs text-rose-500" role="alert">
                      {collectionError}
                    </p>
                  )}
                  {collections.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={async () => {
                        setCollectionError(null);
                        try {
                          await onAddToCollection(col.id, answer.id);
                          setAddedCollectionId(col.id);
                          setTimeout(() => setShowCollections(false), 600);
                        } catch (err) {
                          setCollectionError(
                            err instanceof Error ? err.message : 'Unable to add to collection.'
                          );
                        }
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
              onClick={() => {
                setEditBody(answer.body);
                setEditType(answer.answerType);
                setEditError(null);
                setConfirmDelete(false);
                setEditing((v) => !v);
              }}
              aria-label="Edit answer"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          {answer.isOwner && onDelete && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditError(null);
                setConfirmDelete((v) => !v);
              }}
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
          <CardContextMenu
            triggerLabel="Answer options"
            shareUrl={getAnswerShareUrl(answer.questionId, answer.id)}
            shareTitle={answer.questionTitle || "Thoughtful perspective on Stranger's Wisdom"}
            shareText={answer.body}
            items={contextItems}
          />
        </div>
        )}
      </div>

      {confirmDelete && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs">
          <span className="text-rose-700 dark:text-rose-200 font-medium">
            Remove this answer permanently?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-[34px] rounded-lg px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-indigo-950/60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="min-h-[34px] rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white disabled:opacity-50 cursor-pointer"
            >
              {deleting ? 'Deleting...' : 'Confirm delete'}
            </button>
          </div>
        </div>
      )}

      {editError && !editing && (
        <p className="mt-2 text-xs text-rose-500" role="alert">
          {editError}
        </p>
      )}

      {!focusMode && editing ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ANSWER_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setEditType(type)}
                className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  editType === type
                    ? 'border-violet-500 bg-violet-500/15 text-violet-800 dark:text-violet-200'
                    : 'border-slate-200 dark:border-indigo-950 text-slate-600 dark:text-slate-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] p-3 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          {editError && (
            <p className="text-xs text-rose-500" role="alert">
              {editError}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditError(null);
              }}
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
        <div
          className={`mt-4 font-wisdom whitespace-pre-line break-words ${
            focusMode
              ? 'text-[17.5px] sm:text-[18.5px] leading-[1.88] text-slate-800 dark:text-slate-100'
              : 'text-[15.5px] sm:text-base leading-[1.75] text-slate-800 dark:text-slate-200'
          }`}
        >
          {answer.body}
        </div>
      )}

      {!focusMode && (
        <div
          className={`mt-5 pt-4 border-t border-slate-100 dark:border-indigo-950/60 flex flex-wrap items-center gap-3 ${
            onReact ? 'justify-between' : 'justify-end'
          }`}
        >
          {onReact && (
            <div className="min-w-0 flex-1">
              <AnswerReactionsBar
                answerId={answer.id}
                reactionCounts={answer.reactionCounts}
                userReactions={answer.userReactions}
                onReact={onReact}
              />
            </div>
          )}
          <ShareButton
            title={answer.questionTitle || "Thoughtful perspective on Stranger's Wisdom"}
            text={answer.body}
            url={getAnswerShareUrl(answer.questionId, answer.id)}
            variant="outline"
          />
        </div>
      )}
    </article>
  );
}
