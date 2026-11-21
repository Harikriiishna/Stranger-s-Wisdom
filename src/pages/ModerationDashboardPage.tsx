import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, EyeOff, RotateCcw, Shield, Trash2, UserX } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { moderationApi } from '../lib/api';
import { formatTimeAgo } from '../lib/format';

export function ModerationDashboardPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [actionNote, setActionNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['moderation-dashboard'],
    queryFn: moderationApi.dashboard,
    enabled:
      Boolean(profile) &&
      (profile?.role === 'moderator' || profile?.role === 'admin'),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      reportId,
      action,
    }: {
      reportId: string;
      action: string;
    }) => moderationApi.takeAction(reportId, action, actionNote),
    onSuccess: (_, variables) => {
      setActionNote('');
      setActionError(null);
      setActionSuccess(`Moderation action "${variables.action.replace('_', ' ')}" applied.`);
      queryClient.invalidateQueries({ queryKey: ['moderation-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (err) => {
      setActionSuccess(null);
      setActionError(err instanceof Error ? err.message : 'Unable to apply moderation action.');
    },
  });

  if (!profile || (profile.role !== 'moderator' && profile.role !== 'admin')) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-10">
          <EmptyState
            title="Moderator Access Required"
            subtitle="This dashboard is restricted to authorized community moderators verified by the backend."
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              Moderation Dashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Review reports, protect community safety, and manage flagged submissions.
            </p>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data ? null : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5">
                <p className="font-tabular text-3xl font-semibold text-amber-500">
                  {data.stats.pending}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Pending Reports
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5">
                <p className="font-tabular text-3xl font-semibold text-teal-500">
                  {data.stats.reviewed}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Reviewed Reports
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5">
                <p className="font-tabular text-3xl font-semibold text-cyan-500">
                  {data.stats.flagged}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Auto-Flagged
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="mod-note" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Moderation Reason / Audit Note (applies to next action)
              </label>
              <input
                id="mod-note"
                type="text"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Optional note recorded in moderation history..."
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#0D1326] px-3.5 text-sm"
              />
            </div>

            {actionError && (
              <p className="text-xs text-rose-500" role="alert">
                {actionError}
              </p>
            )}
            {actionSuccess && (
              <p className="text-xs text-teal-600 dark:text-teal-400">
                {actionSuccess}
              </p>
            )}

            {/* Reports Queue */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                Reports Queue
              </h2>
              {data.reports.length === 0 ? (
                <EmptyState
                  title="No reports in the queue."
                  subtitle="Reported questions and answers will appear here for review."
                />
              ) : (
                <div className="space-y-3">
                  {data.reports.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {r.reason}
                          </span>
                          <span className="mx-1.5">·</span>
                          <span className="capitalize">{r.contentType}</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-tabular">{formatTimeAgo(r.createdAt)}</span>
                        </div>
                        <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                          Status: {r.status} (Content: {r.contentStatus})
                        </span>
                      </div>

                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {r.contentPreview}
                      </p>
                      {r.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Reporter note: {r.description}
                        </p>
                      )}

                      <div className="pt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionMutation.isPending}
                          onClick={() =>
                            actionMutation.mutate({ reportId: r.id, action: 'hide' })
                          }
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-indigo-800 px-3 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          Hide
                        </button>
                        <button
                          type="button"
                          disabled={actionMutation.isPending}
                          onClick={() =>
                            actionMutation.mutate({ reportId: r.id, action: 'remove' })
                          }
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 text-rose-500 px-3 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                        <button
                          type="button"
                          disabled={actionMutation.isPending}
                          onClick={() =>
                            actionMutation.mutate({ reportId: r.id, action: 'restore' })
                          }
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-teal-500/40 text-teal-600 dark:text-teal-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                        <button
                          type="button"
                          disabled={actionMutation.isPending}
                          onClick={() =>
                            actionMutation.mutate({
                              reportId: r.id,
                              action: 'suspend_account',
                            })
                          }
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 text-amber-600 dark:text-amber-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Suspend Author
                        </button>
                        <button
                          type="button"
                          disabled={actionMutation.isPending}
                          onClick={() =>
                            actionMutation.mutate({
                              reportId: r.id,
                              action: 'dismiss_report',
                            })
                          }
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-indigo-800 px-3 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Auto-Flagged Questions */}
            {(data.flaggedQuestions ?? []).length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  Auto-Flagged Questions
                </h2>
                <div className="divide-y divide-slate-200 dark:divide-indigo-950 rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326]">
                  {data.flaggedQuestions.map((fq) => (
                    <div
                      key={fq.id}
                      className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-cyan-700 dark:text-cyan-400">
                          {fq.category} · Status: {fq.status} · {formatTimeAgo(fq.createdAt)}
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {fq.title}
                        </p>
                      </div>
                      <Link
                        to={`/questions/${fq.id}`}
                        className="min-h-[36px] inline-flex items-center rounded-xl border border-slate-300 dark:border-indigo-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60"
                      >
                        Inspect
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Moderation History */}
            {data.history.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  Moderation History
                </h2>
                <div className="divide-y divide-slate-200 dark:divide-indigo-950 rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326]">
                  {data.history.map((h) => (
                    <div
                      key={h.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white capitalize">
                          {h.action.replace('_', ' ')}
                        </span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="text-slate-600 dark:text-slate-300 capitalize">
                          {h.contentType}
                        </span>
                        {h.reason && (
                          <span className="ml-2 text-slate-500">({h.reason})</span>
                        )}
                      </div>
                      <span className="font-tabular text-slate-400">
                        {formatTimeAgo(h.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
