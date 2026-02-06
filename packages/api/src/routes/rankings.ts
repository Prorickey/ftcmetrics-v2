import { Hono } from "hono";
import { getFTCApi, type FTCEvent } from "../lib/ftc-api";
import {
  calculateEPA,
  getEPARankings,
  type MatchForEPA,
} from "../lib/stats/epa";

const rankings = new Hono();

const CURRENT_SEASON = 2025;

// In-memory cache for global EPA rankings
let rankingsCache: { data: RankingsResponse; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface RankingsResponse {
  success: true;
  data: {
    season: number;
    totalTeams: number;
    totalMatches: number;
    eventsProcessed: number;
    lastUpdated: string;
    rankings: Array<{
      rank: number;
      teamNumber: number;
      epa: number;
      autoEpa: number;
      teleopEpa: number;
      endgameEpa: number;
      matchCount: number;
      trend: "up" | "down" | "stable";
    }>;
  };
}

/**
 * Process items in batches to avoid overwhelming external APIs
 */
async function fetchInBatches<TItem, TResult>(
  items: TItem[],
  batchSize: number,
  fn: (item: TItem) => Promise<TResult>
): Promise<TResult[]> {
  const results: TResult[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Filter events to only include past competitions
 * Excludes off-season, scrimmage, and future events
 */
function filterPastCompetitionEvents(events: FTCEvent[]): FTCEvent[] {
  const now = new Date();
  return events.filter((event) => {
    // Only include events that have ended
    const endDate = new Date(event.dateEnd);
    if (endDate >= now) return false;

    // Filter out non-competition event types
    const excludedTypes = [
      "OffSeason",
      "Scrimmage",
      "Workshop",
      "Practice",
      "Demo",
    ];
    const typeLower = (event.typeName || event.type || "").toLowerCase();
    for (const excluded of excludedTypes) {
      if (typeLower.includes(excluded.toLowerCase())) return false;
    }

    return true;
  });
}

/**
 * Transform FTC API match and score data into MatchForEPA[] with timestamps.
 *
 * This mirrors the transformMatches function in analytics.ts but produces
 * MatchForEPA objects with timestamps for cross-event chronological ordering.
 */
function transformMatchesForGlobalEPA(
  matches: Array<{
    matchNumber: number;
    startTime: string;
    actualStartTime: string | null;
    teams: Array<{ teamNumber: number; station: string }>;
  }>,
  scores: Array<{
    matchNumber: number;
    alliances: Array<{
      alliance: "Red" | "Blue";
      totalPoints: number;
      autoPoints: number;
      dcPoints: number;
      endgamePoints: number;
      team1: number;
      team2: number;
    }>;
  }>
): MatchForEPA[] {
  const results: MatchForEPA[] = [];

  for (const match of matches) {
    const scoreData = scores.find((s) => s.matchNumber === match.matchNumber);
    if (!scoreData || scoreData.alliances.length < 2) continue;

    const redAlliance = scoreData.alliances.find((a) => a.alliance === "Red");
    const blueAlliance = scoreData.alliances.find((a) => a.alliance === "Blue");

    if (!redAlliance || !blueAlliance) continue;

    // Get team numbers from match teams
    const redTeams = match.teams
      .filter((t) => t.station.startsWith("Red"))
      .map((t) => t.teamNumber);
    const blueTeams = match.teams
      .filter((t) => t.station.startsWith("Blue"))
      .map((t) => t.teamNumber);

    if (redTeams.length < 2 || blueTeams.length < 2) continue;

    // Parse timestamp from actualStartTime or startTime
    const timeStr = match.actualStartTime || match.startTime;
    let timestamp: number | undefined;
    if (timeStr) {
      const parsed = new Date(timeStr).getTime();
      if (!isNaN(parsed)) {
        timestamp = parsed;
      }
    }

    // DECODE 2025-2026 uses teleopPoints/teleopBasePoints instead of dcPoints/endgamePoints
    const redTeleop = redAlliance.dcPoints ?? (redAlliance as Record<string, unknown>).teleopPoints as number ?? 0;
    const redEndgame = redAlliance.endgamePoints ?? (redAlliance as Record<string, unknown>).teleopBasePoints as number ?? 0;
    const blueTeleop = blueAlliance.dcPoints ?? (blueAlliance as Record<string, unknown>).teleopPoints as number ?? 0;
    const blueEndgame = blueAlliance.endgamePoints ?? (blueAlliance as Record<string, unknown>).teleopBasePoints as number ?? 0;

    results.push({
      matchNumber: match.matchNumber,
      timestamp,
      redTeam1: redTeams[0],
      redTeam2: redTeams[1],
      blueTeam1: blueTeams[0],
      blueTeam2: blueTeams[1],
      redScore: redAlliance.totalPoints,
      blueScore: blueAlliance.totalPoints,
      redAutoScore: redAlliance.autoPoints,
      redTeleopScore: redTeleop,
      redEndgameScore: redEndgame,
      blueAutoScore: blueAlliance.autoPoints,
      blueTeleopScore: blueTeleop,
      blueEndgameScore: blueEndgame,
    });
  }

  return results;
}

/**
 * Fetch matches and scores for a single event.
 * Returns null if the event has no match data or if the fetch fails.
 */
async function fetchEventMatches(
  eventCode: string
): Promise<MatchForEPA[] | null> {
  try {
    const api = getFTCApi();
    const [matchesResult, scoresResult] = await Promise.all([
      api.getMatches(eventCode, "qual"),
      api.getScores(eventCode, "qual"),
    ]);

    if (
      !matchesResult.matches ||
      matchesResult.matches.length === 0 ||
      !scoresResult.matchScores ||
      scoresResult.matchScores.length === 0
    ) {
      return null;
    }

    const epaMatches = transformMatchesForGlobalEPA(
      matchesResult.matches,
      scoresResult.matchScores
    );

    return epaMatches.length > 0 ? epaMatches : null;
  } catch (error) {
    console.warn(
      `[Rankings] Failed to fetch matches for event ${eventCode}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * GET /api/rankings/epa
 *
 * Global season-wide EPA rankings.
 * Fetches match data from all past events in the current FTC season,
 * calculates EPA across all matches chronologically, and returns
 * a global ranking of all teams.
 *
 * This is an expensive operation. Results are cached in memory for 30 minutes.
 */
rankings.get("/epa", async (c) => {
  // Return cached result if still fresh
  if (rankingsCache && Date.now() - rankingsCache.timestamp < CACHE_TTL) {
    return c.json(rankingsCache.data);
  }

  try {
    const api = getFTCApi();

    // Step 1: Fetch all events for the current season
    const { events } = await api.getEvents();
    const pastEvents = filterPastCompetitionEvents(events);

    if (pastEvents.length === 0) {
      return c.json({
        success: true,
        data: {
          season: CURRENT_SEASON,
          totalTeams: 0,
          totalMatches: 0,
          eventsProcessed: 0,
          lastUpdated: new Date().toISOString(),
          rankings: [],
        },
      });
    }

    console.log(
      `[Rankings] Processing ${pastEvents.length} past events for global EPA...`
    );

    // Step 2: Fetch matches from all past events in batches of 5
    const eventCodes = pastEvents.map((e) => e.code);
    const eventMatchResults = await fetchInBatches(
      eventCodes,
      5,
      fetchEventMatches
    );

    // Step 3: Combine all matches from all events
    const allMatches: MatchForEPA[] = [];
    let eventsProcessed = 0;

    for (const result of eventMatchResults) {
      if (result !== null) {
        allMatches.push(...result);
        eventsProcessed++;
      }
    }

    if (allMatches.length === 0) {
      const emptyResponse: RankingsResponse = {
        success: true,
        data: {
          season: CURRENT_SEASON,
          totalTeams: 0,
          totalMatches: 0,
          eventsProcessed: 0,
          lastUpdated: new Date().toISOString(),
          rankings: [],
        },
      };
      rankingsCache = { data: emptyResponse, timestamp: Date.now() };
      return c.json(emptyResponse);
    }

    console.log(
      `[Rankings] Calculating EPA from ${allMatches.length} matches across ${eventsProcessed} events...`
    );

    // Step 4: Calculate EPA across all matches (sorted chronologically inside calculateEPA)
    const epaRankings = getEPARankings(allMatches);

    // Step 5: Build response with rank numbers
    const rankedResults = epaRankings.map((result, index) => ({
      rank: index + 1,
      teamNumber: result.teamNumber,
      epa: result.epa,
      autoEpa: result.autoEpa,
      teleopEpa: result.teleopEpa,
      endgameEpa: result.endgameEpa,
      matchCount: result.matchCount,
      trend: result.trend || ("stable" as const),
    }));

    const response: RankingsResponse = {
      success: true,
      data: {
        season: CURRENT_SEASON,
        totalTeams: rankedResults.length,
        totalMatches: allMatches.length,
        eventsProcessed,
        lastUpdated: new Date().toISOString(),
        rankings: rankedResults,
      },
    };

    // Cache the result
    rankingsCache = { data: response, timestamp: Date.now() };

    console.log(
      `[Rankings] Global EPA rankings computed: ${rankedResults.length} teams from ${allMatches.length} matches`
    );

    return c.json(response);
  } catch (error) {
    console.error("[Rankings] Error computing global EPA rankings:", error);
    return c.json(
      {
        success: false,
        error: "Failed to compute global EPA rankings",
      },
      500
    );
  }
});

export default rankings;
