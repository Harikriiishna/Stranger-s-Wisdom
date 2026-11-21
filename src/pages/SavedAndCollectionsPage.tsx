import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, FolderPlus, Plus, Search, Trash2, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { answersApi, questionsApi, savedApi } from '../lib/api';
import { formatTimeAgo } from '../lib/format';

const COVER_IMAGES: Record<string, string> = {
  lantern: '/src/assets/images/collection_lantern_1795241588384.jpg',
  horizon: '/src/assets/images/collection_horizon_1795241588335.jpg',
  harbor: '/src/assets/images/collection_harbor_1795241588125.jpg',
  sanctuary: '/src/assets/images/onboarding_sanctuary_1795241588374.jpg',
};

export function SavedAndCollectionsPage({
  defaultView = 'saved',
}: {
  defaultView?: 'saved' | 'collections';
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'saved' | 'collections'>(defaultView);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'topic'>('newest');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    null
  );
  const [showNewColModal, setShowNewColModal] = useState(false);
  const [colName, setColName] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colCover, setColCover] = useState<'lantern' | 'horizon' | 'harbor' | 'sanctuary'>('lantern');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['saved'],
    queryFn: savedApi.list,
    enabled: Boolean(profile),
  });

  const createCollectionMutation = useMutation({
    mutationFn: savedApi.createCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      setShowNewColModal(false);
      setColName('');
      setColDesc('');
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: savedApi.deleteCollection,
    onSuccess: () => {
      setSelectedCollectionId(null);
      queryClient.invalidateQueries({ queryKey: ['saved'] });
    },
  });

  const filteredAnswers = useMemo(() => {
    const items = data?.savedAnswers ?? [];
    const activeCol = selectedCollectionId
      ? data?.collections.find((c) => c.id === selectedCollectionId)
      : null;

    let result = activeCol
      ? items.filter((item) => activeCol.answerIds.includes(item.answerId))
      : items;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.body.toLowerCase().includes(q) ||
          item.questionTitle.toLowerCase().includes(q) ||
          item.questionCategory.toLowerCase().includes(q)
      );
    }

    if (sort === 'topic') {
      result = [...result].sort((a, b) =>
        a.questionCategory.localeCompare(b.questionCategory)
      );
    }

    return result;
  }, [data, selectedCollectionId, search, sort]);

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-10">
          <EmptyState
            title="Your Saved Wisdom library syncs across devices."
            subtitle="Sign in to save meaningful answers and organize them into personal collections."
            actionLabel="Sign In"
            onAction={() => navigate('/signin')}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              {view === 'collections' ? 'Wisdom Collections' : 'Saved Wisdom'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              A private library of words worth keeping close.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setView('saved');
                setSelectedCollectionId(null);
              }}
              className={`min-h-[42px] rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
                view === 'saved'
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950'
                  : 'border border-slate-200 dark:border-indigo-900 text-slate-600 dark:text-slate-300'
              }`}
            >
              Saved Items
            </button>
            <button
              type="button"
              onClick={() => setView('collections')}
              className={`min-h-[42px] rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
                view === 'collections'
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950'
                  : 'border border-slate-200 dark:border-indigo-900 text-slate-600 dark:text-slate-300'
              }`}
            >
              Collections
            </button>
            <button
              type="button"
              onClick={() => setShowNewColModal(true)}
              aria-label="Create collection"
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-indigo-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : view === 'collections' && !selectedCollectionId ? (
          <div className="space-y-6">
            {(data?.collections ?? []).length === 0 ? (
              <EmptyState
                title="No collections yet."
                subtitle="Create collections like Advice for the Future, Things I Needed to Hear, or Life Lessons."
                actionLabel="Create Collection"
                onAction={() => setShowNewColModal(true)}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data?.collections ?? []).map((col) => (
                  <div
                    key={col.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCollectionId(col.id);
                        setView('saved');
                      }}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="relative h-36 overflow-hidden bg-[#090F22]">
                        <img
                          src={COVER_IMAGES[col.coverKey] || COVER_IMAGES.lantern}
                          alt={col.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#070B19]/90 via-[#070B19]/30 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 text-white">
                          <h3 className="font-semibold text-base truncate">{col.name}</h3>
                          <p className="font-tabular text-xs text-slate-300">
                            {col.answerIds.length} saved{' '}
                            {col.answerIds.length === 1 ? 'entry' : 'entries'}
                          </p>
                        </div>
                      </div>
                      {col.description && (
                        <p className="p-4 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                          {col.description}
                        </p>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${col.name}`}
                      onClick={() => deleteCollectionMutation.mutate(col.id)}
                      className="absolute top-2.5 right-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-black/50 text-slate-200 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {selectedCollectionId && (
              <div className="flex items-center justify-between rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
                <span className="text-sm font-medium text-cyan-800 dark:text-cyan-200">
                  Collection:{' '}
                  {data?.collections.find((c) => c.id === selectedCollectionId)?.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCollectionId(null)}
                  className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:underline cursor-pointer"
                >
                  Show all saved
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search saved wisdom..."
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] pl-10 pr-4 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'newest' | 'topic')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="newest">Sort: Date saved</option>
                  <option value="topic">Sort: Topic</option>
                </select>
              </div>
            </div>

            {filteredAnswers.length === 0 && (data?.savedQuestions ?? []).length === 0 ? (
              <EmptyState
                title="No saved wisdom yet."
                subtitle="Bookmark answers or questions that resonate with you to revisit them anytime."
                actionLabel="Give Me a Perspective"
                onAction={() => navigate('/perspective')}
              />
            ) : (
              <div className="space-y-6">
                {filteredAnswers.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                      Saved Answers ({filteredAnswers.length})
                    </h2>
                    {filteredAnswers.map((item) => (
                      <article
                        key={item.savedId}
                        className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <div>
                            <span className="font-semibold text-violet-700 dark:text-violet-300">
                              {item.answerType}
                            </span>
                            <span className="mx-1.5">·</span>
                            <span>{item.questionCategory}</span>
                            <span className="mx-1.5">·</span>
                            <span className="font-tabular">
                              Saved {formatTimeAgo(item.savedAt)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await answersApi.unsave(item.answerId);
                              queryClient.invalidateQueries({ queryKey: ['saved'] });
                            }}
                            aria-label="Remove saved answer"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-amber-500 hover:text-rose-500 cursor-pointer"
                          >
                            <Bookmark className="h-4 w-4" fill="currentColor" />
                          </button>
                        </div>

                        <p className="font-wisdom text-base leading-relaxed text-slate-800 dark:text-slate-200">
                          “{item.body}”
                        </p>

                        <div className="pt-2 border-t border-slate-100 dark:border-indigo-950/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <Link
                            to={`/questions/${item.questionId}`}
                            className="text-cyan-700 dark:text-cyan-400 hover:underline truncate max-w-md"
                          >
                            From: {item.questionTitle}
                          </Link>

                          {(data?.collections ?? []).length > 0 && (
                            <select
                              aria-label="Add to collection"
                              defaultValue=""
                              onChange={async (e) => {
                                if (!e.target.value) return;
                                await savedApi.addAnswerToCollection(
                                  e.target.value,
                                  item.answerId
                                );
                                queryClient.invalidateQueries({ queryKey: ['saved'] });
                              }}
                              className="rounded-lg border border-slate-200 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-2.5 py-1 text-xs"
                            >
                              <option value="">+ Add to collection</option>
                              {(data?.collections ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {!selectedCollectionId && (data?.savedQuestions ?? []).length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                      Saved Questions ({data?.savedQuestions.length})
                    </h2>
                    {data?.savedQuestions.map((sq) => (
                      <div
                        key={sq.savedId}
                        className="rounded-2xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] p-5 flex items-center justify-between gap-4"
                      >
                        <Link to={`/questions/${sq.questionId}`} className="min-w-0 flex-1">
                          <p className="text-xs text-cyan-700 dark:text-cyan-400">
                            {sq.category} · Saved {formatTimeAgo(sq.savedAt)}
                          </p>
                          <h3 className="mt-1 font-wisdom text-base font-medium text-slate-900 dark:text-white truncate">
                            {sq.title}
                          </h3>
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            await questionsApi.unsave(sq.questionId);
                            queryClient.invalidateQueries({ queryKey: ['saved'] });
                          }}
                          aria-label="Unsave question"
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-amber-500 hover:text-rose-500 cursor-pointer"
                        >
                          <Bookmark className="h-4 w-4" fill="currentColor" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Collection Modal */}
      {showNewColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#0D1326] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-cyan-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  New Collection
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewColModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (colName.trim().length < 2) return;
                createCollectionMutation.mutate({
                  name: colName.trim(),
                  description: colDesc.trim(),
                  coverKey: colCover,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Collection Name
                </label>
                <input
                  type="text"
                  required
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  placeholder="e.g. Things I Needed to Hear"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                  placeholder="A quiet shelf for future perspective"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] px-3.5 text-sm"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                  Cover Atmosphere
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(['lantern', 'horizon', 'harbor', 'sanctuary'] as const).map(
                    (k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setColCover(k)}
                        className={`overflow-hidden rounded-xl border-2 cursor-pointer ${
                          colCover === k
                            ? 'border-cyan-500'
                            : 'border-transparent opacity-70'
                        }`}
                      >
                        <img
                          src={COVER_IMAGES[k]}
                          alt={k}
                          referrerPolicy="no-referrer"
                          className="h-12 w-full object-cover"
                        />
                      </button>
                    )
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={createCollectionMutation.isPending}
                className="w-full min-h-[44px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 cursor-pointer"
              >
                {createCollectionMutation.isPending ? 'Creating...' : 'Create Collection'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
