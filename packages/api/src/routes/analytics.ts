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

    results.push({
      redTeam1: redTeams[0],
      redTeam2: redTeams[1],
      blueTeam1: blueTeams[0],
      blueTeam2: blueTeams[1],
      redScore: redAlliance.totalPoints,
      blueScore: blueAlliance.totalPoints,
      redAutoScore: redAlliance.autoPoints,
      redTeleopScore: redAlliance.dcPoints,
      redEndgameScore: redAlliance.endgamePoints,
      blueAutoScore: blueAlliance.autoPoints,
      blueTeleopScore: blueAlliance.dcPoints,
      blueEndgameScore: blueAlliance.endgamePoints,
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
          eventCode: e.eventCode,
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
 * POST /api/analytics/predict
 * Predict match outcome
 */
analytics.post("/predict", async (c) => {
  try {
    const body = await c.req.json();
    const { eventCode, redTeam1, redTeam2, blueTeam1, blueTeam2 } = body;

    if (!eventCode || !redTeam1 || !redTeam2 || !blueTeam1 || !blueTeam2) {
      return c.json(
        { success: false, error: "Missing required fields" },
        400
      );
    }

    const api = getFTCApi();

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
        success: false,
        error: "Not enough match data for prediction",
      });
    }

    const epaMatches: MatchForEPA[] = matchesResult.matches
      .map((m, idx) => {
        const matchResult = matches[idx];
        if (!matchResult) return null;
        return { matchNumber: m.matchNumber, ...matchResult };
      })
      .filter((m): m is MatchForEPA => m !== null);

    const epaResults = calculateEPA(epaMatches);

    const prediction = predictMatch(
      epaResults,
      redTeam1,
      redTeam2,
      blueTeam1,
      blueTeam2
    );

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
