# FTC Metrics — Full Security & Code Quality Audit

**Date:** 2026-02-21
**Branch:** `audit`
**Scope:** All 4 packages (api, web, db, shared) + infrastructure

---

## Executive Summary

The audit identified **5 Critical**, **16 High**, **12 Medium**, and **11 Low** findings across authentication, API routes, frontend/auth/database, and infrastructure layers. The single most impactful issue is that **the entire API authentication model is broken** — the server trusts a client-supplied `X-User-Id` header with no cryptographic verification, making every authenticated endpoint effectively unauthenticated.

---

## CRITICAL Findings

### C1. API trusts client-supplied `X-User-Id` header — complete auth bypass
- **Files:** `packages/api/src/middleware/auth.ts:9`, `packages/web/src/lib/api.ts` (all fetch calls)
- **Description:** Authentication relies entirely on an `X-User-Id` header set by the client. Any HTTP client (curl, devtools) can set this to any user ID. The `authMiddleware` exists but is **never applied** to any route — handlers read the header directly and trust it.
- **Impact:** Any user can impersonate any other user, manage any team, read/write any scouting data.
- **Fix:** Forward the NextAuth session cookie to the API and verify it server-side, or use signed JWTs with a shared secret. Apply `authMiddleware` globally.

### C2. Input sanitization middleware is dead code — never consumed
- **Files:** `packages/api/src/middleware/auth.ts:191` (sets `sanitizedBody`), 11 call sites across route handlers
- **Description:** `sanitizeInput` middleware computes a sanitized body and stores it via `c.set("sanitizedBody", ...)`, but every route handler calls `c.req.json()` directly, completely bypassing sanitization. Null-byte injection and prototype pollution protections are ineffective.
- **Fix:** Replace all `await c.req.json()` calls with `c.get("sanitizedBody")`, or adopt Zod validation at each route.

### C3. Redis has no authentication (dev or production)
- **Files:** `docker-compose.yml:26`, `docker-compose.prod.yml:64`, `.env.example:8`
- **Description:** Redis runs with no password. In production, any container on the Docker network can read/write/flush all cached data.
- **Fix:** Add `command: redis-server --requirepass ${REDIS_PASSWORD}` and update `REDIS_URL`.

### C4. PostgreSQL uses weak default password fallback in production
- **File:** `docker-compose.prod.yml:52-54`
- **Description:** `${POSTGRES_PASSWORD:-ftcmetrics}` — if the env var is unset, Postgres runs with a trivially guessable password.
- **Fix:** Use `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}` (no default).

### C5. Soketi default app key/secret in production compose
- **File:** `docker-compose.prod.yml:78-80`
- **Description:** Defaults to `ftcmetrics-key` / `ftcmetrics-secret`. Anyone knowing these can publish to all WebSocket channels.
- **Fix:** Remove default fallbacks; require env vars.

---

## HIGH Findings

### H1. Account takeover via `allowDangerousEmailAccountLinking`
- **File:** `packages/web/src/lib/auth.ts:21,26,31`
- **Description:** All 3 OAuth providers have `allowDangerousEmailAccountLinking: true`. An attacker who controls an OAuth account with a victim's email (e.g., unverified GitHub email) can hijack the victim's account.
- **Fix:** Remove the flag. Implement explicit account-linking requiring prior authentication.

### H2. OAuth tokens stored as plaintext in database
- **File:** `packages/db/prisma/schema.prisma:44-49`
- **Description:** `refresh_token`, `access_token`, `id_token` are stored as plain `@db.Text`. A database compromise exposes tokens for Google, Discord, GitHub accounts.
- **Fix:** Encrypt at the application level (AES-256-GCM) or stop storing tokens if not needed post-auth.

### H3. Offline queue is tamper-prone and replayable
- **File:** `packages/web/src/lib/offline-queue.ts:175-185`
- **Description:** `userId` is stored in IndexedDB (client-modifiable). On sync, each entry is sent with the stored `X-User-Id`. No integrity signature, no deduplication.
- **Fix:** Sign queued entries with an HMAC; add server-side idempotency keys.

### H4. No input validation on scouting scoring fields
- **File:** `packages/api/src/routes/scouting.ts:324-343`
- **Description:** Count fields accept negative numbers, strings, or any type. Corrupts analytics via NaN propagation through EPA/OPR calculations.
- **Fix:** Add Zod schema: counts are non-negative integers, `endgameBaseStatus` is enum, `alliance` is `"RED"|"BLUE"`, `matchNumber` is positive integer.

### H5. Scouting notes ratings have no validation
- **File:** `packages/api/src/routes/scouting.ts:833-948`
- **Description:** `reliabilityRating`, `driverSkillRating`, `defenseRating` passed directly to DB with no type or range check.
- **Fix:** Validate as integers in range 1-5.

### H6. `GET /api/scouting/entries` leaks all data when unauthenticated
- **File:** `packages/api/src/routes/scouting.ts:477-547`
- **Description:** Without `userId` and `scoutingTeamId`, the `where` clause has no access control — returns all entries from all teams.
- **Fix:** Require authentication or enforce sharing-level filtering.

