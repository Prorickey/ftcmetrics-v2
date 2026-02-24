import { FTCMetricsError } from "./errors";

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      return (body as { error: string }).error;
    }
    return JSON.stringify(body);
  } catch {
    try {
      return await response.text();
    } catch {
      return response.statusText;
    }
  }
}

export async function httpGet<T>(
  url: string,
  headers: Record<string, string>,
  ErrorClass: new (message: string, status: number, endpoint: string) => FTCMetricsError & { status: number; endpoint: string }
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new ErrorClass(message, response.status, url);
  }

  return (await response.json()) as T;
}

export async function httpPost<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  ErrorClass: new (message: string, status: number, endpoint: string) => FTCMetricsError & { status: number; endpoint: string }
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new ErrorClass(message, response.status, url);
  }

  return (await response.json()) as T;
}
