import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  ne,
  or,
  ilike,
  isNull,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  answerCollections,
  answers,
  collectionAnswers,
  moderationActions,
  notifications,
  oneVoiceDeliveries,
  passwordResets,
  profiles,
  questionDrafts,
  questions,
  reactions,
  reports,
  savedAnswers,
  savedQuestions,
} from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  clearSessionCookie,
  generatePrivateAlias,
  hashPassword,
  hashToken,
  isConfiguredModeratorEmail,
  optionalAuth,
  requireAuth,
  requireModerator,
  sanitizePrivateProfile,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  type AuthRequest,
} from './auth.ts';
import {
  ANSWER_TYPES,
  CRISIS_RESOURCES,
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
  REACTION_TYPES,
  REPORT_REASONS,
} from './constants.ts';
import {
  analyzeContentSafety,
  checkRateLimit,
  computeAnswerQualityScore,
  normalizeForDuplicateCheck,
} from './moderation.ts';
import { broadcastPublicEvent, sendUserEvent } from './realtime.ts';
import { ensureInitialWisdomSeeded } from './seed.ts';

const router = Router();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === '23505';
}

// ---------- AUTHENTICATION ----------

const registerSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128),
  privateAlias: z.string().trim().min(2).max(40).optional(),
});

router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Too many registration attempts. Please try again in ${limit.retryAfterSeconds}s.`,
      });
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
    }

    const email = parsed.data.email.toLowerCase();
    const [existing] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const id = crypto.randomUUID();
    const recoveryCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    const role = isConfiguredModeratorEmail(email) ? 'moderator' : 'member';

    const [created] = await db
      .insert(profiles)
      .values({
        id,
        email,
        passwordHash: hashPassword(parsed.data.password),
        authProvider: 'email',
        privateAlias: parsed.data.privateAlias || generatePrivateAlias(),
        role,
        theme: 'social-pulse',
        recoveryCodeHash: hashToken(recoveryCode),
      })
      .returning();

    const token = signSessionToken(created.id);
    setSessionCookie(res, token);

    return res.status(201).json({
      profile: sanitizePrivateProfile(created),
      token,
      recoveryCode,
    });
  } catch (err) {
    console.error('Register failed:', err);
    return res.status(500).json({ error: 'Unable to create account right now. Please try again.' });
  }
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`login:${ip}`, 20, 15 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Too many login attempts. Try again in ${limit.retryAfterSeconds}s.`,
      });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials.' });
    }

    const email = parsed.data.email.toLowerCase();
    const [found] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (!found || !found.passwordHash || !verifyPassword(parsed.data.password, found.passwordHash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    if (found.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'This account is currently suspended.' });
    }
    if (found.accountStatus === 'deleted') {
      return res.status(401).json({ error: 'This account has been deleted.' });
    }

    const token = signSessionToken(found.id);
    setSessionCookie(res, token);

    return res.json({
      profile: sanitizePrivateProfile(found),
      token,
    });
  } catch (err) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/auth/google', async (req: Request, res: Response) => {
  try {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
    if (!idToken) {
      return res.status(400).json({ error: 'Missing Google authentication token.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email ? decoded.email.toLowerCase() : null;
    const role = isConfiguredModeratorEmail(email) ? 'moderator' : 'member';

    const [existing] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, decoded.uid))
      .limit(1);

    let profile = existing;
    if (!profile) {
      const [created] = await db
        .insert(profiles)
        .values({
          id: decoded.uid,
          email,
          authProvider: 'google',
          privateAlias: generatePrivateAlias(),
          role,
          theme: 'social-pulse',
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { email, updatedAt: new Date() },
        })
        .returning();
      profile = created;
    }

    if (profile.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'This account is currently suspended.' });
    }
    if (profile.accountStatus === 'deleted') {
      return res.status(403).json({ error: 'This account was previously deleted.' });
    }

    const sessionToken = signSessionToken(profile.id);
    setSessionCookie(res, sessionToken);

    return res.json({
      profile: sanitizePrivateProfile(profile),
      token: sessionToken,
    });
  } catch (err) {
    console.error('Google auth failed:', err);
    return res.status(401).json({ error: 'Google sign-in could not be verified.' });
  }
});

router.post('/auth/anonymous', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`anon:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Anonymous session limit reached. Please try again in ${limit.retryAfterSeconds}s or sign in.`,
      });
    }

    const id = `anon-${crypto.randomUUID()}`;
    const [created] = await db
      .insert(profiles)
      .values({
        id,
        authProvider: 'anonymous',
        privateAlias: generatePrivateAlias(),
        role: 'member',
        theme: 'social-pulse',
      })
      .returning();

    const token = signSessionToken(created.id);
    setSessionCookie(res, token);

    return res.status(201).json({
      profile: sanitizePrivateProfile(created),
      token,
    });
  } catch (err) {
    console.error('Anonymous session failed:', err);
    return res.status(500).json({ error: 'Unable to start an anonymous session.' });
  }
});

