# FTC Metrics v2

A scouting and analytics platform for FIRST Tech Challenge (FTC) teams. Enables teams to collect match data from scouts, fetches official statistics from the FTC Events API, and computes advanced analytics (EPA/OPR) with match predictions.

## Project Decisions

### Season Focus
- **Current Season Only**: DECODE (2025-2026 FTC game)
- Scoring values fetched from FTC Events API when available
- No historical season support

### Design Philosophy
- **Minimal & Elegant**: Clean interface inspired by Statbotics
- **Mobile-First**: Primary experience optimized for phones at events
- **Real-Time Everything**: Live updates for scores, scouting, and analytics
- **Useful Over Feature-Rich**: Every feature serves a clear purpose

### Technology Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| **Frontend** | Next.js + TypeScript | PWA for offline scouting |
| **Backend** | TBD (see comparison below) | Real-time is critical |
| **Database** | PostgreSQL + Prisma | Production-ready, scalable |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Auth** | OAuth only | Google, Discord, GitHub (expandable) |

---

## Architecture Comparison

### Your Suggested Stack: Convex + Next.js + Prisma

**Important Note**: Convex and Prisma serve overlapping purposes. Convex has its own database and ORM-like API, so using both creates redundancy. Here are the realistic options:

### Option A: Convex + Next.js (No Prisma)

```
┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│     Convex      │
│   (Frontend)    │     │  (Backend + DB) │
└─────────────────┘     └─────────────────┘
```

| Aspect | Details |
|--------|---------|
| **Real-time** | Built-in, automatic subscriptions |
| **Type Safety** | Excellent, end-to-end TypeScript |
| **Self-hosting** | Difficult (Convex is primarily cloud-hosted) |
| **Kubernetes** | Not ideal - Convex manages its own infra |
| **Database** | Convex's proprietary DB (not PostgreSQL) |
| **Offline/PWA** | Requires custom sync logic |
| **Vendor Lock-in** | High - tied to Convex platform |

**Verdict**: Great for rapid development, but conflicts with self-hosting and Kubernetes requirements.

---

### Option B: Next.js + Prisma + Custom Real-time

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│  API Routes or  │────▶│   PostgreSQL    │
│   (Frontend)    │     │  tRPC + Prisma  │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ WebSocket/SSE   │
                        │ (Soketi/Ably)   │
                        └─────────────────┘
```

| Aspect | Details |
|--------|---------|
| **Real-time** | Manual setup with WebSockets or SSE |
| **Type Safety** | Excellent with tRPC + Prisma |
| **Self-hosting** | Easy - standard Docker containers |
| **Kubernetes** | Excellent - stateless app pods + DB |
| **Database** | PostgreSQL (as requested) |
| **Offline/PWA** | Standard service worker + IndexedDB |
| **Vendor Lock-in** | None - fully open source |

**Verdict**: Best for self-hosting and Kubernetes, but requires implementing real-time layer.

---

### Option C: Next.js + Supabase (Self-hosted)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│    Supabase     │────▶│   PostgreSQL    │
│   (Frontend)    │     │  (API + Realtime)│    │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

| Aspect | Details |
|--------|---------|
| **Real-time** | Built-in PostgreSQL subscriptions |
| **Type Safety** | Good with generated types |
| **Self-hosting** | Supported via Docker Compose |
| **Kubernetes** | Possible but complex (many services) |
| **Database** | PostgreSQL native |
| **Offline/PWA** | Requires custom sync logic |
| **Vendor Lock-in** | Low - can self-host entirely |

**Verdict**: Good balance of features and self-hosting, but Kubernetes setup is heavy.

---

### Option D: Next.js + Hono + Prisma + Soketi (Recommended)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   Hono API      │────▶│   PostgreSQL    │
│   (Frontend)    │     │   + Prisma      │     │   (via Prisma)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                     │
         │              ┌──────▼──────┐
         └─────────────▶│   Soketi    │ (Pusher-compatible WebSocket)
                        └─────────────┘
```

| Aspect | Details |
|--------|---------|
| **Real-time** | Soketi (self-hosted Pusher) |
| **Type Safety** | Excellent with Hono RPC + Prisma |
| **Self-hosting** | Excellent - lightweight containers |
| **Kubernetes** | Excellent - simple stateless pods |
| **Database** | PostgreSQL (as requested) |
| **Offline/PWA** | Standard service worker + IndexedDB |
| **Vendor Lock-in** | None - all open source |

**Verdict**: Best fit for your requirements. Lightweight, Kubernetes-native, real-time capable.

---

### Recommendation

