import { FTCMetricsApiError } from "../errors";
import { httpGet } from "../http";
import type { ApiResponse, EventTeamSummary, TeamProfile } from "../types";

export class TeamsClient {
  constructor(
    private baseUrl: string,
    private headers: Record<string, string>
  ) {}

  private async get<T>(path: string): Promise<T> {
    const res = await httpGet<ApiResponse<T>>(
      `${this.baseUrl}${path}`,
      this.headers,
      FTCMetricsApiError
    );
    if (!res.success || res.data === undefined) {
      throw new FTCMetricsApiError(res.error || "Request failed", 0, path);
    }
    return res.data;
  }

  async get_(teamNumber: number) {
    return this.get<{
      teamNumber: number;
      nameFull: string;
      nameShort: string;
      city: string;
      stateProv: string;
      country: string;
      rookieYear: number;
    }>(`/teams/${teamNumber}`);
  }

  async events(teamNumber: number) {
    return this.get<unknown>(`/teams/${teamNumber}/events`);
  }

  async profile(teamNumber: number) {
    return this.get<TeamProfile | null>(`/teams/${teamNumber}/profile`);
  }

  async eventSummaries(teamNumber: number) {
    return this.get<EventTeamSummary[]>(`/teams/${teamNumber}/event-summaries`);
  }

  async search(query: string) {
    return this.get<Array<{
      teamNumber: number;
      nameShort: string;
      nameFull: string;
      city: string | null;
      stateProv: string | null;
    }>>(`/teams/search?q=${encodeURIComponent(query)}`);
  }
}
