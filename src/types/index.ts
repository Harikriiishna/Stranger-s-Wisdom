export interface NotificationSettings {
  answers: boolean;
  oneVoice: boolean;
  savedQuestions: boolean;
  drafts: boolean;
}

export interface PrivacySettings {
  keepActivityPrivate: boolean;
  allowAnonymousReplies: boolean;
  hiddenQuestionIds: string[];
  blockedQuestionIds: string[];
}

export interface UserProfile {
  id: string;
  email: string | null;
  authProvider: 'email' | 'google' | 'anonymous' | 'system';
  privateAlias: string;
  role: 'member' | 'moderator' | 'admin';
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  theme: 'dark' | 'light' | 'system';
  accountStatus: 'active' | 'suspended' | 'deleted';
  createdAt: string;
}

export interface QuestionCardItem {
  id: string;
  title: string;
  body: string;
  category: string;
  questionType: string;
  tags: string[];
  status: 'open' | 'answered' | 'archived' | 'deleted' | 'hidden';
  isOneVoice: boolean;
  oneVoiceStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  answerCount: number;
  topAnswerPreview?: string | null;
  topAnswerType?: string | null;
  isOwner: boolean;
  isSaved: boolean;
  authorLabel: string;
}

export interface AnswerItem {
  id: string;
  questionId: string;
  parentAnswerId: string | null;
  body: string;
  answerType: string;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  isSaved: boolean;
  reactionCounts: Record<string, number>;
  userReactions: string[];
  authorLabel: string;
  questionTitle?: string;
  questionCategory?: string;
}

export interface PerspectiveItem {
  id: string;
  questionId: string;
  questionTitle: string;
  questionCategory: string;
  body: string;
  answerType: string;
  createdAt: string;
  reactionCounts: Record<string, number>;
  userReactions: string[];
  isSaved: boolean;
  authorLabel: string;
}

export interface DraftItem {
  id: string;
  title: string;
  body: string;
  category: string;
  questionType: string;
  tags: string[];
  updatedAt: string;
}

export interface OneVoiceRequestItem {
  deliveryId: string;
  questionId: string;
  answerId: string | null;
  status: 'waiting' | 'answer_received' | 'delivered' | 'closed';
  deliveredAt: string | null;
  createdAt: string;
  questionTitle: string;
  questionCategory: string;
  answerBody: string | null;
  answerType: string | null;
}

export interface CollectionItem {
  id: string;
  name: string;
  description: string;
  coverKey: 'lantern' | 'horizon' | 'harbor' | 'sanctuary';
  createdAt: string;
  answerIds: string[];
}

export interface NotificationItem {
  id: string;
  notificationType: string;
  title: string;
  body: string;
  relatedQuestionId: string | null;
  relatedAnswerId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CrisisResources {
  notice: string;
  hotlines: { name: string; contact: string }[];
}
