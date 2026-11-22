import type {
  AnswerItem,
  CollectionItem,
  PerspectiveItem,
  QuestionCardItem,
  UserProfile,
} from '../types';

const DB_NAME = 'strangers_wisdom_offline_v1';
const STORE_NAME = 'cache_entries';
const LS_PREFIX = 'sw_offline_v1:';
const LS_SESSION_KEY = 'sw_offline_session_v1';
const MAX_LOCAL_QUESTIONS = 150;

interface CacheEnvelope<T = unknown> {
  key: string;
  scope: 'public' | 'user';
  userId?: string;
  data: T;
  updatedAt: number;
}

interface SavedPayload {
  savedAnswers: Array<{
    savedId: string;
    savedAt: string;
    answerId: string;
    body: string;
    answerType: string;
    questionId: string;
    questionTitle: string;
    questionCategory: string;
  }>;
  savedQuestions: Array<{
    savedId: string;
    savedAt: string;
    questionId: string;
    title: string;
    body: string;
    category: string;
    status: string;
  }>;
  collections: CollectionItem[];
}

const memoryMap = new Map<string, CacheEnvelope>();
let activeUserId: string | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

const USER_SCOPED_PREFIXES = [
  '/saved',
  '/my/questions',
  '/my/answers',
  '/my/responses-received',
  '/my/one-voice',
  '/drafts',
  '/profile',
  '/notifications',
];

function isUserScopedPath(path: string): boolean {
  return USER_SCOPED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
  );
}

function isPublicCacheablePath(path: string): boolean {
  return (
    path === '/home' ||
    path === '/questions' ||
    path.startsWith('/questions?') ||
    /^\/questions\/[^/?]+$/.test(path) ||
    path.startsWith('/wisdom/random')
  );
}

