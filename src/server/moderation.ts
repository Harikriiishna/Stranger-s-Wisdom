import crypto from 'crypto';

interface RateBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucket>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateBuckets.get(key) ?? { timestamps: [] };
  const valid = existing.timestamps.filter((ts) => now - ts < windowMs);

  if (valid.length >= maxRequests) {
    const oldest = valid[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - oldest)) / 1000)
    );
    rateBuckets.set(key, { timestamps: valid });
    return { allowed: false, retryAfterSeconds };
  }

  valid.push(now);
  rateBuckets.set(key, { timestamps: valid });

  if (rateBuckets.size > 5000) {
    for (const [k, bucket] of rateBuckets.entries()) {
      const active = bucket.timestamps.filter((ts) => now - ts < 3600000);
      if (active.length === 0) {
        rateBuckets.delete(k);
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export interface SafetyAnalysisResult {
  allowed: boolean;
  reason?: string;
  flagged: boolean;
  flagReason?: string;
  crisisDetected: boolean;
  piiDetected: boolean;
}

const SELF_HARM_PATTERNS = [
  /\b(kill myself|end my life|suicide|want to die|hurt myself|self[- ]?harm|cutting myself|overdose)\b/i,
];

const SEVERE_ABUSE_PATTERNS = [
  /\b(kys|kill yourself|go die|i will kill you|bomb threat|doxx)\b/i,
];

const SPAM_PATTERNS = [
  /(https?:\/\/\S+){3,}/i,
  /\b(buy now|crypto giveaway|whatsapp me|telegram me|click here for free|earn \$[0-9]+ daily)\b/i,
  /(.)\1{10,}/,
];

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\bpassword\s*[:=]\s*\S+/i,
];

export function analyzeContentSafety(
  title: string,
  body: string
): SafetyAnalysisResult {
  const combined = `${title}\n${body}`.trim();

  for (const pattern of SEVERE_ABUSE_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        allowed: false,
        reason:
          'This message contains harmful or threatening language and cannot be published.',
        flagged: true,
        flagReason: 'Harassment or threats detected',
        crisisDetected: false,
        piiDetected: false,
      };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        allowed: false,
        reason:
          'This submission looks like automated spam or promotional content.',
        flagged: true,
        flagReason: 'Spam pattern detected',
        crisisDetected: false,
        piiDetected: false,
      };
    }
  }

  let piiDetected = false;
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(combined)) {
      piiDetected = true;
      break;
    }
  }

  if (piiDetected) {
    return {
      allowed: false,
      reason:
        'Please avoid sharing phone numbers, email addresses, passwords, or personally identifying information.',
      flagged: false,
      crisisDetected: false,
      piiDetected: true,
    };
  }

  let crisisDetected = false;
  for (const pattern of SELF_HARM_PATTERNS) {
    if (pattern.test(combined)) {
      crisisDetected = true;
      break;
    }
  }

  return {
    allowed: true,
    flagged: crisisDetected,
    flagReason: crisisDetected ? 'Self-harm concern flagged for care review' : undefined,
    crisisDetected,
    piiDetected: false,
  };
}

export function computeAnswerQualityScore(
  questionTitle: string,
  questionBody: string,
  answerBody: string,
  answerType: string
): number {
  const words = answerBody
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const wordCount = words.length;

  let score = 35;

  if (wordCount >= 18) score += 15;
  if (wordCount >= 40) score += 15;
  if (wordCount >= 80) score += 10;

  const sentences = answerBody.split(/[.!?]+/).filter((s) => s.trim().length > 8);
  if (sentences.length >= 2) score += 10;

  const qTokens = new Set(
    `${questionTitle} ${questionBody}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4)
  );
  let overlap = 0;
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (qTokens.has(clean)) overlap++;
  }
  if (overlap >= 1) score += 5;
  if (overlap >= 3) score += 5;

  if (answerType === 'I Experienced This' || answerType === 'Another Perspective') {
    score += 5;
  }

  return Math.min(100, Math.max(10, score));
}

export function normalizeForDuplicateCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashContent(text: string): string {
  return crypto
    .createHash('sha256')
    .update(normalizeForDuplicateCheck(text))
    .digest('hex');
}
