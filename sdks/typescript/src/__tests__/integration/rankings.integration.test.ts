import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { FTCMetricsApiError } from "../../errors";
import { provision, teardown, fullClient } from "./setup";

beforeAll(provision);
afterAll(teardown);

describe("RankingsClient", () => {
  test("global() returns rankings shape with season and rankings fields", async () => {
    const result = await fullClient.rankings.global();
    expect(result).toHaveProperty("season");
    expect(result).toHaveProperty("rankings");
    expect(Array.isArray(result.rankings)).toBe(true);
  });

  test("global({ country: 'US' }) filters work", async () => {
    const result = await fullClient.rankings.global({ country: "US" });
    expect(result).toHaveProperty("rankings");
    expect(Array.isArray(result.rankings)).toBe(true);
  });

  test("filters() returns countries and states", async () => {
    const result = await fullClient.rankings.filters();
    expect(result).toHaveProperty("countries");
    expect(result).toHaveProperty("states");
    expect(Array.isArray(result.countries)).toBe(true);
  });

  test("team(teamNumber) returns rank detail", async () => {
    const result = await fullClient.rankings.team(16461);
    expect(result).toHaveProperty("worldRank");
    expect(result).toHaveProperty("epa");
  });

  test("non-existent team returns error", async () => {
    try {
      await fullClient.rankings.team(99999);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(FTCMetricsApiError);
    }
  });
});
