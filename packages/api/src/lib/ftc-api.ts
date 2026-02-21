/**
 * FTC Events API Client
 *
 * Official API documentation: https://ftc-api.firstinspires.org/
 * Base URL: https://ftc-events.firstinspires.org/api/v2.0
 */

import { getRedis } from "./redis";

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";
const CURRENT_SEASON = 2025; // DECODE season

interface FTCApiConfig {
  username: string;
  token: string;
}

// TTL configuration: endpoint pattern -> { freshTtl, staleTtl } in seconds
interface CacheTTL {
  freshTtl: number;
  staleTtl: number;
}

const CACHE_TTLS: { pattern: RegExp; ttl: CacheTTL }[] = [
  { pattern: /^\/matches\//, ttl: { freshTtl: 120, staleTtl: 86400 } },       // 2min / 24h
  { pattern: /^\/scores\//, ttl: { freshTtl: 120, staleTtl: 86400 } },        // 2min / 24h
  { pattern: /^\/rankings\//, ttl: { freshTtl: 120, staleTtl: 86400 } },      // 2min / 24h
  { pattern: /^\/schedule\//, ttl: { freshTtl: 120, staleTtl: 86400 } },      // 2min / 24h
  { pattern: /^\/teams/, ttl: { freshTtl: 86400, staleTtl: 604800 } },        // 24h / 7d
  { pattern: /^\/events/, ttl: { freshTtl: 21600, staleTtl: 604800 } },       // 6h / 7d
];

function getTTL(endpoint: string): CacheTTL {
  for (const { pattern, ttl } of CACHE_TTLS) {
    if (pattern.test(endpoint)) return ttl;
  }
  // Default: 5min fresh, 1h stale
  return { freshTtl: 300, staleTtl: 3600 };
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number; // epoch ms
}

// API Response Types
export interface FTCEvent {
  code: string;
  name: string;
  districtCode: string | null;
  venue: string;
  address: string;
  city: string;
  stateprov: string;
  country: string;
  dateStart: string;
  dateEnd: string;
  type: string;
  typeName: string;
  timezone: string;
  published: boolean;
}

export interface FTCTeam {
  teamNumber: number;
  nameFull: string;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
  rookieYear: number;
  schoolName: string;
  website: string | null;
}

export interface FTCMatch {
  matchNumber: number;
  tournamentLevel: string;
  description: string;
  startTime: string;
  actualStartTime: string | null;
  postResultTime: string | null;
  teams: FTCMatchTeam[];
  modifiedOn: string;
}

export interface FTCMatchTeam {
  teamNumber: number;
  station: string; // "Red1", "Red2", "Blue1", "Blue2"
  surrogate: boolean;
  dq: boolean;
}

export interface FTCMatchScore {
  matchLevel: string;
  matchNumber: number;
  matchSeries: number;
  alliances: {
    alliance: "Red" | "Blue";
    totalPoints: number;
    autoPoints: number;
    dcPoints: number;
    endgamePoints: number;
    penaltyPointsCommitted: number;
    prePenaltyTotal: number;
    team1: number;
    team2: number;
    // DECODE-specific fields will be here when available
    [key: string]: unknown;
  }[];
}

export interface FTCRankings {
  Rankings: {
    rank: number;
    teamNumber: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    ties: number;
    qualAverage: number;
    sortOrder1: number;
    sortOrder2: number;
    sortOrder3: number;
    sortOrder4: number;
    sortOrder5: number;
    sortOrder6: number;
  }[];
}

const VALID_EVENT_CODE = /^[A-Za-z0-9]+$/;

class FTCEventsAPI {
  private username: string;
  private token: string;

  constructor(config: FTCApiConfig) {
    this.username = config.username;
    this.token = config.token;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.username}:${this.token}`).toString(
      "base64"
    );
    return `Basic ${credentials}`;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${FTC_API_BASE}/${CURRENT_SEASON}${endpoint}`;
    const cacheKey = `ftc-api:${CURRENT_SEASON}:${endpoint}`;
    const { freshTtl, staleTtl } = getTTL(endpoint);
    const redis = getRedis();

    // 1. Check cache
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached);
          const ageSeconds = (Date.now() - entry.cachedAt) / 1000;

          if (ageSeconds < freshTtl) {
            return entry.data;
          }
          // Stale — fall through to fetch, but entry is available for fallback
        }
      } catch {
        // Redis read failed, proceed without cache
      }
    }

    // 2. Fetch from FTC API
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: this.getAuthHeader(),
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `FTC API Error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as T;

      // 3. Store in cache
      if (redis) {
        const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
        try {
          await redis.set(cacheKey, JSON.stringify(entry), "EX", staleTtl);
        } catch {
          // Cache write failed, non-fatal
        }
      }

      return data;
    } catch (apiError) {
      // 4. On API failure, try stale cache fallback
      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const entry: CacheEntry<T> = JSON.parse(cached);
            const ageSeconds = Math.round((Date.now() - entry.cachedAt) / 1000);
            console.warn(
              `[FTC Cache] FTC API unavailable for ${endpoint}, serving stale cache (${ageSeconds}s old)`
            );
            return entry.data;
          }
        } catch {
          // Redis also failed, throw original error
        }
      }

      // No cache available — throw the original API error
      throw apiError;
    }
  }

  /**
   * Get list of all events for the current season
   */
  async getEvents(): Promise<{ events: FTCEvent[] }> {
    return this.fetch<{ events: FTCEvent[] }>("/events");
  }

  /**
   * Get a specific event by code
   */
  async getEvent(eventCode: string): Promise<{ events: FTCEvent[] }> {
    if (!VALID_EVENT_CODE.test(eventCode)) throw new Error("Invalid event code");
    return this.fetch<{ events: FTCEvent[] }>(`/events?eventCode=${eventCode}`);
  }

  /**
   * Get teams at an event
   */
  async getEventTeams(eventCode: string): Promise<{ teams: FTCTeam[] }> {
    if (!VALID_EVENT_CODE.test(eventCode)) throw new Error("Invalid event code");
    return this.fetch<{ teams: FTCTeam[] }>(`/teams?eventCode=${eventCode}`);
  }

  /**
   * Get a specific team
   */
  async getTeam(teamNumber: number): Promise<{ teams: FTCTeam[] }> {
    return this.fetch<{ teams: FTCTeam[] }>(`/teams?teamNumber=${teamNumber}`);
  }

  /**
   * Get match schedule for an event
   */
  async getSchedule(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ): Promise<{ schedule: FTCMatch[] }> {
    if (!VALID_EVENT_CODE.test(eventCode)) throw new Error("Invalid event code");
    return this.fetch<{ schedule: FTCMatch[] }>(
      `/schedule/${eventCode}?tournamentLevel=${tournamentLevel}`
    );
  }

  /**
   * Get match results for an event
   */
  async getMatches(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ): Promise<{ matches: FTCMatch[] }> {
    if (!VALID_EVENT_CODE.test(eventCode)) throw new Error("Invalid event code");
    return this.fetch<{ matches: FTCMatch[] }>(
      `/matches/${eventCode}?tournamentLevel=${tournamentLevel}`
    );
  }

  /**
   * Get detailed match scores for an event
   */
  async getScores(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ): Promise<{ matchScores: FTCMatchScore[] }> {
    if (!VALID_EVENT_CODE.test(eventCode)) throw new Error("Invalid event code");
    return this.fetch<{ matchScores: FTCMatchScore[] }>(
      `/scores/${eventCode}/${tournamentLevel}`
    );
  }

  /**
   * Get team rankings at an event
   */
  async getRankings(eventCode: string): Promise<FTCRankings> {
    if (!VALID_EVENT_CODE.test(eventCode)) throw new Error("Invalid event code");
    return this.fetch<FTCRankings>(`/rankings/${eventCode}`);
  }

  /**
   * Get events a team is registered for
   */
  async getTeamEvents(teamNumber: number): Promise<{ events: FTCEvent[] }> {
    return this.fetch<{ events: FTCEvent[] }>(
      `/events?teamNumber=${teamNumber}`
    );
  }
}

// Create singleton instance
let apiInstance: FTCEventsAPI | null = null;

export function getFTCApi(): FTCEventsAPI {
  if (!apiInstance) {
    const username = process.env.FTC_API_USERNAME;
    const token = process.env.FTC_API_TOKEN;

    if (!username || !token) {
      throw new Error("FTC API credentials not configured");
    }

    apiInstance = new FTCEventsAPI({ username, token });
  }
  return apiInstance;
}

export { FTCEventsAPI };
