# FTC Metrics

A scouting and analytics platform for FIRST Tech Challenge (FTC) teams. Collect match data, compute EPA/OPR rankings, and predict match outcomes.

## Features

- **Team Management** - Create scouting teams, invite members, manage roles (Mentor/Leader/Student/Friend)
- **Match Scouting** - Mobile-first forms for recording quantitative match data
- **Alliance Deduction** - Auto-estimate partner robot scores from official FTC match data
- **Editable Entries** - Fix scouting mistakes with inline editing
- **Team Notes** - Qualitative observations with reliability/driver skill ratings
- **EPA Rankings** - Expected Points Added calculations with trend analysis
- **OPR Rankings** - Offensive Power Rating via iterative least squares
- **Match Predictions** - Win probability and score predictions using EPA
- **FTC API Integration** - Live event data, schedules, and results
- **PWA + Offline** - Installable app with offline scouting and auto-sync

**Current Season:** DECODE (2025-2026)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15 + TypeScript |
| Backend API | Hono |
| Database | PostgreSQL + Prisma |
| Real-time | Soketi (Pusher-compatible) |
| Styling | Tailwind CSS |
| Auth | NextAuth.js (OAuth) |
| Package Manager | Bun |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Docker](https://www.docker.com/) and Docker Compose
- FTC Events API credentials ([register here](https://ftc-events.firstinspires.org/services/API))

### Installation

```bash
# Clone the repository
git clone https://github.com/Prorickey/ftcmetrics-v2.git
cd ftcmetrics-v2

# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your FTC API credentials and OAuth provider keys
```

### Running Locally

```bash
# Start infrastructure (PostgreSQL, Redis, Soketi)
docker compose up -d

# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# Start all services in development mode
bun run dev
```

The application will be available at:
- **Web:** http://localhost:3000
- **API:** http://localhost:3001

### Database Commands

```bash
bun run db:generate  # Generate Prisma client
bun run db:push      # Push schema to database
bun run db:studio    # Open Prisma Studio
bun run db:migrate   # Create migration
```

## Project Structure

```
ftcmetrics-v2/
├── packages/
│   ├── web/              # Next.js frontend
│   │   └── src/app/      # App router pages
│   ├── api/              # Hono API server
│   │   └── src/routes/   # API endpoints
│   ├── db/               # Prisma schema and client
│   └── shared/           # Shared types
├── docker-compose.yml    # Local dev services
└── package.json          # Bun workspace root
```

## Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/ftcmetrics"

# FTC Events API
FTC_API_USERNAME=your_username
FTC_API_TOKEN=your_token

# Auth (at least one OAuth provider)
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

See `.env.example` for all available options.

## Analytics

### EPA (Expected Points Added)

Bayesian-style metric that estimates each team's contribution to alliance scores. Updates incrementally after each match with adaptive K-factor based on experience.

### OPR (Offensive Power Rating)

Uses iterative least squares to decompose alliance scores into individual team contributions. Includes component breakdown (auto/teleop/endgame) and DPR calculations.

### Match Predictions

Combines EPA values to predict alliance scores and win probabilities using a logistic model.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/events` | List FTC events |
| `GET /api/events/:code` | Event details |
| `GET /api/analytics/epa` | EPA rankings |
| `GET /api/analytics/opr` | OPR rankings |
| `GET /api/analytics/predict` | Match prediction |
| `POST /api/scouting/entries` | Submit scouting data |
| `PATCH /api/scouting/entries/:id` | Update scouting entry |
| `POST /api/scouting/entries/:id/deduct-partner` | Deduct alliance partner scores |
| `POST /api/scouting/notes` | Submit team notes |

## Team Roles

| Role | Privileges |
|------|-----------|
| **Mentor** | Full admin: manage settings, invites, members, roles, scouting |
| **Leader** | Full admin: same as Mentor |
| **Student** | Regular member: scout, view data, update own role |
| **Friend** | View-only: can view team data but cannot scout |

## PWA & Offline Scouting

FTC Metrics is a Progressive Web App designed for use at competitions where connectivity is unreliable.

### Installing

- **iOS**: Open in Safari > Share button > "Add to Home Screen"
- **Android**: Open in Chrome > Menu > "Install app"
- **Desktop**: Click the install icon in the address bar

### Offline Mode

Scouting entries are queued locally in IndexedDB when offline and sync automatically when connectivity returns.

- **Green dot** = Online, data submits immediately
- **Red dot** = Offline, data queues locally
- **Yellow badge** = Number of pending entries waiting to sync
- **Sync Now** button available for manual sync

### Technical Details

- Uses `@ducanh2912/next-pwa` for service worker generation
- IndexedDB stores queued entries (persists across browser restarts)
- Auto-sync triggers on `online` event
- Service worker disabled in development, enabled in production builds
- Requires HTTPS for full service worker support (except localhost)

### Offline Limitations

- Event team lists must be loaded while online
- Analytics and match schedules require connectivity
- IndexedDB may not work in private/incognito mode

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [FIRST Tech Challenge](https://www.firstinspires.org/robotics/ftc) for the FTC Events API
- [Statbotics](https://statbotics.io/) for EPA methodology inspiration
