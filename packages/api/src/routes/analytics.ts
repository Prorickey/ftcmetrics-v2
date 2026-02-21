import { Hono } from "hono";
import { getFTCApi } from "../lib/ftc-api";
import {
  calculateOPR,
  getOPRRankings,
  type MatchResult,
} from "../lib/stats/opr";
import {
  calculateEPA,
  getEPARankings,
  predictMatch,
  type MatchForEPA,
  type EPAResult,
} from "../lib/stats/epa";

const analytics = new Hono();

/**
 * Transform FTC API match data to our match format
 */
function transformMatches(
  matches: Array<{
    matchNumber: number;
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
): MatchResult[] {
  const results: MatchResult[] = [];

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

    // DECODE 2025-2026 uses teleopPoints/teleopBasePoints instead of dcPoints/endgamePoints
    const redTeleop = redAlliance.dcPoints ?? (redAlliance as Record<string, unknown>).teleopPoints as number ?? 0;
    const redEndgame = redAlliance.endgamePoints ?? (redAlliance as Record<string, unknown>).teleopBasePoints as number ?? 0;
    const blueTeleop = blueAlliance.dcPoints ?? (blueAlliance as Record<string, unknown>).teleopPoints as number ?? 0;
    const blueEndgame = blueAlliance.endgamePoints ?? (blueAlliance as Record<string, unknown>).teleopBasePoints as number ?? 0;

    results.push({
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
 * GET /api/analytics/opr/:eventCode
 * Get OPR rankings for an event
 */
analytics.get("/opr/:eventCode", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const api = getFTCApi();

    // Fetch matches and scores
    const [matchesResult, scoresResult] = await Promise.all([
      api.getMatches(eventCode, "qual"),
      api.getScores(eventCode, "qual"),
    ]);

    const matches = transformMatches(
      matchesResult.matches,
      scoresResult.matchScores
    );

    if (matches.length === 0) {
      return c.json({
        success: true,
        data: {
          eventCode,
          matchCount: 0,
          rankings: [],
        },
      });
    }

    const rankings = getOPRRankings(matches);

    return c.json({
      success: true,
      data: {
        eventCode,
        matchCount: matches.length,
        rankings,
      },
    });
  } catch (error) {
    console.error("Error calculating OPR:", error);
    return c.json(
      { success: false, error: "Failed to calculate OPR" },
      500
    );
  }
});

/**
 * GET /api/analytics/epa/:eventCode
 * Get EPA rankings for an event
 */
analytics.get("/epa/:eventCode", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const api = getFTCApi();

    // Fetch matches and scores
    const [matchesResult, scoresResult] = await Promise.all([
      api.getMatches(eventCode, "qual"),
      api.getScores(eventCode, "qual"),
    ]);

    const matches = transformMatches(
      matchesResult.matches,
      scoresResult.matchScores
    );

    if (matches.length === 0) {
      return c.json({
        success: true,
        data: {
          eventCode,
          matchCount: 0,
          rankings: [],
        },
      });
    }

    // Transform for EPA (needs matchNumber)
    const epaMatches: MatchForEPA[] = matchesResult.matches
      .map((m) => {
        const matchResult = matches.find(
          (mr) =>
            (mr.redTeam1 ===
              m.teams.find((t) => t.station === "Red1")?.teamNumber ||
              mr.redTeam2 ===
                m.teams.find((t) => t.station === "Red1")?.teamNumber) &&
            m.matchNumber
        );
        if (!matchResult) return null;
        return {
          matchNumber: m.matchNumber,
          ...matchResult,
        };
      })
      .filter((m): m is MatchForEPA => m !== null);

    const rankings = getEPARankings(epaMatches);

    return c.json({
      success: true,
      data: {
        eventCode,
        matchCount: epaMatches.length,
        rankings,
      },
    });
  } catch (error) {
    console.error("Error calculating EPA:", error);
    return c.json(
      { success: false, error: "Failed to calculate EPA" },
      500
    );
  }
});

/**
 * GET /api/analytics/team/:teamNumber
 * Get analytics for a specific team across events
 */
