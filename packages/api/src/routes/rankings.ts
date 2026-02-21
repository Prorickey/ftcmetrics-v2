import { Hono } from "hono";
import { getFTCApi, type FTCEvent } from "../lib/ftc-api";
import {
  calculateEPA,
  getEPARankings,
  type MatchForEPA,
} from "../lib/stats/epa";
import {
  calculateOPR,
  type MatchResult,
} from "../lib/stats/opr";
import { getRedis } from "../lib/redis";
import { prisma } from "@ftcmetrics/db";

const rankings = new Hono();

const CURRENT_SEASON = 2025;

// Redis cache key and TTL for global EPA rankings
const RANKINGS_CACHE_KEY = "ftcmetrics:rankings:epa";
const OPR_RANKINGS_CACHE_KEY = "ftcmetrics:rankings:opr";
const RANKINGS_CACHE_TTL = 30 * 60; // 30 minutes in seconds

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
 * Compute global EPA rankings and cache in Redis.
 * Extracted so it can be called at startup and on a timer.
 */
export async function computeAndCacheRankings(): Promise<RankingsResponse | null> {
  console.log("[Rankings] Background computation started");
  const startTime = Date.now();

  try {
    const api = getFTCApi();

    const { events } = await api.getEvents();
    const pastEvents = filterPastCompetitionEvents(events);

    if (pastEvents.length === 0) {
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
      const redis = getRedis();
      if (redis) {
        try { await redis.setex(RANKINGS_CACHE_KEY, RANKINGS_CACHE_TTL, JSON.stringify(emptyResponse)); } catch {}
      }
      console.log("[Rankings] Background computation completed (no events)");
      return emptyResponse;
    }

    console.log(
      `[Rankings] Processing ${pastEvents.length} past events for global EPA...`
    );

    const eventCodes = pastEvents.map((e) => e.code);
    const eventMatchResults = await fetchInBatches(
      eventCodes,
      5,
      fetchEventMatches
    );

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
      const redis = getRedis();
      if (redis) {
        try { await redis.setex(RANKINGS_CACHE_KEY, RANKINGS_CACHE_TTL, JSON.stringify(emptyResponse)); } catch {}
      }
      console.log("[Rankings] Background computation completed (no matches)");
      return emptyResponse;
    }

    // Cache all team info from events into ftcTeam table for location-based rankings
    console.log(
      `[Rankings] Fetching team info from ${pastEvents.length} events for location data...`
    );
    const allTeamsMap = new Map<number, { nameShort: string; nameFull: string; city: string; stateProv: string; country: string; rookieYear: number }>();
    await fetchInBatches(eventCodes, 5, async (eventCode) => {
      try {
        const api = getFTCApi();
        const { teams } = await api.getEventTeams(eventCode);
        for (const t of teams) {
          if (!allTeamsMap.has(t.teamNumber)) {
            allTeamsMap.set(t.teamNumber, {
              nameShort: t.nameShort,
              nameFull: t.nameFull,
              city: t.city,
              stateProv: t.stateProv,
              country: t.country,
              rookieYear: t.rookieYear,
            });
          }
        }
      } catch (err) {
        console.warn(`[Rankings] Failed to fetch teams for event ${eventCode}:`, err instanceof Error ? err.message : err);
      }
      return null;
    });

    console.log(`[Rankings] Caching ${allTeamsMap.size} teams into database...`);
    const teamEntries = Array.from(allTeamsMap.entries());
    await fetchInBatches(teamEntries, 50, async ([teamNumber, t]) => {
      try {
        await prisma.ftcTeam.upsert({
          where: { teamNumber },
          create: {
            teamNumber,
            nameShort: t.nameShort,
            nameFull: t.nameFull,
            city: t.city,
            stateProv: t.stateProv,
            country: t.country,
            rookieYear: t.rookieYear,
          },
          update: {
            nameShort: t.nameShort,
            nameFull: t.nameFull,
            city: t.city,
            stateProv: t.stateProv,
            country: t.country,
            rookieYear: t.rookieYear,
            fetchedAt: new Date(),
          },
        });
      } catch {}
      return null;
    });

    console.log(
      `[Rankings] Calculating EPA from ${allMatches.length} matches across ${eventsProcessed} events...`
    );

    const epaRankings = getEPARankings(allMatches);

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

    const redis = getRedis();
    if (redis) {
      try { await redis.setex(RANKINGS_CACHE_KEY, RANKINGS_CACHE_TTL, JSON.stringify(response)); } catch {}
    }

    // Compute OPR rankings: calculate per-event OPR then average across events per team
    console.log(
      `[Rankings] Calculating OPR from ${eventsProcessed} events...`
    );

    // Group matches by event for per-event OPR calculation
    // We need to re-fetch per-event since OPR must be computed per-event then averaged
    const teamOprAccumulators = new Map<number, {
      oprSum: number; autoOprSum: number; teleopOprSum: number; endgameOprSum: number;
      eventCount: number; matchCount: number;
    }>();

    for (let i = 0; i < eventCodes.length; i++) {
      const eventMatches = eventMatchResults[i];
      if (!eventMatches) continue;

      // Convert MatchForEPA to MatchResult for OPR calculation
      const oprMatches: MatchResult[] = eventMatches.map((m) => ({
        redTeam1: m.redTeam1,
        redTeam2: m.redTeam2,
        blueTeam1: m.blueTeam1,
        blueTeam2: m.blueTeam2,
        redScore: m.redScore,
        blueScore: m.blueScore,
        redAutoScore: m.redAutoScore,
        redTeleopScore: m.redTeleopScore,
        redEndgameScore: m.redEndgameScore,
        blueAutoScore: m.blueAutoScore,
        blueTeleopScore: m.blueTeleopScore,
        blueEndgameScore: m.blueEndgameScore,
      }));

      const eventOprResults = calculateOPR(oprMatches);

      for (const [teamNum, oprResult] of eventOprResults) {
        let acc = teamOprAccumulators.get(teamNum);
        if (!acc) {
          acc = { oprSum: 0, autoOprSum: 0, teleopOprSum: 0, endgameOprSum: 0, eventCount: 0, matchCount: 0 };
          teamOprAccumulators.set(teamNum, acc);
        }
        acc.oprSum += oprResult.opr;
        acc.autoOprSum += oprResult.autoOpr ?? 0;
        acc.teleopOprSum += oprResult.teleopOpr ?? 0;
        acc.endgameOprSum += oprResult.endgameOpr ?? 0;
        acc.eventCount += 1;
        // Count matches this team played in this event
        const teamMatchCount = oprMatches.filter(
          (m) => m.redTeam1 === teamNum || m.redTeam2 === teamNum || m.blueTeam1 === teamNum || m.blueTeam2 === teamNum
        ).length;
        acc.matchCount += teamMatchCount;
      }
    }

    // Build averaged OPR rankings sorted by OPR descending
    const oprRankedResults = Array.from(teamOprAccumulators.entries())
      .map(([teamNumber, acc]) => ({
        teamNumber,
        opr: Math.round((acc.oprSum / acc.eventCount) * 100) / 100,
        autoOpr: Math.round((acc.autoOprSum / acc.eventCount) * 100) / 100,
        teleopOpr: Math.round((acc.teleopOprSum / acc.eventCount) * 100) / 100,
        endgameOpr: Math.round((acc.endgameOprSum / acc.eventCount) * 100) / 100,
        matchCount: acc.matchCount,
      }))
      .sort((a, b) => b.opr - a.opr)
      .map((entry, index) => ({ rank: index + 1, ...entry }));

    const oprResponse = {
      success: true as const,
      data: {
        season: CURRENT_SEASON,
        totalTeams: oprRankedResults.length,
        totalMatches: allMatches.length,
        eventsProcessed,
        lastUpdated: new Date().toISOString(),
        rankings: oprRankedResults,
      },
    };

    if (redis) {
      try { await redis.setex(OPR_RANKINGS_CACHE_KEY, RANKINGS_CACHE_TTL, JSON.stringify(oprResponse)); } catch {}
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Rankings] Background computation completed in ${elapsed}s: ${rankedResults.length} teams (EPA), ${oprRankedResults.length} teams (OPR) from ${allMatches.length} matches`
    );

    return response;
  } catch (error) {
    console.error("[Rankings] Background computation failed:", error);
    return null;
  }
}

/**
 * GET /api/rankings/epa
 *
 * Global season-wide EPA rankings.
 * Returns cached results from Redis. Falls back to inline computation if cache is empty.
 */
rankings.get("/epa", async (c) => {
  const scope = c.req.query("scope") || "global";
  const countryParam = c.req.query("country");
  const stateParam = c.req.query("state");

  // Return cached result from Redis if available
  const redis = getRedis();
  let rankingsResponse: RankingsResponse | null = null;

  if (redis) {
    try {
      const cached = await redis.get(RANKINGS_CACHE_KEY);
      if (cached) {
        rankingsResponse = JSON.parse(cached) as RankingsResponse;
      }
    } catch {
      // Redis read failed, proceed with fresh computation
    }
  }

  if (!rankingsResponse) {
    // Cache miss — compute inline as fallback
    try {
      rankingsResponse = await computeAndCacheRankings();
    } catch (error) {
      console.error("[Rankings] Error computing global EPA rankings:", error);
    }
  }

  if (!rankingsResponse) {
    return c.json({ success: false, error: "Failed to compute global EPA rankings" }, 500);
  }

  // If global scope or no filtering params, return as-is
  if (scope === "global" || (!countryParam && !stateParam)) {
    return c.json(rankingsResponse);
  }

  // Filter by location
  const teamNumbers = rankingsResponse.data.rankings.map((r) => r.teamNumber);
  const teamLocations = await prisma.ftcTeam.findMany({
    where: { teamNumber: { in: teamNumbers } },
    select: { teamNumber: true, country: true, stateProv: true },
  });
  const locationMap = new Map(teamLocations.map((t) => [t.teamNumber, t]));

  let filtered = rankingsResponse.data.rankings;

  if (scope === "country" && countryParam) {
    filtered = filtered.filter((r) => {
      const loc = locationMap.get(r.teamNumber);
      return loc?.country === countryParam;
    });
  } else if (scope === "state" && countryParam && stateParam) {
    filtered = filtered.filter((r) => {
      const loc = locationMap.get(r.teamNumber);
      return loc?.country === countryParam && loc?.stateProv === stateParam;
    });
  }

  // Re-number ranks
  const reranked = filtered.map((r, i) => ({ ...r, rank: i + 1 }));

  return c.json({
    success: true,
    data: {
      ...rankingsResponse.data,
      totalTeams: reranked.length,
      rankings: reranked,
    },
  } as RankingsResponse);
});

/**
 * GET /api/rankings/filters
 *
 * Returns available countries and states for filtering rankings.
 */
rankings.get("/filters", async (c) => {
  // Get ranked team numbers from cache
  const redis = getRedis();
  let teamNumbers: number[] = [];

  if (redis) {
    try {
      const cached = await redis.get(RANKINGS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as RankingsResponse;
        teamNumbers = parsed.data.rankings.map((r) => r.teamNumber);
      }
    } catch {}
  }

  // Query distinct country/stateProv combos for ranked teams
  const whereClause = teamNumbers.length > 0
    ? { teamNumber: { in: teamNumbers }, country: { not: "" } }
    : { country: { not: "" } };

  const teams = await prisma.ftcTeam.findMany({
    where: whereClause,
    select: { country: true, stateProv: true },
  });

  const countriesSet = new Set<string>();
  const statesMap: Record<string, Set<string>> = {};

  for (const t of teams) {
    if (!t.country) continue;
    countriesSet.add(t.country);
    if (t.stateProv) {
      if (!statesMap[t.country]) statesMap[t.country] = new Set();
      statesMap[t.country].add(t.stateProv);
    }
  }

  const countries = Array.from(countriesSet).sort();
  const states: Record<string, string[]> = {};
  for (const [country, stateSet] of Object.entries(statesMap)) {
    states[country] = Array.from(stateSet).sort();
  }

  return c.json({ success: true, data: { countries, states } });
});

/**
 * GET /api/rankings/team/:teamNumber
 *
 * Returns world, country, and state/province rank for a specific team.
 */
rankings.get("/team/:teamNumber", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);
  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  // Read cached rankings from Redis
  const redis = getRedis();
  let rankingsData: RankingsResponse["data"] | null = null;
  type OPRRankingsResponse = { success: true; data: { season: number; totalTeams: number; totalMatches: number; eventsProcessed: number; lastUpdated: string; rankings: Array<{ rank: number; teamNumber: number; opr: number; autoOpr: number; teleopOpr: number; endgameOpr: number; matchCount: number }> } };
  let oprRankingsData: OPRRankingsResponse["data"] | null = null;

  if (redis) {
    try {
      const [cached, oprCached] = await Promise.all([
        redis.get(RANKINGS_CACHE_KEY),
        redis.get(OPR_RANKINGS_CACHE_KEY),
      ]);
      if (cached) {
        const parsed = JSON.parse(cached) as RankingsResponse;
        rankingsData = parsed.data;
      }
      if (oprCached) {
        const parsed = JSON.parse(oprCached) as OPRRankingsResponse;
        oprRankingsData = parsed.data;
      }
    } catch {}
  }

  if (!rankingsData || rankingsData.rankings.length === 0) {
    return c.json(
      { success: false, error: "Rankings not yet computed. Please try again shortly." },
      503
    );
  }

  // Find team in world rankings
  const teamRanking = rankingsData.rankings.find(
    (r) => r.teamNumber === teamNumber
  );
  if (!teamRanking) {
    return c.json(
      { success: false, error: "Team not found in rankings" },
      404
    );
  }

  const worldRank = teamRanking.rank;
  const worldTotal = rankingsData.totalTeams;

  // Fetch team's location
  const team = await prisma.ftcTeam.findUnique({
    where: { teamNumber },
    select: { country: true, stateProv: true },
  });

  // Find team in OPR rankings
  const teamOprRanking = oprRankingsData?.rankings.find(
    (r) => r.teamNumber === teamNumber
  );
  const oprWorldRank = teamOprRanking?.rank ?? null;
  const oprWorldTotal = oprRankingsData?.totalTeams ?? null;

  if (!team) {
    // Compute world-level component rankings even without location
    const noLocComponentRanks: Record<string, number | null> = {};
    for (const component of ["autoEpa", "teleopEpa", "endgameEpa"] as const) {
      const prefix = component.replace("Epa", "");
      const sorted = [...rankingsData.rankings].sort(
        (a, b) => b[component] - a[component]
      );
      const idx = sorted.findIndex((r) => r.teamNumber === teamNumber);
      noLocComponentRanks[`${prefix}WorldRank`] = idx >= 0 ? idx + 1 : null;
    }

    // OPR world component ranks
    const noLocOprComponentRanks: Record<string, number | null> = {};
    if (oprRankingsData) {
      for (const component of ["autoOpr", "teleopOpr", "endgameOpr"] as const) {
        const prefix = component.replace("Opr", "Opr");
        const sorted = [...oprRankingsData.rankings].sort(
          (a, b) => b[component] - a[component]
        );
        const idx = sorted.findIndex((r) => r.teamNumber === teamNumber);
        noLocOprComponentRanks[`${component}WorldRank`] = idx >= 0 ? idx + 1 : null;
      }
    }

    // Return world rank only if team location not in DB
    return c.json({
      success: true,
      data: {
        worldRank,
        worldTotal,
        countryRank: null,
        countryTotal: null,
        country: null,
        stateRank: null,
        stateTotal: null,
        stateProv: null,
        epa: teamRanking.epa,
        autoEpa: teamRanking.autoEpa,
        teleopEpa: teamRanking.teleopEpa,
        endgameEpa: teamRanking.endgameEpa,
        autoWorldRank: noLocComponentRanks.autoWorldRank,
        teleopWorldRank: noLocComponentRanks.teleopWorldRank,
        endgameWorldRank: noLocComponentRanks.endgameWorldRank,
        autoCountryRank: null,
        teleopCountryRank: null,
        endgameCountryRank: null,
        autoStateRank: null,
        teleopStateRank: null,
        endgameStateRank: null,
        opr: teamOprRanking?.opr ?? null,
        autoOpr: teamOprRanking?.autoOpr ?? null,
        teleopOpr: teamOprRanking?.teleopOpr ?? null,
        endgameOpr: teamOprRanking?.endgameOpr ?? null,
        oprWorldRank,
        oprWorldTotal,
        oprCountryRank: null,
        oprStateRank: null,
        autoOprWorldRank: noLocOprComponentRanks.autoOprWorldRank ?? null,
        teleopOprWorldRank: noLocOprComponentRanks.teleopOprWorldRank ?? null,
        endgameOprWorldRank: noLocOprComponentRanks.endgameOprWorldRank ?? null,
        autoOprCountryRank: null,
        teleopOprCountryRank: null,
        endgameOprCountryRank: null,
        autoOprStateRank: null,
        teleopOprStateRank: null,
        endgameOprStateRank: null,
      },
    });
  }

  // Batch-fetch locations for all ranked teams
  const allTeamNumbers = rankingsData.rankings.map((r) => r.teamNumber);
  const allTeamLocations = await prisma.ftcTeam.findMany({
    where: { teamNumber: { in: allTeamNumbers } },
    select: { teamNumber: true, country: true, stateProv: true },
  });

  const locationMap = new Map(
    allTeamLocations.map((t) => [t.teamNumber, t])
  );

  // Compute country rank
  let countryRank: number | null = null;
  let countryTotal: number | null = null;
  if (team.country) {
    let countryCount = 0;
    for (const r of rankingsData.rankings) {
      const loc = locationMap.get(r.teamNumber);
      if (loc?.country === team.country) {
        countryCount++;
        if (r.teamNumber === teamNumber) {
          countryRank = countryCount;
        }
      }
    }
    countryTotal = countryCount;
  }

  // Compute state rank
  let stateRank: number | null = null;
  let stateTotal: number | null = null;
  if (team.country && team.stateProv) {
    let stateCount = 0;
    for (const r of rankingsData.rankings) {
      const loc = locationMap.get(r.teamNumber);
      if (loc?.country === team.country && loc?.stateProv === team.stateProv) {
        stateCount++;
        if (r.teamNumber === teamNumber) {
          stateRank = stateCount;
        }
      }
    }
    stateTotal = stateCount;
  }

  // Compute component rankings (auto, teleop, endgame) at world/country/state level
  const components = ["autoEpa", "teleopEpa", "endgameEpa"] as const;
  const componentRanks: Record<string, number | null> = {
    autoWorldRank: null, teleopWorldRank: null, endgameWorldRank: null,
    autoCountryRank: null, teleopCountryRank: null, endgameCountryRank: null,
    autoStateRank: null, teleopStateRank: null, endgameStateRank: null,
  };

  for (const component of components) {
    const prefix = component.replace("Epa", "");

    // World rank by component: sort all rankings by this component descending
    const worldSorted = [...rankingsData.rankings].sort(
      (a, b) => b[component] - a[component]
    );
    const worldIdx = worldSorted.findIndex((r) => r.teamNumber === teamNumber);
    componentRanks[`${prefix}WorldRank`] = worldIdx >= 0 ? worldIdx + 1 : null;

    // Country rank by component
    if (team.country) {
      const countrySorted = rankingsData.rankings
        .filter((r) => locationMap.get(r.teamNumber)?.country === team.country)
        .sort((a, b) => b[component] - a[component]);
      const countryIdx = countrySorted.findIndex((r) => r.teamNumber === teamNumber);
      componentRanks[`${prefix}CountryRank`] = countryIdx >= 0 ? countryIdx + 1 : null;
    }

    // State rank by component
    if (team.country && team.stateProv) {
      const stateSorted = rankingsData.rankings
        .filter((r) => {
          const loc = locationMap.get(r.teamNumber);
          return loc?.country === team.country && loc?.stateProv === team.stateProv;
        })
        .sort((a, b) => b[component] - a[component]);
      const stateIdx = stateSorted.findIndex((r) => r.teamNumber === teamNumber);
      componentRanks[`${prefix}StateRank`] = stateIdx >= 0 ? stateIdx + 1 : null;
    }
  }

  // Compute OPR component rankings at world/country/state level
  const oprComponentRanks: Record<string, number | null> = {
    oprCountryRank: null, oprStateRank: null,
    autoOprWorldRank: null, teleopOprWorldRank: null, endgameOprWorldRank: null,
    autoOprCountryRank: null, teleopOprCountryRank: null, endgameOprCountryRank: null,
    autoOprStateRank: null, teleopOprStateRank: null, endgameOprStateRank: null,
  };

  if (oprRankingsData && oprRankingsData.rankings.length > 0) {
    // OPR country rank
    if (team.country) {
      let oprCountryCount = 0;
      const oprCountrySorted = oprRankingsData.rankings
        .filter((r) => locationMap.get(r.teamNumber)?.country === team.country);
      for (const r of oprCountrySorted) {
        oprCountryCount++;
        if (r.teamNumber === teamNumber) {
          oprComponentRanks.oprCountryRank = oprCountryCount;
        }
      }
    }

    // OPR state rank
    if (team.country && team.stateProv) {
      let oprStateCount = 0;
      const oprStateSorted = oprRankingsData.rankings
        .filter((r) => {
          const loc = locationMap.get(r.teamNumber);
          return loc?.country === team.country && loc?.stateProv === team.stateProv;
        });
      for (const r of oprStateSorted) {
        oprStateCount++;
        if (r.teamNumber === teamNumber) {
          oprComponentRanks.oprStateRank = oprStateCount;
        }
      }
    }

    // OPR component ranks (auto, teleop, endgame)
    for (const component of ["autoOpr", "teleopOpr", "endgameOpr"] as const) {
      // World
      const worldSorted = [...oprRankingsData.rankings].sort(
        (a, b) => b[component] - a[component]
      );
      const worldIdx = worldSorted.findIndex((r) => r.teamNumber === teamNumber);
      oprComponentRanks[`${component}WorldRank`] = worldIdx >= 0 ? worldIdx + 1 : null;

      // Country
      if (team.country) {
        const countrySorted = oprRankingsData.rankings
          .filter((r) => locationMap.get(r.teamNumber)?.country === team.country)
          .sort((a, b) => b[component] - a[component]);
        const countryIdx = countrySorted.findIndex((r) => r.teamNumber === teamNumber);
        oprComponentRanks[`${component}CountryRank`] = countryIdx >= 0 ? countryIdx + 1 : null;
      }

      // State
      if (team.country && team.stateProv) {
        const stateSorted = oprRankingsData.rankings
          .filter((r) => {
            const loc = locationMap.get(r.teamNumber);
            return loc?.country === team.country && loc?.stateProv === team.stateProv;
          })
          .sort((a, b) => b[component] - a[component]);
        const stateIdx = stateSorted.findIndex((r) => r.teamNumber === teamNumber);
        oprComponentRanks[`${component}StateRank`] = stateIdx >= 0 ? stateIdx + 1 : null;
      }
    }
  }

  return c.json({
    success: true,
    data: {
      worldRank,
      worldTotal,
      countryRank,
      countryTotal,
      country: team.country,
      stateRank,
      stateTotal,
      stateProv: team.stateProv,
      epa: teamRanking.epa,
      autoEpa: teamRanking.autoEpa,
      teleopEpa: teamRanking.teleopEpa,
      endgameEpa: teamRanking.endgameEpa,
      autoWorldRank: componentRanks.autoWorldRank,
      teleopWorldRank: componentRanks.teleopWorldRank,
      endgameWorldRank: componentRanks.endgameWorldRank,
      autoCountryRank: componentRanks.autoCountryRank,
      teleopCountryRank: componentRanks.teleopCountryRank,
      endgameCountryRank: componentRanks.endgameCountryRank,
      autoStateRank: componentRanks.autoStateRank,
      teleopStateRank: componentRanks.teleopStateRank,
      endgameStateRank: componentRanks.endgameStateRank,
      opr: teamOprRanking?.opr ?? null,
      autoOpr: teamOprRanking?.autoOpr ?? null,
      teleopOpr: teamOprRanking?.teleopOpr ?? null,
      endgameOpr: teamOprRanking?.endgameOpr ?? null,
      oprWorldRank,
      oprWorldTotal,
      oprCountryRank: oprComponentRanks.oprCountryRank,
      oprStateRank: oprComponentRanks.oprStateRank,
      autoOprWorldRank: oprComponentRanks.autoOprWorldRank,
      teleopOprWorldRank: oprComponentRanks.teleopOprWorldRank,
      endgameOprWorldRank: oprComponentRanks.endgameOprWorldRank,
      autoOprCountryRank: oprComponentRanks.autoOprCountryRank,
      teleopOprCountryRank: oprComponentRanks.teleopOprCountryRank,
      endgameOprCountryRank: oprComponentRanks.endgameOprCountryRank,
      autoOprStateRank: oprComponentRanks.autoOprStateRank,
      teleopOprStateRank: oprComponentRanks.teleopOprStateRank,
      endgameOprStateRank: oprComponentRanks.endgameOprStateRank,
    },
  });
});

export default rankings;