**Option D (Next.js + Hono + Prisma + Soketi)** is recommended because:

1. **Kubernetes-native**: Lightweight, stateless containers scale easily
2. **PostgreSQL**: Uses your preferred database
3. **Real-time**: Soketi provides Pusher-compatible WebSockets, self-hosted
4. **Type-safe**: Hono RPC + Prisma gives end-to-end type safety
5. **No vendor lock-in**: Everything is open source
6. **Docker-friendly**: Simple multi-container setup

If you prefer less custom code and accept some complexity, **Option C (Supabase)** is a good alternative.

---

## Team Verification Options

Since teams represent official FTC teams, verification is important. Here are the options:

### Option 1: Open Claim + Dispute System
```
How it works:
1. Any user can claim any unclaimed team number
2. First user becomes the "owner"
3. Other users can dispute the claim
4. Disputes reviewed manually or by vote

Pros: Simple, low friction
Cons: Potential for squatting, requires moderation
```

### Option 2: Verification via FTC Events API
```
How it works:
1. User enters team number
2. System fetches team info from FTC API
3. User must prove association (enter coach email, team location, etc.)
4. Optional: email verification to coach listed in FIRST systems

Pros: Leverages official data
Cons: Coach emails not in public API, requires manual verification
```

### Option 3: Event-Based Verification
```
How it works:
1. At events, generate unique verification codes
2. Codes displayed on screens or distributed to teams
3. Team members enter code to claim/join team

Pros: In-person verification, hard to fake
Cons: Only works at events, delays team setup
```

### Option 4: Invite-Only from Verified User (Recommended)
```
How it works:
1. First user claims team (open claim)
2. Platform marks team as "unverified"
3. Platform admins can verify teams manually
4. Verified mentors can invite members
5. Unverified teams have limited features (can scout, can't share publicly)

Pros: Balances accessibility with trust
Cons: Requires some admin involvement
```

### Option 5: Integration with FIRST Dashboard (Future)
```
How it works:
1. OAuth with FIRST account (if API becomes available)
2. Automatic team association based on FIRST registration

Pros: Authoritative, seamless
Cons: FIRST doesn't currently offer OAuth API
```

**Recommendation**: Start with **Option 4** (Invite-Only with verification status). It allows teams to start using the platform immediately while building trust over time.

---

## Scouting Data Model

### Quantitative Data (DECODE-specific)
- Auto phase: scoring elements, positioning
- Teleop phase: scoring elements, cycles
- Endgame: parking, bonuses
- Match metadata: event, match number, alliance

### Qualitative Data (User-entered notes)
- Robot reliability (1-5 scale + notes)
- Driver skill observations
- Strategy notes
- Mechanical issues observed
- Defense capability
- Free-form comments

### Data Sharing Model

Teams can choose sharing level:

| Level | Visibility |
|-------|-----------|
| **Private** | Only team members can see |
| **Event-Only** | Teams at the same event can see |
| **Public** | All users can search and view |

### Scouting Data Search Panel

Search and filter by:
- **Team who posted**: Find all data from a specific scouting team
- **Team scouted**: Find all data about a specific FTC team
- **Event**: Find all data from teams at a specific event
- **Date range**: Filter by when data was collected
- **Sharing level**: Only show public, or include event-shared data

---

## Alliance Selection Tool

Features:
- **Team Comparison**: Side-by-side stats for 2-4 teams
- **Pick List Builder**: Drag-and-drop ranking of potential picks
- **Compatibility Score**: How well teams complement each other
- **Weakness Analysis**: Identify gaps in your alliance
- **Simulation**: "What if" scenarios with different picks

Data sources:
- EPA/OPR rankings
- Scouting notes (qualitative)
- Historical match performance
- Head-to-head records

---

## Authentication
- **OAuth providers**: Google, Discord, GitHub (more to be added)
- **No email/password**: OAuth handles verification
- **Multi-team membership**: Users can belong to multiple FTC teams

## Team Model
- Team object represents an **FTC team** (not just a scouting group)
- User roles: **Mentor** (full admin) or **Member** (scout access)
- Verification status: **Verified** or **Unverified**
- Scouting data sharing: **Private**, **Event-Only**, or **Public**

## Deployment & Scale
- **Self-hosted** in Docker containers
- **Kubernetes-ready** for scaling to all of FTC
- **Open source** with centralized hosted service available

## MVP Requirements
All features must be usable in MVP - no phased feature releases.

---

## TODO: Implementation Roadmap

### Phase 1: Project Setup & Infrastructure

- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up PostgreSQL database
- [ ] Configure Prisma ORM
- [ ] Set up Hono API (or chosen backend)
- [ ] Set up Soketi for real-time WebSockets
- [ ] Configure PWA with service worker for offline support
- [ ] Set up ESLint and Prettier
- [ ] Create Docker Compose for local development
- [ ] Create production Docker configuration
- [ ] Create Kubernetes manifests (Deployment, Service, ConfigMap, Secrets)
- [ ] Configure CI/CD pipeline with GitHub Actions

### Phase 2: Database Schema

- [ ] Design Prisma schema:
  - [ ] `User` model (id, email, name, avatar, oauth_provider, created_at)
  - [ ] `Team` model (id, team_number, name, verified, sharing_level, created_at)
  - [ ] `TeamMember` model (user_id, team_id, role: mentor|member, joined_at)
  - [ ] `TeamInvite` model (team_id, code, expires_at, created_by)
  - [ ] `ScoutingEntry` model (quantitative DECODE fields + metadata)
  - [ ] `ScoutingNote` model (team_id, about_team, qualitative notes)
  - [ ] `Match` model (official FTC match data)
  - [ ] `Score` model (official match scores)
  - [ ] `Event` model (event details from FTC API)
  - [ ] `EPAHistory` model (track EPA over time)
- [ ] Create database migrations
- [ ] Implement seed data for development

### Phase 3: Authentication System

- [ ] Set up NextAuth.js / Auth.js
- [ ] Configure OAuth providers:
  - [ ] Google OAuth
  - [ ] Discord OAuth
  - [ ] GitHub OAuth
- [ ] Create authentication middleware
- [ ] Implement protected routes
- [ ] Design extensible provider system for future additions
- [ ] Handle user profile creation on first login

### Phase 4: Team Management

- [ ] Implement team claiming (link to FTC team number)
- [ ] Add verification status (verified/unverified)
- [ ] Create team invitation system (invite codes with expiry)
- [ ] Implement role management:
  - [ ] Mentor role (full admin, can verify)
  - [ ] Member role (scout access)
- [ ] Allow users to join multiple teams
- [ ] Build team settings page:
  - [ ] Set data sharing level (private/event/public)
  - [ ] Manage members and roles
  - [ ] Generate invite codes
- [ ] Create team dashboard

### Phase 5: FTC Events API Integration

- [ ] Create FTC Events API client
  - [ ] Basic auth with API credentials
  - [ ] Base URL: `https://ftc-api.firstinspires.org/v2.0`
  - [ ] Season: 2025 (DECODE)
- [ ] Implement API endpoints:
  - [ ] Fetch events list for season
  - [ ] Fetch event details
  - [ ] Fetch match schedule
  - [ ] Fetch match results/scores (with DECODE scoring values)
  - [ ] Fetch team information
- [ ] Add response caching (Redis or in-memory)
- [ ] Create TypeScript types for all API responses
- [ ] Handle rate limiting and errors
- [ ] Background job for syncing match data
- [ ] Real-time score updates during events

### Phase 6: Scouting Interface (DECODE Game)

- [ ] Design mobile-first scouting form (minimal, elegant)
- [ ] Implement interactive DECODE field view component
- [ ] Create match phase management (Auto/Teleop/Endgame)
- [ ] Implement DECODE-specific scoring fields (from FTC API when available)
- [ ] Add qualitative notes section:
  - [ ] Robot reliability rating
  - [ ] Driver skill observations
  - [ ] Strategy notes
  - [ ] Free-form comments
- [ ] PWA offline functionality:
  - [ ] Cache scouting form
  - [ ] Store submissions in IndexedDB
  - [ ] Sync when back online with conflict resolution
- [ ] Real-time data sync via Soketi
- [ ] Match history view per team
- [ ] Data export (CSV/JSON)

### Phase 7: Scouting Data Search Panel

- [ ] Build search interface with filters:
  - [ ] Team who posted (source team)
  - [ ] Team scouted (about team)
  - [ ] Event filter
  - [ ] Date range
  - [ ] Sharing level visibility
- [ ] Implement search API with Prisma
- [ ] Real-time search results
- [ ] Save search presets
- [ ] Export search results

### Phase 8: Analytics - OPR (Offensive Power Rating)

- [ ] Port OPR algorithm to TypeScript
  - [ ] Use `ml-matrix` library for linear algebra
  - [ ] Implement pseudo-inverse matrix calculations
- [ ] Create OPR calculation endpoint
- [ ] Support DECODE-specific statistics
- [ ] Build OPR visualization dashboard (minimal, clean)
  - [ ] Team rankings table
  - [ ] Comparison charts
  - [ ] Event-specific filtering
