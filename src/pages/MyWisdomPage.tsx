import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Edit3, FileText, Trash2 } from 'lucide-react';
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drafts'] }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: questionsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-questions'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[42px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                tab === t.id
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950'
                  : 'border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

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
                      onClick={() => deleteQuestionMutation.mutate(q.id)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs text-slate-500 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
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
                      }}
                      onDelete={async (id) => {
                        await answersApi.remove(id);
                        queryClient.invalidateQueries({ queryKey: ['my-answers'] });
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
                      await answersApi.react(answerId, rx);
                      queryClient.invalidateQueries({ queryKey: ['my-received'] });
                    }}
                    onToggleSave={async (a) => {
                      if (a.isSaved) await answersApi.unsave(a.id);
                      else await answersApi.save(a.id);
                      queryClient.invalidateQueries({ queryKey: ['my-received'] });
                      queryClient.invalidateQueries({ queryKey: ['saved'] });
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
          archivedQuestions.length === 0 ? (
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
                        await questionsApi.update(q.id, { status: 'open' });
                        queryClient.invalidateQueries({ queryKey: ['my-questions'] });
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
