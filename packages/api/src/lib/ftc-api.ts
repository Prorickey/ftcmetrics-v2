/**
 * FTC Events API Client
 *
 * Official API documentation: https://ftc-api.firstinspires.org/
 * Base URL: https://ftc-events.firstinspires.org/api/v2.0
 */

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";
const CURRENT_SEASON = 2025; // DECODE season

interface FTCApiConfig {
  username: string;
  token: string;
}

// API Response Types
export interface FTCEvent {
  eventCode: string;
  name: string;
  districtCode: string | null;
  venue: string;
  address: string;
  city: string;
  stateProv: string;
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

    return response.json();
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
    return this.fetch<{ events: FTCEvent[] }>(`/events?eventCode=${eventCode}`);
  }

  /**
   * Get teams at an event
   */
  async getEventTeams(eventCode: string): Promise<{ teams: FTCTeam[] }> {
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
    return this.fetch<{ matchScores: FTCMatchScore[] }>(
      `/scores/${eventCode}/${tournamentLevel}`
    );
  }

  /**
   * Get team rankings at an event
   */
  async getRankings(eventCode: string): Promise<FTCRankings> {
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
