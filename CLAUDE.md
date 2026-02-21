# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FTC Metrics is a scouting and analytics platform for FIRST Tech Challenge (FTC) teams. It enables teams to collect match data from scouts, fetches official match statistics from the FTC Events API, and computes advanced analytics (EPA/OPR) to understand team performance.

**Current Season:** DECODE 2025-2026

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15 + TypeScript |
| Backend API | Hono |
| Database | PostgreSQL + Prisma |
| Real-time | Soketi (Pusher-compatible) |
| Styling | Tailwind CSS |
| Auth | NextAuth.js (OAuth only) |
| Package Manager | Bun |
| Node Version | 24 LTS |

## Project Structure

```
ftcmetrics-v2/
├── packages/
│   ├── web/              # Next.js frontend (PWA)
│   │   ├── src/app/      # App router pages
│   │   └── src/          # Components, hooks, utils
│   ├── api/              # Hono API server
│   │   └── src/          # Routes, middleware
│   ├── db/               # Prisma schema and client
│   │   └── prisma/       # Schema and migrations
│   └── shared/           # Shared types and utilities
├── docker-compose.yml    # Local dev services (Postgres, Redis, Soketi)
├── package.json          # Bun workspace root
└── tsconfig.base.json    # Shared TypeScript config
```

## Commands

```bash
# Install dependencies
bun install

# Start infrastructure (Postgres, Redis, Soketi)
docker-compose up -d

# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# Run all services in development
bun run dev

# Run specific packages
bun run dev:web    # Next.js on http://localhost:3000
bun run dev:api    # Hono API on http://localhost:3001

# Database management
bun run db:studio  # Prisma Studio
bun run db:migrate # Create migration
```

## Environment Setup

```bash
cp .env.example .env
# Configure:
# - DATABASE_URL (PostgreSQL connection)
# - FTC_API_USERNAME and FTC_API_TOKEN
# - OAuth provider credentials (Google, Discord, GitHub)
# - NEXTAUTH_SECRET
```

## FTC Events API

- Base URL: `https://ftc-api.firstinspires.org/v2.0`
- Requires credentials from FIRST (register at https://ftc-events.firstinspires.org/services/API)
- Current season: 2025 (DECODE)

## DECODE Scoring Reference

### Autonomous (30 seconds)
| Action | Points |
|--------|--------|
| LEAVE | 3 |
| Classified Artifact | 3 each |
| Overflow Artifact | 1 each |
| Pattern | 2 each |

### Teleop (2 minutes)
| Action | Points |
|--------|--------|
| Classified Artifact | 3 each |
| Overflow Artifact | 1 each |
| Depot Artifact | 1 each |
| Pattern | 2 each |
| Motif | 2 each |

### Endgame
| Action | Points |
|--------|--------|
| Base Partial | 5 |
| Base Full | 10 |
| Base Bonus (2 robots) | 10 |

## Analytics Algorithms

**EPA (Expected Points Added):**
- Based on Statbotics methodology
- Initialized with season average baseline
- Updates incrementally per match

**OPR (Offensive Power Rating):**
- Uses pseudo-inverse method on alliance matrix
- Use `ml-matrix` library for linear algebra

## Key Design Decisions

- **Mobile-first**: Primary experience is on phones at events
- **Real-time**: Everything updates live via Soketi WebSockets
- **Minimal UI**: Clean interface inspired by Statbotics
- **PWA**: Offline scouting with sync when back online
- **Kubernetes-ready**: Stateless containers for easy scaling

## Skills

Project-specific skills are available in `.claude/skills/`:

| Skill | Category | Description |
|-------|----------|-------------|
| `analytics` | analytics | EPA and OPR calculation algorithms |
| `bun-workspace` | tools | Bun runtime and monorepo workspace management |
| `ftc-events-api` | api | FTC Events API integration and usage |
| `hono` | api | Hono API framework patterns and middleware |
| `nextauth` | auth | NextAuth.js v5 authentication with Prisma adapter |
| `nextjs` | frontend | Next.js 16 App Router and React 19 patterns |
| `prismadb` | database | Prisma 7 ORM configuration with PostgreSQL adapters |
| `skill-builder` | tools | Create new skills for this project |
| `soketi` | realtime | Soketi WebSocket server for real-time features |
| `tailwind` | frontend | Tailwind CSS with FTC branding and responsive design |
| `typescript-monorepo` | tools | TypeScript configuration across workspace packages |
