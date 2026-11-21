import type {
  AnswerItem,
  CollectionItem,
  CrisisResources,
  DraftItem,
  NotificationItem,
  OneVoiceRequestItem,
  PerspectiveItem,
  QuestionCardItem,
  UserProfile,
} from '../types';

let memoryBearerToken: string | null = null;

export function setInMemoryToken(token: string | null) {
  memoryBearerToken = token;
}

export function getInMemoryToken(): string | null {
  return memoryBearerToken;
}

export class ApiError extends Error {
  status: number;
  piiDetected?: boolean;
  constructor(message: string, status: number, piiDetected?: boolean) {
    super(message);
    this.status = status;
    this.piiDetected = piiDetected;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'StrangersWisdom',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (memoryBearerToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${memoryBearerToken}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data?.error || 'Something went wrong. Your content is safe. Try again.',
      res.status,
      data?.piiDetected
    );
  }
  return data as T;
}

export const authApi = {
  session: () =>
    apiRequest<{
      authenticated: boolean;
      profile: UserProfile | null;
      token?: string;
    }>('/auth/session'),
  register: (payload: { email: string; password: string; privateAlias?: string }) =>
    apiRequest<{
      profile: UserProfile;
      token: string;
      recoveryCode: string;
    }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    apiRequest<{ profile: UserProfile; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  google: (idToken: string) =>
    apiRequest<{ profile: UserProfile; token: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  anonymous: () =>
    apiRequest<{ profile: UserProfile; token: string }>('/auth/anonymous', {
      method: 'POST',
    }),
  logout: () => apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    apiRequest<{ ok: boolean; message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  confirmPasswordReset: (payload: {
    email: string;
    recoveryCode: string;
    newPassword: string;
  }) =>
    apiRequest<{ ok: boolean; message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAccount: () =>
    apiRequest<{ ok: boolean }>('/auth/account', { method: 'DELETE' }),
};

export const profileApi = {
  get: () =>
    apiRequest<{
      profile: UserProfile;
      stats: { questionsAsked: number; answersGiven: number; savedCount: number };
    }>('/profile'),
  update: (payload: Partial<UserProfile>) =>
    apiRequest<{ profile: UserProfile }>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  exportData: () => apiRequest<Record<string, unknown>>('/profile/export'),
};

export const questionsApi = {
  home: () =>
    apiRequest<{
      featuredQuestion: QuestionCardItem | null;
      unansweredQuestions: QuestionCardItem[];
      wisdomFromStrangers: PerspectiveItem[];
      differentPerspective: PerspectiveItem | null;
      quietMoments: QuestionCardItem[];
    }>('/home'),
  explore: (params: {
    category?: string;
    filter?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.filter) qs.set('filter', params.filter);
    if (params.search) qs.set('search', params.search);
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return apiRequest<{
      questions: QuestionCardItem[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/questions?${qs.toString()}`);
  },
  getById: (id: string) =>
    apiRequest<{ question: QuestionCardItem; answers: AnswerItem[] }>(
      `/questions/${id}`
    ),
  create: (payload: {
    title: string;
    body: string;
    category: string;
    questionType: string;
    tags: string[];
    isOneVoice?: boolean;
    draftId?: string;
  }) =>
    apiRequest<{
      question: QuestionCardItem;
      crisisDetected: boolean;
      crisisResources: CrisisResources | null;
    }>('/questions', { method: 'POST', body: JSON.stringify(payload) }),
  update: (
    id: string,
    payload: {
      title?: string;
      body?: string;
      category?: string;
      questionType?: string;
      tags?: string[];
      status?: 'open' | 'answered' | 'archived';
    }
  ) =>
    apiRequest<{ question: QuestionCardItem }>(`/questions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`/questions/${id}`, { method: 'DELETE' }),
  hide: (id: string) =>
    apiRequest<{ ok: boolean }>(`/questions/${id}/hide`, { method: 'POST' }),
  save: (id: string) =>
    apiRequest<{ saved: boolean }>(`/saved/questions/${id}`, { method: 'POST' }),
  unsave: (id: string) =>
    apiRequest<{ saved: boolean }>(`/saved/questions/${id}`, {
      method: 'DELETE',
    }),
};

export const answersApi = {
  create: (
    questionId: string,
    payload: { body: string; answerType: string; parentAnswerId?: string }
  ) =>
    apiRequest<{
      answer: AnswerItem;
      crisisDetected: boolean;
      crisisResources: CrisisResources | null;
    }>(`/questions/${questionId}/answers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: { body?: string; answerType?: string }) =>
    apiRequest<{ answer: AnswerItem }>(`/answers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`/answers/${id}`, { method: 'DELETE' }),
  react: (id: string, reactionType: string) =>
    apiRequest<{
      active: boolean;
      reactionCounts: Record<string, number>;
      userReactions: string[];
    }>(`/answers/${id}/react`, {
      method: 'POST',
      body: JSON.stringify({ reactionType }),
    }),
  save: (id: string) =>
    apiRequest<{ saved: boolean }>(`/saved/answers/${id}`, { method: 'POST' }),
  unsave: (id: string) =>
    apiRequest<{ saved: boolean }>(`/saved/answers/${id}`, {
      method: 'DELETE',
    }),
  randomPerspective: (excludeIds: string[]) =>
    apiRequest<{ perspective: PerspectiveItem | null }>(
      `/wisdom/random?excludeIds=${encodeURIComponent(excludeIds.join(','))}`
    ),
};

export const myWisdomApi = {
  questions: () => apiRequest<{ questions: QuestionCardItem[] }>('/my/questions'),
  answers: () => apiRequest<{ answers: AnswerItem[] }>('/my/answers'),
  responsesReceived: () =>
    apiRequest<{ responses: PerspectiveItem[] }>('/my/responses-received'),
  oneVoice: () =>
    apiRequest<{
      myRequests: OneVoiceRequestItem[];
      waitingToAnswer: Array<{
        deliveryId: string;
        questionId: string;
        title: string;
        body: string;
        category: string;
        questionType: string;
        createdAt: string;
      }>;
    }>('/my/one-voice'),
  closeOneVoice: (deliveryId: string) =>
    apiRequest<{ ok: boolean }>(`/my/one-voice/${deliveryId}/close`, {
      method: 'POST',
    }),
  drafts: () => apiRequest<{ drafts: DraftItem[] }>('/drafts'),
  saveDraft: (payload: Partial<DraftItem>) =>
    apiRequest<{ draft: DraftItem }>('/drafts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteDraft: (id: string) =>
    apiRequest<{ ok: boolean }>(`/drafts/${id}`, { method: 'DELETE' }),
};

export const savedApi = {
  list: () =>
    apiRequest<{
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
    }>('/saved'),
  createCollection: (payload: {
    name: string;
    description: string;
    coverKey: string;
  }) =>
    apiRequest<{ collection: CollectionItem }>('/collections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteCollection: (id: string) =>
    apiRequest<{ ok: boolean }>(`/collections/${id}`, { method: 'DELETE' }),
  addAnswerToCollection: (collectionId: string, answerId: string) =>
    apiRequest<{ ok: boolean }>(
      `/collections/${collectionId}/answers/${answerId}`,
      { method: 'POST' }
    ),
  removeAnswerFromCollection: (collectionId: string, answerId: string) =>
    apiRequest<{ ok: boolean }>(
      `/collections/${collectionId}/answers/${answerId}`,
      { method: 'DELETE' }
    ),
};

export const notificationsApi = {
  list: () =>
    apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>(
      '/notifications'
    ),
  markRead: (id: string) =>
    apiRequest<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () =>
    apiRequest<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
  clear: () =>
    apiRequest<{ ok: boolean }>('/notifications', { method: 'DELETE' }),
};

export const moderationApi = {
  submitReport: (payload: {
    contentType: 'question' | 'answer';
    contentId: string;
    reason: string;
    description?: string;
  }) =>
    apiRequest<{
      ok: boolean;
      reportId: string;
      showCrisisResources: boolean;
      crisisResources: CrisisResources | null;
    }>('/reports', { method: 'POST', body: JSON.stringify(payload) }),
  status: () =>
    apiRequest<{ isModerator: boolean; canClaimInitialModerator: boolean }>(
      '/moderation/status'
    ),
  claimInitial: () =>
    apiRequest<{ profile: UserProfile }>('/moderation/claim', { method: 'POST' }),
  dashboard: () =>
    apiRequest<{
      stats: { pending: number; reviewed: number; flagged: number };
      reports: Array<{
        id: string;
        contentType: 'question' | 'answer';
        contentId: string;
        reason: string;
        description: string;
        status: string;
        createdAt: string;
        reviewedAt: string | null;
        contentPreview: string;
        contentStatus: string;
      }>;
      flaggedQuestions: Array<{
        id: string;
        title: string;
        category: string;
        status: string;
        createdAt: string;
      }>;
      history: Array<{
        id: string;
        contentType: string;
        contentId: string;
        action: string;
        reason: string;
        createdAt: string;
      }>;
    }>('/moderation/dashboard'),
  takeAction: (reportId: string, action: string, reason: string) =>
    apiRequest<{ ok: boolean }>(`/moderation/reports/${reportId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }),
};
