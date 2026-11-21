import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Bookmark,
  Check,
  Edit3,
  EyeOff,
  Flag,
  LockOpen,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { AnswerCard } from '../components/AnswerCard';
import { Layout } from '../components/Layout';
import { ReportModal } from '../components/ReportModal';
import {
  CrisisSupportBanner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SuccessConfirmation,
} from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { answersApi, questionsApi, savedApi } from '../lib/api';
import { ANSWER_TYPES, formatStatusLabel, formatTimeAgo } from '../lib/format';
import type { AnswerItem, CrisisResources } from '../types';

export function QuestionDetailsPage({ openEditorByDefault = false }: { openEditorByDefault?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, continueAnonymously } = useAuth();

  const [showEditor, setShowEditor] = useState(openEditorByDefault);
  const [answerBody, setAnswerBody] = useState('');
  const [answerType, setAnswerType] = useState<string>('My Advice');
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerSuccess, setAnswerSuccess] = useState(false);
  const [crisisResources, setCrisisResources] = useState<CrisisResources | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'question' | 'answer';
    id: string;
  } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['question', id],
    queryFn: () => questionsApi.getById(id!),
    enabled: Boolean(id),
  });

  const { data: savedData } = useQuery({
    queryKey: ['saved'],
    queryFn: savedApi.list,
    enabled: Boolean(profile),
  });

  const saveQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!profile) {
        navigate('/signin');
        return;
      }
      if (data?.question.isSaved) {
        await questionsApi.unsave(id!);
      } else {
        await questionsApi.save(id!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
    },
  });

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnswerError(null);
    if (answerBody.trim().length < 20) {
      setAnswerError('Please share a thoughtful response of at least 20 characters.');
      return;
    }

    setSubmittingAnswer(true);
    try {
      if (!profile) {
        await continueAnonymously();
      }
      const res = await answersApi.create(id!, {
        body: answerBody.trim(),
        answerType,
      });
      if (res.crisisDetected && res.crisisResources) {
        setCrisisResources(res.crisisResources);
      }
      setAnswerBody('');
      setAnswerSuccess(true);
      setShowEditor(false);
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['my-answers'] });
      queryClient.invalidateQueries({ queryKey: ['one-voice'] });
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : 'Unable to post answer.');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleReact = async (answerId: string, reactionType: string) => {
    if (!profile) {
      navigate('/signin');
      return;
    }
    await answersApi.react(answerId, reactionType);
    queryClient.invalidateQueries({ queryKey: ['question', id] });
  };

  const handleToggleSaveAnswer = async (ans: AnswerItem) => {
    if (!profile) {
      navigate('/signin');
      return;
    }
    if (ans.isSaved) await answersApi.unsave(ans.id);
    else await answersApi.save(ans.id);
    queryClient.invalidateQueries({ queryKey: ['question', id] });
    queryClient.invalidateQueries({ queryKey: ['saved'] });
  };

  const handleEditAnswer = async (ans: AnswerItem, newBody: string, newType: string) => {
    await answersApi.update(ans.id, { body: newBody, answerType: newType });
    queryClient.invalidateQueries({ queryKey: ['question', id] });
  };

  const handleDeleteAnswer = async (answerId: string) => {
    await answersApi.remove(answerId);
    queryClient.invalidateQueries({ queryKey: ['question', id] });
  };

  const handleStatusChange = async (status: 'open' | 'archived') => {
    await questionsApi.update(id!, { status });
    queryClient.invalidateQueries({ queryKey: ['question', id] });
    queryClient.invalidateQueries({ queryKey: ['my-questions'] });
  };

  const handleDeleteQuestion = async () => {
    await questionsApi.remove(id!);
    queryClient.invalidateQueries({ queryKey: ['home'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    navigate('/explore');
  };

  const handleHideQuestion = async () => {
    if (!profile) {
      navigate('/signin');
      return;
    }
    await questionsApi.hide(id!);
    queryClient.invalidateQueries({ queryKey: ['home'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    navigate('/explore');
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: data?.question.title || "Stranger's Wisdom",
        url: shareUrl,
      }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-[44px] inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {isLoading ? (
          <LoadingSkeleton count={3} />
        ) : isError || !data ? (
          <ErrorState
            message="We could not find this question. It may have been archived or removed."
            onRetry={() => refetch()}
          />
        ) : (
          <>
            {/* Question Header Card */}
            <section className="rounded-3xl border border-slate-200/90 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 sm:p-8 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                    {data.question.category}
                  </span>
                  <span>·</span>
                  <span>{data.question.questionType}</span>
                  <span>·</span>
                  <span className="font-tabular">
                    {formatTimeAgo(data.question.createdAt)}
                  </span>
                  <span>·</span>
                  <span>{formatStatusLabel(data.question.status)}</span>
                </div>
                <span>{data.question.authorLabel}</span>
              </div>

              <h1 className="font-wisdom text-2xl sm:text-3xl font-medium leading-snug text-slate-900 dark:text-white text-balance">
                {data.question.title}
              </h1>

              {data.question.body && (
                <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {data.question.body}
                </p>
              )}

              {data.question.tags && data.question.tags.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Topics: {data.question.tags.join(' · ')}
                </p>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-indigo-950/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {data.question.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => setShowEditor((v) => !v)}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 cursor-pointer"
                    >
                      Write an Answer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => saveQuestionMutation.mutate()}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-indigo-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
                  >
                    <Bookmark
                      className="h-4 w-4 text-amber-500"
                      fill={data.question.isSaved ? 'currentColor' : 'none'}
                    />
                    {data.question.isSaved ? 'Saved' : 'Save'}
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-indigo-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
                  >
                    {copiedShare ? <Check className="h-4 w-4 text-teal-500" /> : <Share2 className="h-4 w-4" />}
                    {copiedShare ? 'Link copied' : 'Share'}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {data.question.isOwner ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/ask?edit=${data.question.id}`)}
                        aria-label="Edit question"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-cyan-500 cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusChange(
                            data.question.status === 'archived' ? 'open' : 'archived'
                          )
                        }
                        aria-label={
                          data.question.status === 'archived'
                            ? 'Reopen question'
                            : 'Archive question'
                        }
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-500 cursor-pointer"
                      >
                        {data.question.status === 'archived' ? (
                          <LockOpen className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteQuestion}
                        aria-label="Delete question"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleHideQuestion}
                        aria-label="Hide from feed"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReportTarget({ type: 'question', id: data.question.id })
                        }
                        aria-label="Report question"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-500 cursor-pointer"
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {answerSuccess && (
              <div className="space-y-4">
                <SuccessConfirmation
                  title="Your answer has reached someone."
                  message="Thank you for sharing your perspective thoughtfully and anonymously."
                  primaryLabel="Read Answers"
                  onPrimary={() => setAnswerSuccess(false)}
                />
                {crisisResources && <CrisisSupportBanner resources={crisisResources} />}
              </div>
            )}

            {/* Answer Editor */}
            {showEditor && data.question.status !== 'archived' && (
              <form
                onSubmit={handleAnswerSubmit}
                className="rounded-3xl border border-cyan-500/35 bg-white dark:bg-[#0D1326] p-6 sm:p-8 space-y-5"
              >
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    What would you say to someone going through this?
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Speak from real experience. Thoughtful responses stay meaningful long after tonight.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ANSWER_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAnswerType(type)}
                      className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        answerType === type
                          ? 'border-violet-500 bg-violet-500/15 text-violet-800 dark:text-violet-200'
                          : 'border-slate-200 dark:border-indigo-950 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={5}
                  required
                  value={answerBody}
                  onChange={(e) => setAnswerBody(e.target.value)}
                  placeholder="What would you say to someone going through this?"
                  className="w-full rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] p-4 text-sm leading-relaxed text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                />

                <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                  <span>
                    Please avoid sharing phone numbers, addresses, passwords, or personally identifying information.
                  </span>
                </div>

                {answerError && (
                  <p className="text-sm text-rose-500" role="alert">
                    {answerError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="min-h-[44px] rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAnswer}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    {submittingAnswer ? 'Sending...' : 'Post Answer'}
                  </button>
                </div>
              </form>
            )}

            {/* Answers List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-tabular text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Answers ({data.answers.length})
                </h2>
              </div>

              {data.answers.length === 0 ? (
                <EmptyState
                  title="No answers yet."
                  subtitle="If you have lived through something similar, your perspective could mean a lot here."
                  actionLabel={
                    data.question.status !== 'archived'
                      ? 'Write the first answer'
                      : undefined
                  }
                  onAction={() => setShowEditor(true)}
                />
              ) : (
                <div className="space-y-4">
                  {data.answers.map((ans) => (
                    <AnswerCard
                      key={ans.id}
                      answer={ans}
                      onReact={handleReact}
                      onToggleSave={handleToggleSaveAnswer}
                      onReport={(ansId) =>
                        setReportTarget({ type: 'answer', id: ansId })
                      }
                      onEdit={handleEditAnswer}
                      onDelete={handleDeleteAnswer}
                      collections={savedData?.collections}
                      onAddToCollection={async (colId, ansId) => {
                        await savedApi.addAnswerToCollection(colId, ansId);
                        queryClient.invalidateQueries({ queryKey: ['saved'] });
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {reportTarget && (
        <ReportModal
          contentType={reportTarget.type}
          contentId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}
    </Layout>
  );
}
