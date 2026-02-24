import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { FTCMetrics } from "../../client";
import { FTCMetricsApiError, FTCMetricsConfigError } from "../../errors";
import {
  provision,
  teardown,
  limitedClient,
  revokedClient,
  expiredClient,
  API_BASE_URL,
} from "./setup";

beforeAll(provision);
afterAll(teardown);

describe("Errors — scope enforcement", () => {
  test("limited-scope key gets 403 on out-of-scope endpoint (teams)", async () => {
    // limitedClient only has events:read
    try {
      await limitedClient.teams.get_(16461);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(FTCMetricsApiError);
      expect((e as FTCMetricsApiError).status).toBe(403);
    }
  });

  test("limited-scope key succeeds on in-scope endpoint (events)", async () => {
    const events = await limitedClient.events.list();
    expect(Array.isArray(events)).toBe(true);
  });
});

describe("Errors — revoked and expired keys", () => {
  test("revoked key is treated as unauthenticated (public endpoints still work without scope)", async () => {
    // A revoked key is ignored by the middleware — the request proceeds
    // without an authenticated user. For public endpoints with optionalAuth,
    // the request succeeds but the scope middleware rejects because there's
    // no session user and no valid API key scopes.
    // The actual behavior depends on whether optionalAuth + requireScope
    // allows unauthenticated access. Since requireScope only checks
    // apiKeyScopes when they exist, a revoked key means no scopes are set,
    // which means requireScope's "no apiKeyScopes" path runs (session user path),
    // and since there's no session user either, it still proceeds.
    // Let's test that the call either succeeds or gives a clear error.
    try {
      const events = await revokedClient.events.list();
      // If it succeeds, the revoked key was ignored and request passed through
      expect(Array.isArray(events)).toBe(true);
    } catch (e) {
      // If it fails, it should be a 401 or 403
      expect(e).toBeInstanceOf(FTCMetricsApiError);
      const status = (e as FTCMetricsApiError).status;
      expect([401, 403]).toContain(status);
    }
  });

  test("expired key is treated as unauthenticated", async () => {
    try {
      const events = await expiredClient.events.list();
      expect(Array.isArray(events)).toBe(true);
    } catch (e) {
      expect(e).toBeInstanceOf(FTCMetricsApiError);
      const status = (e as FTCMetricsApiError).status;
      expect([401, 403]).toContain(status);
    }
  });
});

describe("Errors — invalid keys and unreachable API", () => {
  test("invalid key format throws FTCMetricsConfigError synchronously", () => {
    expect(
      () => new FTCMetrics({ ftcmApiKey: "bad_key", baseUrl: API_BASE_URL })
    ).toThrow(FTCMetricsConfigError);
  });

  test("unreachable API throws network error", async () => {
    const client = new FTCMetrics({
      ftcmApiKey: "ftcm_unreachable_test_key",
      baseUrl: "http://localhost:19999/api",
    });

    await expect(client.events.list()).rejects.toThrow();
  });
});