router.get('/auth/session', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (req.suspended) {
    return res.json({ authenticated: false, profile: null, suspended: true });
  }
  if (!req.profile) {
    return res.json({ authenticated: false, profile: null });
  }
  const freshToken = signSessionToken(req.profile.id);
  return res.json({
    authenticated: true,
    profile: sanitizePrivateProfile(req.profile),
    token: freshToken,
  });
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

router.post('/auth/password-reset/request', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Please provide your email address.' });
    }

    const limit = checkRateLimit(`pwreset:${email}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ error: 'Too many password reset requests. Please wait.' });
    }

    const [found] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (found && found.authProvider === 'email') {
      const rawToken = crypto.randomBytes(16).toString('hex');
      await db.insert(passwordResets).values({
        userId: found.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
    }

    return res.json({
      ok: true,
      message:
        'If an email account exists, enter your recovery code from registration along with your new password to reset access.',
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    return res.status(500).json({ error: 'Unable to process password reset right now.' });
  }
});

const resetConfirmSchema = z.object({
  email: z.string().trim().email(),
  recoveryCode: z.string().trim().min(4),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
});

router.post('/auth/password-reset/confirm', async (req: Request, res: Response) => {
  try {
    const parsed = resetConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset details.' });
    }

    const email = parsed.data.email.toLowerCase();
    const limit = checkRateLimit(`pwconfirm:${email}:${getClientIp(req)}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Too many reset attempts. Please try again in ${limit.retryAfterSeconds}s.`,
      });
    }

    const [found] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (!found || found.authProvider !== 'email') {
      return res.status(400).json({ error: 'Invalid email or recovery code.' });
    }

    const providedHash = hashToken(parsed.data.recoveryCode.toUpperCase());
    const matchesRecovery = Boolean(found.recoveryCodeHash && found.recoveryCodeHash === providedHash);

    const [activeReset] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.userId, found.id),
          eq(passwordResets.tokenHash, hashToken(parsed.data.recoveryCode)),
          isNull(passwordResets.usedAt)
        )
      )
      .limit(1);

    const matchesToken = Boolean(activeReset && activeReset.expiresAt > new Date());

    if (!matchesRecovery && !matchesToken) {
      return res.status(400).json({ error: 'Invalid or expired recovery code.' });
    }

    const newRecoveryCode = crypto.randomBytes(6).toString('hex').toUpperCase();

    await db
      .update(profiles)
      .set({
        passwordHash: hashPassword(parsed.data.newPassword),
        recoveryCodeHash: hashToken(newRecoveryCode),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, found.id));

    if (activeReset) {
      await db
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(eq(passwordResets.id, activeReset.id));
    }

    return res.json({
      ok: true,
      message: 'Your password has been updated. Save your new recovery code below.',
      newRecoveryCode,
    });
  } catch (err) {
    console.error('Password reset confirm error:', err);
    return res.status(500).json({ error: 'Unable to reset password.' });
  }
});

router.post('/auth/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.authProvider !== 'email' || !profile.passwordHash) {
      return res.status(400).json({
        error: 'Password changes are only available for email/password accounts.',
      });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    if (!verifyPassword(currentPassword, profile.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await db
      .update(profiles)
      .set({
        passwordHash: hashPassword(newPassword),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profile.id));

    return res.json({ ok: true });
  } catch (err) {
    console.error('Change password failed:', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

router.delete('/auth/account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    await db.delete(profiles).where(eq(profiles.id, userId));
    clearSessionCookie(res);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete account failed:', err);
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// ---------- PRIVATE PROFILE & SETTINGS ----------

router.get('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const [{ value: questionsAsked }] = await db
      .select({ value: count() })
      .from(questions)
      .where(and(eq(questions.authorId, userId), ne(questions.status, 'deleted')));
    const [{ value: answersGiven }] = await db
      .select({ value: count() })
      .from(answers)
      .where(and(eq(answers.authorId, userId), eq(answers.status, 'active')));
    const [{ value: savedCount }] = await db
      .select({ value: count() })
      .from(savedAnswers)
      .where(eq(savedAnswers.userId, userId));

    return res.json({
      profile: sanitizePrivateProfile(req.profile!),
      stats: {
        questionsAsked,
        answersGiven,
        savedCount,
      },
    });
  } catch (err) {
    console.error('Profile fetch failed:', err);
    return res.status(500).json({ error: 'Unable to load your profile.' });
  }
});

const profileUpdateSchema = z.object({
  privateAlias: z.string().trim().min(2).max(40).optional(),
  theme: z
    .enum([
      'social-pulse',
      'social-daylight',
      'social-aurora',
      'social-sky',
      'dark',
      'light',
      'system',
      'liquid-glass',
      'frost-glass',
      'ocean-abyss',
      'nordic-slate',
      'obsidian-gold',
      'amber-dusk',
      'forest-mist',
      'velvet-violet',
      'rose-quartz',
      'parchment',
      'sage-morning',
      'terracotta-warm',
    ])
    .optional(),
  notificationSettings: z
    .object({
      answers: z.boolean(),
      oneVoice: z.boolean(),
      savedQuestions: z.boolean(),
      drafts: z.boolean(),
    })
    .optional(),
  privacySettings: z
    .object({
      keepActivityPrivate: z.boolean(),
      allowAnonymousReplies: z.boolean(),
      hiddenQuestionIds: z.array(z.string()).optional(),
      blockedQuestionIds: z.array(z.string()).optional(),
    })
    .optional(),
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid profile settings.' });
    }

    const current = req.profile!;
    const nextPrivacy = parsed.data.privacySettings
      ? {
          ...current.privacySettings,
          ...parsed.data.privacySettings,
          hiddenQuestionIds:
            parsed.data.privacySettings.hiddenQuestionIds ??
            current.privacySettings.hiddenQuestionIds,
          blockedQuestionIds:
            parsed.data.privacySettings.blockedQuestionIds ??
            current.privacySettings.blockedQuestionIds,
        }
      : current.privacySettings;

    const [updated] = await db
      .update(profiles)
      .set({
        privateAlias: parsed.data.privateAlias ?? current.privateAlias,
        theme: parsed.data.theme ?? current.theme,
        notificationSettings:
          parsed.data.notificationSettings ?? current.notificationSettings,
        privacySettings: nextPrivacy,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, current.id))
      .returning();

    sendUserEvent(updated.id, 'user:synced', { scope: 'profile' });
    return res.json({ profile: sanitizePrivateProfile(updated) });
  } catch (err) {
    console.error('Profile update failed:', err);
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

router.get('/profile/export', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const myQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.authorId, userId));
    const myAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.authorId, userId));
    const myDrafts = await db
      .select()
      .from(questionDrafts)
      .where(eq(questionDrafts.userId, userId));
    const myCollections = await db
      .select()
      .from(answerCollections)
      .where(eq(answerCollections.userId, userId));

    return res.json({
      exportedAt: new Date().toISOString(),
      account: sanitizePrivateProfile(req.profile!),
      questions: myQuestions.map(({ authorId: _a, ...rest }) => rest),
      answers: myAnswers.map(({ authorId: _a, ...rest }) => rest),
      drafts: myDrafts.map(({ userId: _u, ...rest }) => rest),
      collections: myCollections.map(({ userId: _u, ...rest }) => rest),
    });
  } catch (err) {
    console.error('Export failed:', err);
    return res.status(500).json({ error: 'Unable to export personal data.' });
  }
});

// ---------- HELPER: FORMAT PUBLIC QUESTIONS & ANSWERS ----------

const TRENDING_ENGAGEMENT_THRESHOLD = 6;

function computeQuestionEngagementScore(
  answerCount: number,
  reactionCount: number,
  saveCount: number
): number {
  return answerCount * 3 + reactionCount + saveCount * 2;
}

async function buildPublicQuestionCards(
  rawQuestions: (typeof questions.$inferSelect)[],
  viewerId?: string
) {
  if (rawQuestions.length === 0) return [];
  const qIds = rawQuestions.map((q) => q.id);

  const answerRows = await db
    .select({
      questionId: answers.questionId,
      id: answers.id,
      body: answers.body,
      answerType: answers.answerType,
      qualityScore: answers.qualityScore,
      createdAt: answers.createdAt,
    })
    .from(answers)
    .where(and(inArray(answers.questionId, qIds), eq(answers.status, 'active')));

  const answerToQuestion = new Map<string, string>();
  const ansIds: string[] = [];
  for (const a of answerRows) {
    answerToQuestion.set(a.id, a.questionId);
    ansIds.push(a.id);
  }

  const reactionCountByQ = new Map<string, number>();
  if (ansIds.length > 0) {
    const reactionRows = await db
      .select({ answerId: reactions.answerId })
      .from(reactions)
      .where(inArray(reactions.answerId, ansIds));
    for (const r of reactionRows) {
      const qId = answerToQuestion.get(r.answerId);
      if (qId) {
        reactionCountByQ.set(qId, (reactionCountByQ.get(qId) ?? 0) + 1);
      }
    }
  }

  const savedRows = await db
    .select({
      questionId: savedQuestions.questionId,
      userId: savedQuestions.userId,
    })
    .from(savedQuestions)
    .where(inArray(savedQuestions.questionId, qIds));

  const saveCountByQ = new Map<string, number>();
  const savedIds = new Set<string>();
  for (const s of savedRows) {
    saveCountByQ.set(s.questionId, (saveCountByQ.get(s.questionId) ?? 0) + 1);
    if (viewerId && s.userId === viewerId) {
      savedIds.add(s.questionId);
    }
  }

  const answersByQ = new Map<string, typeof answerRows>();
  for (const a of answerRows) {
    const arr = answersByQ.get(a.questionId) ?? [];
    arr.push(a);
    answersByQ.set(a.questionId, arr);
  }

  return rawQuestions.map((q) => {
    const qAnswers = answersByQ.get(q.id) ?? [];
    const sorted = [...qAnswers].sort((a, b) => b.qualityScore - a.qualityScore);
    const reactionCount = reactionCountByQ.get(q.id) ?? 0;
    const saveCount = saveCountByQ.get(q.id) ?? 0;
    const engagementScore = computeQuestionEngagementScore(
      qAnswers.length,
      reactionCount,
      saveCount
    );
    return {
      id: q.id,
      title: q.title,
      body: q.body,
      category: q.category,
      questionType: q.questionType,
      tags: q.tags,
      status: q.status,
      isOneVoice: q.isOneVoice,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      closedAt: q.closedAt,
      answerCount: qAnswers.length,
      topAnswerPreview: sorted[0]?.body ?? null,
      topAnswerType: sorted[0]?.answerType ?? null,
      isOwner: Boolean(viewerId && q.authorId === viewerId),
      isSaved: savedIds.has(q.id),
      authorLabel: 'Asked anonymously',
      engagementScore,
      isTrending: engagementScore >= TRENDING_ENGAGEMENT_THRESHOLD,
    };
  });
}

async function getReactionSummaryForAnswers(answerIds: string[], viewerId?: string) {
  if (answerIds.length === 0) {
    return new Map<
      string,
      { counts: Record<string, number>; userReactions: string[] }
    >();
  }

  const rows = await db
    .select()
    .from(reactions)
    .where(inArray(reactions.answerId, answerIds));

  const map = new Map<
    string,
    { counts: Record<string, number>; userReactions: string[] }
  >();

  for (const id of answerIds) {
    map.set(id, { counts: {}, userReactions: [] });
  }

  for (const r of rows) {
    const entry = map.get(r.answerId)!;
    entry.counts[r.reactionType] = (entry.counts[r.reactionType] || 0) + 1;
    if (viewerId && r.userId === viewerId) {
      entry.userReactions.push(r.reactionType);
    }
  }

  return map;
}

// ---------- HOME & DISCOVERY ----------

router.get('/home', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitialWisdomSeeded();
    const viewerId = req.profile?.id;
    const hiddenIds = new Set(req.profile?.privacySettings?.hiddenQuestionIds ?? []);

    const activeQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          inArray(questions.status, ['open', 'answered']),
          eq(questions.isOneVoice, false)
        )
      )
      .orderBy(desc(questions.createdAt))
      .limit(50);

    const visibleQuestions = activeQuestions.filter((q) => !hiddenIds.has(q.id));
    const cards = await buildPublicQuestionCards(visibleQuestions, viewerId);

    const featuredQuestion =
      cards.find((c) => c.isTrending) ??
      cards.find((c) => c.answerCount > 0) ??
      cards[0] ??
      null;

    const unansweredQuestions = cards
      .filter((c) => c.answerCount === 0 && c.status === 'open')
      .slice(0, 4);

    const quietMoments = cards
      .filter((c) => c.answerCount > 0 && c.id !== featuredQuestion?.id)
      .slice(0, 4);

    const visibleQIds = visibleQuestions.map((q) => q.id);
    let wisdomFromStrangers: Array<{
      id: string;
      questionId: string;
      questionTitle: string;
      questionCategory: string;
      body: string;
      answerType: string;
      createdAt: Date;
      reactionCounts: Record<string, number>;
      userReactions: string[];
      isSaved: boolean;
    }> = [];
    let differentPerspective: (typeof wisdomFromStrangers)[number] | null = null;

    if (visibleQIds.length > 0) {
      const qTitleMap = new Map(visibleQuestions.map((q) => [q.id, q]));
      const activeAns = await db
        .select()
        .from(answers)
        .where(
          and(
            inArray(answers.questionId, visibleQIds),
            eq(answers.status, 'active'),
            isNull(answers.parentAnswerId)
          )
        )
        .orderBy(desc(answers.qualityScore), desc(answers.createdAt))
        .limit(12);

      const ansIds = activeAns.map((a) => a.id);
      const reactionMap = await getReactionSummaryForAnswers(ansIds, viewerId);
      const savedAnsSet = new Set<string>();

      if (viewerId && ansIds.length > 0) {
        const saved = await db
          .select({ answerId: savedAnswers.answerId })
          .from(savedAnswers)
          .where(
            and(
              eq(savedAnswers.userId, viewerId),
              inArray(savedAnswers.answerId, ansIds)
            )
          );
        for (const s of saved) savedAnsSet.add(s.answerId);
      }

      const formatted = activeAns.map((a) => {
        const q = qTitleMap.get(a.questionId);
        const rx = reactionMap.get(a.id) ?? { counts: {}, userReactions: [] };
        return {
          id: a.id,
          questionId: a.questionId,
          questionTitle: q?.title ?? '',
          questionCategory: q?.category ?? 'Life',
          body: a.body,
          answerType: a.answerType,
          createdAt: a.createdAt,
          reactionCounts: rx.counts,
          userReactions: rx.userReactions,
          isSaved: savedAnsSet.has(a.id),
        };
      });

      differentPerspective =
        formatted.find((a) => a.answerType === 'Another Perspective') ??
        formatted[1] ??
        null;

      wisdomFromStrangers = formatted
        .filter((a) => a.id !== differentPerspective?.id)
        .slice(0, 4);
    }

    return res.json({
      featuredQuestion,
      unansweredQuestions,
      wisdomFromStrangers,
      differentPerspective,
      quietMoments,
    });
  } catch (err) {
    console.error('Home fetch failed:', err);
    return res.status(500).json({ error: 'Unable to load home feed.' });
  }
});

router.get('/questions', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitialWisdomSeeded();
    const viewerId = req.profile?.id;
    const hiddenIds = new Set(req.profile?.privacySettings?.hiddenQuestionIds ?? []);

    const category = typeof req.query.category === 'string' ? req.query.category : 'All';
    const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12));

    const conditions = [
      inArray(questions.status, ['open', 'answered']),
      eq(questions.isOneVoice, false),
    ];

    if (category && category !== 'All') {
      if (category === 'Love') {
        conditions.push(eq(questions.category, 'Love and Relationships'));
      } else if (category === 'Growth') {
        conditions.push(eq(questions.category, 'Personal Growth'));
      } else {
        conditions.push(eq(questions.category, category));
      }
    }

    if (filter === 'advice') {
      conditions.push(eq(questions.questionType, 'I Need Advice'));
    } else if (filter === 'experiences') {
      conditions.push(
        or(
          eq(questions.category, 'Experiences'),
          eq(questions.questionType, 'Has Anyone Experienced This?')
        )!
      );
    } else if (filter === 'relationships') {
      conditions.push(eq(questions.category, 'Love and Relationships'));
    } else if (filter === 'career') {
      conditions.push(eq(questions.category, 'Career'));
    } else if (filter === 'growth') {
      conditions.push(eq(questions.category, 'Personal Growth'));
    } else if (filter === 'decisions') {
      conditions.push(eq(questions.category, 'Decisions'));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(questions.title, pattern),
          ilike(questions.body, pattern),
          ilike(questions.category, pattern),
          sql`${questions.tags}::text ILIKE ${pattern}`
        )!
      );
    }

    const raw = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(desc(questions.createdAt))
      .limit(120);

    let cards = await buildPublicQuestionCards(
      raw.filter((q) => !hiddenIds.has(q.id)),
      viewerId
    );

    if (filter === 'unanswered') {
      cards = cards.filter((c) => c.answerCount === 0);
    } else if (filter === 'recent') {
      cards = [...cards].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    if (sort === 'needs_answer') {
      cards = [...cards].sort((a, b) => a.answerCount - b.answerCount);
    } else if (sort === 'random') {
      cards = [...cards].sort(() => Math.random() - 0.5);
    } else if (sort === 'relevant') {
      cards = [...cards].sort(
        (a, b) =>
          (a.answerCount > 0 ? 0 : 1) - (b.answerCount > 0 ? 0 : 1) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    const total = cards.length;
    const offset = (page - 1) * limit;
    const paginated = cards.slice(offset, offset + limit);

    return res.json({
      questions: paginated,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('Explore questions failed:', err);
    return res.status(500).json({ error: 'Unable to fetch questions right now.' });
  }
});

// ---------- QUESTION DETAILS & CRUD ----------

router.get('/questions/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const viewerId = req.profile?.id;

    const [q] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);

    if (!q || q.status === 'deleted' || q.status === 'hidden') {
      return res.status(404).json({ error: 'Question not found.' });
    }

    const isOwner = Boolean(viewerId && q.authorId === viewerId);

    const activeAnswers = await db
      .select()
      .from(answers)
      .where(and(eq(answers.questionId, id), eq(answers.status, 'active')))
      .orderBy(desc(answers.qualityScore), desc(answers.createdAt));

    const ansIds = activeAnswers.map((a) => a.id);
    const reactionMap = await getReactionSummaryForAnswers(ansIds, viewerId);

    let reactionCount = 0;
    for (const rx of reactionMap.values()) {
      for (const count of Object.values(rx.counts)) {
        reactionCount += count;
      }
    }

    const savedQuestionRows = await db
      .select({ userId: savedQuestions.userId })
      .from(savedQuestions)
      .where(eq(savedQuestions.questionId, id));
    const questionSaveCount = savedQuestionRows.length;
    const isQuestionSaved = Boolean(
      viewerId && savedQuestionRows.some((row) => row.userId === viewerId)
    );

    const savedAnsSet = new Set<string>();
    if (viewerId && ansIds.length > 0) {
      const sa = await db
        .select({ answerId: savedAnswers.answerId })
        .from(savedAnswers)
        .where(
          and(
            eq(savedAnswers.userId, viewerId),
            inArray(savedAnswers.answerId, ansIds)
          )
        );
      for (const row of sa) savedAnsSet.add(row.answerId);
    }

    let oneVoiceStatus: string | null = null;
    if (q.isOneVoice) {
      const [ov] = await db
        .select()
        .from(oneVoiceDeliveries)
        .where(eq(oneVoiceDeliveries.questionId, id))
        .limit(1);
      oneVoiceStatus = ov?.status ?? 'waiting';
    }

    const formattedAnswers = activeAnswers.map((a) => {
      const rx = reactionMap.get(a.id) ?? { counts: {}, userReactions: [] };
      return {
        id: a.id,
        questionId: a.questionId,
        parentAnswerId: a.parentAnswerId,
        body: a.body,
        answerType: a.answerType,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        isOwner: Boolean(viewerId && a.authorId === viewerId),
        isSaved: savedAnsSet.has(a.id),
        reactionCounts: rx.counts,
        userReactions: rx.userReactions,
        authorLabel: 'Anonymous Stranger',
      };
    });

    const engagementScore = computeQuestionEngagementScore(
      formattedAnswers.length,
      reactionCount,
      questionSaveCount
    );

    return res.json({
      question: {
        id: q.id,
        title: q.title,
        body: q.body,
        category: q.category,
        questionType: q.questionType,
        tags: q.tags,
        status: q.status,
        isOneVoice: q.isOneVoice,
        oneVoiceStatus,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
        closedAt: q.closedAt,
        isOwner,
        isSaved: isQuestionSaved,
        answerCount: formattedAnswers.length,
        authorLabel: 'Asked anonymously',
        engagementScore,
        isTrending: engagementScore >= TRENDING_ENGAGEMENT_THRESHOLD,
      },
      answers: formattedAnswers,
    });
  } catch (err) {
    console.error('Question details failed:', err);
    return res.status(500).json({ error: 'Unable to load question details.' });
  }
});

const createQuestionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, 'Your question should be at least 10 characters.')
    .max(220, 'Please keep the question title under 220 characters.'),
  body: z.string().trim().max(3000, 'Context must be under 3,000 characters.').default(''),
  category: z.enum(QUESTION_CATEGORIES),
  questionType: z.enum(QUESTION_TYPES).default('I Need Perspective'),
  tags: z.array(z.string().trim().min(1).max(24)).max(5).default([]),
  isOneVoice: z.boolean().default(false),
  draftId: z.string().optional(),
});

router.post('/questions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const maxPerHour = profile.authProvider === 'anonymous' ? 2 : 8;
    const limit = checkRateLimit(`q:${profile.id}`, maxPerHour, 60 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Please pause before posting again. You can ask another question in ${limit.retryAfterSeconds}s.`,
      });
    }

    const parsed = createQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid question fields.' });
    }

    const safety = analyzeContentSafety(parsed.data.title, parsed.data.body);
    if (!safety.allowed) {
      return res.status(400).json({
        error: safety.reason,
        piiDetected: safety.piiDetected,
      });
    }

    const normalizedTitle = normalizeForDuplicateCheck(parsed.data.title);
    const recentUserQs = await db
      .select({ title: questions.title })
      .from(questions)
      .where(and(eq(questions.authorId, profile.id), ne(questions.status, 'deleted')))
      .orderBy(desc(questions.createdAt))
      .limit(10);

    if (recentUserQs.some((q) => normalizeForDuplicateCheck(q.title) === normalizedTitle)) {
      return res.status(409).json({
        error: 'You already asked a very similar question recently.',
      });
    }

    const questionId = crypto.randomUUID();
    const [created] = await db
      .insert(questions)
      .values({
        id: questionId,
        authorId: profile.id,
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category,
        questionType: parsed.data.questionType,
        tags: parsed.data.tags,
        status: 'open',
        isOneVoice: parsed.data.isOneVoice,
        isFlagged: safety.flagged,
      })
      .returning();

    if (parsed.data.isOneVoice) {
      await db.insert(oneVoiceDeliveries).values({
        id: crypto.randomUUID(),
        questionId: created.id,
        recipientId: profile.id,
        status: 'waiting',
      });
    }

    if (parsed.data.draftId) {
      await db
        .delete(questionDrafts)
        .where(
          and(
            eq(questionDrafts.id, parsed.data.draftId),
            eq(questionDrafts.userId, profile.id)
          )
        );
    }

    broadcastPublicEvent('question:created', {
      questionId: created.id,
      category: created.category,
    });

    return res.status(201).json({
      question: {
        id: created.id,
        title: created.title,
        body: created.body,
        category: created.category,
        questionType: created.questionType,
        tags: created.tags,
        status: created.status,
        isOneVoice: created.isOneVoice,
        createdAt: created.createdAt,
        isOwner: true,
      },
      crisisDetected: safety.crisisDetected,
      crisisResources: safety.crisisDetected ? CRISIS_RESOURCES : null,
    });
  } catch (err) {
    console.error('Create question failed:', err);
    return res.status(500).json({ error: 'Unable to publish question. Please try again.' });
  }
});

