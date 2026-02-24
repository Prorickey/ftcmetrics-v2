# ftcmetrics

Official TypeScript SDK for the [FTCMetrics](https://ftcmetrics.com) API and the [FTC Events API](https://ftc-api.firstinspires.org/).

## Installation

```bash
npm install ftcmetrics
# or
bun add ftcmetrics
```

## Quick Start

```typescript
import { FTCMetrics } from 'ftcmetrics';

const client = new FTCMetrics({
  ftcmApiKey: 'ftcm_your_key_here',
  ftcApiCredentials: { username: '...', token: '...' },
  season: 2025,
});

// FTCMetrics API
const events = await client.events.list();
const epa = await client.analytics.epa('USFLOR');
const rankings = await client.rankings.global({ country: 'US' });

// FTC Events API (direct FIRST API)
const ftcEvents = await client.ftcApi.getEvents();
const scores = await client.ftcApi.getScores('USFLOR', 'qual');
```

You can provide only the credentials you need. The other sub-client will throw a helpful error if used without credentials.

## API Reference

### `client.events`

| Method | Description |
|--------|-------------|
| `list()` | List all events |
| `get_(eventCode)` | Get a specific event |
| `teams(eventCode)` | Get teams at an event |
| `schedule(eventCode, level?)` | Get event schedule |
| `matches(eventCode, level?)` | Get event matches |
| `rankings(eventCode)` | Get event rankings |

### `client.teams`

| Method | Description |
|--------|-------------|
| `get_(teamNumber)` | Get team info |
| `events(teamNumber)` | Get team's events |
| `profile(teamNumber)` | Get team profile |
| `eventSummaries(teamNumber)` | Get team event summaries |
| `search(query)` | Search teams |

### `client.analytics`

| Method | Description |
|--------|-------------|
| `opr(eventCode)` | Get OPR rankings for event |
| `epa(eventCode)` | Get EPA rankings for event |
| `team(teamNumber, opts?)` | Get team analytics |
| `predict(params)` | Predict match outcome |
| `teamMatches(teamNumber, eventCode)` | Get team match breakdowns |
| `compare(eventCode, teams)` | Compare teams at event |

### `client.rankings`

| Method | Description |
|--------|-------------|
| `global(opts?)` | Get global EPA rankings |
| `filters()` | Get available ranking filters |
| `team(teamNumber)` | Get team ranking details |

### `client.ftcApi`

| Method | Description |
|--------|-------------|
| `getEvents()` | List all FTC events |
| `getEvent(eventCode)` | Get specific event |
| `getEventTeams(eventCode)` | Get teams at event |
| `getTeam(teamNumber)` | Get team info |
| `getSchedule(eventCode, level?)` | Get match schedule |
| `getMatches(eventCode, level?)` | Get match results |
| `getScores(eventCode, level?)` | Get detailed scores |
| `getRankings(eventCode)` | Get event rankings |
| `getTeamEvents(teamNumber)` | Get team's events |

## Error Handling

```typescript
import { FTCMetricsApiError, FTCEventsApiError } from 'ftcmetrics';

try {
  await client.analytics.epa('USFLOR');
} catch (err) {
  if (err instanceof FTCMetricsApiError) {
    console.error(`API error ${err.status}: ${err.message}`);
  }
}
```

| Error Class | When |
|-------------|------|
| `FTCMetricsConfigError` | Invalid config or missing credentials |
| `FTCMetricsApiError` | FTCMetrics API HTTP error |
| `FTCEventsApiError` | FTC Events API HTTP error |
| `FTCMetricsError` | Base error class |

## TypeScript

All types are exported:

```typescript
import type { EPAResult, OPRResult, FTCEvent, FTCTeam } from 'ftcmetrics';
```

## Requirements

- Node.js >= 18 (uses native `fetch`)
- Works in Bun, Deno, and modern browsers
