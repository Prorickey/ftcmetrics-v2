# FTC Metrics v2

A scouting and analytics platform for FIRST Tech Challenge (FTC) teams. Enables teams to collect match data from scouts, fetches official statistics from the FTC Events API, and computes advanced analytics (EPA/OPR) with match predictions.

## Project Decisions

### Season Focus
- **Current Season Only**: DECODE (2025-2026 FTC game)
- No historical season support

### Technology Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| **Frontend** | Next.js + TypeScript | PWA for offline scouting |
| **Backend** | Convex (primary) | See alternatives below |
| **Database** | PostgreSQL + Prisma | Production-ready, scalable |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Auth** | OAuth only | Google, Discord, GitHub (expandable) |

### Backend Alternatives to Convex

| Option | Pros | Cons |
|--------|------|------|
| **Convex** | Real-time built-in, serverless, type-safe | Vendor lock-in, self-hosting complex |
| **Supabase** | PostgreSQL native, real-time, self-hostable | More setup for type safety |
| **tRPC + Prisma** | Full control, type-safe, easy self-hosting | Manual real-time implementation |
| **Hono + Prisma** | Lightweight, edge-ready, Docker-friendly | No built-in real-time |

### Authentication
- **OAuth providers**: Google, Discord, GitHub (more to be added)
- **No email/password**: OAuth handles verification
- **Multi-team membership**: Users can belong to multiple FTC teams

### Team Model
- Team object represents an **FTC team** (not just a scouting group)
- User roles: **Mentor** or **Member**
- Scouting data: **Shareable** (team's choice to make public or private)

### Deployment & Scale
- **Self-hosted** in Docker containers
- **Kubernetes-ready** for scaling to all of FTC
- **Open source** with centralized hosted service available

### MVP Requirements
All features must be usable in MVP - no phased feature releases.

---

## TODO: Implementation Roadmap

### Phase 1: Project Setup & Infrastructure

- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up PostgreSQL database
- [ ] Configure Prisma ORM
- [ ] Set up Convex backend (or chosen alternative)
- [ ] Configure PWA with service worker for offline support
- [ ] Set up ESLint and Prettier
- [ ] Create Docker configuration
- [ ] Create Kubernetes manifests (Deployment, Service, ConfigMap, Secrets)
- [ ] Configure CI/CD pipeline with GitHub Actions

### Phase 2: Database Schema

- [ ] Design Prisma schema:
  - [ ] `User` model (id, email, name, avatar, oauth_provider, created_at)
  - [ ] `Team` model (id, team_number, name, sharing_enabled, created_at)
  - [ ] `TeamMember` model (user_id, team_id, role: mentor|member, joined_at)
  - [ ] `ScoutingMatchData` model (DECODE game-specific fields)
  - [ ] `Match` model (official FTC match data)
  - [ ] `Score` model (official match scores)
  - [ ] `Schedule` model (event schedules)
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

- [ ] Link teams to official FTC team numbers
- [ ] Implement team creation (claim FTC team number)
- [ ] Create team invitation system (invite links/codes)
- [ ] Implement role management:
  - [ ] Mentor role (full admin)
  - [ ] Member role (scout access)
- [ ] Allow users to join multiple teams
- [ ] Build team settings page:
  - [ ] Toggle scouting data sharing (public/private)
  - [ ] Manage members and roles
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
  - [ ] Fetch match results/scores
  - [ ] Fetch team information
- [ ] Add response caching (Redis or in-memory)
- [ ] Create TypeScript types for all API responses
- [ ] Handle rate limiting and errors
- [ ] Background job for syncing match data

### Phase 6: Scouting Interface (DECODE Game)

- [ ] Design mobile-first scouting form
- [ ] Implement interactive DECODE field view component
- [ ] Create match phase management (Auto/Teleop/Endgame)
- [ ] Implement DECODE-specific scoring fields:
  - [ ] Auto phase scoring elements
  - [ ] Teleop phase scoring elements
  - [ ] Endgame/parking elements
- [ ] PWA offline functionality:
  - [ ] Cache scouting form
  - [ ] Store submissions in IndexedDB
  - [ ] Sync when back online
- [ ] Real-time data sync
- [ ] Match history view per team
- [ ] Data export (CSV/JSON)

### Phase 7: Analytics - OPR (Offensive Power Rating)

- [ ] Port OPR algorithm to TypeScript
  - [ ] Use `ml-matrix` library for linear algebra
  - [ ] Implement pseudo-inverse matrix calculations
- [ ] Create OPR calculation endpoint
- [ ] Support DECODE-specific statistics:
  - [ ] Total score
  - [ ] Auto points
  - [ ] Teleop points
  - [ ] Endgame points
  - [ ] Individual game elements
- [ ] Build OPR visualization dashboard
  - [ ] Team rankings table
  - [ ] Comparison charts
  - [ ] Event-specific filtering
- [ ] Add caching for computed values

### Phase 8: Analytics - EPA (Expected Points Added)

- [ ] Port EPA algorithm to TypeScript
  - [ ] Initialize with baseline average scores
  - [ ] Incremental match-by-match updates
- [ ] Track EPA history over time
- [ ] Create EPA calculation endpoint
- [ ] Build EPA visualization dashboard:
  - [ ] Team EPA rankings
  - [ ] EPA trend graphs over season
  - [ ] Team comparison tool
- [ ] Historical EPA tracking per team

### Phase 9: Match Predictions

- [ ] Implement prediction algorithm using EPA/OPR
- [ ] Predict match outcomes (win probability)
- [ ] Predict score ranges
- [ ] Alliance selection recommendations
- [ ] Event outcome predictions (playoff brackets)
- [ ] Prediction accuracy tracking
- [ ] Build predictions dashboard

### Phase 10: UI/UX Pages

- [ ] Homepage / Landing page
  - [ ] Feature overview
  - [ ] Quick access to scouting
  - [ ] Live event feed
- [ ] OAuth login page
- [ ] Team dashboard
  - [ ] Team overview with FTC team info
  - [ ] Member management
  - [ ] Scouting statistics
  - [ ] Data sharing toggle
- [ ] Scouting interface page (PWA-optimized)
- [ ] Analytics pages:
  - [ ] OPR dashboard with event selection
  - [ ] EPA dashboard with rankings
  - [ ] Match predictions page
- [ ] Team explorer / search page
- [ ] User profile page (manage team memberships)
- [ ] 404 and error pages

### Phase 11: Real-time Features

- [ ] Live scouting data updates
- [ ] Real-time team collaboration
- [ ] Live match score tracking
- [ ] Notification system
- [ ] Collaborative notes

### Phase 12: Testing

- [ ] Set up Vitest for unit testing
- [ ] Write tests for analytics algorithms (OPR/EPA/Predictions)
- [ ] Write tests for API routes
- [ ] Write tests for authentication flows
- [ ] Set up Playwright for E2E testing
- [ ] Create E2E tests for critical user flows
- [ ] Add API integration tests for FTC Events API
- [ ] Load testing for Kubernetes scaling

### Phase 13: Documentation & Polish

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

### Phase 14: Deployment

- [ ] Set up PostgreSQL in production
- [ ] Configure environment variables
- [ ] Build Docker image with multi-stage build
- [ ] Create Kubernetes manifests:
  - [ ] Deployment with resource limits
  - [ ] Horizontal Pod Autoscaler
  - [ ] Service (ClusterIP/LoadBalancer)
  - [ ] Ingress with TLS
  - [ ] ConfigMap and Secrets
  - [ ] PersistentVolumeClaim for data
- [ ] Set up Helm chart (optional)
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up logging (ELK or Loki)
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
