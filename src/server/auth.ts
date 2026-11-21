import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_FALLBACK_SECRET;
}

export const SESSION_COOKIE_NAME = 'sw_session';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signSessionToken(userId: string): string {
  const payload = {
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): { sub: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encodedPayload)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as { sub: string; exp: number };

    if (!payload.sub || Date.now() > payload.exp) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
  });
}

const ADJECTIVES = [
  'Quiet',
  'Gentle',
  'Thoughtful',
  'Still',
  'Midnight',
  'Wandering',
  'Calm',
  'Distant',
  'Luminous',
  'Patient',
  'Kind',
  'Silent',
];

const NOUNS = [
  'Listener',
  'Thinker',
  'Lantern',
  'Traveler',
  'Observer',
  'Harbor',
  'Horizon',
  'Compass',
  'Echo',
  'Anchor',
  'Beacon',
  'Reader',
];

export function generatePrivateAlias(): string {
  const adj = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(NOUNS.length)];
  const num = crypto.randomInt(100, 999);
  return `${adj} ${noun} ${num}`;
}

export function isConfiguredModeratorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.MODERATOR_EMAILS || '';
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export type ProfileRecord = typeof profiles.$inferSelect;

export interface AuthRequest extends Request {
  profile?: ProfileRecord;
  authMethod?: 'bearer' | 'firebase' | 'cookie';
  suspended?: boolean;
}

export async function resolveUserFromTokenOrCookie(
  bearerToken?: string,
  cookieToken?: string
): Promise<{ profile: ProfileRecord; authMethod: 'bearer' | 'firebase' | 'cookie' } | null> {
  if (bearerToken) {
    const custom = verifySessionToken(bearerToken);
    if (custom) {
      const [found] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, custom.sub))
        .limit(1);
      if (found && found.accountStatus !== 'deleted') {
        return { profile: found, authMethod: 'bearer' };
      }
    }

    try {
      const decoded = await adminAuth.verifyIdToken(bearerToken);
      const email = decoded.email ?? null;
      const role = isConfiguredModeratorEmail(email) ? 'moderator' : 'member';
      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, decoded.uid))
        .limit(1);

      if (existing) {
        if (existing.accountStatus === 'deleted') return null;
        return { profile: existing, authMethod: 'firebase' };
      }

      const [created] = await db
        .insert(profiles)
        .values({
          id: decoded.uid,
          email,
          authProvider: 'google',
          privateAlias: generatePrivateAlias(),
          role,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { email, updatedAt: new Date() },
        })
        .returning();

      if (created) {
        return { profile: created, authMethod: 'firebase' };
      }
    } catch {
      // Invalid Firebase token
    }
  }

  if (cookieToken) {
    const custom = verifySessionToken(cookieToken);
    if (custom) {
      const [found] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, custom.sub))
        .limit(1);
      if (found && found.accountStatus !== 'deleted') {
        return { profile: found, authMethod: 'cookie' };
      }
    }
  }

  return null;
}

function isOriginSafeForCookieMutation(req: Request): boolean {
  const customHeader = req.headers['x-requested-with'];
  if (customHeader === 'StrangersWisdom') {
    return true;
  }
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[SESSION_COOKIE_NAME];

    const resolved = await resolveUserFromTokenOrCookie(bearer, cookieToken);
    if (resolved) {
      if (resolved.profile.accountStatus === 'suspended') {
        req.suspended = true;
        if (resolved.authMethod === 'cookie') {
          clearSessionCookie(res);
        }
      } else {
        req.profile = resolved.profile;
        req.authMethod = resolved.authMethod;
      }
    }
    next();
  } catch (err) {
    console.error('Auth resolution error:', err);
    next();
  }
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await optionalAuth(req, res, () => {
    if (req.suspended) {
      return res
        .status(403)
        .json({ error: 'This account has been suspended for safety violations.' });
    }
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (
      req.authMethod === 'cookie' &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase()) &&
      !isOriginSafeForCookieMutation(req)
    ) {
      return res.status(403).json({ error: 'Cross-origin request verification failed.' });
    }
    next();
  });
};

export const requireModerator = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireAuth(req, res, () => {
    if (
      !req.profile ||
      (req.profile.role !== 'moderator' && req.profile.role !== 'admin')
    ) {
      return res
        .status(403)
        .json({ error: 'Moderator authorization is required.' });
    }
    next();
  });
};

export function sanitizePrivateProfile(profile: ProfileRecord) {
  return {
    id: profile.id,
    email: profile.email,
    authProvider: profile.authProvider,
    privateAlias: profile.privateAlias,
    role: profile.role,
    notificationSettings: profile.notificationSettings,
    privacySettings: profile.privacySettings,
    theme: profile.theme,
    accountStatus: profile.accountStatus,
    createdAt: profile.createdAt,
  };
}