const updateQuestionSchema = z.object({
  title: z.string().trim().min(10).max(220).optional(),
  body: z.string().trim().max(3000).optional(),
  category: z.enum(QUESTION_CATEGORIES).optional(),
  questionType: z.enum(QUESTION_TYPES).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(5).optional(),
  status: z.enum(['open', 'answered', 'archived']).optional(),
});

router.patch('/questions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.profile!.id;

    const [existing] = await db
      .select()
      .from(questions)
      .where(and(eq(questions.id, id), eq(questions.authorId, userId)))
      .limit(1);

    if (!existing || existing.status === 'deleted') {
      return res.status(404).json({ error: 'Question not found or not owned by you.' });
    }

    const parsed = updateQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update.' });
    }

    const nextTitle = parsed.data.title ?? existing.title;
    const nextBody = parsed.data.body ?? existing.body;
    const safety = analyzeContentSafety(nextTitle, nextBody);
    if (!safety.allowed) {
      return res.status(400).json({ error: safety.reason });
    }

    const nextStatus = parsed.data.status ?? existing.status;
    const [updated] = await db
      .update(questions)
      .set({
        title: nextTitle,
        body: nextBody,
        category: parsed.data.category ?? existing.category,
        questionType: parsed.data.questionType ?? existing.questionType,
        tags: parsed.data.tags ?? existing.tags,
        status: nextStatus,
        closedAt: nextStatus === 'archived' ? new Date() : nextStatus === 'open' ? null : existing.closedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(questions.id, id), eq(questions.authorId, userId)))
      .returning();

    broadcastPublicEvent('question:updated', { questionId: updated.id });

    return res.json({
      question: {
        id: updated.id,
        title: updated.title,
        body: updated.body,
        category: updated.category,
        questionType: updated.questionType,
        tags: updated.tags,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    console.error('Update question failed:', err);
    return res.status(500).json({ error: 'Failed to update question.' });
  }
});

