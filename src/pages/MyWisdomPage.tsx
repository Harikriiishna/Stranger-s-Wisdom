import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGroup, motion } from 'motion/react';
import { Archive, Edit3, FileText, Trash2, X } from 'lucide-react';
import { AnswerCard } from '../components/AnswerCard';
import { Layout } from '../components/Layout';
import { QuestionCard } from '../components/QuestionCard';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { answersApi, myWisdomApi, questionsApi } from '../lib/api';
import { formatTimeAgo } from '../lib/format';
import type { AnswerItem } from '../types';

type TabId = 'questions' | 'answers' | 'received' | 'drafts' | 'completed';

export function MyWisdomPage({ defaultTab = 'questions' }: { defaultTab?: TabId }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>(defaultTab);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState<string | null>(null);

  useEffect(() => {
    setTab(defaultTab);
    setConfirmDeleteQuestionId(null);
    setActionError(null);
  }, [defaultTab]);

  const myQs = useQuery({
    queryKey: ['my-questions'],
    queryFn: myWisdomApi.questions,
    enabled: Boolean(profile),
  });

  const myAs = useQuery({
    queryKey: ['my-answers'],
    queryFn: myWisdomApi.answers,
    enabled: Boolean(profile),
  });

  const received = useQuery({
    queryKey: ['my-received'],
    queryFn: myWisdomApi.responsesReceived,
    enabled: Boolean(profile),
  });

  const drafts = useQuery({
    queryKey: ['drafts'],
    queryFn: myWisdomApi.drafts,
    enabled: Boolean(profile),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: myWisdomApi.deleteDraft,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to delete draft.');
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: questionsApi.remove,
    onSuccess: () => {
      setActionError(null);
      setConfirmDeleteQuestionId(null);
      queryClient.invalidateQueries({ queryKey: ['my-questions'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to delete question.');
    },
  });

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-10">
          <EmptyState
            title="Your personal wisdom space is private."
            subtitle="Sign in or start an anonymous session to keep track of your questions, drafts, and answers."
            actionLabel="Sign In or Continue Anonymously"
            onAction={() => navigate('/signin')}
          />
        </div>
      </Layout>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'questions', label: 'My Questions' },
    { id: 'answers', label: 'My Answers' },
    { id: 'received', label: 'Responses Received' },
    { id: 'drafts', label: 'Drafts' },
    { id: 'completed', label: 'Archived' },
  ];

  const activeQuestions = (myQs.data?.questions ?? []).filter(
    (q) => q.status !== 'archived'
  );
  const archivedQuestions = (myQs.data?.questions ?? []).filter(
    (q) => q.status === 'archived'
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              My Wisdom
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Your private participation history. Never visible to anyone else.
            </p>
          </div>
          <Link
            to="/saved"
            className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-indigo-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 whitespace-nowrap"
          >
            Open Saved Wisdom
          </Link>
        </div>

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

        <LayoutGroup id="my-wisdom-tabs">
          <div
            role="tablist"
            aria-label="My Wisdom sections"
            className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200/80 dark:border-indigo-950/80"
          >
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`relative min-h-[44px] px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] ${
                    active
                      ? 'text-cyan-700 dark:text-cyan-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{t.label}</span>
                  {active && (
                    <motion.span
                      layoutId="my-wisdom-bottom-bar"
                      data-bottom-bar="active"
                      aria-hidden="true"
                      transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                      className="sw-bottom-bar pointer-events-none absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-cyan-600 dark:bg-cyan-400"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        {tab === 'questions' && (
          myQs.isLoading ? (
            <LoadingSkeleton count={3} />
          ) : myQs.isError ? (
            <ErrorState onRetry={() => myQs.refetch()} />
          ) : activeQuestions.length === 0 ? (
            <EmptyState
              title="You haven’t asked any questions yet."
              subtitle="When something weighs on your mind, you can ask anonymously anytime."
              actionLabel="Ask a Question"
              onAction={() => navigate('/ask')}
            />
          ) : (
            <div className="space-y-4">
              {activeQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <QuestionCard question={q} />
                  {confirmDeleteQuestionId === q.id ? (
                    <div className="flex flex-wrap items-center justify-end gap-2 px-2 text-xs">
                      <span className="text-rose-600 dark:text-rose-300 font-medium">
                        Delete this question?
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteQuestionId(null)}
                        className="min-h-[36px] rounded-lg px-3 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deleteQuestionMutation.isPending}
                        onClick={() => deleteQuestionMutation.mutate(q.id)}
                        className="min-h-[36px] rounded-lg bg-rose-600 px-3 font-semibold text-white disabled:opacity-50 cursor-pointer"
                      >
                        {deleteQuestionMutation.isPending ? 'Deleting...' : 'Confirm delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2 px-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/ask?edit=${q.id}`)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs text-slate-500 hover:text-cyan-500 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteQuestionId(q.id)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs text-slate-500 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'answers' && (
          myAs.isLoading ? (
            <LoadingSkeleton count={3} />
          ) : myAs.isError ? (
            <ErrorState onRetry={() => myAs.refetch()} />
          ) : (myAs.data?.answers ?? []).length === 0 ? (
            <EmptyState
              title="You haven’t shared an answer yet."
              subtitle="Explore open questions and help someone with what you’ve lived through."
              actionLabel="Explore Questions"
              onAction={() => navigate('/explore')}
            />
          ) : (
            <div className="space-y-4">
              {(myAs.data?.answers ?? []).map((ans) => {
                const item: AnswerItem = {
                  ...ans,
                  isOwner: true,
                  isSaved: false,
                  userReactions: [],
                  authorLabel: 'You (shown anonymously)',
                };
                return (
                  <div key={ans.id} className="space-y-2">
                    <Link
                      to={`/questions/${ans.questionId}`}
                      className="block text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline px-1"
                    >
                      On: {ans.questionTitle}
                    </Link>
                    <AnswerCard
                      answer={item}
                      onEdit={async (a, newBody, newType) => {
                        await answersApi.update(a.id, { body: newBody, answerType: newType });
                        queryClient.invalidateQueries({ queryKey: ['my-answers'] });
                        queryClient.invalidateQueries({ queryKey: ['questions'] });
                      }}
                      onDelete={async (id) => {
                        await answersApi.remove(id);
                        queryClient.invalidateQueries({ queryKey: ['my-answers'] });
                        queryClient.invalidateQueries({ queryKey: ['questions'] });
                        queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === 'received' && (
          received.isLoading ? (
            <LoadingSkeleton count={3} />
          ) : received.isError ? (
            <ErrorState onRetry={() => received.refetch()} />
          ) : (received.data?.responses ?? []).length === 0 ? (
            <EmptyState
              title="No responses received yet."
              subtitle="When strangers answer your questions, their perspectives will gather here."
            />
          ) : (
            <div className="space-y-4">
              {(received.data?.responses ?? []).map((resp) => (
                <div key={resp.id} className="space-y-2">
                  <Link
                    to={`/questions/${resp.questionId}`}
                    className="block text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:underline px-1"
                  >
                    Question: {resp.questionTitle}
                  </Link>
                  <AnswerCard
                    answer={{
                      ...resp,
                      parentAnswerId: null,
                      updatedAt: resp.createdAt,
                      isOwner: false,
                      authorLabel: 'Anonymous Stranger',
                    }}
                    onReact={async (answerId, rx) => {
                      setActionError(null);
                      try {
                        await answersApi.react(answerId, rx);
                        queryClient.invalidateQueries({ queryKey: ['my-received'] });
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : 'Unable to react.');
                      }
                    }}
                    onToggleSave={async (a) => {
                      setActionError(null);
                      try {
                        if (a.isSaved) await answersApi.unsave(a.id);
                        else await answersApi.save(a.id);
                        queryClient.invalidateQueries({ queryKey: ['my-received'] });
                        queryClient.invalidateQueries({ queryKey: ['saved'] });
                        queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : 'Unable to save answer.');
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'drafts' && (
          drafts.isLoading ? (
            <LoadingSkeleton count={2} />
          ) : (drafts.data?.drafts ?? []).length === 0 ? (
            <EmptyState
              title="No saved drafts."
              subtitle="Start writing a question anytime and save it privately before publishing."
              actionLabel="Write a Draft"
              onAction={() => navigate('/ask')}
            />
          ) : (
            <div className="space-y-3">
              {(drafts.data?.drafts ?? []).map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <FileText className="h-3.5 w-3.5 text-cyan-500" />
                      <span>{d.category}</span>
                      <span>·</span>
                      <span className="font-tabular">Updated {formatTimeAgo(d.updatedAt)}</span>
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {d.title || 'Untitled draft'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/ask?draft=${d.id}`)}
                      className="min-h-[40px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-slate-950 cursor-pointer"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDraftMutation.mutate(d.id)}
                      aria-label="Delete draft"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'completed' && (
          myQs.isLoading ? (
            <LoadingSkeleton count={2} />
          ) : myQs.isError ? (
            <ErrorState onRetry={() => myQs.refetch()} />
          ) : archivedQuestions.length === 0 ? (
            <EmptyState
              title="No archived conversations."
              subtitle="Questions you close or archive appear here for quiet reflection."
            />
          ) : (
            <div className="space-y-4">
              {archivedQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <QuestionCard question={q} />
                  <div className="flex justify-end px-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setActionError(null);
                        try {
                          await questionsApi.update(q.id, { status: 'open' });
                          queryClient.invalidateQueries({ queryKey: ['my-questions'] });
                          queryClient.invalidateQueries({ queryKey: ['questions'] });
                          queryClient.invalidateQueries({ queryKey: ['home'] });
                        } catch (err) {
                          setActionError(
                            err instanceof Error ? err.message : 'Unable to reopen question.'
                          );
                        }
                      }}
                      className="min-h-[36px] inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Reopen question
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  );
}
