import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { provision, teardown, fullClient } from "./setup";

beforeAll(provision);
afterAll(teardown);

describe("AnalyticsClient", () => {
  // We need a real event code that has match data for analytics.
  // We'll discover one from the events list.
  let eventCode: string;
  let teamNumbers: number[] = [];

  beforeAll(async () => {
    // Get an event that likely has matches
    const events = await fullClient.events.list();
    eventCode = events[0].code;

    // Try to get teams from that event for compare/predict tests
    try {
      const teams = await fullClient.events.teams(eventCode);
      if (Array.isArray(teams) && teams.length >= 4) {
        teamNumbers = teams.slice(0, 4).map((t) => t.teamNumber);
      }
    } catch {
      // Some events may not have team data yet
    }
  });

  test("opr(eventCode) returns correct shape", async () => {
    const result = await fullClient.analytics.opr(eventCode);
    expect(result).toHaveProperty("eventCode", eventCode);
    expect(result).toHaveProperty("matchCount");
    expect(result).toHaveProperty("rankings");
    expect(Array.isArray(result.rankings)).toBe(true);
  });

  test("epa(eventCode) returns correct shape", async () => {
    const result = await fullClient.analytics.epa(eventCode);
    expect(result).toHaveProperty("eventCode", eventCode);
    expect(result).toHaveProperty("matchCount");
    expect(result).toHaveProperty("rankings");
    expect(Array.isArray(result.rankings)).toBe(true);
  });

  test("team(teamNumber) without eventCode returns team events", async () => {
    const teamNumber = teamNumbers[0] ?? 16461;
    const result = await fullClient.analytics.team(teamNumber);
    expect(result).toHaveProperty("teamNumber", teamNumber);
    expect(result).toHaveProperty("events");
  });

  test("team(teamNumber, { eventCode }) returns OPR/EPA data", async () => {
    const teamNumber = teamNumbers[0] ?? 16461;
    const result = await fullClient.analytics.team(teamNumber, { eventCode });
    expect(result).toHaveProperty("teamNumber", teamNumber);
    expect(result).toHaveProperty("eventCode", eventCode);
    expect(result).toHaveProperty("opr");
    expect(result).toHaveProperty("epa");
  });

  test("teamMatches(teamNumber, eventCode) returns matches array", async () => {
    const teamNumber = teamNumbers[0] ?? 16461;
    const result = await fullClient.analytics.teamMatches(teamNumber, eventCode);
    expect(result).toHaveProperty("teamNumber", teamNumber);
    expect(result).toHaveProperty("eventCode", eventCode);
    expect(result).toHaveProperty("matches");
    expect(Array.isArray(result.matches)).toBe(true);
  });

  test("compare(eventCode, teams) returns comparison", async () => {
    if (teamNumbers.length < 2) {
      console.log("Skipping compare test — not enough teams at event");
      return;
    }
    const result = await fullClient.analytics.compare(eventCode, teamNumbers.slice(0, 2));
    expect(result).toHaveProperty("eventCode", eventCode);
    expect(result).toHaveProperty("teams");
    expect(Array.isArray(result.teams)).toBe(true);
  });

  test("predict(data) returns prediction with probability", async () => {
    if (teamNumbers.length < 4) {
      console.log("Skipping predict test — not enough teams at event");
      return;
    }
    const result = await fullClient.analytics.predict({
      eventCode,
      redTeam1: teamNumbers[0],
      redTeam2: teamNumbers[1],
      blueTeam1: teamNumbers[2],
      blueTeam2: teamNumbers[3],
    });
    expect(result).toHaveProperty("prediction");
    expect(result.prediction).toHaveProperty("redWinProbability");
    expect(result.prediction).toHaveProperty("blueWinProbability");
    expect(result.prediction.redWinProbability + result.prediction.blueWinProbability).toBeCloseTo(1, 1);
  });
});
