import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { QuestionCard } from '../components/QuestionCard';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateViews';
import { useAuth } from '../contexts/AuthContext';
import { questionsApi } from '../lib/api';
import { EXPLORE_CHIPS } from '../lib/format';
import type { QuestionCardItem } from '../types';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'recent', label: 'Recently Asked' },
  { id: 'advice', label: 'Advice' },
  { id: 'experiences', label: 'Life Experiences' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'career', label: 'Career' },
  { id: 'growth', label: 'Personal Growth' },
  { id: 'decisions', label: 'Decisions' },
];

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recently posted' },
  { id: 'needs_answer', label: 'Needs an answer' },
  { id: 'relevant', label: 'Relevant' },
  { id: 'random', label: 'Random discovery' },
];

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (category !== 'All') next.set('category', category);
    if (filter !== 'all') next.set('filter', filter);
    if (sort !== 'recent') next.set('sort', sort);
    if (debouncedSearch) next.set('q', debouncedSearch);
    setSearchParams(next, { replace: true });
  }, [category, filter, sort, debouncedSearch, setSearchParams]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['questions', category, filter, sort, debouncedSearch, page],
    queryFn: () =>
      questionsApi.explore({
        category,
        filter,
        sort,
        search: debouncedSearch,
        page,
        limit: 10,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async (q: QuestionCardItem) => {
      if (!profile) {
        navigate('/signin');
        return;
      }
      if (q.isSaved) await questionsApi.unsave(q.id);
      else await questionsApi.save(q.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['saved'] });
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
              Explore Questions
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Browse real experiences, unanswered reflections, and quiet conversations.
            </p>
          </div>
          <Link
            to="/ask"
            className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-cyan-600 dark:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 whitespace-nowrap shrink-0"
          >
            Ask Something
          </Link>
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {EXPLORE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setCategory(chip);
                setPage(1);
              }}
              className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                category === chip
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950'
                  : 'border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] text-slate-600 dark:text-slate-300 hover:border-cyan-500/40'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Search, Filter, Sort Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <SearchIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search questions, topics, or keywords..."
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] pl-10 pr-4 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="explore-filter" className="sr-only">
              Filter
            </label>
            <select
              id="explore-filter"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
            >
              {FILTER_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  Filter: {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="explore-sort" className="sr-only">
              Sort
            </label>
            <select
              id="explore-sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#0D1326] px-3.5 text-sm focus:border-cyan-500 focus:outline-none"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <LoadingSkeleton count={4} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.questions.length === 0 ? (
          <EmptyState
            title="No questions here yet."
            subtitle="Someone might need your perspective today."
            actionLabel="Ask a Question"
            onAction={() => navigate('/ask')}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-tabular">
                Showing {data.questions.length} of {data.total} questions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {SORT_OPTIONS.find((s) => s.id === sort)?.label}
              </span>
            </div>

            <div className="space-y-4">
              {data.questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onToggleSave={(item) => saveMutation.mutate(item)}
                />
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[44px] rounded-xl border border-slate-200 dark:border-indigo-900 px-4 py-2 text-sm disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-tabular text-xs text-slate-500 dark:text-slate-400">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-[44px] rounded-xl border border-slate-200 dark:border-indigo-900 px-4 py-2 text-sm disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

const POPULAR_TOPICS = ['Life', 'Love', 'Career', 'Growth', 'Decisions', 'Friendship'];

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'self care',
    'moving on',
    'career advice',
  ]);
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = query.trim();
      setDebounced(trimmed);
      if (trimmed.length >= 3) {
        setRecentSearches((prev) =>
          [trimmed, ...prev.filter((p) => p !== trimmed)].slice(0, 6)
        );
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () =>
      questionsApi.explore({
        search: debounced,
        limit: 15,
      }),
    enabled: debounced.length > 0,
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">
            Search Wisdom
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Find questions and lived experiences by topic, emotion, or keyword.
          </p>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full min-h-[52px] rounded-2xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#0D1326] pl-12 pr-12 text-base focus:border-cyan-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!debounced ? (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                Popular Searches
              </h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setQuery(topic)}
                    className="min-h-[40px] rounded-xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#0D1326] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 cursor-pointer"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  Recent Searches
                </h2>
                <div className="divide-y divide-slate-200/70 dark:divide-indigo-950/70 rounded-2xl border border-slate-200/80 dark:border-indigo-950/80 bg-white dark:bg-[#0D1326]">
                  {recentSearches.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setQuery(item)}
                      className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                    >
                      <span className="flex items-center gap-3">
                        <SearchIcon className="h-4 w-4 text-slate-400" />
                        {item}
                      </span>
                      <span className="text-xs text-cyan-600 dark:text-cyan-400">
                        Search
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <LoadingSkeleton count={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.questions.length === 0 ? (
          <EmptyState
            title="No matching questions yet."
            subtitle="You can ask this question anonymously and invite a stranger's perspective."
            actionLabel="Ask This Question"
            onAction={() => navigate('/ask')}
          />
        ) : (
          <div className="space-y-4">
            <p className="font-tabular text-xs text-slate-500 dark:text-slate-400">
              {data.total} {data.total === 1 ? 'result' : 'results'} for “{debounced}”
            </p>
            {data.questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