router.delete('/questions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.profile!.id;

    const [updated] = await db
      .update(questions)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(and(eq(questions.id, id), eq(questions.authorId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Question not found or not owned by you.' });
    }

    broadcastPublicEvent('question:deleted', { questionId: id });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete question failed:', err);
    return res.status(500).json({ error: 'Failed to delete question.' });
  }
});

router.post('/questions/:id/hide', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const current = req.profile!;
    const currentHidden = current.privacySettings.hiddenQuestionIds ?? [];
    if (!currentHidden.includes(id)) {
      const nextPrivacy = {
        ...current.privacySettings,
        hiddenQuestionIds: [...currentHidden, id],
      };
      await db
        .update(profiles)
        .set({ privacySettings: nextPrivacy, updatedAt: new Date() })
        .where(eq(profiles.id, current.id));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Hide question failed:', err);
    return res.status(500).json({ error: 'Unable to hide question.' });
  }
});

// ---------- ANSWERS & REACTIONS ----------

const createAnswerSchema = z.object({
  body: z
    .string()
    .trim()
    .min(20, 'Please share a thoughtful response of at least 20 characters.')
    .max(5000, 'Please keep answers under 5,000 characters.'),
  answerType: z.enum(ANSWER_TYPES).default('My Advice'),
  parentAnswerId: z.string().optional(),
});

