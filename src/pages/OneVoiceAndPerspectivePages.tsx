import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Heart,
  Lightbulb,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { CardContextMenu } from '../components/CardContextMenu';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { answersApi, myWisdomApi } from '../lib/api';
import { getAnswerShareUrl } from '../lib/clipboard';
import { formatStatusLabel, formatTimeAgo, REACTION_TYPES } from '../lib/format';

export function OneVoicePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['one-voice'],
    queryFn: myWisdomApi.oneVoice,
    enabled: Boolean(profile),
  });

  const closeMutation = useMutation({
    mutationFn: myWisdomApi.closeOneVoice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['one-voice'] }),
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <section className="rounded-3xl border border-indigo-200/80 dark:border-indigo-900/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 dark:from-[#0E1630] dark:via-[#0B1124] dark:to-[#121030] p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
            <Radio className="h-4 w-4" />
            One Voice
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            One question. One thoughtful stranger.
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
            When you ask through One Voice, your question is held quietly for a single, unhurried response—without public competition or endless threads.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => navigate('/ask')}
              className="min-h-[44px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 cursor-pointer"
            >
              Ask via One Voice
            </button>
          </div>
        </section>

        {!profile ? (
          <EmptyState
            title="Sign in to use One Voice"
            subtitle="One Voice delivers a single private response directly to your account."
            actionLabel="Sign In"
            onAction={() => navigate('/signin')}
          />
        ) : isLoading ? (
          <LoadingSkeleton count={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <div className="space-y-8">
            {/* My One Voice Requests */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                Your One Voice Threads
              </h2>
              {(data?.myRequests ?? []).length === 0 ? (
                <EmptyState
                  title="No One Voice requests yet."
                  subtitle="When you toggle One Voice while asking a question, its delivery status will appear here."
                />
              ) : (
                <div className="space-y-4">
                  {data?.myRequests.map((req) => (
                    <div
                      key={req.deliveryId}
                      className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                          {req.questionCategory} · {formatTimeAgo(req.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Status: {formatStatusLabel(req.status)}
                        </span>
                      </div>

                      <h3 className="font-wisdom text-lg font-medium text-slate-900 dark:text-white">
                        {req.questionTitle}
                      </h3>

                      {req.answerBody ? (
                        <div className="rounded-2xl bg-slate-50 dark:bg-[#070B19] border border-slate-200/80 dark:border-indigo-950 p-5 space-y-3">
                          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                            {req.answerType} · Delivered anonymously
                          </p>
                          <p className="font-wisdom text-base leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
                            {req.answerBody}
                          </p>
                          {req.status !== 'closed' && (
                            <div className="pt-2 flex flex-col items-end gap-2">
                              <button
                                type="button"
                                disabled={closeMutation.isPending}
                                onClick={() => closeMutation.mutate(req.deliveryId)}
                                className="min-h-[40px] rounded-xl border border-slate-300 dark:border-indigo-800 px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 disabled:opacity-50 cursor-pointer"
                              >
                                {closeMutation.isPending ? 'Closing...' : 'Mark as Closed'}
                              </button>
                              {closeMutation.isError && (
                                <p className="text-xs text-rose-500" role="alert">
                                  {closeMutation.error instanceof Error
                                    ? closeMutation.error.message
                                    : 'Unable to close delivery.'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Waiting quietly for a thoughtful response from a stranger...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Questions Waiting for One Voice */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                Waiting for a Single Voice
              </h2>
              {(data?.waitingToAnswer ?? []).length === 0 ? (
                <EmptyState
                  title="All One Voice requests have been answered."
                  subtitle="Check back soon or browse open questions in Explore."
                  actionLabel="Explore Open Questions"
                  onAction={() => navigate('/explore')}
                />
              ) : (
                <div className="space-y-3">
                  {data?.waitingToAnswer.map((q) => (
                    <div
                      key={q.questionId}
                      className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-cyan-700 dark:text-cyan-400">
                          {q.category} · {q.questionType} · {formatTimeAgo(q.createdAt)}
                        </p>
                        <h3 className="font-wisdom text-base font-medium text-slate-900 dark:text-white">
                          {q.title}
                        </h3>
                      </div>
                      <Link
                        to={`/questions/${q.questionId}/answer`}
                        className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 dark:bg-violet-500 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 whitespace-nowrap shrink-0"
                      >
                        Be Their One Voice
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}

export function PerspectivePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [cycleCount, setCycleCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['random-perspective', cycleCount],
    queryFn: async () => {
      const res = await answersApi.randomPerspective(seenIds);
      return res;
    },
  });

  const perspective = data?.perspective;

  const handleNext = () => {
    setActionError(null);
    if (perspective?.id) {
      setSeenIds((prev) => [...prev.slice(-15), perspective.id]);
      setCycleCount((c) => c + 1);
    } else {
      refetch();
    }
  };

  const handleToggleSave = async () => {
    if (!perspective) return;
    if (!profile) {
      navigate('/signin');
      return;
    }
    setActionError(null);
    try {
      if (perspective.isSaved) await answersApi.unsave(perspective.id);
      else await answersApi.save(perspective.id);
      queryClient.invalidateQueries({ queryKey: ['random-perspective'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save perspective.');
    }
  };

  const handleReact = async (reactionType: string) => {
    if (!perspective) return;
    if (!profile) {
      navigate('/signin');
      return;
    }
    setActionError(null);
    try {
      await answersApi.react(perspective.id, reactionType);
      queryClient.invalidateQueries({ queryKey: ['random-perspective'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update reaction.');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-4 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            Give Me a Perspective
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Quiet wisdom shared anonymously by someone who has walked a similar road.
          </p>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={1} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !perspective ? (
          <EmptyState
            title="No perspectives available yet."
            subtitle="Be the first to share a thoughtful answer on an open question."
            actionLabel="Explore Questions"
            onAction={() => navigate('/explore')}
          />
        ) : (
          <div className="relative rounded-3xl border border-indigo-200 dark:border-indigo-900 bg-gradient-to-b from-white via-slate-50 to-indigo-50/40 dark:from-[#101836] dark:via-[#0D1326] dark:to-[#0A0F21] p-7 sm:p-10 space-y-6 shadow-xl">
            <div className="absolute top-4 right-4">
              <CardContextMenu
                triggerLabel="Perspective options"
                shareUrl={getAnswerShareUrl(perspective.questionId, perspective.id)}
              />
            </div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <Lightbulb className="h-7 w-7" />
            </div>

            <div className="text-center space-y-2">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                {perspective.answerType} · {perspective.questionCategory}
              </p>
              <blockquote className="font-wisdom text-xl sm:text-2xl leading-relaxed text-slate-900 dark:text-white text-balance break-words">
                “{perspective.body}”
              </blockquote>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-indigo-950 bg-white/70 dark:bg-[#070B19]/70 p-4 text-center space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                In response to:
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {perspective.questionTitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {REACTION_TYPES.slice(0, 3).map((rx) => {
                const active = perspective.userReactions.includes(rx.id);
                return (
                  <button
                    key={rx.id}
                    type="button"
                    onClick={() => handleReact(rx.id)}
                    className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      active
                        ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                        : 'border-slate-200 dark:border-indigo-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Heart className="h-3.5 w-3.5" fill={active ? 'currentColor' : 'none'} />
                    {rx.label}
                  </button>
                );
              })}
            </div>

            {actionError && (
              <p className="text-center text-xs text-rose-500" role="alert">
                {actionError}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleToggleSave}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-indigo-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
              >
                <Bookmark
                  className="h-4 w-4 text-amber-500"
                  fill={perspective.isSaved ? 'currentColor' : 'none'}
                />
                {perspective.isSaved ? 'Saved' : 'Save'}
              </button>

              <Link
                to={`/questions/${perspective.questionId}#answer-${perspective.id}`}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-indigo-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60"
              >
                Read More
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                disabled={isFetching}
                onClick={handleNext}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Another Perspective
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