### H7. `GET /api/scouting/entries/:id` has no auth check
- **File:** `packages/api/src/routes/scouting.ts:553-587`
- **Description:** Any caller who knows an entry UUID can read it, bypassing team sharing levels.

### H8. `GET /api/scouting/notes` has no auth check
- **File:** `packages/api/src/routes/scouting.ts:968-1017`
- **Description:** All scouting notes (strategy, mechanical, general) readable by anyone.

### H9. `GET /api/scouting/team-summary/:teamNumber` has no auth
- **File:** `packages/api/src/routes/scouting.ts:1023-1096`
- **Description:** Returns all scouting entries and averages for any team, ignoring sharing levels.

### H10. File upload validates MIME from header, not magic bytes
- **File:** `packages/api/src/routes/user-teams.ts:633-641`
- **Description:** `file.type` comes from client `Content-Type`. An attacker can upload HTML/JS as `image/jpeg`. Combined with missing `nosniff` header on serving, enables stored XSS.
- **Fix:** Validate file magic bytes. Add `X-Content-Type-Options: nosniff` and `Content-Disposition` headers.

### H11. Users can self-promote role via PATCH member endpoint
- **File:** `packages/api/src/routes/user-teams.ts:540-549`
- **Description:** The `isSelf` check allows any member to update their own role. A STUDENT can PATCH themselves to MENTOR and gain admin privileges.
- **Fix:** Disallow self-promotion; only allow admins to change roles.

### H12. Invite codes use `Math.random()` with low entropy
- **File:** `packages/api/src/routes/user-teams.ts:30-37`
- **Description:** 8 chars from 31-char alphabet (~8.5×10¹¹ combinations) using non-cryptographic PRNG. Predictable with enough samples.
- **Fix:** Use `crypto.randomBytes()`, increase to 12+ chars, rate-limit the join endpoint.

### H13. NEXTAUTH_SECRET placeholder is weak
- **File:** `.env.example:31`
- **Description:** `NEXTAUTH_SECRET=your-secret-key-change-in-production` — may be copied verbatim to production.
- **Fix:** Leave blank with comment: `# Generate with: openssl rand -base64 32`.

### H14. API Dockerfile runs as root
- **File:** `packages/api/Dockerfile:17-29`
- **Description:** No `USER` directive. Process runs as root, increasing blast radius of any RCE.
- **Fix:** Add non-root user (the web Dockerfile already does this).

### H15. Nginx missing security headers
- **File:** `nginx.conf`
- **Description:** No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, or `Referrer-Policy`.
- **Fix:** Add all standard security headers.

### H16. No rate limiting on nginx reverse proxy
- **File:** `nginx.conf`
- **Description:** No `limit_req_zone` configured. Auth and API endpoints exposed to brute force.
- **Fix:** Add `limit_req_zone` on `/api/auth/` and `/api/`.

---

## MEDIUM Findings

### M1. Rate limiter is in-memory, not shared across instances
- **File:** `packages/api/src/middleware/auth.ts:135-174`
- **Description:** Uses a `Map` — per-process, unbounded growth, resets on restart. Redis is available.

### M2. Rate limit key uses spoofable identifiers
- **File:** `packages/api/src/middleware/auth.ts:142`
- **Description:** Uses `X-User-Id` then `X-Forwarded-For` — both client-spoofable. Fallback `"anonymous"` is a shared bucket (DoS vector).

### M3. CORS returns fallback origin for unknown requesters
- **File:** `packages/api/src/index.ts:34-39`
- **Description:** Non-matching origins get `allowed[0]` instead of rejection.
- **Fix:** Return `null`/empty for non-matching origins.

### M4. Missing unique constraint on ScoutingEntry
- **File:** `packages/db/prisma/schema.prisma:231-298`
- **Description:** No constraint preventing duplicate submissions for the same scout/match/team.
- **Fix:** Add `@@unique([scouterId, eventCode, matchNumber, scoutedTeamId])`.

### M5. Missing unique constraint on ScoutingNote
- **File:** `packages/db/prisma/schema.prisma:311-348`

### M6. TeamInvite schema missing `maxUses`/`uses` columns
- **File:** `packages/db/prisma/schema.prisma:128-141`
- **Description:** API types reference `maxUses` and `uses` but schema lacks them. Invite codes are unlimited use.

### M7. Invite codes are multi-use with no limit
- **File:** `packages/api/src/routes/user-teams.ts:377-425`
- **Description:** Any number of users can use a code within the 7-day window.

### M8. Session secret has no startup assertion
- **File:** `packages/web/src/lib/auth.ts:15`
- **Description:** `process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET` — no fail-fast if both are undefined.

### M9. SSRF via `eventCode` path parameter
- **File:** `packages/api/src/routes/events.ts:37`, `packages/api/src/lib/ftc-api.ts:232-290`
- **Description:** `eventCode` interpolated into FTC API URLs without validation. Path traversal possible (limited to FIRST domain).
- **Fix:** Validate `eventCode` with `/^[A-Za-z0-9]+$/`.

