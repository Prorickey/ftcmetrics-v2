import { FTCMetricsApiError } from "../errors";
import { httpGet } from "../http";
import type { ApiResponse } from "../types";

export class EventsClient {
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
      throw new FTCMetricsApiError(
        res.error || "Request failed",
        0,
        path
      );
    }
    return res.data;
  }

  async list() {
    return this.get<Array<{
      code: string;
      name: string;
      city: string;
      stateprov: string;
      country: string;
      dateStart: string;
      dateEnd: string;
      type: string;
    }>>("/events");
  }

  async get_(eventCode: string) {
    return this.get<unknown>(`/events/${eventCode}`);
  }

  async teams(eventCode: string) {
    return this.get<Array<{
      teamNumber: number;
      nameFull: string;
      nameShort: string;
      city: string;
      stateProv: string;
    }>>(`/events/${eventCode}/teams`);
  }

  async schedule(eventCode: string, level: "qual" | "playoff" = "qual") {
    return this.get<unknown>(`/events/${eventCode}/schedule?level=${level}`);
  }

  async matches(eventCode: string, level: "qual" | "playoff" = "qual") {
    return this.get<unknown>(`/events/${eventCode}/matches?level=${level}`);
  }

  async rankings(eventCode: string) {
    return this.get<unknown>(`/events/${eventCode}/rankings`);
  }
}
