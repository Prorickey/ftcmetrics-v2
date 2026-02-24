import { describe, test, expect, beforeAll } from "bun:test";
import { FTCMetrics } from "../../client";

const FTC_API_USERNAME = process.env.FTC_API_USERNAME;
const FTC_API_TOKEN = process.env.FTC_API_TOKEN;

const hasCredentials =
  FTC_API_USERNAME &&
  FTC_API_TOKEN &&
  FTC_API_USERNAME !== "your_username" &&
  FTC_API_TOKEN !== "your_token";

describe.skipIf(!hasCredentials)("FTCEventsClient — real FIRST API", () => {
  let client: FTCMetrics;

  beforeAll(() => {
    client = new FTCMetrics({
      ftcApiCredentials: {
        username: FTC_API_USERNAME!,
        token: FTC_API_TOKEN!,
      },
    });
  });

  test("getEvents() returns events with length > 0", async () => {
    const result = await client.ftcApi.getEvents();
    expect(result).toHaveProperty("events");
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);
  });

  test("getTeam(16461) returns team data", async () => {
    const result = await client.ftcApi.getTeam(16461);
    expect(result).toHaveProperty("teams");
    expect(Array.isArray(result.teams)).toBe(true);
    expect(result.teams.length).toBeGreaterThan(0);
    expect(result.teams[0].teamNumber).toBe(16461);
  });

  test("getEvent(eventCode) returns event data", async () => {
    // First grab a valid event code from the season
    const allEvents = await client.ftcApi.getEvents();
    const eventCode = allEvents.events[0].code;

    const result = await client.ftcApi.getEvent(eventCode);
    expect(result).toHaveProperty("events");
    expect(result.events.length).toBeGreaterThan(0);
  });
});
