import { FTCMetricsConfigError } from "./errors";
import { FTCEventsClient } from "./ftc/ftc-events";
import { AnalyticsClient } from "./ftcm/analytics";
import { EventsClient } from "./ftcm/events";
import { RankingsClient } from "./ftcm/rankings";
import { TeamsClient } from "./ftcm/teams";
import type { FTCMetricsConfig } from "./types";

const DEFAULT_BASE_URL = "https://ftcmetrics.com/api";
const DEFAULT_SEASON = 2025;

export class FTCMetrics {
  public readonly events: EventsClient;
  public readonly teams: TeamsClient;
  public readonly analytics: AnalyticsClient;
  public readonly rankings: RankingsClient;
  public readonly ftcApi: FTCEventsClient;

  constructor(config: FTCMetricsConfig = {}) {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const season = config.season ?? DEFAULT_SEASON;

    // Validate API key format if provided
    if (config.ftcmApiKey !== undefined && !config.ftcmApiKey.startsWith("ftcm_")) {
      throw new FTCMetricsConfigError(
        'FTCMetrics API key must start with "ftcm_"'
      );
    }

    // FTCMetrics sub-clients
    const ftcmHeaders: Record<string, string> = {};
    if (config.ftcmApiKey) {
      ftcmHeaders["Authorization"] = `Bearer ${config.ftcmApiKey}`;
    }

    if (config.ftcmApiKey) {
      this.events = new EventsClient(baseUrl, ftcmHeaders);
      this.teams = new TeamsClient(baseUrl, ftcmHeaders);
      this.analytics = new AnalyticsClient(baseUrl, ftcmHeaders);
      this.rankings = new RankingsClient(baseUrl, ftcmHeaders);
    } else {
      const handler: ProxyHandler<object> = {
        get(_target, prop) {
          if (typeof prop === "string" && prop !== "then") {
            return () => {
              throw new FTCMetricsConfigError(
                "FTCMetrics API key is required. Pass ftcmApiKey to the constructor."
              );
            };
          }
        },
      };
      const proxy = new Proxy({}, handler) as EventsClient;
      this.events = proxy;
      this.teams = proxy as unknown as TeamsClient;
      this.analytics = proxy as unknown as AnalyticsClient;
      this.rankings = proxy as unknown as RankingsClient;
    }

    // FTC Events sub-client
    if (config.ftcApiCredentials) {
      this.ftcApi = new FTCEventsClient(config.ftcApiCredentials, season);
    } else {
      const handler: ProxyHandler<object> = {
        get(_target, prop) {
          if (typeof prop === "string" && prop !== "then") {
            return () => {
              throw new FTCMetricsConfigError(
                "FTC API credentials are required. Pass ftcApiCredentials to the constructor."
              );
            };
          }
        },
      };
      this.ftcApi = new Proxy({}, handler) as FTCEventsClient;
    }
  }
}
