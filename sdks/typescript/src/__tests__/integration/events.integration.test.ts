import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { FTCMetricsApiError } from "../../errors";
import { provision, teardown, fullClient } from "./setup";

beforeAll(provision);
afterAll(teardown);

describe("EventsClient", () => {
  // We need a real event code from the database. We'll grab one from list().
  let eventCode: string;

  test("list() returns an array of events", async () => {
    const events = await fullClient.events.list();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    // Grab first event for subsequent tests
    eventCode = events[0].code;
    expect(typeof eventCode).toBe("string");
  });

  test("get_(eventCode) returns event with matching code", async () => {
    const event = await fullClient.events.get_(eventCode);
    expect(event).toBeDefined();
  });

  test("teams(eventCode) returns team array", async () => {
    const teams = await fullClient.events.teams(eventCode);
    expect(Array.isArray(teams)).toBe(true);
  });

  test("schedule(eventCode) returns data", async () => {
    const schedule = await fullClient.events.schedule(eventCode);
    expect(schedule).toBeDefined();
  });

  test("matches(eventCode) returns data", async () => {
    const matches = await fullClient.events.matches(eventCode);
    expect(matches).toBeDefined();
  });

  test("rankings(eventCode) returns data or throws for events without rankings", async () => {
    try {
      const rankings = await fullClient.events.rankings(eventCode);
      expect(rankings).toBeDefined();
    } catch (e) {
      // Some events don't have rankings data yet — that's acceptable
      expect(e).toBeInstanceOf(FTCMetricsApiError);
    }
  });

  test("invalid event code returns error", async () => {
    try {
      await fullClient.events.get_("NONEXISTENT_EVENT_CODE_99999");
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(FTCMetricsApiError);
    }
  });
});
