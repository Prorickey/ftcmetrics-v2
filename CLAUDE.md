# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FTC Metrics v2 is a scouting and analytics platform for FIRST Tech Challenge (FTC) teams. It enables teams to collect match data from scouts, fetches official match statistics from the FTC Events API, and computes advanced analytics (EPA/OPR) to understand team performance.

**Current stack (Python/Flask):** This project is being migrated to a modern TypeScript stack.

**Target stack:**
- **Frontend:** Next.js with TypeScript
- **Backend:** Convex (serverless backend)
- **Database:** Prisma ORM
- **Styling:** Tailwind CSS

## Current Architecture

### Python Backend Structure

```
routes/           # Flask blueprints for API endpoints
  auth.py         # /api/register, /api/login, /api/logout
  teams.py        # /api/teams/create, /api/teams/leave, etc.
  scout.py        # Match data collection interface
  stats.py        # OPR/EPA analytics endpoints
  content.py      # Page rendering (Jinja2 templates)

stats/            # Analytics calculation modules
  epa.py          # Expected Points Added (EPA) calculations
  opr.py          # Offensive Power Rating via linear algebra
  events_api.py   # FTC Events API integration

database.py       # SQLite with connection pooling (thread-safe)
R.py              # Redis session management
middlware.py      # @authenticated and @team_admin decorators
```

### Key Patterns

- **Thread-safe database:** Connection pooling via Queue to prevent SQLite contention in multi-threaded Flask
- **Session management:** Redis-backed tokens instead of server-side sessions
- **Authentication:** Decorator pattern (@authenticated, @team_admin) attaches user/team to Flask `g` context
- **Background processing:** EPA calculations run in separate thread at startup
- **FTC API integration:** Basic auth with credentials from .env

### Database Schema (schema.sql)

Core tables: `teams`, `users`, `scouting_match_data`, `scores`, `matches`, `schedule`

Match data fields reflect FTC "Into The Deep" game: samples (high/low/net), specimens, climb levels, etc.

## Commands

```bash
# Current Python setup
source venv/bin/activate
pip install -r requirements.txt
python3 app.py  # Runs on http://0.0.0.0:8080

# Environment setup
cp .env.example .env
# Add FTC Events API credentials: USERNAME and TOKEN
```

## FTC Events API

- Base URL: https://ftc-api.firstinspires.org/v2.0
- Requires credentials from FIRST (register at https://ftc-events.firstinspires.org/services/API)
- Current season: 2024 (2024-2025 "Into The Deep")

## Analytics Algorithms

**EPA (Expected Points Added):**
- Based on Statbotics methodology
- Initialized with January average score baseline
- Updates incrementally per match using match deltas

**OPR (Offensive Power Rating):**
- Uses pseudo-inverse method on alliance matrix
- Linear algebra approach to separate individual team contributions

## Migration Notes

When converting to TypeScript/Next.js/Convex/Prisma:

1. **Auth flow:** Currently uses password hashing with salt stored in SQLite; migrate to a proper auth solution
2. **Real-time:** Convex provides real-time by default; leverage for live scouting updates
3. **Type safety:** Define TypeScript types for FTC API responses and scouting data
4. **EPA/OPR:** Port NumPy calculations to a suitable JS library (e.g., ml-matrix)

Reference the original ftcmetrics repo (https://github.com/Prorickey/ftcmetrics) for inspiration on Next.js/Prisma patterns.
