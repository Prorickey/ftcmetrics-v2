import { FTCMetricsApiError } from "../errors";
import { httpGet, httpPost } from "../http";
import type {
  ApiResponse,
  EPAResult,
  MatchPrediction,
  OPRResult,
  TeamMatchBreakdown,
} from "../types";

export class AnalyticsClient {
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

  async opr(eventCode: string) {
    return this.get<{
      eventCode: string;
      matchCount: number;
      rankings: OPRResult[];
    }>(`/analytics/opr/${eventCode}`);
  }

  async epa(eventCode: string) {
    return this.get<{
      eventCode: string;
      matchCount: number;
      rankings: EPAResult[];
    }>(`/analytics/epa/${eventCode}`);
  }

  async team(teamNumber: number, opts?: { eventCode?: string }) {
    const params = opts?.eventCode ? `?eventCode=${opts.eventCode}` : "";
    return this.get<{
      teamNumber: number;
      eventCode?: string;
      opr: OPRResult | null;
      epa: EPAResult | null;
    }>(`/analytics/team/${teamNumber}${params}`);
  }

  async predict(data: {
    eventCode: string;
    redTeam1: number;
    redTeam2: number;
    blueTeam1: number;
    blueTeam2: number;
  }) {
    const res = await httpPost<ApiResponse<MatchPrediction>>(
      `${this.baseUrl}/analytics/predict`,
      this.headers,
      data,
      FTCMetricsApiError
    );
    if (!res.success || res.data === undefined) {
      throw new FTCMetricsApiError(res.error || "Request failed", 0, "/analytics/predict");
    }
    return res.data;
  }

  async teamMatches(teamNumber: number, eventCode: string) {
    return this.get<{
      teamNumber: number;
      eventCode: string;
      matches: TeamMatchBreakdown[];
    }>(`/analytics/team/${teamNumber}/matches?eventCode=${encodeURIComponent(eventCode)}`);
  }

  async compare(eventCode: string, teams: number[]) {
    return this.get<{
      eventCode: string;
      teams: Array<{
        teamNumber: number;
        opr: OPRResult | null;
        epa: EPAResult | null;
      }>;
    }>(`/analytics/compare?eventCode=${eventCode}&teams=${teams.join(",")}`);
  }
}
