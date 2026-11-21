# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Cross-User Draft Modification | `src/server/routes.ts` | 1947 | Saving a draft accepted a client-supplied `id` and ran an unconditional upsert, allowing one signed-in user to overwrite another user's private draft if they knew its ID. | High | Fixed | Added an explicit ownership lookup and `and(eq(questionDrafts.id, requestedId), eq(questionDrafts.userId, userId))` filter, returning HTTP `403` when `existing.userId !== userId`. |
| One Voice Delivery Race Condition | `src/server/routes.ts` | 1328 | Concurrent answer submissions on a One Voice question could both pass the waiting check and insert multiple answers, and authors could answer their own One Voice thread. | Medium | Fixed | Blocked self-answers on One Voice questions (`403`) and moved claim + insert + delivery completion into an atomic `db.transaction` conditional on `status = 'waiting'`, returning `409` on race conflicts. |
| Initial Moderator Claim Race | `src/server/routes.ts` | 2468 | Two non-anonymous accounts calling `/api/moderation/claim` simultaneously could both observe `modCount === 0` before promotion committed and both claim moderator privileges. | Medium | Fixed | Serialized initial moderator claim inside a database transaction protected by `pg_advisory_xact_lock(729401)`. |
| Password Reset Recovery Code Replay | `src/server/routes.ts` | 361 | `/api/auth/password-reset/confirm` had no dedicated confirmation rate-limit and kept the static recovery code hash reusable after password reset. | Medium | Fixed | Added per-email/IP rate limiting (`5` requests / 15 min) and rotated `recoveryCodeHash` on every successful reset, returning the newly issued recovery code once. |
| Suspended Account WebSocket Access | `src/server/realtime.ts` | 29 | WebSocket connections and `{ type: 'auth' }` re-authentication checked whether a profile existed without rejecting suspended accounts or clearing auth state on logout. | Medium | Fixed | Restricted `client.userId` assignment to `accountStatus === 'active'` profiles on both handshake and message auth, and cleared `client.userId` on `{ type: 'logout' }`. |
| Missing HTTP Hardening Headers | `server.ts` | 19 | Responses from Express lacked baseline browser security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), and unmatched `/api/*` paths fell through to Vite HTML. | Low | Fixed | Added safe HTTP hardening headers (preserving iframe embedding for preview hosts) and added a JSON `404` fallback for `/api/*`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Passwords & Session Signing | `src/server/auth.ts` | Passwords use random 16-byte salts with `crypto.scryptSync` and timing-safe comparison; session tokens use HMAC-SHA256 with `crypto.timingSafeEqual` and `HttpOnly; Secure; SameSite=None; Partitioned` cookies. |
| Cross-Origin Mutation Guard | `src/server/auth.ts` | Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` requests require either the custom `X-Requested-With: StrangersWisdom` header or a matching `Origin` host. |
| Database Access | `src/server/routes.ts` | All PostgreSQL queries use Drizzle ORM parameterized builders and Zod schema validation; anonymous public payloads strip `authorId`, `email`, and private aliases. |
| Server-Side Role Enforcement | `src/server/auth.ts` | Admin and moderator routes verify `req.profile.role` from the database via `requireModerator` and never trust client-supplied role values during registration. |
| Token & Secrets Hygiene | `src/lib/firebase-admin.ts` | Token verification runs server-side via Firebase Admin; Cloud SQL credentials and session secrets stay in server environment variables (`process.env`). |
| React Output Escaping | `src/components/AnswerCard.tsx` | All user-authored question titles, bodies, answers, and tags render strictly through React JSX text bindings with zero raw HTML injection sinks. |

---

## PoC Verification

### Cross-User Draft Modification Blocked

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Ownership Check on Draft Save |
| Impact | High |
| Affected File | `src/server/routes.ts:1947` |
| Test Scenario | `POST /api/drafts` authenticated as User B passing `{ id: "<user_A_draft_id>", title: "Hijacked" }` |

#### How It Was Fixed
Before updating a draft by `id`, the handler queries `questionDrafts` for `requestedId`. If the row exists and belongs to a different `userId`, it immediately rejects the request with HTTP `403`. Updates also require both `id` and `userId` in the `WHERE` clause, and brand-new drafts always generate a fresh server-side UUID.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | User B sends `POST /api/drafts` with User A's `draftId` | Passes `requireAuth` as User B |
| 2 | Ownership lookup executes at `src/server/routes.ts:1948-1956` | Finds `existing.userId !== userId` |
| 3 | Route returns `res.status(403).json({ error: 'You do not have permission to edit this draft.' })` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Users can no longer read or overwrite another user's private question drafts by supplying their draft ID.

---

### One Voice Concurrent Answer Race Condition

#### Summary
| Field | Value |
|---|---|
| Issue Type | Concurrency Race & Self-Answer Check |
| Impact | Medium |
| Affected File | `src/server/routes.ts:1328` |
| Test Scenario | Two strangers concurrently send `POST /api/questions/:id/answers` on a single One Voice question |

#### How It Was Fixed
The endpoint explicitly rejects self-answers (`q.authorId === profile.id`) with HTTP `403`, and wraps the One Voice claim (`UPDATE one_voice_deliveries SET status = 'answer_received' WHERE question_id = ... AND status = 'waiting'`), answer insertion, and delivery completion inside `db.transaction(...)`. Only one transaction can claim the row; the second throws `ONE_VOICE_ALREADY_CLAIMED` and receives HTTP `409`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Two requests arrive simultaneously at `POST /api/questions/:id/answers` | Both enter `db.transaction` at `src/server/routes.ts:1342` |
| 2 | First transaction matches `oneVoiceDeliveries.status = 'waiting'` and updates row | Acquires row lock & inserts single answer |
| 3 | Second transaction checks `returning()` after row commit (`src/server/routes.ts:1358`) | Sees empty `claimed` -> returns `409 Conflict` (**Handled Safely**) |

#### Conclusion
**Fix Verified** - Exactly one stranger answer can ever be accepted and delivered for a One Voice question even under concurrent requests.

---

### Initial Moderator Claim Race

#### Summary
| Field | Value |
|---|---|
| Issue Type | Concurrent Privilege Claim Race |
| Impact | Medium |
| Affected File | `src/server/routes.ts:2468` |
| Test Scenario | Two newly registered email accounts simultaneously call `POST /api/moderation/claim` |

#### How It Was Fixed
The check-and-promote flow executes inside `db.transaction` protected by `SELECT pg_advisory_xact_lock(729401)`, forcing concurrent callers to serialize cleanly before counting existing moderators.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Two authenticated non-anonymous users invoke `POST /api/moderation/claim` | Both invoke `db.transaction` at `src/server/routes.ts:2468` |
| 2 | Lock at `src/server/routes.ts:2469` serializes transaction execution | First promotes user to `moderator`; second sees `modCount > 0` |
| 3 | Second request evaluates `if (!updated)` at `src/server/routes.ts:2489` | Returns `403 Forbidden` (**Handled Safely**) |

#### Conclusion
**Fix Verified** - Concurrent first-run moderator claim requests cannot promote more than one account.

---

### Password Reset Recovery Code Replay & Brute-Force Guard

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Rate Limit & Static Recovery Token Reuse |
| Impact | Medium |
| Affected File | `src/server/routes.ts:361` |
| Test Scenario | Repeated invalid reset attempts or reusing a previously spent recovery code after resetting a password |

#### How It Was Fixed
Added a `5` attempts per 15 minutes rate limit keyed by email and client IP, and rotated `recoveryCodeHash` atomically inside the user profile update when a reset succeeds while marking any `passwordResets` token row used.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Client submits `POST /api/auth/password-reset/confirm` with old recovery code | Rate limit check runs at `src/server/routes.ts:361` |
| 2 | First valid reset updates `passwordHash` and writes rotated `recoveryCodeHash` (`src/server/routes.ts:405`) | Old recovery code hash is replaced |
| 3 | Subsequent attempt using the old code compares hashes at `src/server/routes.ts:379` | Fails comparison and returns `400` (**Handled Safely**) |

#### Conclusion
**Fix Verified** - Recovery codes are single-use per reset and confirmation attempts are rate-limited.

---

### Suspended Account WebSocket Authentication Enforcement

#### Summary
| Field | Value |
|---|---|
| Issue Type | Incomplete Account Status Check in Realtime Handshake |
| Impact | Medium |
| Affected File | `src/server/realtime.ts:29` |
| Test Scenario | A suspended user opens `/ws?token=<valid_token>` or sends `{ type: 'auth', token: '<valid_token>' }` |

#### How It Was Fixed
Both the initial WebSocket upgrade listener and the `{ type: 'auth' }` handler now check `resolved.profile.accountStatus === 'active'` before setting `client.userId`, and `{ type: 'logout' }` clears `client.userId`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Suspended user connects to `/ws` or sends `{ type: 'auth', token }` | `resolveUserFromTokenOrCookie` returns suspended profile |
| 2 | Active status check at `src/server/realtime.ts:29` and `43` evaluates to `false` | `client.userId` stays `undefined` |
| 3 | Private notifications dispatched via `sendUserEvent(userId, ...)` | Never delivered to suspended socket (**Handled Safely**) |

#### Conclusion
**Fix Verified** - Suspended users cannot bind WebSocket connections to private account channels.
