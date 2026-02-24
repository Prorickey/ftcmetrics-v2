import { FTCEventsApiError, FTCMetricsConfigError } from "../errors";
import { httpGet } from "../http";
import type {
  FTCEvent,
  FTCMatch,
  FTCMatchScore,
  FTCRankings,
  FTCTeam,
} from "../types";

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0";
const VALID_EVENT_CODE = /^[A-Za-z0-9]+$/;

export class FTCEventsClient {
  private authHeader: string;
  private season: number;

  constructor(credentials: { username: string; token: string }, season: number) {
    if (!credentials.username || !credentials.token) {
      throw new FTCMetricsConfigError(
        "FTC API credentials require both username and token"
      );
    }
    this.authHeader = `Basic ${btoa(`${credentials.username}:${credentials.token}`)}`;
    this.season = season;
  }

  private get headers(): Record<string, string> {
    return { Authorization: this.authHeader };
  }

  private validateEventCode(eventCode: string): void {
    if (!VALID_EVENT_CODE.test(eventCode)) {
      throw new FTCMetricsConfigError(`Invalid event code: ${eventCode}`);
    }
  }

  private url(endpoint: string): string {
    return `${FTC_API_BASE}/${this.season}${endpoint}`;
  }

  async getEvents(): Promise<{ events: FTCEvent[] }> {
    return httpGet(this.url("/events"), this.headers, FTCEventsApiError);
  }

  async getEvent(eventCode: string): Promise<{ events: FTCEvent[] }> {
    this.validateEventCode(eventCode);
    return httpGet(
      this.url(`/events?eventCode=${eventCode}`),
      this.headers,
      FTCEventsApiError
    );
  }

  async getEventTeams(eventCode: string): Promise<{ teams: FTCTeam[] }> {
    this.validateEventCode(eventCode);
    return httpGet(
      this.url(`/teams?eventCode=${eventCode}`),
      this.headers,
      FTCEventsApiError
    );
  }

  async getTeam(teamNumber: number): Promise<{ teams: FTCTeam[] }> {
    return httpGet(
      this.url(`/teams?teamNumber=${teamNumber}`),
      this.headers,
      FTCEventsApiError
    );
  }

  async getSchedule(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ): Promise<{ schedule: FTCMatch[] }> {
    this.validateEventCode(eventCode);
    return httpGet(
      this.url(`/schedule/${eventCode}?tournamentLevel=${tournamentLevel}`),
      this.headers,
      FTCEventsApiError
    );
  }

  async getMatches(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ): Promise<{ matches: FTCMatch[] }> {
    this.validateEventCode(eventCode);
    return httpGet(
      this.url(`/matches/${eventCode}?tournamentLevel=${tournamentLevel}`),
      this.headers,
      FTCEventsApiError
    );
  }

  async getScores(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual"
  ): Promise<{ matchScores: FTCMatchScore[] }> {
    this.validateEventCode(eventCode);
    return httpGet(
      this.url(`/scores/${eventCode}/${tournamentLevel}`),
      this.headers,
      FTCEventsApiError
    );
  }

  async getRankings(eventCode: string): Promise<FTCRankings> {
    this.validateEventCode(eventCode);
    return httpGet(
      this.url(`/rankings/${eventCode}`),
      this.headers,
      FTCEventsApiError
    );
  }

  async getTeamEvents(teamNumber: number): Promise<{ events: FTCEvent[] }> {
    return httpGet(
      this.url(`/events?teamNumber=${teamNumber}`),
      this.headers,
      FTCEventsApiError
    );
  }
}