router.post('/questions/:id/answers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const questionId = String(req.params.id);

    const maxPerHour = profile.authProvider === 'anonymous' ? 5 : 20;
    const limit = checkRateLimit(`ans:${profile.id}`, maxPerHour, 60 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({
        error: `Please wait ${limit.retryAfterSeconds}s before posting another answer.`,
      });
    }

    const [q] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!q || q.status === 'deleted' || q.status === 'hidden') {
      return res.status(404).json({ error: 'Question not found.' });
    }
    if (q.status === 'archived') {
      return res.status(400).json({ error: 'This question has been archived and is no longer accepting answers.' });
    }

    const parsed = createAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid answer.' });
    }

    const safety = analyzeContentSafety('', parsed.data.body);
    if (!safety.allowed) {
      return res.status(400).json({
        error: safety.reason,
        piiDetected: safety.piiDetected,
      });
    }

    if (q.isOneVoice && q.authorId === profile.id) {
      return res.status(403).json({
        error: 'You cannot answer your own One Voice request.',
      });
    }

    const qualityScore = computeAnswerQualityScore(
      q.title,
      q.body,
      parsed.data.body,
      parsed.data.answerType
    );

    const answerId = crypto.randomUUID();
    const created = await db.transaction(async (tx) => {
      if (q.isOneVoice) {
        const [claimed] = await tx
          .update(oneVoiceDeliveries)
          .set({
            status: 'answer_received',
            senderId: profile.id,
          })
          .where(
            and(
              eq(oneVoiceDeliveries.questionId, q.id),
              eq(oneVoiceDeliveries.status, 'waiting')
            )
          )
          .returning();

        if (!claimed) {
          throw new Error('ONE_VOICE_ALREADY_CLAIMED');
        }
      }

      const [inserted] = await tx
        .insert(answers)
        .values({
          id: answerId,
          questionId: q.id,
          authorId: profile.id,
          parentAnswerId: parsed.data.parentAnswerId ?? null,
          body: parsed.data.body,
          answerType: parsed.data.answerType,
          qualityScore,
          status: 'active',
        })
        .returning();

      if (q.status === 'open') {
        await tx
          .update(questions)
          .set({ status: 'answered', updatedAt: new Date() })
          .where(eq(questions.id, q.id));
      }

      if (q.isOneVoice) {
        await tx
          .update(oneVoiceDeliveries)
          .set({
            answerId: inserted.id,
            status: 'delivered',
            deliveredAt: new Date(),
          })
          .where(eq(oneVoiceDeliveries.questionId, q.id));
      }

      return inserted;
    });

    if (q.isOneVoice) {
      sendUserEvent(q.authorId, 'one_voice:updated', {
        questionId: q.id,
        status: 'delivered',
      });
    }

    if (q.authorId !== profile.id) {
      const [authorProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, q.authorId))
        .limit(1);

      const wantsAnswerNotif = q.isOneVoice
        ? authorProfile?.notificationSettings?.oneVoice ?? true
        : authorProfile?.notificationSettings?.answers ?? true;

      if (wantsAnswerNotif) {
        const notifId = crypto.randomUUID();
        const notifTitle = q.isOneVoice
          ? 'Your One Voice response was delivered'
          : 'Someone answered your question';
        const notifBody = `A stranger shared "${parsed.data.answerType}" on "${q.title.slice(0, 70)}${q.title.length > 70 ? '...' : ''}"`;

        await db.insert(notifications).values({
          id: notifId,
          userId: q.authorId,
          notificationType: q.isOneVoice ? 'one_voice_delivered' : 'question_answered',
          title: notifTitle,
          body: notifBody,
          relatedQuestionId: q.id,
          relatedAnswerId: created.id,
        });

        sendUserEvent(q.authorId, 'notification:new', {
          id: notifId,
          title: notifTitle,
          questionId: q.id,
        });
      }
    }

    broadcastPublicEvent('answer:created', {
      questionId: q.id,
      answerId: created.id,
    });

    return res.status(201).json({
      answer: {
        id: created.id,
        questionId: created.questionId,
        parentAnswerId: created.parentAnswerId,
        body: created.body,
        answerType: created.answerType,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        isOwner: true,
        isSaved: false,
        reactionCounts: {},
        userReactions: [],
        authorLabel: 'Anonymous Stranger',
      },
      crisisDetected: safety.crisisDetected,
      crisisResources: safety.crisisDetected ? CRISIS_RESOURCES : null,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'ONE_VOICE_ALREADY_CLAIMED') {
      return res.status(409).json({
        error: 'This One Voice question has already received its single response.',
      });
    }
    console.error('Create answer failed:', err);
    return res.status(500).json({ error: 'Unable to post your answer. Please try again.' });
  }
});

router.patch('/answers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.profile!.id;

    const [existing] = await db
      .select()
      .from(answers)
      .where(and(eq(answers.id, id), eq(answers.authorId, userId)))
      .limit(1);

    if (!existing || existing.status !== 'active') {
      return res.status(404).json({ error: 'Answer not found or not owned by you.' });
    }

    const parsed = createAnswerSchema.partial().safeParse(req.body);
    if (!parsed.success || (!parsed.data.body && !parsed.data.answerType)) {
      return res.status(400).json({ error: 'Invalid answer update.' });
    }

    const nextBody = parsed.data.body ?? existing.body;
    const safety = analyzeContentSafety('', nextBody);
    if (!safety.allowed) {
      return res.status(400).json({ error: safety.reason });
    }

    const [updated] = await db
      .update(answers)
      .set({
        body: nextBody,
        answerType: parsed.data.answerType ?? existing.answerType,
        updatedAt: new Date(),
      })
      .where(and(eq(answers.id, id), eq(answers.authorId, userId)))
      .returning();

    broadcastPublicEvent('answer:updated', {
      questionId: updated.questionId,
      answerId: updated.id,
    });

    return res.json({ answer: updated });
  } catch (err) {
    console.error('Update answer failed:', err);
    return res.status(500).json({ error: 'Failed to update answer.' });
  }
});

router.delete('/answers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.profile!.id;

    const [deleted] = await db
      .update(answers)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(answers.id, id), eq(answers.authorId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Answer not found or not owned by you.' });
    }

    broadcastPublicEvent('answer:deleted', {
      questionId: deleted.questionId,
      answerId: deleted.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete answer failed:', err);
    return res.status(500).json({ error: 'Failed to delete answer.' });
  }
});

const allowedReactionIds = REACTION_TYPES.map((r) => r.id);

router.post('/answers/:id/react', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const answerId = String(req.params.id);
    const reactionType = String(req.body?.reactionType || '');

    if (!allowedReactionIds.includes(reactionType as (typeof allowedReactionIds)[number])) {
      return res.status(400).json({ error: 'Invalid reaction type.' });
    }

    const limit = checkRateLimit(`react:${userId}`, 40, 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ error: 'Please slow down reactions.' });
    }

    const [ans] = await db
      .select()
      .from(answers)
      .where(and(eq(answers.id, answerId), eq(answers.status, 'active')))
      .limit(1);

    if (!ans) {
      return res.status(404).json({ error: 'Answer not found.' });
    }

    const [existing] = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.userId, userId),
          eq(reactions.answerId, answerId),
          eq(reactions.reactionType, reactionType)
        )
      )
      .limit(1);

    let active = false;
    if (existing) {
      await db.delete(reactions).where(eq(reactions.id, existing.id));
      active = false;
    } else {
      try {
        await db.insert(reactions).values({
          id: crypto.randomUUID(),
          userId,
          answerId,
          reactionType,
        });
        active = true;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        active = true;
      }
    }

    const summary = await getReactionSummaryForAnswers([answerId], userId);
    const rx = summary.get(answerId) ?? { counts: {}, userReactions: [] };

    broadcastPublicEvent('reaction:updated', {
      questionId: ans.questionId,
      answerId,
      counts: rx.counts,
    });

    return res.json({
      active,
      reactionCounts: rx.counts,
      userReactions: rx.userReactions,
    });
  } catch (err) {
    console.error('Reaction failed:', err);
    return res.status(500).json({ error: 'Unable to save reaction.' });
  }
});

// ---------- RANDOM WISDOM ("GIVE ME A PERSPECTIVE") ----------

router.get('/wisdom/random', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureInitialWisdomSeeded();
    const viewerId = req.profile?.id;
    const excludeParam = typeof req.query.excludeIds === 'string' ? req.query.excludeIds : '';
    const excludeIds = new Set(
      excludeParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );

    const activeAns = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        body: answers.body,
        answerType: answers.answerType,
        qualityScore: answers.qualityScore,
        createdAt: answers.createdAt,
        qTitle: questions.title,
        qCategory: questions.category,
        qStatus: questions.status,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(
        and(
          eq(answers.status, 'active'),
          inArray(questions.status, ['open', 'answered']),
          eq(questions.isOneVoice, false),
          isNull(answers.parentAnswerId)
        )
      )
      .orderBy(desc(answers.qualityScore))
      .limit(40);

    if (activeAns.length === 0) {
      return res.json({ perspective: null });
    }

    let pool = activeAns.filter((a) => !excludeIds.has(a.id));
    if (pool.length === 0) {
      pool = activeAns;
    }

    const picked = pool[crypto.randomInt(pool.length)];
    const rxMap = await getReactionSummaryForAnswers([picked.id], viewerId);
    const rx = rxMap.get(picked.id) ?? { counts: {}, userReactions: [] };

    let isSaved = false;
    if (viewerId) {
      const [sa] = await db
        .select()
        .from(savedAnswers)
        .where(
          and(
            eq(savedAnswers.userId, viewerId),
            eq(savedAnswers.answerId, picked.id)
          )
        )
        .limit(1);
      isSaved = Boolean(sa);
    }

    return res.json({
      perspective: {
        id: picked.id,
        questionId: picked.questionId,
        questionTitle: picked.qTitle,
        questionCategory: picked.qCategory,
        body: picked.body,
        answerType: picked.answerType,
        createdAt: picked.createdAt,
        reactionCounts: rx.counts,
        userReactions: rx.userReactions,
        isSaved,
        authorLabel: 'Anonymous Stranger',
      },
    });
  } catch (err) {
    console.error('Random wisdom failed:', err);
    return res.status(500).json({ error: 'Unable to gather a perspective right now.' });
  }
});

