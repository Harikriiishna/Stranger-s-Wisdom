import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Bookmark,
  BookOpen,
  Check,
  Edit3,
  EyeOff,
  Flag,
  Flame,
  LockOpen,
  Minimize2,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { AnswerCard } from '../components/AnswerCard';
import { CardContextMenu } from '../components/CardContextMenu';
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
import { getQuestionShareUrl, shareContent } from '../lib/clipboard';
import { ANSWER_TYPES, formatStatusLabel, formatTimeAgo } from '../lib/format';
import type { AnswerItem, CrisisResources } from '../types';

export function QuestionDetailsPage({ openEditorByDefault = false }: { openEditorByDefault?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, continueAnonymously } = useAuth();

  const [showEditor, setShowEditor] = useState(openEditorByDefault);
  const [answerBody, setAnswerBody] = useState('');
  const [answerType, setAnswerType] = useState<string>('My Advice');
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerSuccess, setAnswerSuccess] = useState(false);
  const [crisisResources, setCrisisResources] = useState<CrisisResources | null>(null);
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'shared' | 'copied'>('idle');
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'question' | 'answer';
    id: string;
  } | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    setShowEditor(openEditorByDefault);
    setAnswerBody('');
    setAnswerError(null);
    setActionError(null);
    setAnswerSuccess(false);
    setCrisisResources(null);
    setConfirmDeleteQuestion(false);
    setFocusMode(false);
  }, [id, openEditorByDefault]);

  useEffect(() => {
    if (!focusMode || reportTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode, reportTarget]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['question', id],
    queryFn: () => questionsApi.getById(id!),
    enabled: Boolean(id),
  });

  const highlightedAnswerId = location.hash.startsWith('#answer-')
    ? location.hash.slice('#answer-'.length)
    : null;

  useEffect(() => {
    if (!highlightedAnswerId || !data?.answers?.length) return;
    const el = document.getElementById(`answer-${highlightedAnswerId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedAnswerId, data?.answers?.length]);

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
      setActionError(null);
      if (data?.question.isSaved) {
        await questionsApi.unsave(id!);
      } else {
        await questionsApi.save(id!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Unable to save question.');
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
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
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
    setActionError(null);
    try {
      await answersApi.react(answerId, reactionType);
      queryClient.invalidateQueries({ queryKey: ['question', id] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update reaction.');
    }
  };

  const handleToggleSaveAnswer = async (ans: AnswerItem) => {
    if (!profile) {
      navigate('/signin');
      return;
    }
    setActionError(null);
    try {
      if (ans.isSaved) await answersApi.unsave(ans.id);
      else await answersApi.save(ans.id);
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update saved state.');
    }
  };

  const handleEditAnswer = async (ans: AnswerItem, newBody: string, newType: string) => {
    await answersApi.update(ans.id, { body: newBody, answerType: newType });
    queryClient.invalidateQueries({ queryKey: ['question', id] });
  };

  const handleDeleteAnswer = async (answerId: string) => {
    await answersApi.remove(answerId);
    queryClient.invalidateQueries({ queryKey: ['question', id] });
    queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
  };

  const handleStatusChange = async (status: 'open' | 'archived') => {
    setActionError(null);
    try {
      await questionsApi.update(id!, { status });
      queryClient.invalidateQueries({ queryKey: ['question', id] });
      queryClient.invalidateQueries({ queryKey: ['my-questions'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update question status.');
    }
  };

  const handleDeleteQuestion = async () => {
    setActionError(null);
    setDeletingQuestion(true);
    try {
      await questionsApi.remove(id!);
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['my-questions'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
      navigate('/explore');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete question.');
    } finally {
      setDeletingQuestion(false);
    }
  };

  const handleHideQuestion = async () => {
    if (!profile) {
      navigate('/signin');
      return;
    }
    setActionError(null);
    try {
      await questionsApi.hide(id!);
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      navigate('/explore');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to hide question.');
    }
  };

  const handleShare = async () => {
    const shareUrl = id ? getQuestionShareUrl(id) : window.location.href;
    setActionError(null);
    const outcome = await shareContent({
      title: data?.question.title || "Stranger's Wisdom",
      text: data?.question.body || `${data?.question.category || 'Reflection'} · Stranger's Wisdom`,
      url: shareUrl,
    });

    if (outcome === 'shared' || outcome === 'copied') {
      setShareFeedback(outcome);
      setTimeout(() => setShareFeedback('idle'), 2000);
    } else if (outcome === 'failed') {
      setActionError('Could not copy link automatically. Please copy the URL from your browser address bar.');
    }
  };

  return (
    <Layout focusMode={focusMode} hideDesktopBack>
      <div className={focusMode ? 'max-w-[65ch] mx-auto space-y-8' : 'max-w-3xl mx-auto space-y-6'}>
        <div className="flex items-center justify-between gap-3">
          {!focusMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
                  else navigate('/home');
                }}
                className="hidden md:inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <span className="md:hidden" />
            </>
          ) : (
            <span className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
              Focus Mode · Reading view
            </span>
          )}

          {data && (
            <button
              type="button"
              aria-pressed={focusMode}
              onClick={() => setFocusMode((v) => !v)}
              className={`min-h-[40px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                focusMode
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-indigo-900 bg-white/70 dark:bg-[#0D1326] text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {focusMode ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>Exit Focus Mode</span>
                </>
              ) : (
                <>
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Focus Mode</span>
                </>
              )}
            </button>
          )}
        </div>

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
            <section
              className={`rounded-3xl border border-slate-200/90 dark:border-indigo-950 bg-white dark:bg-[#0D1326] ${
                focusMode ? 'p-7 sm:p-10 space-y-6' : 'p-6 sm:p-8 space-y-5'
              }`}
            >
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
                  {!focusMode && data.question.isTrending && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        data-trending="true"
                        title="Popular discussion with high engagement"
                        className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap"
                      >
                        <Flame
                          className="h-3.5 w-3.5 shrink-0 fill-amber-500/25"
                          aria-hidden="true"
                        />
                        <span>Trending</span>
                      </span>
                    </>
                  )}
                </div>
                <span>{data.question.authorLabel}</span>
              </div>

              <h1
                className={`font-wisdom font-medium text-slate-900 dark:text-white text-balance ${
                  focusMode
                    ? 'text-2xl sm:text-[2.1rem] leading-[1.3]'
                    : 'text-2xl sm:text-3xl leading-snug'
                }`}
              >
                {data.question.title}
              </h1>

              {data.question.body && (
                <p
                  className={`whitespace-pre-line ${
                    focusMode
                      ? 'font-wisdom text-[17.5px] sm:text-[18.5px] leading-[1.88] text-slate-700 dark:text-slate-200'
                      : 'text-base leading-relaxed text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {data.question.body}
                </p>
              )}

              {data.question.tags && data.question.tags.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Topics: {data.question.tags.join(' · ')}
                </p>
              )}

              {!focusMode && (
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
                    {shareFeedback !== 'idle' ? (
                      <Check className="h-4 w-4 text-teal-500" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                    {shareFeedback === 'shared'
                      ? 'Shared'
                      : shareFeedback === 'copied'
                      ? 'Link copied'
                      : 'Share'}
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
                        onClick={() => setConfirmDeleteQuestion((v) => !v)}
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
                  <CardContextMenu
                    triggerLabel="Question options"
                    shareUrl={getQuestionShareUrl(data.question.id)}
                    shareTitle={data.question.title}
                    shareText={data.question.body || `${data.question.category} · ${data.question.questionType}`}
                    items={[
                      {
                        label: data.question.isSaved ? 'Remove from saved' : 'Save question',
                        icon: (
                          <Bookmark
                            className="h-4 w-4 text-amber-500"
                            fill={data.question.isSaved ? 'currentColor' : 'none'}
                          />
                        ),
                        onClick: () => saveQuestionMutation.mutate(),
                      },
                      ...(!data.question.isOwner
                        ? [
                            {
                              label: 'Hide from feed',
                              icon: <EyeOff className="h-4 w-4 text-slate-400" />,
                              onClick: handleHideQuestion,
                            },
                            {
                              label: 'Report question',
                              icon: <Flag className="h-4 w-4 text-amber-500" />,
                              onClick: () =>
                                setReportTarget({ type: 'question', id: data.question.id }),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
              )}

              {!focusMode && confirmDeleteQuestion && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-xs">
                  <span className="text-rose-700 dark:text-rose-200 font-medium">
                    Permanently delete this question and all its answers?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteQuestion(false)}
                      className="min-h-[36px] rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deletingQuestion}
                      onClick={handleDeleteQuestion}
                      className="min-h-[36px] rounded-xl bg-rose-600 px-3.5 py-1.5 font-semibold text-white disabled:opacity-50 cursor-pointer"
                    >
                      {deletingQuestion ? 'Deleting...' : 'Confirm delete'}
                    </button>
                  </div>
                </div>
              )}

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
            </section>

            {!focusMode && answerSuccess && (
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
            {!focusMode && showEditor && data.question.status !== 'archived' && (
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
                    !focusMode && data.question.status !== 'archived'
                      ? 'Write the first answer'
                      : undefined
                  }
                  onAction={() => setShowEditor(true)}
                />
              ) : (
                <div className={focusMode ? 'space-y-6' : 'space-y-4'}>
                  {data.answers.map((ans) => (
                    <AnswerCard
                      key={ans.id}
                      answer={ans}
                      highlighted={highlightedAnswerId === ans.id}
                      focusMode={focusMode}
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

              {focusMode && (
                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setFocusMode(false)}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-indigo-900 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 cursor-pointer"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    Exit Focus Mode
                  </button>
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
