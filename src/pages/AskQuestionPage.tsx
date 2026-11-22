import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, Radio, Save, Send, ShieldCheck } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  CrisisSupportBanner,
  ErrorState,
  LoadingSkeleton,
  SuccessConfirmation,
} from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { myWisdomApi, questionsApi } from '../lib/api';
import { QUESTION_CATEGORIES, QUESTION_TYPES } from '../lib/format';
import type { CrisisResources } from '../types';

export function AskQuestionPage() {
  const { profile, continueAnonymously } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const draftIdParam = searchParams.get('draft');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('Life');
  const [questionType, setQuestionType] = useState<string>('I Need Perspective');
  const [tagsText, setTagsText] = useState('');
  const [isOneVoice, setIsOneVoice] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(
    draftIdParam || undefined
  );

  const [busy, setBusy] = useState(false);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [crisisResources, setCrisisResources] = useState<CrisisResources | null>(
    null
  );

  const {
    data: editData,
    isLoading: editLoading,
    isError: editError,
    refetch: refetchEdit,
  } = useQuery({
    queryKey: ['question', editId],
    queryFn: () => questionsApi.getById(editId!),
    enabled: Boolean(editId),
  });

  const { data: draftsData } = useQuery({
    queryKey: ['drafts'],
    queryFn: myWisdomApi.drafts,
    enabled: Boolean(profile),
  });

  useEffect(() => {
    if (!editId && !draftIdParam) {
      setTitle('');
      setBody('');
      setCategory('Life');
      setQuestionType('I Need Perspective');
      setTagsText('');
      setIsOneVoice(false);
      setPreviewMode(false);
      setActiveDraftId(undefined);
      setPublishedId(null);
      setError(null);
      setDraftSavedMsg(null);
      setCrisisResources(null);
    }
  }, [editId, draftIdParam]);

  useEffect(() => {
    if (editData?.question) {
      setTitle(editData.question.title);
      setBody(editData.question.body);
      setCategory(editData.question.category);
      setQuestionType(editData.question.questionType);
      setTagsText((editData.question.tags || []).join(', '));
      setIsOneVoice(editData.question.isOneVoice);
    }
  }, [editData]);

  useEffect(() => {
    if (draftIdParam && draftsData?.drafts) {
      const found = draftsData.drafts.find((d) => d.id === draftIdParam);
      if (found) {
        setTitle(found.title);
        setBody(found.body);
        setCategory(found.category);
        setQuestionType(found.questionType);
        setTagsText((found.tags || []).join(', '));
        setActiveDraftId(found.id);
      }
    }
  }, [draftIdParam, draftsData]);

  const parsedTags = tagsText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);

  const ensureSession = async () => {
    if (!profile) {
      await continueAnonymously();
    }
  };

  const handleSaveDraft = async () => {
    setError(null);
    setDraftSavedMsg(null);
    setBusy(true);
    try {
      await ensureSession();
      const res = await myWisdomApi.saveDraft({
        id: activeDraftId,
        title: title.trim(),
        body: body.trim(),
        category,
        questionType,
        tags: parsedTags,
      });
      setActiveDraftId(res.draft.id);
      setDraftSavedMsg('Draft saved privately.');
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 10) {
      setError('Please write a question title of at least 10 characters.');
      return;
    }

    setBusy(true);
    try {
      await ensureSession();

      if (editId) {
        await questionsApi.update(editId, {
          title: title.trim(),
          body: body.trim(),
          category,
          questionType,
          tags: parsedTags,
        });
        queryClient.invalidateQueries({ queryKey: ['question', editId] });
        queryClient.invalidateQueries({ queryKey: ['home'] });
        queryClient.invalidateQueries({ queryKey: ['questions'] });
        navigate(`/questions/${editId}`);
        return;
      }

      const res = await questionsApi.create({
        title: title.trim(),
        body: body.trim(),
        category,
        questionType,
        tags: parsedTags,
        isOneVoice,
        draftId: activeDraftId,
      });

      if (res.crisisDetected && res.crisisResources) {
        setCrisisResources(res.crisisResources);
      }
      setPublishedId(res.question.id);
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['my-questions'] });
      queryClient.invalidateQueries({ queryKey: ['one-voice'] });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish question.');
    } finally {
      setBusy(false);
    }
  };

  if (editId && editLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <LoadingSkeleton count={2} />
        </div>
      </Layout>
    );
  }

  if (editId && editError) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <ErrorState
            message="We could not load this question for editing."
            onRetry={() => refetchEdit()}
          />
        </div>
      </Layout>
    );
  }

  if (publishedId) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-8 space-y-6">
          <SuccessConfirmation
            title="Your question is out there now."
            message="Someone may understand it better than you expect. Your identity remains completely private."
            primaryLabel="View Question"
            onPrimary={() =>
              navigate(isOneVoice ? '/one-voice' : `/questions/${publishedId}`)
            }
            secondaryLabel="Return Home"
            onSecondary={() => navigate('/home')}
          />
          {crisisResources && <CrisisSupportBanner resources={crisisResources} />}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              {editId ? 'Edit Your Question' : 'What is on your mind?'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              You don’t need to explain everything. Ask what you need.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-indigo-900 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer self-start"
          >
            {previewMode ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {previewMode ? 'Back to Editor' : 'Preview'}
          </button>
        </div>

        {/* Saved Drafts Quick Picker */}
        {!editId && draftsData && draftsData.drafts.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
              Load saved draft:
            </span>
            {draftsData.drafts.slice(0, 4).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setTitle(d.title);
                  setBody(d.body);
                  setCategory(d.category);
                  setQuestionType(d.questionType);
                  setTagsText((d.tags || []).join(', '));
                  setActiveDraftId(d.id);
                }}
                className="min-h-[36px] rounded-xl border border-slate-200 dark:border-indigo-900 px-3 py-1 text-xs text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 truncate max-w-[200px] cursor-pointer"
              >
                {d.title || 'Untitled draft'}
              </button>
            ))}
          </div>
        )}

        {previewMode ? (
          <div className="rounded-3xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#0D1326] p-6 sm:p-8 space-y-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-cyan-700 dark:text-cyan-400">{category}</span>
              <span>·</span>
              <span>{questionType}</span>
              <span>·</span>
              <span>Asked anonymously</span>
              {isOneVoice && (
                <>
                  <span>·</span>
                  <span className="text-violet-600 dark:text-violet-300">One Voice</span>
                </>
              )}
            </div>
            <h2 className="font-wisdom text-2xl font-medium text-slate-900 dark:text-white">
              {title || 'Your question title will appear here...'}
            </h2>
            {body && (
              <p className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                {body}
              </p>
            )}
            {parsedTags.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                Topics: {parsedTags.join(' · ')}
              </p>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-slate-200/90 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-6 sm:p-8 space-y-6"
          >
            <div>
              <label
                htmlFor="ask-title"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2"
              >
                Question Title
              </label>
              <input
                id="ask-title"
                type="text"
                required
                maxLength={220}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What question is on your mind?"
                className="w-full min-h-[48px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-4 text-base text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
              />
              <p className="mt-1.5 font-tabular text-xs text-slate-400">
                {title.length} / 220 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="ask-body"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2"
              >
                Additional Context (optional)
              </label>
              <textarea
                id="ask-body"
                rows={5}
                maxLength={3000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share as much or as little context as feels comfortable..."
                className="w-full rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] p-4 text-sm leading-relaxed text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="ask-category"
                  className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2"
                >
                  Category
                </label>
                <select
                  id="ask-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  {QUESTION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ask-tags"
                  className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2"
                >
                  Optional Tags (comma separated)
                </label>
                <input
                  id="ask-tags"
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="Add optional topics, separated by commas"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2.5">
                Question Type
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUESTION_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setQuestionType(type)}
                    className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                      questionType === type
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                        : 'border-slate-200 dark:border-indigo-950 bg-slate-50/70 dark:bg-[#070B19] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-indigo-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {!editId && (
              <label className="flex items-start gap-3 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/50 dark:bg-[#090F22] p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOneVoice}
                  onChange={(e) => setIsOneVoice(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-500"
                />
                <div className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Radio className="h-4 w-4 text-cyan-500" />
                    Send through One Voice
                  </span>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Instead of an open public thread, receive one unhurried, thoughtful response from a stranger without public competition.
                  </p>
                </div>
              </label>
            )}

            <div className="rounded-xl bg-slate-100 dark:bg-[#080D1F] px-4 py-3 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <span>
                Please avoid sharing phone numbers, addresses, passwords, or personally identifying information.
              </span>
            </div>

            {error && (
              <p className="text-sm text-rose-500" role="alert">
                {error}
              </p>
            )}

            {draftSavedMsg && (
              <p className="text-sm text-teal-600 dark:text-teal-400">
                {draftSavedMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {!editId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveDraft}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-indigo-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </button>
              )}

              <button
                type="submit"
                disabled={busy}
                className="ml-auto min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Send className="h-4 w-4" />
                {busy
                  ? 'Sending...'
                  : editId
                    ? 'Save Changes'
                    : 'Send Into the World'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