- [ ] Real-time OPR updates after each match
- [ ] Add caching for computed values

### Phase 9: Analytics - EPA (Expected Points Added)

- [ ] Port EPA algorithm to TypeScript
  - [ ] Initialize with baseline average scores
  - [ ] Incremental match-by-match updates
- [ ] Track EPA history over time
- [ ] Create EPA calculation endpoint
- [ ] Build EPA visualization dashboard:
  - [ ] Team EPA rankings
  - [ ] EPA trend graphs over season
  - [ ] Team comparison tool
- [ ] Real-time EPA updates after each match

### Phase 10: Match Predictions (Simple)

- [ ] Implement simple prediction algorithm:
  - [ ] Alliance EPA/OPR sum
  - [ ] Win probability calculation
  - [ ] Score range estimate
- [ ] Build predictions display on match pages
- [ ] Track prediction accuracy over time

### Phase 11: Alliance Selection Tool

- [ ] Team comparison view (side-by-side stats)
- [ ] Pick list builder with drag-and-drop
- [ ] Compatibility scoring algorithm
- [ ] Weakness analysis display
- [ ] Integration with scouting notes
- [ ] Export pick list

### Phase 12: UI/UX Pages (Mobile-First, Minimal)

- [ ] Homepage / Landing page
  - [ ] Clean feature overview
  - [ ] Quick access to scouting
  - [ ] Live event feed
- [ ] OAuth login page (simple, fast)
- [ ] Team dashboard
  - [ ] Team overview with FTC team info
  - [ ] Member management
  - [ ] Scouting statistics
  - [ ] Data sharing settings
- [ ] Scouting interface page (PWA-optimized)
- [ ] Scouting search panel
- [ ] Analytics pages:
  - [ ] OPR dashboard
  - [ ] EPA dashboard
  - [ ] Match predictions
- [ ] Alliance selection tool page
- [ ] Team explorer / search page
- [ ] User profile page (manage team memberships)
- [ ] 404 and error pages

### Phase 13: Real-time Features

- [ ] Set up Soketi WebSocket server
- [ ] Live scouting data updates
- [ ] Real-time team collaboration
- [ ] Live match score tracking from FTC API
- [ ] Real-time EPA/OPR recalculation
- [ ] Push notifications for match times (optional)

### Phase 14: Testing

- [ ] Set up Vitest for unit testing
- [ ] Write tests for analytics algorithms (OPR/EPA/Predictions)
- [ ] Write tests for API routes
- [ ] Write tests for authentication flows
- [ ] Set up Playwright for E2E testing
- [ ] Create E2E tests for critical user flows
- [ ] Add API integration tests for FTC Events API
- [ ] Load testing for Kubernetes scaling

### Phase 15: Documentation & Polish

- [ ] Write API documentation
- [ ] Create user guide/tutorial
- [ ] Add inline code documentation
- [ ] Create contribution guidelines (CONTRIBUTING.md)
- [ ] Performance optimization
  - [ ] Image optimization
  - [ ] Code splitting
  - [ ] Caching strategies
- [ ] Accessibility audit (WCAG compliance)
- [ ] Mobile responsiveness testing
- [ ] PWA audit (Lighthouse)

### Phase 16: Deployment

- [ ] Set up PostgreSQL in production
- [ ] Configure environment variables
- [ ] Build Docker images with multi-stage builds:
  - [ ] Next.js app
  - [ ] Hono API
  - [ ] Soketi
- [ ] Create Kubernetes manifests:
  - [ ] Deployment with resource limits
  - [ ] Horizontal Pod Autoscaler
  - [ ] Service (ClusterIP/LoadBalancer)
  - [ ] Ingress with TLS
  - [ ] ConfigMap and Secrets
  - [ ] PersistentVolumeClaim for data
- [ ] Set up Helm chart (optional)
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up logging (Loki or ELK)
- [ ] Configure custom domain
- [ ] Set up error tracking (Sentry)
- [ ] Create backup strategy (pg_dump cron)

---

## Quick Start (Current Python Backend)

```bash
# Set up virtual environment
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add FTC Events API credentials: USERNAME and TOKEN

# Run the application
python3 app.py  # Runs on http://0.0.0.0:8080
```

## FTC Events API

- Base URL: `https://ftc-api.firstinspires.org/v2.0`
- Register for credentials at: https://ftc-events.firstinspires.org/services/API
- Current season: 2025 (DECODE)

## Contributing

See `CLAUDE.md` for development guidelines and architecture details.

## License

MIT
