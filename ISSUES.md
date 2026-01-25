# FTC Metrics v2 - Known Issues

This document tracks issues discovered during testing. Last updated: 2026-01-25.

---

## Critical Issues

### 1. ~~NextAuth Secret Not Configured~~ FIXED
**Severity:** Critical
**Component:** Authentication (packages/web)
**Status:** FIXED - Generated and configured proper secret in `.env`

---

### 2. ~~FTC Events API Credentials Invalid~~ FIXED
**Severity:** Critical
**Component:** API (packages/api)
**Status:** FIXED - Credentials configured and API base URL corrected to `https://ftc-api.firstinspires.org/v2.0`

**Changes Made:**
- Updated `.env` with valid FTC API credentials
- Fixed API base URL in `packages/api/src/lib/ftc-api.ts`
- Added dotenv loading to API package

---

## High Priority Issues

### 3. ~~Team Creation API Fails~~ NOT A BUG
**Severity:** N/A
**Component:** API (packages/api)
**Status:** Working as designed - requires valid user ID from database (must be authenticated first)

---

### 4. ~~OAuth Providers Not Configured~~ FIXED
**Severity:** High
**Component:** Authentication
**Status:** FIXED - GitHub OAuth configured in `.env`

---

### 5. ~~CORS Origin Mismatch~~ FIXED
**Severity:** High
**Component:** API + Web
**Status:** FIXED - Updated `.env` to use port 3002 for `NEXTAUTH_URL` and `CORS_ORIGIN`

---

## Medium Priority Issues

### 6. Protected Routes Return 404 Instead of Redirect
**Severity:** Medium
**Component:** Web (packages/web)
**Pages Affected:** `/scout/match`, `/scout/notes`

**Description:**
When accessing protected routes without authentication, the page returns a 404 error combined with a redirect attempt, rather than cleanly redirecting to login.

**Expected:** Clean redirect to `/login` with return URL
**Actual:** 404 error page with `NEXT_REDIRECT` error in stack trace

---

### 7. Empty Scouting Data
**Severity:** Medium
**Component:** API

**Description:**
Scouting endpoints return empty arrays:
```json
{"success":true,"data":[]}
```

This is expected for a fresh database, but there's no seed data for testing.

**Recommendation:**
Add a `bun run db:seed` script to populate test data for development.

---

### 8. ~~No Health Check for Database~~ FIXED
**Severity:** Medium
**Component:** API
**Status:** FIXED - Health endpoint now checks database connectivity and returns component status.

---

## Low Priority Issues

### 9. ~~Docker Compose Version Warning~~ FIXED
**Severity:** Low
**Component:** Infrastructure
**Status:** FIXED - Removed obsolete `version` attribute from `docker-compose.yml`.

---

### 10. No API Rate Limit Feedback
**Severity:** Low
**Component:** API

**Description:**
Rate limiting is configured (100 req/min) but there's no indication when a user approaches or hits the limit.

**Recommendation:**
Add `X-RateLimit-*` headers to responses.

---

### 11. Missing Favicon
**Severity:** Low
**Component:** Web

**Description:**
Browser shows default favicon. The old `static/favicon.png` was removed during migration.

**Fix:**
Add favicon to `packages/web/public/`.

---

### 12. ~~Navigation Links Broken~~ FIXED
**Severity:** Low
**Component:** Web (packages/web)
**Status:** FIXED

**Description:**
Header navigation had broken links:
- "Teams" linked to `/teams` (doesn't exist) instead of `/my-teams`
- "Settings" link in dropdown menu (page doesn't exist)

**Fix:**
- Updated `/teams` link to `/my-teams`
- Removed non-existent Settings link from dropdown

---

### 13. No Mobile Navigation Menu
**Severity:** Medium
**Component:** Web (packages/web)

**Description:**
The header navigation uses `hidden md:flex` to hide the nav on mobile, but there's no hamburger menu button to show navigation on smaller screens.

**Impact:**
- Mobile users cannot access Dashboard, Scout, Analytics, or Teams pages from the header
- Users must know URLs directly or use browser history

**Recommendation:**
Add a mobile hamburger menu button that toggles visibility of navigation links on small screens.

---

## Testing Notes

### Pages Verified Working
| Page | Status |
|------|--------|
| `/` (Homepage) | Renders - hero, features, DECODE banner |
| `/login` | Renders - OAuth buttons (Google, Discord, GitHub) |
| `/dashboard` | Renders (requires auth) |
| `/scout` | Renders - team/event selection, DECODE season |
| `/scout/match` | Renders - full scouting form with DECODE elements |
| `/scout/notes` | Renders - qualitative notes form with ratings |
| `/analytics` | Renders - event selector, EPA/OPR tabs |
| `/analytics/predict` | Renders |
| `/my-teams` | Renders (requires auth) |
| `/my-teams/create` | Renders |
| `/my-teams/join` | Renders |

### API Endpoints Verified
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /` | Working | Returns API info |
| `GET /api/health` | Working | Includes database check |
| `GET /api/events` | Working | Returns 1686 events |
| `GET /api/teams/:number` | Working | Returns team info (404 if not found) |
| `GET /api/analytics/opr/:eventCode` | Working | Requires event with matches |
| `GET /api/analytics/epa/:eventCode` | Working | Requires event with matches |
| `GET /api/scouting/entries` | Working | Returns empty array |
| `GET /api/scouting/notes` | Working | Returns empty array |
| `GET /api/user-teams` | Working | Requires auth header |
| `POST /api/user-teams` | Working | Requires valid authenticated user |
| `GET /api/auth/providers` | Working | Lists OAuth providers |
| `GET /api/auth/session` | Working | Returns session or null |

### Database
- PostgreSQL container: Running and healthy
- Redis container: Running and healthy
- Soketi container: Running and healthy
- Tables created: 11 tables present
- Data: Empty (no seed data)

---

## Environment Checklist

Before the application is fully functional, ensure:

- [x] `NEXTAUTH_SECRET` is a real secret (not placeholder) - DONE
- [x] `FTC_API_USERNAME` and `FTC_API_TOKEN` are valid credentials - DONE
- [x] At least one OAuth provider is configured (GitHub) - DONE
- [x] `NEXTAUTH_URL` matches actual web app URL - DONE (port 3002)
- [x] `CORS_ORIGIN` matches actual web app URL - DONE (port 3002)
- [x] Health check includes database connectivity - DONE
- [x] Docker Compose version warning fixed - DONE
