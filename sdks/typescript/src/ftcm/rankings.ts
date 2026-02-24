import { FTCMetricsApiError } from "../errors";
import { httpGet } from "../http";
import type {
  ApiResponse,
  GlobalEPARankings,
  RankingFilters,
  TeamRankDetail,
} from "../types";

export class RankingsClient {
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

  async global(opts?: { scope?: string; country?: string; state?: string }) {
    const params = new URLSearchParams();
    if (opts?.scope) params.set("scope", opts.scope);
    if (opts?.country) params.set("country", opts.country);
    if (opts?.state) params.set("state", opts.state);
    const qs = params.toString();
    return this.get<GlobalEPARankings>(`/rankings/epa${qs ? `?${qs}` : ""}`);
  }

  async filters() {
    return this.get<RankingFilters>("/rankings/filters");
  }

  async team(teamNumber: number) {
    return this.get<TeamRankDetail>(`/rankings/team/${teamNumber}`);
  }
}
