export class FTCMetricsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FTCMetricsError";
  }
}

export class FTCMetricsApiError extends FTCMetricsError {
  public readonly status: number;
  public readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "FTCMetricsApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class FTCEventsApiError extends FTCMetricsError {
  public readonly status: number;
  public readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "FTCEventsApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class FTCMetricsConfigError extends FTCMetricsError {
  constructor(message: string) {
    super(message);
    this.name = "FTCMetricsConfigError";
  }
}