// ---------- MY WISDOM & ONE VOICE & DRAFTS ----------

router.get('/my/questions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const rows = await db
      .select()
      .from(questions)
      .where(and(eq(questions.authorId, userId), ne(questions.status, 'deleted')))
      .orderBy(desc(questions.createdAt));
    const cards = await buildPublicQuestionCards(rows, userId);
    return res.json({ questions: cards });
  } catch (err) {
    console.error('My questions failed:', err);
    return res.status(500).json({ error: 'Unable to load your questions.' });
  }
});

router.get('/my/answers', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const rows = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        body: answers.body,
        answerType: answers.answerType,
        createdAt: answers.createdAt,
        updatedAt: answers.updatedAt,
        questionTitle: questions.title,
        questionCategory: questions.category,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(and(eq(answers.authorId, userId), eq(answers.status, 'active')))
      .orderBy(desc(answers.createdAt));

    const rxMap = await getReactionSummaryForAnswers(
      rows.map((r) => r.id),
      userId
    );

    return res.json({
      answers: rows.map((r) => ({
        ...r,
        reactionCounts: rxMap.get(r.id)?.counts ?? {},
      })),
    });
  } catch (err) {
    console.error('My answers failed:', err);
    return res.status(500).json({ error: 'Unable to load your answers.' });
  }
});

router.get('/my/responses-received', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const myQs = await db
      .select({ id: questions.id, title: questions.title, category: questions.category })
      .from(questions)
      .where(and(eq(questions.authorId, userId), ne(questions.status, 'deleted')));

    if (myQs.length === 0) return res.json({ responses: [] });
    const qMap = new Map(myQs.map((q) => [q.id, q]));

    const ansRows = await db
      .select()
      .from(answers)
      .where(
        and(
          inArray(answers.questionId, Array.from(qMap.keys())),
          eq(answers.status, 'active'),
          ne(answers.authorId, userId)
        )
      )
      .orderBy(desc(answers.createdAt))
      .limit(50);

    const rxMap = await getReactionSummaryForAnswers(
      ansRows.map((a) => a.id),
      userId
    );

    return res.json({
      responses: ansRows.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        questionTitle: qMap.get(a.questionId)?.title ?? '',
        questionCategory: qMap.get(a.questionId)?.category ?? 'Life',
        body: a.body,
        answerType: a.answerType,
        createdAt: a.createdAt,
        reactionCounts: rxMap.get(a.id)?.counts ?? {},
        userReactions: rxMap.get(a.id)?.userReactions ?? [],
      })),
    });
  } catch (err) {
    console.error('Responses received failed:', err);
    return res.status(500).json({ error: 'Unable to load responses received.' });
  }
});

router.get('/my/one-voice', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;

    const myRequests = await db
      .select({
        deliveryId: oneVoiceDeliveries.id,
        questionId: oneVoiceDeliveries.questionId,
        answerId: oneVoiceDeliveries.answerId,
        status: oneVoiceDeliveries.status,
        deliveredAt: oneVoiceDeliveries.deliveredAt,
        createdAt: oneVoiceDeliveries.createdAt,
        questionTitle: questions.title,
        questionCategory: questions.category,
      })
      .from(oneVoiceDeliveries)
      .innerJoin(questions, eq(oneVoiceDeliveries.questionId, questions.id))
      .where(eq(oneVoiceDeliveries.recipientId, userId))
      .orderBy(desc(oneVoiceDeliveries.createdAt));

    const ansIds = myRequests
      .map((r) => r.answerId)
      .filter((id): id is string => Boolean(id));
    const deliveredAnswers =
      ansIds.length > 0
        ? await db.select().from(answers).where(inArray(answers.id, ansIds))
        : [];
    const ansMap = new Map(deliveredAnswers.map((a) => [a.id, a]));

    const waitingToAnswer = await db
      .select({
        deliveryId: oneVoiceDeliveries.id,
        questionId: questions.id,
        title: questions.title,
        body: questions.body,
        category: questions.category,
        questionType: questions.questionType,
        createdAt: questions.createdAt,
      })
      .from(oneVoiceDeliveries)
      .innerJoin(questions, eq(oneVoiceDeliveries.questionId, questions.id))
      .where(
        and(
          eq(oneVoiceDeliveries.status, 'waiting'),
          ne(oneVoiceDeliveries.recipientId, userId),
          eq(questions.status, 'open')
        )
      )
      .orderBy(desc(questions.createdAt))
      .limit(12);

    return res.json({
      myRequests: myRequests.map((r) => ({
        ...r,
        answerBody: r.answerId ? ansMap.get(r.answerId)?.body ?? null : null,
        answerType: r.answerId ? ansMap.get(r.answerId)?.answerType ?? null : null,
      })),
      waitingToAnswer,
    });
  } catch (err) {
    console.error('One Voice fetch failed:', err);
    return res.status(500).json({ error: 'Unable to load One Voice spaces.' });
  }
});

router.post('/my/one-voice/:deliveryId/close', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const deliveryId = String(req.params.deliveryId);

    const [updated] = await db
      .update(oneVoiceDeliveries)
      .set({ status: 'closed' })
      .where(
        and(
          eq(oneVoiceDeliveries.id, deliveryId),
          eq(oneVoiceDeliveries.recipientId, userId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'One Voice delivery not found.' });
    }

    await db
      .update(questions)
      .set({ status: 'archived', closedAt: new Date() })
      .where(eq(questions.id, updated.questionId));

    return res.json({ ok: true });
  } catch (err) {
    console.error('Close One Voice failed:', err);
    return res.status(500).json({ error: 'Unable to close One Voice thread.' });
  }
});

// ---------- DRAFTS ----------

router.get('/drafts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(questionDrafts)
      .where(eq(questionDrafts.userId, req.profile!.id))
      .orderBy(desc(questionDrafts.updatedAt));
    return res.json({ drafts: rows });
  } catch (err) {
    console.error('Fetch drafts failed:', err);
    return res.status(500).json({ error: 'Unable to load drafts.' });
  }
});

router.post('/drafts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const requestedId = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : null;
    const title = String(req.body?.title || '').slice(0, 220);
    const body = String(req.body?.body || '').slice(0, 3000);
    const category = QUESTION_CATEGORIES.includes(req.body?.category)
      ? req.body.category
      : 'Life';
    const questionType = QUESTION_TYPES.includes(req.body?.questionType)
      ? req.body.questionType
      : 'I Need Perspective';
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map(String).slice(0, 5)
      : [];

    if (requestedId) {
      const [existing] = await db
        .select()
        .from(questionDrafts)
        .where(eq(questionDrafts.id, requestedId))
        .limit(1);

      if (existing && existing.userId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to edit this draft.' });
      }

      if (existing) {
        const [updated] = await db
          .update(questionDrafts)
          .set({
            title,
            body,
            category,
            questionType,
            tags,
            updatedAt: new Date(),
          })
          .where(and(eq(questionDrafts.id, requestedId), eq(questionDrafts.userId, userId)))
          .returning();

        sendUserEvent(userId, 'user:synced', { scope: 'drafts' });
        return res.status(200).json({ draft: updated });
      }
    }

    const [created] = await db
      .insert(questionDrafts)
      .values({
        id: crypto.randomUUID(),
        userId,
        title,
        body,
        category,
        questionType,
        tags,
        updatedAt: new Date(),
      })
      .returning();

    sendUserEvent(userId, 'user:synced', { scope: 'drafts' });
    return res.status(201).json({ draft: created });
  } catch (err) {
    console.error('Save draft failed:', err);
    return res.status(500).json({ error: 'Unable to save draft.' });
  }
});

router.delete('/drafts/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const userId = req.profile!.id;
    await db
      .delete(questionDrafts)
      .where(and(eq(questionDrafts.id, id), eq(questionDrafts.userId, userId)));
    sendUserEvent(userId, 'user:synced', { scope: 'drafts' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete draft failed:', err);
    return res.status(500).json({ error: 'Unable to delete draft.' });
  }
});

// ---------- SAVED WISDOM & COLLECTIONS ----------