### M10. `X-Forwarded-For` appendable by clients through nginx
- **File:** `nginx.conf:18,28,37,48`
- **Description:** `$proxy_add_x_forwarded_for` appends to client-supplied header. Backend may trust spoofed first value.
- **Fix:** Use `proxy_set_header X-Forwarded-For $remote_addr;`.

### M11. Uploaded files served without security headers
- **File:** `packages/api/src/index.ts:84-89`
- **Description:** Missing `X-Content-Type-Options: nosniff`, `Content-Disposition`. Enables stored XSS with H10.

### M12. Builder stage copies entire repo (potential secret leak in image layers)
- **Files:** `packages/api/Dockerfile:13`, `packages/web/Dockerfile:13`
- **Description:** `COPY . .` may include `.env`, `.git` if `.dockerignore` is missing/incomplete.

---

## LOW Findings

### L1. Health endpoint exposes infrastructure details
- **File:** `packages/api/src/index.ts:99-138`

### L2. Upload route bypasses rate limiter (mounted before middleware)
- **File:** `packages/api/src/index.ts:59-90`

### L3. Sanitization middleware silently swallows parse errors
- **File:** `packages/api/src/middleware/auth.ts:192-194`

### L4. NaN propagation in analytics from invalid scoring data
- **File:** `packages/api/src/routes/scouting.ts:1064`

### L5. Rankings cache is process-local (inconsistent in multi-instance)
- **File:** `packages/api/src/routes/rankings.ts:14`

### L6. No DELETE endpoint for scouting entries
- **File:** `packages/api/src/routes/scouting.ts`

### L7. Error messages leak Prisma/schema details
- **File:** `packages/api/src/routes/scouting.ts:465-466`

### L8. `renderMarkdown` URL injection edge case
- **File:** `packages/web/src/app/my-teams/page.tsx:85-97`
- **Description:** URLs containing double quotes can break out of `href` attribute.

### L9. No CSRF protection on API (relevant when fixing C1 with cookies)
- **File:** `packages/web/src/lib/api.ts:29`

### L10. Cascade deletes may cause unintended data loss
- **File:** `packages/db/prisma/schema.prisma` (multiple relations)

### L11. Dev compose exposes Postgres/Redis on all interfaces
- **File:** `docker-compose.yml:14,27`
- **Fix:** Bind to `127.0.0.1`.

---

## Prioritized Remediation Plan

### Phase 0 — Foundation (do first, before any code changes)
| # | Task | Details | Effort |
|---|------|---------|--------|
| 0a | **Upgrade to Node 24 LTS** | Update `engines` in all `package.json` files, Dockerfiles (`FROM` base images), `.nvmrc`/`.node-version` if present, CI configs. Test that all packages build and start. | Medium |
| 0b | **Update all npm dependencies to latest** | Run `bun update --latest` across the workspace. Resolve any breaking changes in Next.js, Hono, Prisma, NextAuth, Tailwind, and other deps. Run full build + type-check after. | Large |
| 0c | **Verify clean build** | `bun install && bun run db:generate && bun run dev` — confirm all packages compile, dev servers start, and no runtime errors. | Small |

> **Why first:** Upgrading dependencies often patches known CVEs in third-party code (the cheapest security wins). Doing it before other changes avoids merge conflicts and ensures fixes target current APIs.

### Phase 1 — Immediate (blocks production use)
| # | Finding | Effort |
|---|---------|--------|
| 1 | **C1** Fix authentication — verify NextAuth session server-side | Large |
| 2 | **C2** Wire up sanitization or replace with Zod validation | Medium |
| 3 | **H6-H9** Add auth checks to all scouting read endpoints | Medium |
| 4 | **H11** Block self-promotion in role updates | Small |
| 5 | **C3-C5** Add secrets/passwords to Redis, Postgres, Soketi in prod compose | Small |

### Phase 2 — Before public launch
| # | Finding | Effort |
|---|---------|--------|
| 6 | **H1** Remove `allowDangerousEmailAccountLinking` | Small |
| 7 | **H4-H5** Add Zod validation on all request bodies | Medium |
| 8 | **H10** Validate upload magic bytes + add security headers (M11) | Medium |
| 9 | **H12** Crypto-secure invite codes, increase entropy | Small |
| 10 | **H14** Non-root user in API Dockerfile | Small |
| 11 | **H15-H16** Nginx security headers + rate limiting | Small |
| 12 | **H13** Fix .env.example placeholder | Small |
| 13 | **M3** Fix CORS fallback | Small |
| 14 | **M9** Validate eventCode parameter | Small |
| 15 | **M10** Fix X-Forwarded-For in nginx | Small |

### Phase 3 — Hardening
| # | Finding | Effort |
|---|---------|--------|
| 16 | **H2** Encrypt OAuth tokens at rest | Medium |
| 17 | **H3** Sign offline queue entries | Medium |
| 18 | **M1-M2** Redis-backed rate limiter with trusted IP | Medium |
| 19 | **M4-M7** Add DB constraints and invite limits | Small |
| 20 | **M8** Startup assertion for auth secret | Small |
| 21 | All LOW findings | Small each |
