import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

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

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  authProvider: text('auth_provider').notNull().default('email'),
  privateAlias: text('private_alias').notNull(),
  role: text('role').notNull().default('member'),
  notificationSettings: jsonb('notification_settings')
    .$type<NotificationSettings>()
    .notNull()
    .default({
      answers: true,
      oneVoice: true,
      savedQuestions: true,
      drafts: true,
    }),
  privacySettings: jsonb('privacy_settings')
    .$type<PrivacySettings>()
    .notNull()
    .default({
      keepActivityPrivate: true,
      allowAnonymousReplies: true,
      hiddenQuestionIds: [],
      blockedQuestionIds: [],
    }),
  theme: text('theme').notNull().default('dark'),
  accountStatus: text('account_status').notNull().default('active'),
  recoveryCodeHash: text('recovery_code_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const questions = pgTable(
  'questions',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    category: text('category').notNull(),
    questionType: text('question_type').notNull().default('I Need Perspective'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('open'),
    isOneVoice: boolean('is_one_voice').notNull().default(false),
    isFlagged: boolean('is_flagged').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
  },
  (table) => [
    index('idx_questions_status_created').on(table.status, table.createdAt),
    index('idx_questions_category').on(table.category),
    index('idx_questions_author').on(table.authorId),
  ]
);

export const answers = pgTable(
  'answers',
  {
    id: text('id').primaryKey(),
    questionId: text('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: text('author_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    parentAnswerId: text('parent_answer_id'),
    body: text('body').notNull(),
    answerType: text('answer_type').notNull().default('My Advice'),
    qualityScore: integer('quality_score').notNull().default(50),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_answers_question').on(table.questionId),
    index('idx_answers_author').on(table.authorId),
  ]
);

export const reactions = pgTable(
  'reactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    answerId: text('answer_id')
      .references(() => answers.id, { onDelete: 'cascade' })
      .notNull(),
    reactionType: text('reaction_type').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_reactions_user_answer_type').on(
      table.userId,
      table.answerId,
      table.reactionType
    ),
    index('idx_reactions_answer').on(table.answerId),
  ]
);

export const savedQuestions = pgTable(
  'saved_questions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    questionId: text('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_saved_questions_user_question').on(
      table.userId,
      table.questionId
    ),
  ]
);

export const savedAnswers = pgTable(
  'saved_answers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    answerId: text('answer_id')
      .references(() => answers.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_saved_answers_user_answer').on(table.userId, table.answerId),
  ]
);

export const answerCollections = pgTable('answer_collections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  coverKey: text('cover_key').notNull().default('lantern'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const collectionAnswers = pgTable(
  'collection_answers',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .references(() => answerCollections.id, { onDelete: 'cascade' })
      .notNull(),
    answerId: text('answer_id')
      .references(() => answers.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_collection_answers_pair').on(
      table.collectionId,
      table.answerId
    ),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    notificationType: text('notification_type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    relatedQuestionId: text('related_question_id'),
    relatedAnswerId: text('related_answer_id'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_notifications_user').on(table.userId, table.createdAt)]
);

export const reports = pgTable(
  'reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    contentType: text('content_type').notNull(),
    contentId: text('content_id').notNull(),
    reason: text('reason').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at'),
  },
  (table) => [index('idx_reports_status').on(table.status, table.createdAt)]
);

export const moderationActions = pgTable('moderation_actions', {
  id: text('id').primaryKey(),
  moderatorId: text('moderator_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  contentType: text('content_type').notNull(),
  contentId: text('content_id').notNull(),
  action: text('action').notNull(),
  reason: text('reason').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const questionDrafts = pgTable(
  'question_drafts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    category: text('category').notNull().default('Life'),
    questionType: text('question_type').notNull().default('I Need Perspective'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_drafts_user').on(table.userId)]
);

export const oneVoiceDeliveries = pgTable(
  'one_voice_deliveries',
  {
    id: text('id').primaryKey(),
    questionId: text('question_id')
      .references(() => questions.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    answerId: text('answer_id').references(() => answers.id, {
      onDelete: 'set null',
    }),
    senderId: text('sender_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    recipientId: text('recipient_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull().default('waiting'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_one_voice_recipient').on(table.recipientId)]
);

export const profilesRelations = relations(profiles, ({ many }) => ({
  questions: many(questions),
  answers: many(answers),
  notifications: many(notifications),
  collections: many(answerCollections),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  author: one(profiles, {
    fields: [questions.authorId],
    references: [profiles.id],
  }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one, many }) => ({
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
  author: one(profiles, {
    fields: [answers.authorId],
    references: [profiles.id],
  }),
  reactions: many(reactions),
}));
