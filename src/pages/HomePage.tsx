import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bookmark, Feather, Sparkles, X } from 'lucide-react';
import { AnswerReactionsBar } from '../components/AnswerCard';
import { CardContextMenu } from '../components/CardContextMenu';
import { Layout } from '../components/Layout';
import { QuestionCard } from '../components/QuestionCard';
import { ShareButton } from '../components/ShareButton';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { answersApi, questionsApi } from '../lib/api';
import { getAnswerShareUrl } from '../lib/clipboard';
import { formatTimeAgo, getGreeting } from '../lib/format';
import type { QuestionCardItem } from '../types';

export function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: questionsApi.home,
  });

  const saveQuestionMutation = useMutation({
    mutationFn: async (q: QuestionCardItem) => {
      if (!profile) {
        navigate('/signin');
        return;
      }
      setActionError(null);
      if (q.isSaved) {
        await questionsApi.unsave(q.id);
      } else {
        await questionsApi.save(q.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to update saved question.');
    },
  });

  const saveAnswerMutation = useMutation({
    mutationFn: async ({ id, isSaved }: { id: string; isSaved: boolean }) => {
      if (!profile) {
        navigate('/signin');
        return;
      }
      setActionError(null);
      if (isSaved) {
        await answersApi.unsave(id);
      } else {
        await answersApi.save(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to update saved wisdom.');
    },
  });

  const reactAnswerMutation = useMutation({
    mutationFn: async ({
      answerId,
      reactionType,
    }: {
      answerId: string;
      reactionType: string;
    }) => {
      if (!profile) {
        navigate('/signin');
        return;
      }
      setActionError(null);
      await answersApi.react(answerId, reactionType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['question'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to update reaction.');
    },
  });

  return (
    <Layout>
      <div className="space-y-10 min-w-0">
        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-200"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Hero Greeting */}
        <section className="sw-hero-surface relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-indigo-950/90 bg-gradient-to-br from-white via-slate-50 to-cyan-50/40 dark:from-[#0E1630] dark:via-[#0B1124] dark:to-[#11183A] p-6 sm:p-10">
          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
              {getGreeting()}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
              Somewhere, someone understands.
            </h1>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
              You don’t need to know them. Sometimes all you need is their perspective.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/ask')}
                className="sw-btn-primary min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-400 transition-all cursor-pointer whitespace-nowrap"
              >
                <Feather className="h-4 w-4" />
                Ask Something
              </button>
              <button
                type="button"
                onClick={() => navigate('/perspective')}
                className="min-h-[46px] inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-800 dark:text-violet-200 hover:bg-violet-500/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                Give Me a Perspective
              </button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <LoadingSkeleton count={4} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data ||
          (!data.featuredQuestion &&
            (data.wisdomFromStrangers ?? []).length === 0 &&
            (data.unansweredQuestions ?? []).length === 0 &&
            !data.differentPerspective &&
            (data.quietMoments ?? []).length === 0) ? (
          <EmptyState
            title="No questions shared yet."
            subtitle="Ask what is genuinely on your mind, or check back as new reflections arrive."
            actionLabel="Ask the first question"
            onAction={() => navigate('/ask')}
          />
        ) : (
          <div className="space-y-10">
            {/* A. A Question for You */}
            {data.featuredQuestion && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                    A Question for You
                  </h2>
                  <Link
                    to="/explore"
                    className="text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    Explore all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <QuestionCard
                  question={data.featuredQuestion}
                  onToggleSave={(q) => saveQuestionMutation.mutate(q)}
                />
              </section>
            )}

            {/* B. Wisdom from Strangers */}
            {(data.wisdomFromStrangers ?? []).length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                    Wisdom from Strangers
                  </h2>
                  <Link
                    to="/perspective"
                    className="text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline"
                  >
                    Random wisdom
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.wisdomFromStrangers.map((item) => (
                    <article
                      key={item.id}
                      className="min-w-0 rounded-2xl border border-slate-200/90 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326] p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2.5 min-w-0">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-violet-700 dark:text-violet-300">
                            {item.answerType}
                          </span>
                          <span className="font-tabular">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>
                        <p className="font-wisdom text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 line-clamp-4 break-words">
                          “{item.body}”
                        </p>
                      </div>

                      <AnswerReactionsBar
                        answerId={item.id}
                        reactionCounts={item.reactionCounts}
                        userReactions={item.userReactions}
                        compact
                        onReact={(answerId, reactionType) =>
                          reactAnswerMutation.mutate({ answerId, reactionType })
                        }
                      />

                      <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60 flex items-center justify-between gap-2 min-w-0">
                        <Link
                          to={`/questions/${item.questionId}#answer-${item.id}`}
                          className="min-w-0 text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 truncate"
                        >
                          On: {item.questionTitle}
                        </Link>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <ShareButton
                            title={item.questionTitle}
                            text={item.body}
                            url={getAnswerShareUrl(item.questionId, item.id)}
                            variant="subtle"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              saveAnswerMutation.mutate({
                                id: item.id,
                                isSaved: item.isSaved,
                              })
                            }
                            aria-label={item.isSaved ? 'Unsave wisdom' : 'Save wisdom'}
                            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl shrink-0 cursor-pointer ${
                              item.isSaved
                                ? 'text-amber-500'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            <Bookmark
                              className="h-4 w-4"
                              fill={item.isSaved ? 'currentColor' : 'none'}
                            />
                          </button>
                          <CardContextMenu
                            triggerLabel="Answer options"
                            shareUrl={getAnswerShareUrl(item.questionId, item.id)}
                            shareTitle={item.questionTitle}
                            shareText={item.body}
                            items={[
                              {
                                label: item.isSaved ? 'Remove from saved' : 'Save wisdom',
                                icon: (
                                  <Bookmark
                                    className="h-4 w-4 text-amber-500"
                                    fill={item.isSaved ? 'currentColor' : 'none'}
                                  />
                                ),
                                onClick: () =>
                                  saveAnswerMutation.mutate({
                                    id: item.id,
                                    isSaved: item.isSaved,
                                  }),
                              },
                            ]}
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* C. Questions Waiting for Someone */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  Questions Waiting for Someone
                </h2>
                <Link
                  to="/explore?filter=unanswered"
                  className="text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                >
                  See all unanswered
                </Link>
              </div>
              {(data.unansweredQuestions ?? []).length === 0 ? (
                <EmptyState
                  title="Every recent question has received a voice."
                  subtitle="You can explore older discussions or share what is on your mind."
                  actionLabel="Ask Something"
                  onAction={() => navigate('/ask')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(data.unansweredQuestions ?? []).map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      compact
                      onToggleSave={(item) => saveQuestionMutation.mutate(item)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* D. A Different Perspective */}
            {data.differentPerspective && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  A Different Perspective
                </h2>
                <div className="sw-perspective-surface rounded-3xl border border-indigo-200/80 dark:border-indigo-900/80 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 dark:from-[#101836] dark:via-[#0D1326] dark:to-[#13112E] p-6 sm:p-8 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      {data.differentPerspective.answerType} · {data.differentPerspective.questionCategory}
                    </span>
                    <span className="font-tabular">
                      {formatTimeAgo(data.differentPerspective.createdAt)}
                    </span>
                  </div>
                  <blockquote className="font-wisdom text-lg sm:text-xl leading-relaxed text-slate-900 dark:text-slate-100">
                    “{data.differentPerspective.body}”
                  </blockquote>
                  <AnswerReactionsBar
                    answerId={data.differentPerspective.id}
                    reactionCounts={data.differentPerspective.reactionCounts}
                    userReactions={data.differentPerspective.userReactions}
                    compact
                    onReact={(answerId, reactionType) =>
                      reactAnswerMutation.mutate({ answerId, reactionType })
                    }
                  />
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <Link
                      to={`/questions/${data.differentPerspective.questionId}#answer-${data.differentPerspective.id}`}
                      className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                    >
                      Read original question →
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          saveAnswerMutation.mutate({
                            id: data.differentPerspective!.id,
                            isSaved: data.differentPerspective!.isSaved,
                          })
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-indigo-800 px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
                      >
                        <Bookmark
                          className="h-3.5 w-3.5 text-amber-500"
                          fill={data.differentPerspective.isSaved ? 'currentColor' : 'none'}
                        />
                        {data.differentPerspective.isSaved ? 'Saved' : 'Save perspective'}
                      </button>
                      <ShareButton
                        title={data.differentPerspective.questionTitle}
                        text={data.differentPerspective.body}
                        url={getAnswerShareUrl(
                          data.differentPerspective.questionId,
                          data.differentPerspective.id
                        )}
                        variant="outline"
                      />
                      <CardContextMenu
                        triggerLabel="Answer options"
                        shareUrl={getAnswerShareUrl(
                          data.differentPerspective.questionId,
                          data.differentPerspective.id
                        )}
                        shareTitle={data.differentPerspective.questionTitle}
                        shareText={data.differentPerspective.body}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* E. Quiet Moments */}
            {(data.quietMoments ?? []).length > 0 && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  Quiet Moments
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(data.quietMoments ?? []).map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      onToggleSave={(item) => saveQuestionMutation.mutate(item)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