router.get('/saved', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;

    const savedAnsRows = await db
      .select({
        savedId: savedAnswers.id,
        savedAt: savedAnswers.createdAt,
        answerId: answers.id,
        body: answers.body,
        answerType: answers.answerType,
        questionId: questions.id,
        questionTitle: questions.title,
        questionCategory: questions.category,
      })
      .from(savedAnswers)
      .innerJoin(answers, eq(savedAnswers.answerId, answers.id))
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(and(eq(savedAnswers.userId, userId), eq(answers.status, 'active')))
      .orderBy(desc(savedAnswers.createdAt));

    const savedQRows = await db
      .select({
        savedId: savedQuestions.id,
        savedAt: savedQuestions.createdAt,
        questionId: questions.id,
        title: questions.title,
        body: questions.body,
        category: questions.category,
        status: questions.status,
      })
      .from(savedQuestions)
      .innerJoin(questions, eq(savedQuestions.questionId, questions.id))
      .where(and(eq(savedQuestions.userId, userId), ne(questions.status, 'deleted')))
      .orderBy(desc(savedQuestions.createdAt));

    const collections = await db
      .select()
      .from(answerCollections)
      .where(eq(answerCollections.userId, userId))
      .orderBy(desc(answerCollections.createdAt));

    const colIds = collections.map((c) => c.id);
    const colLinks =
      colIds.length > 0
        ? await db
            .select()
            .from(collectionAnswers)
            .where(inArray(collectionAnswers.collectionId, colIds))
        : [];

    const linksByCol = new Map<string, string[]>();
    for (const l of colLinks) {
      const arr = linksByCol.get(l.collectionId) ?? [];
      arr.push(l.answerId);
      linksByCol.set(l.collectionId, arr);
    }

    return res.json({
      savedAnswers: savedAnsRows,
      savedQuestions: savedQRows,
      collections: collections.map((c) => ({
        ...c,
        answerIds: linksByCol.get(c.id) ?? [],
      })),
    });
  } catch (err) {
    console.error('Saved wisdom fetch failed:', err);
    return res.status(500).json({ error: 'Unable to load saved wisdom.' });
  }
});

router.post('/saved/questions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const questionId = String(req.params.id);
    const [q] = await db
      .select({ id: questions.id, status: questions.status })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!q || q.status === 'deleted' || q.status === 'hidden') {
      return res.status(404).json({ error: 'Question not found.' });
    }
    await db
      .insert(savedQuestions)
      .values({ id: crypto.randomUUID(), userId, questionId })
      .onConflictDoNothing();
    sendUserEvent(userId, 'user:synced', { scope: 'saved' });
    return res.json({ saved: true });
  } catch (err) {
    console.error('Save question failed:', err);
    return res.status(500).json({ error: 'Unable to save question.' });
  }
});

router.delete('/saved/questions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const questionId = String(req.params.id);
    await db
      .delete(savedQuestions)
      .where(
        and(
          eq(savedQuestions.userId, userId),
          eq(savedQuestions.questionId, questionId)
        )
      );
    sendUserEvent(userId, 'user:synced', { scope: 'saved' });
    return res.json({ saved: false });
  } catch (err) {
    console.error('Unsave question failed:', err);
    return res.status(500).json({ error: 'Unable to remove saved question.' });
  }
});

router.post('/saved/answers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const answerId = String(req.params.id);
    const [a] = await db
      .select({ id: answers.id, status: answers.status })
      .from(answers)
      .where(eq(answers.id, answerId))
      .limit(1);
    if (!a || a.status !== 'active') {
      return res.status(404).json({ error: 'Answer not found.' });
    }
    await db
      .insert(savedAnswers)
      .values({ id: crypto.randomUUID(), userId, answerId })
      .onConflictDoNothing();
    sendUserEvent(userId, 'user:synced', { scope: 'saved' });
    return res.json({ saved: true });
  } catch (err) {
    console.error('Save answer failed:', err);
    return res.status(500).json({ error: 'Unable to save answer.' });
  }
});

router.delete('/saved/answers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const answerId = String(req.params.id);
    await db
      .delete(savedAnswers)
      .where(
        and(
          eq(savedAnswers.userId, userId),
          eq(savedAnswers.answerId, answerId)
        )
      );
    sendUserEvent(userId, 'user:synced', { scope: 'saved' });
    return res.json({ saved: false });
  } catch (err) {
    console.error('Unsave answer failed:', err);
    return res.status(500).json({ error: 'Unable to remove saved answer.' });
  }
});

const createCollectionSchema = z.object({
  name: z.string().trim().min(2, 'Collection name is required.').max(60),
  description: z.string().trim().max(240).default(''),
  coverKey: z.enum(['lantern', 'horizon', 'harbor', 'sanctuary']).default('lantern'),
});

router.post('/collections', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createCollectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid collection.' });
    }
    const [created] = await db
      .insert(answerCollections)
      .values({
        id: crypto.randomUUID(),
        userId: req.profile!.id,
        name: parsed.data.name,
        description: parsed.data.description,
        coverKey: parsed.data.coverKey,
      })
      .returning();

    sendUserEvent(req.profile!.id, 'user:synced', { scope: 'saved' });
    return res.status(201).json({ collection: { ...created, answerIds: [] } });
  } catch (err) {
    console.error('Create collection failed:', err);
    return res.status(500).json({ error: 'Unable to create collection.' });
  }
});

router.delete('/collections/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    await db
      .delete(answerCollections)
      .where(and(eq(answerCollections.id, id), eq(answerCollections.userId, req.profile!.id)));
    sendUserEvent(req.profile!.id, 'user:synced', { scope: 'saved' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete collection failed:', err);
    return res.status(500).json({ error: 'Unable to delete collection.' });
  }
});

router.post('/collections/:id/answers/:answerId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const answerId = String(req.params.answerId);
    const userId = req.profile!.id;

    const [col] = await db
      .select()
      .from(answerCollections)
      .where(and(eq(answerCollections.id, id), eq(answerCollections.userId, userId)))
      .limit(1);
    if (!col) {
      return res.status(404).json({ error: 'Collection not found.' });
    }

    const [ans] = await db
      .select({ id: answers.id, status: answers.status })
      .from(answers)
      .where(eq(answers.id, answerId))
      .limit(1);
    if (!ans || ans.status !== 'active') {
      return res.status(404).json({ error: 'Answer not found.' });
    }

    await db
      .insert(savedAnswers)
      .values({ id: crypto.randomUUID(), userId, answerId })
      .onConflictDoNothing();

    await db
      .insert(collectionAnswers)
      .values({ id: crypto.randomUUID(), collectionId: id, answerId })
      .onConflictDoNothing();

    sendUserEvent(userId, 'user:synced', { scope: 'saved' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Add to collection failed:', err);
    return res.status(500).json({ error: 'Unable to add wisdom to collection.' });
  }
});

router.delete('/collections/:id/answers/:answerId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const answerId = String(req.params.answerId);
    const [col] = await db
      .select()
      .from(answerCollections)
      .where(and(eq(answerCollections.id, id), eq(answerCollections.userId, req.profile!.id)))
      .limit(1);
    if (!col) {
      return res.status(404).json({ error: 'Collection not found.' });
    }
    await db
      .delete(collectionAnswers)
      .where(
        and(
          eq(collectionAnswers.collectionId, id),
          eq(collectionAnswers.answerId, answerId)
        )
      );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Remove from collection failed:', err);
    return res.status(500).json({ error: 'Unable to remove item from collection.' });
  }
});

// ---------- NOTIFICATIONS ----------

router.get('/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.profile!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return res.json({
      notifications: rows,
      unreadCount: rows.filter((n) => !n.readAt).length,
    });
  } catch (err) {
    console.error('Fetch notifications failed:', err);
    return res.status(500).json({ error: 'Unable to load notifications.' });
  }
});

router.post('/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.profile!.id)));
    return res.json({ ok: true });
  } catch (err) {
    console.error('Mark notification read failed:', err);
    return res.status(500).json({ error: 'Unable to mark notification as read.' });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, req.profile!.id), isNull(notifications.readAt)));
    return res.json({ ok: true });
  } catch (err) {
    console.error('Read all notifications failed:', err);
    return res.status(500).json({ error: 'Unable to update notifications.' });
  }
});

router.delete('/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, req.profile!.id));
    return res.json({ ok: true });
  } catch (err) {
    console.error('Clear notifications failed:', err);
    return res.status(500).json({ error: 'Unable to clear notifications.' });
  }
});

// ---------- SAFETY REPORTING & MODERATION ----------

const reportSchema = z.object({
  contentType: z.enum(['question', 'answer']),
  contentId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  description: z.string().trim().max(1000).default(''),
});

