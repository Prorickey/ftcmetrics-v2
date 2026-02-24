import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { FTCMetrics } from "../client";
import { FTCMetricsApiError, FTCEventsApiError, FTCMetricsConfigError } from "../errors";
import { httpGet, httpPost } from "../http";

const BASE_URL = "http://localhost:3001/api";

let originalFetch: typeof globalThis.fetch;
let lastRequest: { url: string; init?: RequestInit };

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(body: unknown, status = 200) {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    lastRequest = { url: input.toString(), init };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function mockFTCMetricsResponse(data: unknown, status = 200) {
  mockFetch({ success: true, data }, status);
}

function mockFTCEventsResponse(data: unknown, status = 200) {
  mockFetch(data, status);
}

// ---------------------------------------------------------------------------
// 1. Constructor tests
// ---------------------------------------------------------------------------
describe("Constructor", () => {
  test("rejects API keys not starting with ftcm_", () => {
    expect(() => new FTCMetrics({ ftcmApiKey: "bad_key", baseUrl: BASE_URL })).toThrow(
      FTCMetricsConfigError
    );
  });

  test("accepts valid config with ftcm_ prefix", () => {
    const client = new FTCMetrics({ ftcmApiKey: "ftcm_test123", baseUrl: BASE_URL });
    expect(client).toBeDefined();
  });

  test("accepts empty config", () => {
    const client = new FTCMetrics({});
    expect(client).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Lazy proxy tests
// ---------------------------------------------------------------------------
describe("Lazy proxy - missing credentials", () => {
  test("ftcApi throws FTCMetricsConfigError when no credentials", () => {
    const client = new FTCMetrics({});
    expect(() => client.ftcApi.getEvents()).toThrow(FTCMetricsConfigError);
  });

  test("events throws FTCMetricsConfigError when no API key", () => {
    const client = new FTCMetrics({});
    expect(() => client.events.list()).toThrow(FTCMetricsConfigError);
  });
});

// ---------------------------------------------------------------------------
// 3. FTCMetrics API sub-client tests
// ---------------------------------------------------------------------------
describe("FTCMetrics API sub-clients", () => {
  const API_KEY = "ftcm_testkey";
  let client: FTCMetrics;

  beforeEach(() => {
    client = new FTCMetrics({ ftcmApiKey: API_KEY, baseUrl: BASE_URL });
  });

  test("events.list() → GET {baseUrl}/events with Bearer auth", async () => {
    const mockData = [{ eventCode: "USFLOR", name: "Florida" }];
    mockFTCMetricsResponse(mockData);

    const result = await client.events.list();

    expect(lastRequest.url).toBe(`${BASE_URL}/events`);
    const headers = lastRequest.init!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${API_KEY}`);
    expect(result).toEqual(mockData);
  });

  test("events.teams('USFLOR') → GET {baseUrl}/events/USFLOR/teams", async () => {
    const mockData = [{ teamNumber: 12345 }];
    mockFTCMetricsResponse(mockData);

    const result = await client.events.teams("USFLOR");

    expect(lastRequest.url).toBe(`${BASE_URL}/events/USFLOR/teams`);
    expect(result).toEqual(mockData);
  });

  test("teams.get_(12345) → GET {baseUrl}/teams/12345", async () => {
    const mockData = { teamNumber: 12345, name: "Robonauts" };
    mockFTCMetricsResponse(mockData);

    const result = await client.teams.get_(12345);

    expect(lastRequest.url).toBe(`${BASE_URL}/teams/12345`);
    expect(result).toEqual(mockData);
  });

  test("teams.search('robonauts') → GET {baseUrl}/teams/search?q=robonauts", async () => {
    const mockData = [{ teamNumber: 12345, name: "Robonauts" }];
    mockFTCMetricsResponse(mockData);

    const result = await client.teams.search("robonauts");

    expect(lastRequest.url).toBe(`${BASE_URL}/teams/search?q=robonauts`);
    expect(result).toEqual(mockData);
  });

  test("analytics.epa('USFLOR') → GET {baseUrl}/analytics/epa/USFLOR", async () => {
    const mockData = { eventCode: "USFLOR", matchCount: 5, rankings: [] };
    mockFTCMetricsResponse(mockData);

    const result = await client.analytics.epa("USFLOR");

    expect(lastRequest.url).toBe(`${BASE_URL}/analytics/epa/USFLOR`);
    expect(result).toEqual(mockData);
  });

  test("analytics.predict(...) → POST {baseUrl}/analytics/predict with JSON body", async () => {
    const mockData = { redWinProbability: 0.65 };
    mockFTCMetricsResponse(mockData);

    const predictBody = {
      eventCode: "USFLOR",
      redTeam1: 12345,
      redTeam2: 67890,
      blueTeam1: 11111,
      blueTeam2: 22222,
    };
    const result = await client.analytics.predict(predictBody);

    expect(lastRequest.url).toBe(`${BASE_URL}/analytics/predict`);
    expect(lastRequest.init?.method).toBe("POST");
    expect(lastRequest.init?.body).toBe(JSON.stringify(predictBody));
    expect(result).toEqual(mockData);
  });

  test("rankings.global({ country: 'US' }) → GET {baseUrl}/rankings/epa?country=US", async () => {
    const mockData = { rankings: [{ teamNumber: 12345, rank: 1 }] };
    mockFTCMetricsResponse(mockData);

    const result = await client.rankings.global({ country: "US" });

    expect(lastRequest.url).toBe(`${BASE_URL}/rankings/epa?country=US`);
    expect(result).toEqual(mockData);
  });

  test("rankings.team(12345) → GET {baseUrl}/rankings/team/12345", async () => {
    const mockData = { teamNumber: 12345, rank: 1 };
    mockFTCMetricsResponse(mockData);

    const result = await client.rankings.team(12345);

    expect(lastRequest.url).toBe(`${BASE_URL}/rankings/team/12345`);
    expect(result).toEqual(mockData);
  });
});

// ---------------------------------------------------------------------------
// 4. FTC Events API tests
// ---------------------------------------------------------------------------
describe("FTC Events API", () => {
  const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";
  let client: FTCMetrics;

  beforeEach(() => {
    client = new FTCMetrics({
      ftcApiCredentials: { username: "testuser", token: "testtoken" },
    });
  });

  test("ftcApi.getEvents() → GET with Basic auth header", async () => {
    const mockData = { events: [{ code: "USFLOR" }] };
    mockFTCEventsResponse(mockData);

    const result = await client.ftcApi.getEvents();

    expect(lastRequest.url).toBe(`${FTC_API_BASE}/2025/events`);
    const headers = lastRequest.init!.headers as Record<string, string>;
    const expectedAuth = "Basic " + btoa("testuser:testtoken");
    expect(headers["Authorization"]).toBe(expectedAuth);
    expect(result).toEqual(mockData);
  });

  test("ftcApi.getEventTeams('USFLOR') → correct URL with auth", async () => {
    const mockData = { teams: [{ teamNumber: 12345 }] };
    mockFTCEventsResponse(mockData);

    const result = await client.ftcApi.getEventTeams("USFLOR");

    expect(lastRequest.url).toBe(`${FTC_API_BASE}/2025/teams?eventCode=USFLOR`);
    const headers = lastRequest.init!.headers as Record<string, string>;
    expect(headers["Authorization"]).toContain("Basic ");
    expect(result).toEqual(mockData);
  });

  test("ftcApi.getScores('USFLOR', 'qual') → correct URL", async () => {
    const mockData = { matchScores: [] };
    mockFTCEventsResponse(mockData);

    const result = await client.ftcApi.getScores("USFLOR", "qual");

    expect(lastRequest.url).toBe(`${FTC_API_BASE}/2025/scores/USFLOR/qual`);
    expect(result).toEqual(mockData);
  });

  test("ftcApi.getMatches('USFLOR', 'playoff') → uses playoff level", async () => {
    const mockData = { matches: [] };
    mockFTCEventsResponse(mockData);

    const result = await client.ftcApi.getMatches("USFLOR", "playoff");

    expect(lastRequest.url).toBe(
      `${FTC_API_BASE}/2025/matches/USFLOR?tournamentLevel=playoff`
    );
    expect(result).toEqual(mockData);
  });

  test("invalid event code '../evil' throws error", () => {
    expect(() => client.ftcApi.getScores("../evil")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. Error handling
// ---------------------------------------------------------------------------
describe("Error handling", () => {
  const API_KEY = "ftcm_testkey";
  let client: FTCMetrics;

  beforeEach(() => {
    client = new FTCMetrics({ ftcmApiKey: API_KEY, baseUrl: BASE_URL });
  });

  test("401 response throws FTCMetricsApiError", async () => {
    mockFetch({ error: "Unauthorized" }, 401);

    await expect(client.events.list()).rejects.toThrow(FTCMetricsApiError);
  });

  test("500 response throws error with status", async () => {
    mockFetch({ error: "Internal Server Error" }, 500);

    try {
      await client.events.list();
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(FTCMetricsApiError);
      expect((e as FTCMetricsApiError).status).toBe(500);
    }
  });

  test("network failure propagates", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    await expect(client.events.list()).rejects.toThrow(TypeError);
  });

  test("error body parsing extracts error field", async () => {
    mockFetch({ error: "Rate limit exceeded" }, 429);

    try {
      await client.events.list();
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(FTCMetricsApiError);
      expect((e as FTCMetricsApiError).message).toContain("Rate limit exceeded");
    }
  });
});

// ---------------------------------------------------------------------------
// 6. HTTP helper tests
// ---------------------------------------------------------------------------
describe("HTTP helpers", () => {
  test("httpGet constructs correct GET request", async () => {
    mockFetch({ result: "ok" });

    await httpGet(
      `${BASE_URL}/test`,
      { Authorization: "Bearer ftcm_abc" },
      FTCMetricsApiError
    );

    expect(lastRequest.url).toBe(`${BASE_URL}/test`);
    expect(lastRequest.init?.method).toBe("GET");
    const headers = lastRequest.init!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer ftcm_abc");
  });

  test("httpPost constructs correct POST request with JSON body", async () => {
    mockFetch({ result: "ok" });

    const body = { foo: "bar" };
    await httpPost(
      `${BASE_URL}/test`,
      { Authorization: "Bearer ftcm_abc" },
      body,
      FTCMetricsApiError
    );

    expect(lastRequest.url).toBe(`${BASE_URL}/test`);
    expect(lastRequest.init?.method).toBe("POST");
    expect(lastRequest.init?.body).toBe(JSON.stringify(body));
    const headers = lastRequest.init!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer ftcm_abc");
  });
});