function makeStorageKey(path: string, userId: string | null): string | null {
  if (isUserScopedPath(path)) {
    if (!userId) return null;
    return `user:${userId}:${path}`;
  }
  if (isPublicCacheablePath(path)) {
    return `public:${path}`;
  }
  return null;
}

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<CacheEnvelope | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CacheEnvelope | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetAll(): Promise<CacheEnvelope[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? (req.result as CacheEnvelope[]) : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbPut(entry: CacheEnvelope): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDeleteKeys(predicate: (entry: CacheEnvelope) => boolean): Promise<void> {
  const db = await openDB();
  if (!db) return;
  const all = await idbGetAll();
  const toDelete = all.filter(predicate).map((e) => e.key);
  if (toDelete.length === 0) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const k of toDelete) {
        store.delete(k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function lsPut(entry: CacheEnvelope) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LS_PREFIX}${entry.key}`, JSON.stringify(entry));
  } catch {
    // Quota exceeded or private mode — IndexedDB still retains primary copy
  }
}

function lsGet(key: string): CacheEnvelope | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${LS_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function lsListByPrefix(prefix: string): CacheEnvelope[] {
  if (typeof window === 'undefined') return [];
  const results: CacheEnvelope[] = [];
  try {
    const fullPrefix = `${LS_PREFIX}${prefix}`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as CacheEnvelope;
          if (parsed && typeof parsed === 'object') results.push(parsed);
        } catch {
          // ignore corrupted item
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return results;
}

function lsDeleteByPredicate(predicate: (keyWithoutPrefix: string) => boolean) {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) {
        const stripped = k.slice(LS_PREFIX.length);
        if (predicate(stripped)) keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // ignore storage errors
  }
}

async function writeEntry(entry: CacheEnvelope): Promise<void> {
  memoryMap.set(entry.key, entry);
  lsPut(entry);
  await idbPut(entry);
}

async function readEntry<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const mem = memoryMap.get(key);
  if (mem) return mem as CacheEnvelope<T>;
  const idb = await idbGet(key);
  if (idb) {
    memoryMap.set(key, idb);
    return idb as CacheEnvelope<T>;
  }
  const ls = lsGet(key);
  if (ls) {
    memoryMap.set(key, ls);
    return ls as CacheEnvelope<T>;
  }
  return null;
}

function indexQuestionCards(cards: QuestionCardItem[]) {
  if (!Array.isArray(cards) || cards.length === 0) return;
  const now = Date.now();
  for (const card of cards.slice(0, MAX_LOCAL_QUESTIONS)) {
    if (!card || typeof card.id !== 'string') continue;
    const key = `public:qcard:${card.id}`;
    void writeEntry({
      key,
      scope: 'public',
      data: card,
      updatedAt: now,
    });
  }
}

export function setActiveOfflineUser(userId: string | null) {
  activeUserId = userId;
}

export function saveOfflineSession(profile: UserProfile | null) {
  setActiveOfflineUser(profile?.id ?? null);
  if (typeof window === 'undefined') return;
  try {
    if (!profile) {
      window.localStorage.removeItem(LS_SESSION_KEY);
      return;
    }
    window.localStorage.setItem(
      LS_SESSION_KEY,
      JSON.stringify({ profile, savedAt: Date.now() })
    );
  } catch {
    // ignore storage errors
  }
}

export function readOfflineSession(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: UserProfile; savedAt?: number };
    if (parsed?.profile && typeof parsed.profile.id === 'string') {
      setActiveOfflineUser(parsed.profile.id);
      return parsed.profile;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function clearOfflineSession() {
  activeUserId = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LS_SESSION_KEY);
    } catch {
      // ignore
    }
  }
}

export async function clearUserOfflineData(targetUserId?: string): Promise<void> {
  clearOfflineSession();
  const matches = (entry: CacheEnvelope) =>
    entry.scope === 'user' && (!targetUserId || entry.userId === targetUserId);

  for (const [k, v] of memoryMap.entries()) {
    if (matches(v)) memoryMap.delete(k);
  }
  lsDeleteByPredicate((k) =>
    targetUserId ? k.startsWith(`user:${targetUserId}:`) : k.startsWith('user:')
  );
  await idbDeleteKeys(matches);
}

export async function clearAllOfflineCache(): Promise<void> {
  for (const k of memoryMap.keys()) {
    memoryMap.delete(k);
  }
  lsDeleteByPredicate(() => true);
  await idbDeleteKeys(() => true);
}

export async function recordCacheableResponse(path: string, data: unknown): Promise<void> {
  const key = makeStorageKey(path, activeUserId);
  if (!key || data === null || data === undefined) return;

  const isUser = isUserScopedPath(path);
  const entry: CacheEnvelope = {
    key,
    scope: isUser ? 'user' : 'public',
    userId: isUser ? activeUserId ?? undefined : undefined,
    data,
    updatedAt: Date.now(),
  };

  await writeEntry(entry);

  // Extract individual questions so any viewed list/saved question can be opened offline
  if (path === '/home' && typeof data === 'object') {
    const home = data as {
      featuredQuestion?: QuestionCardItem | null;
      unansweredQuestions?: QuestionCardItem[];
      quietMoments?: QuestionCardItem[];
    };
    const cards: QuestionCardItem[] = [];
    if (home.featuredQuestion) cards.push(home.featuredQuestion);
    if (Array.isArray(home.unansweredQuestions)) cards.push(...home.unansweredQuestions);
    if (Array.isArray(home.quietMoments)) cards.push(...home.quietMoments);
    indexQuestionCards(cards);
  } else if (
    (path === '/questions' || path.startsWith('/questions?') || path === '/my/questions') &&
    typeof data === 'object'
  ) {
    const list = (data as { questions?: QuestionCardItem[] }).questions;
    if (Array.isArray(list)) indexQuestionCards(list);
  } else if (/^\/questions\/[^/?]+$/.test(path) && typeof data === 'object') {
    const detail = data as { question?: QuestionCardItem };
    if (detail.question) indexQuestionCards([detail.question]);
  }
}

async function getAllCachedQuestionCards(): Promise<QuestionCardItem[]> {
  const map = new Map<string, QuestionCardItem>();
  const add = (card: QuestionCardItem | undefined | null) => {
    if (card && typeof card.id === 'string' && !map.has(card.id)) {
      map.set(card.id, card);
    }
  };

  for (const [k, v] of memoryMap.entries()) {
    if (k.startsWith('public:qcard:')) add(v.data as QuestionCardItem);
  }
  for (const env of lsListByPrefix('public:qcard:')) {
    add(env.data as QuestionCardItem);
  }
  const allIdb = await idbGetAll();
  for (const env of allIdb) {
    if (env.key.startsWith('public:qcard:')) add(env.data as QuestionCardItem);
  }

  return Array.from(map.values());
}

async function buildOfflineExploreFallback(path: string): Promise<{
  questions: QuestionCardItem[];
  total: number;
  page: number;
  totalPages: number;
} | null> {
  const cards = await getAllCachedQuestionCards();
  if (cards.length === 0) return null;

  const qsPart = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
  const params = new URLSearchParams(qsPart);
  const category = params.get('category') || 'All';
  const filter = params.get('filter') || 'all';
  const search = (params.get('search') || '').trim().toLowerCase();
  const sort = params.get('sort') || 'recent';
  const page = Math.max(1, Number(params.get('page') || 1) || 1);
  const limit = Math.max(1, Number(params.get('limit') || 10) || 10);

  let items = [...cards];

  if (category && category !== 'All') {
    items = items.filter((q) => q.category.toLowerCase() === category.toLowerCase());
  }

  if (filter && filter !== 'all') {
    if (filter === 'unanswered') {
      items = items.filter((q) => q.answerCount === 0);
    } else if (filter === 'advice') {
      items = items.filter(
        (q) =>
          q.questionType.toLowerCase().includes('advice') ||
          q.category.toLowerCase() === 'advice'
      );
    } else if (filter === 'experiences') {
      items = items.filter((q) => q.questionType.toLowerCase().includes('experience'));
    } else if (filter === 'relationships') {
      items = items.filter((q) => q.category.toLowerCase() === 'relationships');
    } else if (filter === 'career') {
      items = items.filter((q) => q.category.toLowerCase() === 'career');
    } else if (filter === 'growth') {
      items = items.filter((q) => q.category.toLowerCase().includes('growth'));
    } else if (filter === 'decisions') {
      items = items.filter((q) => q.category.toLowerCase().includes('decision'));
    }
  }

  if (search) {
    items = items.filter(
      (q) =>
        q.title.toLowerCase().includes(search) ||
        q.body.toLowerCase().includes(search) ||
        q.category.toLowerCase().includes(search) ||
        q.tags?.some((t) => t.toLowerCase().includes(search))
    );
  }

  if (sort === 'needs_answer') {
    items.sort((a, b) => a.answerCount - b.answerCount);
  } else {
    items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paged = items.slice((page - 1) * limit, page * limit);

  return {
    questions: paged,
    total,
    page,
    totalPages,
  };
}

async function buildOfflineQuestionDetailFallback(
  questionId: string,
  userId: string | null
): Promise<{ question: QuestionCardItem; answers: AnswerItem[] } | null> {
  const qcard = await readEntry<QuestionCardItem>(`public:qcard:${questionId}`);
  const savedEnv = userId
    ? await readEntry<SavedPayload>(`user:${userId}:/saved`)
    : null;
  const savedData = savedEnv?.data;

  const matchedSavedQ = savedData?.savedQuestions?.find(
    (sq) => sq.questionId === questionId
  );
  const matchedSavedAnswers = (savedData?.savedAnswers ?? []).filter(
    (sa) => sa.questionId === questionId
  );

  let question: QuestionCardItem | null = qcard?.data ?? null;
  if (!question && matchedSavedQ) {
    question = {
      id: matchedSavedQ.questionId,
      title: matchedSavedQ.title,
      body: matchedSavedQ.body,
      category: matchedSavedQ.category,
      questionType: 'Need Advice',
      tags: [],
      status:
        matchedSavedQ.status === 'answered' || matchedSavedQ.status === 'archived'
          ? matchedSavedQ.status
          : 'open',
      isOneVoice: false,
      answerCount: matchedSavedAnswers.length,
      createdAt: matchedSavedQ.savedAt,
      updatedAt: matchedSavedQ.savedAt,
      closedAt: null,
      isOwner: false,
      isSaved: true,
      authorLabel: 'Anonymous Stranger',
    };
  } else if (!question && matchedSavedAnswers.length > 0) {
    const first = matchedSavedAnswers[0];
    question = {
      id: first.questionId,
      title: first.questionTitle,
      body: '',
      category: first.questionCategory,
      questionType: 'Perspective',
      tags: [],
      status: 'answered',
      isOneVoice: false,
      answerCount: matchedSavedAnswers.length,
      createdAt: first.savedAt,
      updatedAt: first.savedAt,
      closedAt: null,
      isOwner: false,
      isSaved: false,
      authorLabel: 'Anonymous Stranger',
    };
  }

  if (!question) return null;

  const answers: AnswerItem[] = matchedSavedAnswers.map((sa) => ({
    id: sa.answerId,
    questionId: sa.questionId,
    parentAnswerId: null,
    body: sa.body,
    answerType: sa.answerType,
    reactionCounts: {},
    userReactions: [],
    createdAt: sa.savedAt,
    updatedAt: sa.savedAt,
    isOwner: false,
    isSaved: true,
    authorLabel: 'Anonymous Stranger',
  }));

  return { question, answers };
}

export async function readOfflineFallback<T>(path: string): Promise<T | null> {
  const uid = activeUserId ?? readOfflineSession()?.id ?? null;
  const key = makeStorageKey(path, uid);
  if (key) {
    const exact = await readEntry<T>(key);
    if (exact) return exact.data;
  }

  // Synthesize explore/search results from previously loaded questions
  if (path === '/questions' || path.startsWith('/questions?')) {
    const fallback = await buildOfflineExploreFallback(path);
    if (fallback) return fallback as unknown as T;
  }

  // Synthesize question thread from cached question card or saved content
  const detailMatch = path.match(/^\/questions\/([^/?]+)$/);
  if (detailMatch) {
    const detail = await buildOfflineQuestionDetailFallback(detailMatch[1], uid);
    if (detail) return detail as unknown as T;
  }

  // Synthesize random perspective from cached home feed while offline
  if (path.startsWith('/wisdom/random')) {
    const home = await readEntry<{ wisdomFromStrangers?: PerspectiveItem[] }>('public:/home');
    const items = home?.data?.wisdomFromStrangers ?? [];
    if (items.length > 0) {
      const qs = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
      const exclude = new Set((qs.get('excludeIds') || '').split(',').filter(Boolean));
      const candidate = items.find((p) => !exclude.has(p.id)) ?? items[0];
      return { perspective: candidate } as unknown as T;
    }
  }

  return null;
}

export async function getOfflineCacheStats(): Promise<{
  cachedQuestionsCount: number;
  savedItemsCount: number;
  lastSyncedAt: number | null;
}> {
  const uid = activeUserId ?? readOfflineSession()?.id ?? null;
  const cards = await getAllCachedQuestionCards();
  let savedItemsCount = 0;
  let lastSyncedAt: number | null = null;

  if (uid) {
    const saved = await readEntry<SavedPayload>(`user:${uid}:/saved`);
    if (saved) {
      savedItemsCount =
        (saved.data.savedAnswers?.length ?? 0) +
        (saved.data.savedQuestions?.length ?? 0);
      lastSyncedAt = saved.updatedAt;
    }
  }

  const home = await readEntry('public:/home');
  if (home && (!lastSyncedAt || home.updatedAt > lastSyncedAt)) {
    lastSyncedAt = home.updatedAt;
  }

  return {
    cachedQuestionsCount: cards.length,
    savedItemsCount,
    lastSyncedAt,
  };
}