analytics.get("/team/:teamNumber", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);
  const eventCode = c.req.query("eventCode");

  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  try {
    const api = getFTCApi();

    // If event code provided, get stats for that event
    if (eventCode) {
      const [matchesResult, scoresResult] = await Promise.all([
        api.getMatches(eventCode, "qual"),
        api.getScores(eventCode, "qual"),
      ]);

      const matches = transformMatches(
        matchesResult.matches,
        scoresResult.matchScores
      );

      const oprResults = calculateOPR(matches);
      const epaMatches: MatchForEPA[] = matchesResult.matches
        .map((m, idx) => {
          const matchResult = matches[idx];
          if (!matchResult) return null;
          return { matchNumber: m.matchNumber, ...matchResult };
        })
        .filter((m): m is MatchForEPA => m !== null);
      const epaResults = calculateEPA(epaMatches);

      const teamOpr = oprResults.get(teamNumber);
      const teamEpa = epaResults.get(teamNumber);

      return c.json({
        success: true,
        data: {
          teamNumber,
          eventCode,
          opr: teamOpr || null,
          epa: teamEpa || null,
        },
      });
    }

    // Get team's events and aggregate stats
    const { events } = await api.getTeamEvents(teamNumber);

    return c.json({
      success: true,
      data: {
        teamNumber,
        events: events.map((e) => ({
          eventCode: e.code,
          name: e.name,
          dateStart: e.dateStart,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching team analytics:", error);
    return c.json(
      { success: false, error: "Failed to fetch team analytics" },
      500
    );
  }
});

/**
 * Helper: Compute EPA results from an event's match data.
 * Returns null if the event has no scored matches.
 */
async function getEventEPAResults(
  api: ReturnType<typeof getFTCApi>,
  eventCode: string
): Promise<{ epaResults: Map<number, EPAResult>; epaMatches: MatchForEPA[] } | null> {
  const [matchesResult, scoresResult] = await Promise.all([
    api.getMatches(eventCode, "qual"),
    api.getScores(eventCode, "qual"),
  ]);

  const matches = transformMatches(
    matchesResult.matches,
    scoresResult.matchScores
  );

  if (matches.length === 0) return null;

  const epaMatches: MatchForEPA[] = matchesResult.matches
    .map((m, idx) => {
      const matchResult = matches[idx];
      if (!matchResult) return null;
      return { matchNumber: m.matchNumber, ...matchResult };
    })
    .filter((m): m is MatchForEPA => m !== null);

  const epaResults = calculateEPA(epaMatches);
  return { epaResults, epaMatches };
}

/**
 * Helper: For a set of team numbers, find EPA data from their other events
 * in the current season when the selected event has no match data.
 *
 * For each team, we look up all their events, find ones with match data,
 * and use the EPA from the most recent event (by start date).
 * Teams with no data from any event get a baseline EPA (epa=0).
 */
async function getEPAFromOtherEvents(
  api: ReturnType<typeof getFTCApi>,
  teamNumbers: number[]
): Promise<{
  epaResults: Map<number, EPAResult>;
  dataSources: Map<number, string>; // teamNumber -> eventCode used
}> {
  const epaResults = new Map<number, EPAResult>();
  const dataSources = new Map<number, string>();

  // Fetch all teams' events in parallel
  const teamEventsResults = await Promise.all(
    teamNumbers.map(async (teamNumber) => {
      try {
        const { events } = await api.getTeamEvents(teamNumber);
        return { teamNumber, events };
      } catch {
        return { teamNumber, events: [] as { code: string; name: string; dateStart: string }[] };
      }
    })
  );

  // Collect all unique event codes across all teams, sorted by date (most recent first)
  const eventCodeSet = new Map<string, string>(); // code -> dateStart
  for (const { events } of teamEventsResults) {
    for (const event of events) {
      if (!eventCodeSet.has(event.code)) {
        eventCodeSet.set(event.code, event.dateStart);
      }
    }
  }

  const sortedEventCodes = Array.from(eventCodeSet.entries())
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .map(([code]) => code);

  // Cache EPA results per event to avoid redundant API calls
  const eventEPACache = new Map<string, Map<number, EPAResult> | null>();

  // For each team, find EPA from their most recent event with data
  for (const { teamNumber, events } of teamEventsResults) {
    const teamEventCodes = new Set(events.map((e) => e.code));

    // Try events in order of most recent first
    let found = false;
    for (const eventCode of sortedEventCodes) {
      if (!teamEventCodes.has(eventCode)) continue;

      // Check cache or fetch
      if (!eventEPACache.has(eventCode)) {
        try {
          const result = await getEventEPAResults(api, eventCode);
          eventEPACache.set(eventCode, result?.epaResults ?? null);
        } catch {
          eventEPACache.set(eventCode, null);
        }
      }

      const cachedEPA = eventEPACache.get(eventCode);
      if (cachedEPA && cachedEPA.has(teamNumber)) {
        epaResults.set(teamNumber, cachedEPA.get(teamNumber)!);
        dataSources.set(teamNumber, eventCode);
        found = true;
        break;
      }
    }

    // If no EPA found from any event, use baseline (EPA = 0)
    if (!found) {
      epaResults.set(teamNumber, {
        teamNumber,
        epa: 0,
        autoEpa: 0,
        teleopEpa: 0,
        endgameEpa: 0,
        matchCount: 0,
        trend: "stable",
      });
      dataSources.set(teamNumber, "baseline");
    }
  }

  return { epaResults, dataSources };
}

/**
 * POST /api/analytics/predict
 * Predict match outcome
 */
analytics.post("/predict", async (c) => {
  try {
    const body = (c as any).get("sanitizedBody");
    const { eventCode, redTeam1, redTeam2, blueTeam1, blueTeam2 } = body;

    if (!eventCode || !redTeam1 || !redTeam2 || !blueTeam1 || !blueTeam2) {
      return c.json(
        { success: false, error: "Missing required fields" },
        400
      );
    }

    const api = getFTCApi();

    // First, try to get EPA from the selected event
    const eventEPA = await getEventEPAResults(api, eventCode);

    let epaResults: Map<number, EPAResult>;
    let dataSource: "event" | "cross-event" | "baseline";
    let dataSources: Map<number, string> | undefined;

    if (eventEPA && eventEPA.epaMatches.length > 0) {
      // Selected event has match data -- use it directly
      epaResults = eventEPA.epaResults;
      dataSource = "event";
    } else {
      // No match data for selected event -- look up EPA from other events
      const teamNumbers = [redTeam1, redTeam2, blueTeam1, blueTeam2];
      const crossEventResult = await getEPAFromOtherEvents(api, teamNumbers);

      epaResults = crossEventResult.epaResults;
      dataSources = crossEventResult.dataSources;

      // Check if at least one team has real data (not just baseline)
      const hasRealData = Array.from(crossEventResult.dataSources.values()).some(
        (source) => source !== "baseline"
      );

      if (hasRealData) {
        dataSource = "cross-event";
      } else {
        // All teams are on baseline -- still produce a prediction but flag it
        dataSource = "baseline";
      }
    }

    const prediction = predictMatch(
      epaResults,
      redTeam1,
      redTeam2,
      blueTeam1,
      blueTeam2
    );

    // Build per-team data source info for cross-event predictions
    const teamDataSources = dataSources
      ? {
          [redTeam1]: dataSources.get(redTeam1) || "baseline",
          [redTeam2]: dataSources.get(redTeam2) || "baseline",
          [blueTeam1]: dataSources.get(blueTeam1) || "baseline",
          [blueTeam2]: dataSources.get(blueTeam2) || "baseline",
        }
      : undefined;

    return c.json({
      success: true,
      data: {
        redAlliance: { team1: redTeam1, team2: redTeam2 },
        blueAlliance: { team1: blueTeam1, team2: blueTeam2 },
        prediction: {
          redScore: prediction.predictedRedScore,
          blueScore: prediction.predictedBlueScore,
          redWinProbability: prediction.redWinProbability,
          blueWinProbability:
            Math.round((1 - prediction.redWinProbability) * 100) / 100,
          predictedWinner:
            prediction.redWinProbability > 0.5 ? "red" : "blue",
          margin: Math.abs(
            prediction.predictedRedScore - prediction.predictedBlueScore
          ),
        },
        dataSource,
        ...(teamDataSources && { teamDataSources }),
        ...(dataSource === "baseline" && {
          warning:
            "No match data available for any of these teams in the current season. Prediction is based on season average baseline scores.",
        }),
        ...(dataSource === "cross-event" && {
          note: "EPA data sourced from teams' other events this season (selected event has no match data yet).",
        }),
      },
    });
  } catch (error) {
    console.error("Error predicting match:", error);
    return c.json(
      { success: false, error: "Failed to predict match" },
      500
    );
  }
});

/**
 * GET /api/analytics/team/:teamNumber/matches
 * Get match-by-match breakdowns for a team at an event
 */
analytics.get("/team/:teamNumber/matches", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);
  const eventCode = c.req.query("eventCode");

  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  if (!eventCode) {
    return c.json({ success: false, error: "eventCode query parameter required" }, 400);
  }

  try {
    const api = getFTCApi();

    const [qualMatches, qualScores, playoffMatches, playoffScores] = await Promise.all([
      api.getMatches(eventCode, "qual"),
      api.getScores(eventCode, "qual"),
      api.getMatches(eventCode, "playoff").catch(() => ({ matches: [] })),
      api.getScores(eventCode, "playoff").catch(() => ({ matchScores: [] })),
    ]);

    type MatchEntry = {
      matchNumber: number;
      matchSeries: number;
      level: "qual" | "playoff";
      description: string;
      alliance: "red" | "blue";
      partnerTeam: number;
      opponentTeam1: number;
      opponentTeam2: number;
      allianceScore: number;
      allianceAutoScore: number;
      allianceTeleopScore: number;
      allianceEndgameScore: number;
      opponentScore: number;
      result: "win" | "loss" | "tie";
    };

    const matches: MatchEntry[] = [];

    // Build an index of scores by matchNumber+matchSeries for efficient lookup
    const buildScoreIndex = (scores: typeof qualScores.matchScores) => {
      const index = new Map<string, (typeof scores)[number]>();
      for (const s of scores) {
        index.set(`${s.matchNumber}-${s.matchSeries}`, s);
      }
      return index;
    };

    // For quals, matches and scores are 1:1 by matchNumber (matchSeries=0).
    // For playoffs, multiple matchSeries share the same matchNumber,
    // so we pair matches with scores positionally (both ordered by series).
    const qualScoreIndex = buildScoreIndex(qualScores.matchScores);

    // Process qual matches
    for (const match of qualMatches.matches) {
      const teamEntry = match.teams.find((t) => t.teamNumber === teamNumber);
      if (!teamEntry) continue;

      const matchScoreData = qualScoreIndex.get(`${match.matchNumber}-0`);
      if (!matchScoreData || matchScoreData.alliances.length < 2) continue;

      const isRed = teamEntry.station.startsWith("Red");
      const allianceColor = isRed ? "Red" : "Blue";
      const opponentColor = isRed ? "Blue" : "Red";

      const ally = matchScoreData.alliances.find((a) => a.alliance === allianceColor);
      const opp = matchScoreData.alliances.find((a) => a.alliance === opponentColor);
      if (!ally || !opp) continue;

      const allianceTeams = match.teams
        .filter((t) => t.station.startsWith(allianceColor))
        .map((t) => t.teamNumber);
      const opponentTeams = match.teams
        .filter((t) => t.station.startsWith(opponentColor))
        .map((t) => t.teamNumber);

      // DECODE season uses teleopPoints and teleopBasePoints (endgame)
      const teleopScore = Number(ally.dcPoints) || Number((ally as Record<string, unknown>).teleopPoints) || 0;
      const endgameScore = Number(ally.endgamePoints) || Number((ally as Record<string, unknown>).teleopBasePoints) || 0;

      let result: "win" | "loss" | "tie";
      if (ally.totalPoints > opp.totalPoints) result = "win";
      else if (ally.totalPoints < opp.totalPoints) result = "loss";
      else result = "tie";

      matches.push({
        matchNumber: match.matchNumber,
        matchSeries: 0,
        level: "qual",
        description: match.description || `Qual ${match.matchNumber}`,
        alliance: isRed ? "red" : "blue",
        partnerTeam: allianceTeams.find((t) => t !== teamNumber) ?? 0,
        opponentTeam1: opponentTeams[0] ?? 0,
        opponentTeam2: opponentTeams[1] ?? 0,
        allianceScore: ally.totalPoints,
        allianceAutoScore: ally.autoPoints,
        allianceTeleopScore: teleopScore,
        allianceEndgameScore: endgameScore,
        opponentScore: opp.totalPoints,
        result,
      });
    }

    // Process playoff matches — pair by index since matchNumber is shared
    // Both matches and scores arrays are ordered by series
    for (let i = 0; i < playoffMatches.matches.length; i++) {
      const match = playoffMatches.matches[i];
      const teamEntry = match.teams.find((t) => t.teamNumber === teamNumber);
      if (!teamEntry) continue;

      const matchScoreData = playoffScores.matchScores[i];
      if (!matchScoreData || matchScoreData.alliances.length < 2) continue;

      const isRed = teamEntry.station.startsWith("Red");
      const allianceColor = isRed ? "Red" : "Blue";
      const opponentColor = isRed ? "Blue" : "Red";

      const ally = matchScoreData.alliances.find((a) => a.alliance === allianceColor);
      const opp = matchScoreData.alliances.find((a) => a.alliance === opponentColor);
      if (!ally || !opp) continue;

      const allianceTeams = match.teams
        .filter((t) => t.station.startsWith(allianceColor))
        .map((t) => t.teamNumber);
      const opponentTeams = match.teams
        .filter((t) => t.station.startsWith(opponentColor))
        .map((t) => t.teamNumber);

      const teleopScore = Number(ally.dcPoints) || Number((ally as Record<string, unknown>).teleopPoints) || 0;
      const endgameScore = Number(ally.endgamePoints) || Number((ally as Record<string, unknown>).teleopBasePoints) || 0;

      let result: "win" | "loss" | "tie";
      if (ally.totalPoints > opp.totalPoints) result = "win";
      else if (ally.totalPoints < opp.totalPoints) result = "loss";
      else result = "tie";

      matches.push({
        matchNumber: match.matchNumber,
        matchSeries: matchScoreData.matchSeries,
        level: "playoff",
        description: match.description || `Playoff ${matchScoreData.matchSeries}`,
        alliance: isRed ? "red" : "blue",
        partnerTeam: allianceTeams.find((t) => t !== teamNumber) ?? 0,
        opponentTeam1: opponentTeams[0] ?? 0,
        opponentTeam2: opponentTeams[1] ?? 0,
        allianceScore: ally.totalPoints,
        allianceAutoScore: ally.autoPoints,
        allianceTeleopScore: teleopScore,
        allianceEndgameScore: endgameScore,
        opponentScore: opp.totalPoints,
        result,
      });
    }

    // Quals by matchNumber, then playoffs by matchSeries
    matches.sort((a, b) => {
      if (a.level !== b.level) return a.level === "qual" ? -1 : 1;
      if (a.level === "qual") return a.matchNumber - b.matchNumber;
      return a.matchSeries - b.matchSeries;
    });

    return c.json({
      success: true,
      data: {
        teamNumber,
        eventCode,
        matches,
      },
    });
  } catch (error) {
    console.error("Error fetching team matches:", error);
    return c.json(
      { success: false, error: "Failed to fetch team matches" },
      500
    );
  }
});

/**
 * GET /api/analytics/compare
 * Compare multiple teams
 */
analytics.get("/compare", async (c) => {
  const teams = c.req.query("teams")?.split(",").map(Number);
  const eventCode = c.req.query("eventCode");

  if (!teams || teams.length < 2 || teams.some(isNaN)) {
    return c.json(
      { success: false, error: "Provide at least 2 valid team numbers" },
      400
    );
  }

  if (!eventCode) {
    return c.json({ success: false, error: "Event code required" }, 400);
  }

  try {
    const api = getFTCApi();

    const [matchesResult, scoresResult] = await Promise.all([
      api.getMatches(eventCode, "qual"),
      api.getScores(eventCode, "qual"),
    ]);

    const matches = transformMatches(
      matchesResult.matches,
      scoresResult.matchScores
    );

    const oprResults = calculateOPR(matches);
    const epaMatches: MatchForEPA[] = matchesResult.matches
      .map((m, idx) => {
        const matchResult = matches[idx];
        if (!matchResult) return null;
        return { matchNumber: m.matchNumber, ...matchResult };
      })
      .filter((m): m is MatchForEPA => m !== null);
    const epaResults = calculateEPA(epaMatches);

    const comparison = teams.map((teamNumber) => ({
      teamNumber,
      opr: oprResults.get(teamNumber) || null,
      epa: epaResults.get(teamNumber) || null,
    }));

    return c.json({
      success: true,
      data: {
        eventCode,
        teams: comparison,
      },
    });
  } catch (error) {
    console.error("Error comparing teams:", error);
    return c.json(
      { success: false, error: "Failed to compare teams" },
      500
    );
  }
});

export default analytics;
