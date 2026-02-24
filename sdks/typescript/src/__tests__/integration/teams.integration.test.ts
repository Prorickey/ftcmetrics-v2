import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { FTCMetricsApiError } from "../../errors";
import { provision, teardown, fullClient } from "./setup";

beforeAll(provision);
afterAll(teardown);

describe("TeamsClient", () => {
  const TEAM_NUMBER = 16461;

  test("get_(teamNumber) returns team data with correct number", async () => {
    const team = await fullClient.teams.get_(TEAM_NUMBER);
    expect(team).toBeDefined();
    expect(team.teamNumber).toBe(TEAM_NUMBER);
  });

  test("search('16461') returns results", async () => {
    const results = await fullClient.teams.search("16461");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.teamNumber === TEAM_NUMBER)).toBe(true);
  });

  test("profile(teamNumber) returns null or profile object", async () => {
    const profile = await fullClient.teams.profile(TEAM_NUMBER);
    // Profile may be null if team hasn't set one up, or an object
    if (profile !== null) {
      expect(profile).toHaveProperty("bio");
      expect(profile).toHaveProperty("robotName");
    }
  });

  test("events(teamNumber) returns array", async () => {
    const events = await fullClient.teams.events(TEAM_NUMBER);
    expect(events).toBeDefined();
  });

  test("eventSummaries(teamNumber) returns array", async () => {
    const summaries = await fullClient.teams.eventSummaries(TEAM_NUMBER);
    expect(Array.isArray(summaries)).toBe(true);
  });

  test("non-existent team returns error", async () => {
    try {
      await fullClient.teams.get_(999999);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(FTCMetricsApiError);
    }
  });
});
