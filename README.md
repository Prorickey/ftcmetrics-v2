# FTC Metrics v2

A scouting and analytics platform for FIRST Tech Challenge (FTC) teams. Enables teams to collect match data from scouts, fetches official statistics from the FTC Events API, and computes advanced analytics (EPA/OPR) to understand team performance.

## Current Status

The project currently runs on a **Python/Flask backend** with Jinja2 templates and is being migrated to a modern TypeScript stack.

**Target Stack:**
- Frontend: Next.js with TypeScript
- Backend: Convex (serverless backend)
- Database: Prisma ORM
- Styling: Tailwind CSS

---

## TODO: Implementation Roadmap

### Phase 1: Project Setup & Infrastructure

- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up Prisma ORM with database schema
- [ ] Configure Convex backend
- [ ] Set up ESLint and Prettier
- [ ] Create environment variable configuration (.env)
- [ ] Set up Docker configuration for deployment
- [ ] Configure CI/CD pipeline

### Phase 2: Database & Schema Migration

- [ ] Design Prisma schema based on current SQLite schema
  - [ ] `User` model (id, email, password hash, salt, created_at)
  - [ ] `Team` model (id, name, code, created_at)
  - [ ] `TeamMember` model (user_id, team_id, role, notes)
  - [ ] `ScoutingMatchData` model (Into The Deep game fields)
  - [ ] `Match` model (official FTC match data)
  - [ ] `Score` model (official match scores)
  - [ ] `Schedule` model (event schedules)
- [ ] Create database migrations
- [ ] Implement seed data for development
- [ ] Set up database connection pooling

### Phase 3: Authentication System

- [ ] Implement user registration
  - [ ] Email/password validation
  - [ ] Password hashing with secure algorithm (bcrypt/argon2)
  - [ ] Email verification (optional)
- [ ] Implement user login
  - [ ] Session/JWT token management
  - [ ] Secure cookie handling
- [ ] Implement logout functionality
- [ ] Create authentication middleware/guards
- [ ] Add protected route handling
- [ ] Consider OAuth providers (Google, Discord) for easier login

### Phase 4: Team Management

- [ ] Create team creation flow
  - [ ] Generate unique team join codes
  - [ ] Team name validation
- [ ] Implement team joining via code
- [ ] Implement team leaving functionality
- [ ] Build team administration features
  - [ ] View team members
  - [ ] Remove members (admin only)
  - [ ] Promote members to admin (admin only)
  - [ ] Update team settings (admin only)
- [ ] Add team notes/collaboration features
- [ ] Create team dashboard page

### Phase 5: FTC Events API Integration

- [ ] Create FTC Events API client
  - [ ] Basic auth with API credentials
  - [ ] Base URL: `https://ftc-api.firstinspires.org/v2.0`
- [ ] Implement API endpoints:
  - [ ] Fetch events list for a season
  - [ ] Fetch event details
  - [ ] Fetch match schedule
  - [ ] Fetch match results/scores
  - [ ] Fetch team information
- [ ] Add response caching to reduce API calls
- [ ] Create TypeScript types for all API responses
- [ ] Handle rate limiting and errors gracefully
- [ ] Background job for syncing match data

### Phase 6: Scouting Interface

- [ ] Design mobile-friendly scouting form
- [ ] Implement interactive field view component
  - [ ] Visual representation of FTC field
  - [ ] Touch/click interactions for scoring
- [ ] Create match phase management (Auto/Teleop/Endgame)
- [ ] Implement "Into The Deep" game scoring fields:
  - [ ] Auto phase: samples (high/low), specimens (high/low)
  - [ ] Teleop phase: samples (high/low), specimens (high/low)
  - [ ] Endgame: climb levels (observation zone, ascent levels)
  - [ ] Additional points tracking
- [ ] Add match data submission to backend
- [ ] Real-time data sync with Convex
- [ ] Match history view per team
- [ ] Data export functionality (CSV/JSON)

### Phase 7: Analytics - OPR (Offensive Power Rating)

- [ ] Port OPR algorithm from Python to TypeScript
  - [ ] Use `ml-matrix` library for linear algebra
  - [ ] Implement pseudo-inverse matrix calculations
- [ ] Create OPR calculation endpoint
- [ ] Support multiple statistics:
  - [ ] Total score
  - [ ] Auto points
  - [ ] Teleop points
  - [ ] Endgame points
  - [ ] Individual game elements
- [ ] Build OPR visualization dashboard
  - [ ] Team rankings table
  - [ ] Comparison charts
  - [ ] Event-specific filtering
- [ ] Add caching for computed OPR values

### Phase 8: Analytics - EPA (Expected Points Added)

- [ ] Port EPA algorithm from Python to TypeScript
  - [ ] Initialize with baseline average scores
  - [ ] Implement incremental match-by-match updates
- [ ] Track EPA history over time
- [ ] Create EPA calculation endpoint
- [ ] Build EPA visualization dashboard
  - [ ] Team EPA rankings
  - [ ] EPA trend graphs over season
  - [ ] Team comparison tool
- [ ] Historical EPA tracking per team
- [ ] EPA predictions for upcoming matches

### Phase 9: UI/UX Pages

- [ ] Homepage / Landing page
  - [ ] Feature overview
  - [ ] Quick access to scouting
  - [ ] Recent activity feed
- [ ] Login page with validation
- [ ] Registration page with validation
- [ ] Team dashboard
  - [ ] Team overview
  - [ ] Member management
  - [ ] Scouting statistics
- [ ] Scouting interface page
- [ ] OPR analytics page
  - [ ] Event selection
  - [ ] Interactive data tables
  - [ ] Charts and visualizations
- [ ] EPA analytics page
  - [ ] Team search
  - [ ] Season rankings
  - [ ] Historical trends
- [ ] Team explorer / search page
- [ ] User profile/settings page
- [ ] 404 and error pages

### Phase 10: Real-time Features (Convex)

- [ ] Live scouting data updates
- [ ] Real-time team collaboration
- [ ] Live match score tracking
- [ ] Notification system for team events
- [ ] Collaborative note-taking

### Phase 11: Testing

- [ ] Set up Jest/Vitest for unit testing
- [ ] Write tests for analytics algorithms (OPR/EPA)
- [ ] Write tests for API routes
- [ ] Write tests for authentication flows
- [ ] Set up Playwright/Cypress for E2E testing
- [ ] Create E2E tests for critical user flows
- [ ] Add API integration tests for FTC Events API

### Phase 12: Documentation & Polish

- [ ] Write API documentation
- [ ] Create user guide/tutorial
- [ ] Add inline code documentation
- [ ] Create contribution guidelines
- [ ] Performance optimization
  - [ ] Image optimization
  - [ ] Code splitting
  - [ ] Caching strategies
- [ ] Accessibility audit (WCAG compliance)
- [ ] Mobile responsiveness testing

### Phase 13: Deployment

- [ ] Set up production database
- [ ] Configure environment variables for production
- [ ] Set up Vercel/hosting platform
- [ ] Configure custom domain
- [ ] Set up monitoring and logging
- [ ] Create backup strategy for data
- [ ] Set up error tracking (Sentry or similar)

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
- Current season: 2024 (2024-2025 "Into The Deep")

## Contributing

See `CLAUDE.md` for development guidelines and architecture details.

## License

MIT