router.post('/reports', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.profile!.id;
    const limit = checkRateLimit(`report:${userId}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ error: 'Report rate limit reached. Please wait.' });
    }

    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report.' });
    }

    if (parsed.data.contentId !== 'general-safety-report') {
      const [existingReport] = await db
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            eq(reports.reporterId, userId),
            eq(reports.contentType, parsed.data.contentType),
            eq(reports.contentId, parsed.data.contentId),
            eq(reports.status, 'pending')
          )
        )
        .limit(1);

      if (existingReport) {
        return res.status(409).json({
          error: 'You have already submitted a report for this item. Moderators will review it shortly.',
        });
      }
    }

    const [created] = await db
      .insert(reports)
      .values({
        id: crypto.randomUUID(),
        reporterId: userId,
        contentType: parsed.data.contentType,
        contentId: parsed.data.contentId,
        reason: parsed.data.reason,
        description: parsed.data.description,
        status: 'pending',
      })
      .returning();

    if (parsed.data.contentType === 'question' && parsed.data.contentId !== 'general-safety-report') {
      await db
        .update(questions)
        .set({ isFlagged: true })
        .where(eq(questions.id, parsed.data.contentId));
    } else if (
      parsed.data.contentType === 'answer' &&
      parsed.data.reason === 'Self-harm concerns'
    ) {
      const [ansRow] = await db
        .select({ questionId: answers.questionId })
        .from(answers)
        .where(eq(answers.id, parsed.data.contentId))
        .limit(1);
      if (ansRow) {
        await db
          .update(questions)
          .set({ isFlagged: true })
          .where(eq(questions.id, ansRow.questionId));
      }
    }

    return res.status(201).json({
      ok: true,
      reportId: created.id,
      showCrisisResources: parsed.data.reason === 'Self-harm concerns',
      crisisResources:
        parsed.data.reason === 'Self-harm concerns' ? CRISIS_RESOURCES : null,
    });
  } catch (err) {
    console.error('Submit report failed:', err);
    return res.status(500).json({ error: 'Unable to submit report.' });
  }
});

router.get('/moderation/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [{ value: modCount }] = await db
      .select({ value: count() })
      .from(profiles)
      .where(or(eq(profiles.role, 'moderator'), eq(profiles.role, 'admin')));

    return res.json({
      isModerator:
        req.profile!.role === 'moderator' || req.profile!.role === 'admin',
      canClaimInitialModerator:
        modCount === 0 && req.profile!.authProvider !== 'anonymous',
    });
  } catch (err) {
    console.error('Moderation status failed:', err);
    return res.status(500).json({ error: 'Unable to check moderation status.' });
  }
});

router.post('/moderation/claim', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.profile!.authProvider === 'anonymous') {
      return res.status(403).json({
        error: 'Moderator role requires a registered or Google account.',
      });
    }

    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(729401)`);

      const [{ value: modCount }] = await tx
        .select({ value: count() })
        .from(profiles)
        .where(or(eq(profiles.role, 'moderator'), eq(profiles.role, 'admin')));

      if (modCount > 0) {
        return null;
      }

      const [promoted] = await tx
        .update(profiles)
        .set({ role: 'moderator', updatedAt: new Date() })
        .where(eq(profiles.id, req.profile!.id))
        .returning();

      return promoted;
    });

    if (!updated) {
      return res.status(403).json({
        error: 'Moderator access has already been claimed.',
      });
    }

    return res.json({ profile: sanitizePrivateProfile(updated) });
  } catch (err) {
    console.error('Moderation claim failed:', err);
    return res.status(500).json({ error: 'Unable to claim moderator role.' });
  }
});

router.get('/moderation/dashboard', requireModerator, async (_req: AuthRequest, res: Response) => {
  try {
    const allReports = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(100);

    const qIds = allReports
      .filter((r) => r.contentType === 'question')
      .map((r) => r.contentId);
    const aIds = allReports
      .filter((r) => r.contentType === 'answer')
      .map((r) => r.contentId);

    const reportedQs =
      qIds.length > 0
        ? await db.select().from(questions).where(inArray(questions.id, qIds))
        : [];
    const reportedAs =
      aIds.length > 0
        ? await db.select().from(answers).where(inArray(answers.id, aIds))
        : [];

    const flaggedQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.isFlagged, true))
      .orderBy(desc(questions.createdAt))
      .limit(30);

    const history = await db
      .select()
      .from(moderationActions)
      .orderBy(desc(moderationActions.createdAt))
      .limit(40);

    const qMap = new Map(reportedQs.map((q) => [q.id, q]));
    const aMap = new Map(reportedAs.map((a) => [a.id, a]));

    const pendingCount = allReports.filter((r) => r.status === 'pending').length;
    const reviewedCount = allReports.filter((r) => r.status !== 'pending').length;

    return res.json({
      stats: {
        pending: pendingCount,
        reviewed: reviewedCount,
        flagged: flaggedQuestions.length,
      },
      reports: allReports.map((r) => {
        const q = r.contentType === 'question' ? qMap.get(r.contentId) : undefined;
        const a = r.contentType === 'answer' ? aMap.get(r.contentId) : undefined;
        return {
          id: r.id,
          contentType: r.contentType,
          contentId: r.contentId,
          reason: r.reason,
          description: r.description,
          status: r.status,
          createdAt: r.createdAt,
          reviewedAt: r.reviewedAt,
          contentPreview: q
            ? q.title
            : a
              ? a.body.slice(0, 180)
              : '[Content removed]',
          contentStatus: q?.status ?? a?.status ?? 'unknown',
          targetAuthorId: q?.authorId ?? a?.authorId ?? null,
        };
      }),
      flaggedQuestions: flaggedQuestions.map((q) => ({
        id: q.id,
        title: q.title,
        category: q.category,
        status: q.status,
        createdAt: q.createdAt,
      })),
      history,
    });
  } catch (err) {
    console.error('Moderation dashboard failed:', err);
    return res.status(500).json({ error: 'Unable to load moderation dashboard.' });
  }
});

const moderationActionSchema = z.object({
  action: z.enum(['hide', 'remove', 'restore', 'suspend_account', 'dismiss_report']),
  reason: z.string().trim().max(500).default(''),
});

router.post(
  '/moderation/reports/:id/action',
  requireModerator,
  async (req: AuthRequest, res: Response) => {
    try {
      const reportId = String(req.params.id);
      const parsed = moderationActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid moderation action.' });
      }

      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      if (!report) {
        return res.status(404).json({ error: 'Report not found.' });
      }

      const { action, reason } = parsed.data;
      let targetAuthorId: string | null = null;

      if (report.contentType === 'question') {
        const [q] = await db
          .select()
          .from(questions)
          .where(eq(questions.id, report.contentId))
          .limit(1);
        targetAuthorId = q?.authorId ?? null;

        if (action === 'hide') {
          await db
            .update(questions)
            .set({ status: 'hidden', updatedAt: new Date() })
            .where(eq(questions.id, report.contentId));
        } else if (action === 'remove') {
          await db
            .update(questions)
            .set({ status: 'deleted', updatedAt: new Date() })
            .where(eq(questions.id, report.contentId));
        } else if (action === 'restore') {
          await db
            .update(questions)
            .set({ status: 'open', isFlagged: false, updatedAt: new Date() })
            .where(eq(questions.id, report.contentId));
        }
      } else if (report.contentType === 'answer') {
        const [a] = await db
          .select()
          .from(answers)
          .where(eq(answers.id, report.contentId))
          .limit(1);
        targetAuthorId = a?.authorId ?? null;

        if (action === 'hide') {
          await db
            .update(answers)
            .set({ status: 'hidden', updatedAt: new Date() })
            .where(eq(answers.id, report.contentId));
        } else if (action === 'remove') {
          await db
            .update(answers)
            .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(answers.id, report.contentId));
        } else if (action === 'restore') {
          await db
            .update(answers)
            .set({ status: 'active', deletedAt: null, updatedAt: new Date() })
            .where(eq(answers.id, report.contentId));
        }
      }

      if (action === 'suspend_account' && targetAuthorId) {
        await db
          .update(profiles)
          .set({ accountStatus: 'suspended', updatedAt: new Date() })
          .where(eq(profiles.id, targetAuthorId));
      }

      await db
        .update(reports)
        .set({
          status: action === 'dismiss_report' ? 'dismissed' : 'resolved',
          reviewedAt: new Date(),
        })
        .where(eq(reports.id, reportId));

      await db.insert(moderationActions).values({
        id: crypto.randomUUID(),
        moderatorId: req.profile!.id,
        contentType: action === 'suspend_account' ? 'account' : report.contentType,
        contentId:
          action === 'suspend_account' && targetAuthorId
            ? targetAuthorId
            : report.contentId,
        action,
        reason,
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error('Moderation action failed:', err);
      return res.status(500).json({ error: 'Unable to apply moderation action.' });
    }
  }
);

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

export { sql };
export default router;
