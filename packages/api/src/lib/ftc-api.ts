/**
 * FTC Events API Client — caching wrapper over ftcmetrics SDK
 *
 * Official API documentation: https://ftc-api.firstinspires.org/
 * Base URL: https://ftc-events.firstinspires.org/api/v2.0
 */

import { FTCEventsClient } from "ftcmetrics";
import { getRedis } from "./redis";

// Re-export types from SDK for backward compatibility
export type {
  FTCEvent,
  FTCTeam,
  FTCMatch,
  FTCMatchTeam,
  FTCMatchScore,
  FTCRankings,
} from "ftcmetrics";

const CURRENT_SEASON = 2025; // DECODE season

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

class CachingFTCEventsAPI {
  private sdk: FTCEventsClient;

  constructor(config: { username: string; token: string }) {
    this.sdk = new FTCEventsClient(config, CURRENT_SEASON);
  }

  private async fetchWithCache<T>(
    endpoint: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
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

    // 2. Fetch via SDK
    try {
      const data = await fetcher();

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

  async getEvents() {
    return this.fetchWithCache("/events", () => this.sdk.getEvents());
  }

  async getEvent(eventCode: string) {
    return this.fetchWithCache(`/events?eventCode=${eventCode}`, () =>
      this.sdk.getEvent(eventCode)
    );
  }

  async getEventTeams(eventCode: string) {
    return this.fetchWithCache(`/teams?eventCode=${eventCode}`, () =>
      this.sdk.getEventTeams(eventCode)
    );
  }

  async getTeam(teamNumber: number) {
    return this.fetchWithCache(`/teams?teamNumber=${teamNumber}`, () =>
      this.sdk.getTeam(teamNumber)
    );
  }

  async getSchedule(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ) {
    return this.fetchWithCache(
      `/schedule/${eventCode}?tournamentLevel=${tournamentLevel}`,
      () => this.sdk.getSchedule(eventCode, tournamentLevel)
    );
  }

  async getMatches(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ) {
    return this.fetchWithCache(
      `/matches/${eventCode}?tournamentLevel=${tournamentLevel}`,
      () => this.sdk.getMatches(eventCode, tournamentLevel)
    );
  }

  async getScores(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ) {
    return this.fetchWithCache(
      `/scores/${eventCode}/${tournamentLevel}`,
      () => this.sdk.getScores(eventCode, tournamentLevel)
    );
  }

  async getRankings(eventCode: string) {
    return this.fetchWithCache(`/rankings/${eventCode}`, () =>
      this.sdk.getRankings(eventCode)
    );
  }

  async getTeamEvents(teamNumber: number) {
    return this.fetchWithCache(`/events?teamNumber=${teamNumber}`, () =>
      this.sdk.getTeamEvents(teamNumber)
    );
  }
}

// Create singleton instance
let apiInstance: CachingFTCEventsAPI | null = null;

export function getFTCApi(): CachingFTCEventsAPI {
  if (!apiInstance) {
    const username = process.env.FTC_API_USERNAME;
    const token = process.env.FTC_API_TOKEN;

    if (!username || !token) {
      throw new Error("FTC API credentials not configured");
    }

    apiInstance = new CachingFTCEventsAPI({ username, token });
  }
  return apiInstance;
}

// Export for backward compatibility
export { CachingFTCEventsAPI as FTCEventsAPI };
