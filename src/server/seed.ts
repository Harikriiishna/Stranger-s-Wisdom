import { count } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { answers, profiles, questions, reactions } from '../db/schema.ts';

let seedAttempted = false;

export async function ensureInitialWisdomSeeded(): Promise<void> {
  if (seedAttempted) return;
  try {
    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(questions);
    if (existingCount > 0) {
      seedAttempted = true;
      return;
    }

    const systemAuthors = [
      {
        id: 'system-contributor-1',
        privateAlias: 'Quiet Harbor 101',
        authProvider: 'system',
        role: 'member',
      },
      {
        id: 'system-contributor-2',
        privateAlias: 'Distant Lantern 204',
        authProvider: 'system',
        role: 'member',
      },
      {
        id: 'system-contributor-3',
        privateAlias: 'Patient Horizon 309',
        authProvider: 'system',
        role: 'member',
      },
    ];

    for (const author of systemAuthors) {
      await db
        .insert(profiles)
        .values(author)
        .onConflictDoNothing();
    }

    const now = Date.now();
    const hour = 3600 * 1000;

    const initialQuestions = [
      {
        id: 'q-seed-1',
        authorId: 'system-contributor-1',
        title:
          'I feel like everyone around me is moving forward, while I am stuck in the same place. How did you deal with this?',
        body: 'People my age are getting promotions, moving cities, or starting families. I know comparison does not help, yet every quiet evening the feeling catches up with me. If you went through a season where nothing seemed to move, what helped you survive it without losing hope?',
        category: 'Life',
        questionType: 'Has Anyone Experienced This?',
        tags: ['comparison', 'patience', 'season of life'],
        status: 'answered',
        createdAt: new Date(now - 6 * hour),
        updatedAt: new Date(now - 2 * hour),
      },
      {
        id: 'q-seed-2',
        authorId: 'system-contributor-2',
        title:
          'How do you know when you are holding onto a relationship out of love versus out of fear of starting over?',
        body: 'Nothing dramatic happened. There is no cruelty, only a growing quiet distance that neither of us knows how to bridge anymore. I keep wondering if staying is loyalty or just fear of the unknown.',
        category: 'Love and Relationships',
        questionType: 'I Need Perspective',
        tags: ['relationships', 'clarity', 'honesty'],
        status: 'answered',
        createdAt: new Date(now - 14 * hour),
        updatedAt: new Date(now - 5 * hour),
      },
      {
        id: 'q-seed-3',
        authorId: 'system-contributor-3',
        title:
          'What is one quiet truth about work and ambition you wish someone had told you in your twenties?',
        body: 'I am pouring almost every waking hour into building my career right now, and I am proud of the discipline, but I am starting to wonder what I might be sacrificing without noticing.',
        category: 'Career',
        questionType: 'Something I Learned',
        tags: ['career', 'balance', 'ambition'],
        status: 'answered',
        createdAt: new Date(now - 26 * hour),
        updatedAt: new Date(now - 10 * hour),
      },
      {
        id: 'q-seed-4',
        authorId: 'system-contributor-1',
        title:
          'I just moved to a city where I know nobody. How do you build genuine friendships as an adult without feeling desperate?',
        body: 'Everything feels polite and surface-level. People say "we should grab coffee sometime" and mean well, but weeks pass without real connection. How did you find your first true friends after starting over?',
        category: 'Friendship',
        questionType: 'I Need Advice',
        tags: ['new city', 'loneliness', 'friendship'],
        status: 'open',
        createdAt: new Date(now - 3 * hour),
        updatedAt: new Date(now - 3 * hour),
      },
      {
        id: 'q-seed-5',
        authorId: 'system-contributor-2',
        title:
          'How do you forgive yourself for a decision that cost you years of peace, even after you have learned the lesson?',
        body: 'I already apologized where I could and changed how I live. Everyone tells me to move on, yet I still replay the moment wishing I had known better back then.',
        category: 'Regrets',
        questionType: 'I Need Perspective',
        tags: ['self-forgiveness', 'regret', 'healing'],
        status: 'answered',
        createdAt: new Date(now - 36 * hour),
        updatedAt: new Date(now - 18 * hour),
      },
      {
        id: 'q-seed-6',
        authorId: 'system-contributor-3',
        title:
          'If you had to choose between a stable path you no longer care about and an uncertain path that scares you, what settled your mind?',
        body: 'The safe option pays the bills and keeps my family calm. The uncertain one feels like the only honest thing I have wanted in years.',
        category: 'Decisions',
        questionType: 'What Would You Do?',
        tags: ['crossroads', 'courage', 'uncertainty'],
        status: 'open',
        createdAt: new Date(now - 1 * hour),
        updatedAt: new Date(now - 1 * hour),
      },
    ];

    for (const q of initialQuestions) {
      await db.insert(questions).values(q).onConflictDoNothing();
    }

    const initialAnswers = [
      {
        id: 'a-seed-1',
        questionId: 'q-seed-1',
        authorId: 'system-contributor-2',
        body: 'In my late twenties I spent three years feeling invisible while everyone else seemed to accelerate. Looking back, those quiet years were not wasted—they were root growth underground. When you stop measuring your calendar against other people’s highlight reels, you notice small shifts in your character: steadier boundaries, clearer values, deeper patience. You do not need to have your entire life figured out tonight; you only need to care for the next honest step in front of you.',
        answerType: 'I Experienced This',
        qualityScore: 94,
        status: 'active',
        createdAt: new Date(now - 4 * hour),
        updatedAt: new Date(now - 4 * hour),
      },
      {
        id: 'a-seed-2',
        questionId: 'q-seed-1',
        authorId: 'system-contributor-3',
        body: 'One practical shift helped me: I stopped asking "Why am I behind?" and started asking "What is one thing I want to look back on six months from now and feel proud I practiced?" Shrinking the horizon from five years to six weeks gave me back my breath.',
        answerType: 'Another Perspective',
        qualityScore: 88,
        status: 'active',
        createdAt: new Date(now - 2 * hour),
        updatedAt: new Date(now - 2 * hour),
      },
      {
        id: 'a-seed-3',
        questionId: 'q-seed-2',
        authorId: 'system-contributor-1',
        body: 'Try imagining a quiet Tuesday afternoon three years from now. If nothing changes between you two—not worse, just exactly how today feels—does your chest soften with peace, or tighten with grief? Often our bodies answer what our minds try to rationalize.',
        answerType: 'Another Perspective',
        qualityScore: 92,
        status: 'active',
        createdAt: new Date(now - 5 * hour),
        updatedAt: new Date(now - 5 * hour),
      },
      {
        id: 'a-seed-4',
        questionId: 'q-seed-3',
        authorId: 'system-contributor-1',
        body: 'The people who love you do not remember your job titles; they remember whether you were reachable when they were hurting, and whether you stayed curious about life outside your calendar. Protect at least two evenings a week that belong to no metric.',
        answerType: 'What I Learned',
        qualityScore: 91,
        status: 'active',
        createdAt: new Date(now - 10 * hour),
        updatedAt: new Date(now - 10 * hour),
      },
      {
        id: 'a-seed-5',
        questionId: 'q-seed-5',
        authorId: 'system-contributor-3',
        body: 'You are judging your past self with wisdom you only earned by surviving the mistake. That version of you did not have the map you hold today. Self-forgiveness is not pretending the cost was small; it is refusing to keep punishing someone who has already learned.',
        answerType: 'My Advice',
        qualityScore: 96,
        status: 'active',
        createdAt: new Date(now - 18 * hour),
        updatedAt: new Date(now - 18 * hour),
      },
    ];

    for (const a of initialAnswers) {
      await db.insert(answers).values(a).onConflictDoNothing();
    }

    const initialReactions = [
      {
        id: 'r-seed-1',
        userId: 'system-contributor-1',
        answerId: 'a-seed-1',
        reactionType: 'this_helped',
      },
      {
        id: 'r-seed-2',
        userId: 'system-contributor-1',
        answerId: 'a-seed-3',
        reactionType: 'i_needed_this',
      },
      {
        id: 'r-seed-3',
        userId: 'system-contributor-2',
        answerId: 'a-seed-5',
        reactionType: 'thank_you',
      },
    ];

    for (const r of initialReactions) {
      await db.insert(reactions).values(r).onConflictDoNothing();
    }

    seedAttempted = true;
  } catch (error) {
    console.error('Initial wisdom seeding skipped or failed:', error);
  }
}
