import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockPrisma, mockRedis } from "../setup";

// Mock FTC API so computeAndCacheRankings doesn't hit the network
vi.mock("../../lib/ftc-api", () => ({
  getFTCApi: () => ({
    getEvents: vi.fn().mockResolvedValue({ events: [] }),
    getMatches: vi.fn().mockResolvedValue({ matches: [] }),
    getScores: vi.fn().mockResolvedValue({ matchScores: [] }),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal cached rankings payload stored in Redis */
function makeCachedRankings(
  rankingsOverride?: Array<{
    rank: number;
    teamNumber: number;
    epa: number;
    autoEpa: number;
    teleopEpa: number;
    endgameEpa: number;
    matchCount: number;
    trend: "up" | "down" | "stable";
  }>
) {
  const rankings = rankingsOverride ?? [
    {
      rank: 1,
      teamNumber: 8569,
      epa: 95.5,
      autoEpa: 30.0,
      teleopEpa: 50.5,
      endgameEpa: 15.0,
      matchCount: 10,
      trend: "stable" as const,
    },
    {
      rank: 2,
      teamNumber: 1234,
      epa: 80.0,
      autoEpa: 25.0,
      teleopEpa: 42.0,
      endgameEpa: 13.0,
      matchCount: 8,
      trend: "up" as const,
    },
    {
      rank: 3,
      teamNumber: 5555,
      epa: 70.0,
      autoEpa: 20.0,
      teleopEpa: 38.0,
      endgameEpa: 12.0,
      matchCount: 7,
      trend: "down" as const,
    },
  ];

  return JSON.stringify({
    success: true,
    data: {
      season: 2025,
      totalTeams: rankings.length,
      totalMatches: 100,
      eventsProcessed: 5,
      lastUpdated: new Date().toISOString(),
      rankings,
    },
  });
}

async function createApp() {
  const rankings = (await import("../../routes/rankings")).default;
  const app = new Hono();
  app.route("/api/rankings", rankings);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/rankings/team/:teamNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for a non-numeric team number", async () => {
    // Redis returns cached data (shouldn't even be reached, but set it anyway)
    mockRedis.get.mockResolvedValue(makeCachedRankings());

    const app = await createApp();
    const res = await app.request("/api/rankings/team/abc");
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/invalid team number/i);
  });

  it("returns 503 when Redis has no cached rankings", async () => {
    mockRedis.get.mockResolvedValue(null);

    const app = await createApp();
    const res = await app.request("/api/rankings/team/8569");
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/not yet computed/i);
  });

  it("returns 503 when cached rankings list is empty", async () => {
    mockRedis.get.mockResolvedValue(makeCachedRankings([]));

    const app = await createApp();
    const res = await app.request("/api/rankings/team/8569");
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 404 when team is not present in the rankings", async () => {
    mockRedis.get.mockResolvedValue(makeCachedRankings());

    const app = await createApp();
    const res = await app.request("/api/rankings/team/9999");
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/not found/i);
  });

  it("returns world rank with null location fields when team has no DB record", async () => {
    mockRedis.get.mockResolvedValue(makeCachedRankings());
    // Simulate team not found in ftcTeam table
    mockPrisma.ftcTeam.findUnique.mockResolvedValue(null);

    const app = await createApp();
    const res = await app.request("/api/rankings/team/8569");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;
    expect(data.worldRank).toBe(1);
    expect(data.worldTotal).toBe(3);

    // Location-dependent fields should be null
    expect(data.countryRank).toBeNull();
    expect(data.countryTotal).toBeNull();
    expect(data.country).toBeNull();
    expect(data.stateRank).toBeNull();
    expect(data.stateTotal).toBeNull();
    expect(data.stateProv).toBeNull();

    // Component world ranks should still be computed
    expect(data.autoWorldRank).toBe(1);
    expect(data.teleopWorldRank).toBe(1);
    expect(data.endgameWorldRank).toBe(1);

    // Country/state component ranks should be null
    expect(data.autoCountryRank).toBeNull();
    expect(data.teleopCountryRank).toBeNull();
    expect(data.endgameCountryRank).toBeNull();
    expect(data.autoStateRank).toBeNull();
    expect(data.teleopStateRank).toBeNull();
    expect(data.endgameStateRank).toBeNull();

    // EPA values
    expect(data.epa).toBe(95.5);
    expect(data.autoEpa).toBe(30.0);
    expect(data.teleopEpa).toBe(50.5);
    expect(data.endgameEpa).toBe(15.0);
  });

  it("returns world, country, and state ranks with component breakdowns when team has location", async () => {
    mockRedis.get.mockResolvedValue(makeCachedRankings());

    // Team 8569 is in USA, TX
    mockPrisma.ftcTeam.findUnique.mockResolvedValue({
      country: "USA",
      stateProv: "TX",
    });

    // All three ranked teams share the same country; only 8569 and 1234 are in TX
    mockPrisma.ftcTeam.findMany.mockResolvedValue([
      { teamNumber: 8569, country: "USA", stateProv: "TX" },
      { teamNumber: 1234, country: "USA", stateProv: "TX" },
      { teamNumber: 5555, country: "USA", stateProv: "CA" },
    ] as unknown[]);

    const app = await createApp();
    const res = await app.request("/api/rankings/team/8569");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;

    // World rank
    expect(data.worldRank).toBe(1);
    expect(data.worldTotal).toBe(3);

    // Country rank: all 3 teams are USA → 8569 is rank 1 of 3
    expect(data.country).toBe("USA");
    expect(data.countryRank).toBe(1);
    expect(data.countryTotal).toBe(3);

    // State rank: only 8569 and 1234 are in TX → 8569 is rank 1 of 2
    expect(data.stateProv).toBe("TX");
    expect(data.stateRank).toBe(1);
    expect(data.stateTotal).toBe(2);

    // Component world ranks: 8569 has highest auto/teleop/endgame EPA → all rank 1
    expect(data.autoWorldRank).toBe(1);
    expect(data.teleopWorldRank).toBe(1);
    expect(data.endgameWorldRank).toBe(1);

    // Component country ranks: 8569 is best in USA for all components
    expect(data.autoCountryRank).toBe(1);
    expect(data.teleopCountryRank).toBe(1);
    expect(data.endgameCountryRank).toBe(1);

    // Component state ranks: 8569 is best in TX for all components
    expect(data.autoStateRank).toBe(1);
    expect(data.teleopStateRank).toBe(1);
    expect(data.endgameStateRank).toBe(1);

    // EPA values
    expect(data.epa).toBe(95.5);
    expect(data.autoEpa).toBe(30.0);
    expect(data.teleopEpa).toBe(50.5);
    expect(data.endgameEpa).toBe(15.0);
  });

  it("returns correct country rank when target team is not #1 in its country", async () => {
    // Rankings: team 1234 (rank 2 world) is in USA-TX
    // team 8569 (rank 1) is also USA-TX, so 1234 should be country rank 2
    mockRedis.get.mockResolvedValue(makeCachedRankings());

    mockPrisma.ftcTeam.findUnique.mockResolvedValue({
      country: "USA",
      stateProv: "TX",
    });

    mockPrisma.ftcTeam.findMany.mockResolvedValue([
      { teamNumber: 8569, country: "USA", stateProv: "TX" },
      { teamNumber: 1234, country: "USA", stateProv: "TX" },
      { teamNumber: 5555, country: "USA", stateProv: "CA" },
    ]);

    const app = await createApp();
    const res = await app.request("/api/rankings/team/1234");
    expect(res.status).toBe(200);

    const json = await res.json();
    const data = json.data;

    expect(data.worldRank).toBe(2);
    expect(data.countryRank).toBe(2);
    expect(data.countryTotal).toBe(3);
    expect(data.stateRank).toBe(2);
    expect(data.stateTotal).toBe(2);
  });
});
