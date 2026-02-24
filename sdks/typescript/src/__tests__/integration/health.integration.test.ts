import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { provision, teardown, API_BASE_URL, fullClient } from "./setup";

beforeAll(provision);
afterAll(teardown);

describe("Health", () => {
  test("API health endpoint returns 200 with database healthy", async () => {
    const res = await fetch(`${API_BASE_URL}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.database).toBe("healthy");
  });

  test("SDK client constructs and is usable", () => {
    expect(fullClient).toBeDefined();
    expect(fullClient.events).toBeDefined();
    expect(fullClient.teams).toBeDefined();
    expect(fullClient.analytics).toBeDefined();
    expect(fullClient.rankings).toBeDefined();
  });
});
